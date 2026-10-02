import { randomUUID } from "node:crypto";
import { Express, Request, Response } from "express";
import { ExpressAuth, getSession } from "@auth/express";
import { Resend } from "resend";
import { prisma } from "../prisma";
import { authConfig } from "./config";
import {
  createOtp,
  hashOtp,
  hashScope,
  normalizeEmail,
  otpExpiry,
  RATE_WINDOW_SECONDS,
} from "./otp-core";
import { resolveAuthSecret } from "./secret";
import { hashPassword, verifyPassword } from "./password";
import { allowAuthRequest } from "./rate-limit";
import { getProgramOptions } from "../academics/programs";

const GENERIC_REQUEST_MESSAGE = "Si cette adresse est préenregistrée par HEMIP, un code lui sera envoyé.";
const ROLE_VALUES = new Set(["visitor", "student", "teacher", "payment_manager", "academic_admin", "evaluation_manager", "super_admin"]);
const REGISTRATION_PROFILES = new Set(["student", "teacher", "administrative"]);

export type AuthenticatedHemipUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  registrationStatus: string;
  registrationProfile: string | null;
};

function authConfigured(): boolean {
  return Boolean(resolveAuthSecret().length >= 32 && process.env.NEON_DATABASE_URL);
}

function emailDeliveryConfigured(): boolean {
  return Boolean(authConfigured() && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function sameOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = (forwardedHost || req.get("host") || "").toLowerCase();
    const allowedProtocol = parsed.protocol === "https:" || (parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestHost));
    return allowedProtocol && parsed.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

async function issueOtp(email: string, purpose: "email" | "signup-email", req: Request, limitsChecked = false): Promise<{ challengeId: string | null; limited: boolean }> {
  const now = new Date();
  const secret = resolveAuthSecret();
  const identifierHash = hashScope(secret, purpose, email);
  const ipHash = hashScope(secret, "ip", req.ip || "unknown");
  if (!limitsChecked && !await allowAuthRequest(email, req.ip || "unknown")) return { challengeId: null, limited: true };

  await prisma.otpChallenge.updateMany({
    where: { identifierHash, consumedAt: null },
    data: { consumedAt: now },
  });
  const code = createOtp();
  const challengeId = randomUUID();
  await prisma.otpChallenge.create({
    data: {
      id: challengeId,
      identifierHash,
      codeHash: hashOtp(secret, identifierHash, challengeId, code),
      expiresAt: otpExpiry(now),
      maxAttempts: 5,
      requestIpHash: ipHash,
    },
  });

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: purpose === "signup-email" ? "Vérifiez votre adresse HEMIP" : "Votre code de connexion HEMIP",
    html: emailHtml(code),
    text: `Votre code HEMIP est ${code}. Il expire dans 3 minutes et ne peut être utilisé qu’une fois.`,
  });
  if (result.error) {
    await prisma.otpChallenge.updateMany({ where: { id: challengeId, consumedAt: null }, data: { consumedAt: new Date() } });
    return { challengeId: null, limited: false };
  }
  return { challengeId, limited: false };
}

function emailHtml(code: string): string {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><body style="margin:0;background:#f4f7f8;font-family:Arial,sans-serif;color:#172b34"><main style="max-width:520px;margin:32px auto;padding:32px;background:#fff;border:1px solid #e5ecef;border-radius:14px"><p style="color:#0d84bf;font-weight:700;letter-spacing:.08em">HEMIP · LA PERCÉE</p><h1 style="font-size:22px">Votre code de connexion</h1><p>Utilisez ce code à six chiffres pour accéder à votre espace HEMIP :</p><p style="font-size:34px;letter-spacing:.28em;font-weight:700;color:#096a99">${code}</p><p>Il expire dans 3 minutes et ne peut être utilisé qu’une fois. Ne le communiquez à personne.</p><p style="color:#75858a;font-size:12px">Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p></main></body></html>`;
}

export async function getAuthenticatedHemipUser(req: Request): Promise<AuthenticatedHemipUser | null> {
  if (!authConfigured()) return null;
  try {
    const session = await getSession(req, authConfig);
    const sessionUser = session?.user as ({ id?: string } & Record<string, unknown>) | undefined;
    if (!sessionUser?.id) return null;
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, registrationStatus: true, registrationProfile: true },
    });
    if (!user?.isActive || !ROLE_VALUES.has(user.role) || user.registrationStatus === "REJECTED" || user.registrationStatus === "PENDING_EMAIL") return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      registrationStatus: user.registrationStatus,
      registrationProfile: user.registrationProfile,
    };
  } catch {
    return null;
  }
}

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/providers", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()) });
  });

  app.get("/api/auth/registration-options", async (_req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ programs: await getProgramOptions(), levels: [1, 2, 3] });
    } catch {
      res.status(503).json({ message: "Le catalogue des formations est momentan\u00e9ment indisponible." });
    }
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    if (!sameOrigin(req)) {
      res.status(403).json({ ok: false, message: "Origine de la requ\u00eate refus\u00e9e." });
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({ ok: false, message: "Format de requ\u00eate non pris en charge." });
      return;
    }
    if (!emailDeliveryConfigured()) {
      res.status(503).json({ ok: false, message: "Le service de cr\u00e9ation de compte est en cours de configuration." });
      return;
    }

    const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const profile = typeof req.body?.profile === "string" ? req.body.profile.toLowerCase() : "";
    const programCode = typeof req.body?.programCode === "string" ? req.body.programCode.trim().toUpperCase() : "";
    const level = Number(req.body?.level);
    if (!email || firstName.length < 2 || firstName.length > 80 || lastName.length < 2 || lastName.length > 80 || !REGISTRATION_PROFILES.has(profile)) {
      res.status(422).json({ ok: false, message: "V\u00e9rifiez votre nom, votre pr\u00e9nom, votre adresse e-mail et votre profil." });
      return;
    }
    if (password.length < 8 || password.length > 256 || password.trim().length < 8) {
      res.status(422).json({ ok: false, message: "Le mot de passe doit contenir au moins 8 caract\u00e8res." });
      return;
    }
    if (profile === "student") {
      if (![1, 2, 3].includes(level)) {
        res.status(422).json({ ok: false, message: "Choisissez un niveau parmi L1, L2 et L3." });
        return;
      }
      const programs = await getProgramOptions();
      if (!programs.some(program => program.code === programCode)) {
        res.status(422).json({ ok: false, message: "Choisissez une fili\u00e8re du catalogue HEMIP." });
        return;
      }
    }

    try {
      if (!await allowAuthRequest(email, req.ip || "unknown")) {
        res.setHeader("Retry-After", String(RATE_WINDOW_SECONDS));
        res.status(429).json({ ok: false, message: "Trop de demandes. R\u00e9essayez dans quelques minutes." });
        return;
      }
      const [existing, reserved] = await Promise.all([
        prisma.user.findUnique({ where: { email } }),
        prisma.preEnrolledAccount.findUnique({ where: { email }, select: { isActive: true, role: true } }),
      ]);
      const matchingPreEnrollment = reserved?.isActive && (
        (reserved.role === "student" && profile === "student") ||
        (reserved.role === "teacher" && profile === "teacher")
      );
      if (reserved?.isActive && !existing && !matchingPreEnrollment) {
        res.json({ ok: true, challengeId: randomUUID(), message: "Cette adresse doit utiliser le parcours de connexion HEMIP." });
        return;
      }
      if (existing) {
        const canResend = existing.registrationStatus === "PENDING_EMAIL" &&
          existing.registrationProfile === profile.toUpperCase() &&
          await verifyPassword(password, existing.passwordHash);
        if (canResend) {
          const issued = await issueOtp(email, "signup-email", req, true);
          if (issued.limited) {
            res.setHeader("Retry-After", String(RATE_WINDOW_SECONDS));
            res.status(429).json({ ok: false, message: "Trop de demandes. R\u00e9essayez dans quelques minutes." });
            return;
          }
          if (issued.challengeId) {
            res.json({ ok: true, challengeId: issued.challengeId, message: "Un code de v\u00e9rification vous a \u00e9t\u00e9 envoy\u00e9." });
            return;
          }
        }
        res.json({ ok: true, challengeId: randomUUID(), message: "Si votre inscription peut \u00eatre confirm\u00e9e, un code vous sera envoy\u00e9." });
        return;
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.$transaction(async tx => {
        const created = await tx.user.create({
          data: {
            name: firstName + " " + lastName,
            email,
            passwordHash,
            role: "visitor",
            registrationStatus: "PENDING_EMAIL",
            registrationProfile: profile.toUpperCase() as "STUDENT" | "TEACHER" | "ADMINISTRATIVE",
            requestedProgramCode: profile === "student" ? programCode : null,
            requestedLevel: profile === "student" ? level : null,
            isActive: true,
          },
          select: { id: true },
        });
        if (matchingPreEnrollment) {
          await tx.preEnrolledAccount.deleteMany({ where: { email } });
        }
        return created;
      });
      const issued = await issueOtp(email, "signup-email", req, true);
      if (issued.limited) {
        await prisma.user.delete({ where: { id: user.id } });
        res.setHeader("Retry-After", String(RATE_WINDOW_SECONDS));
        res.status(429).json({ ok: false, message: "Trop de demandes. R\u00e9essayez dans quelques minutes." });
        return;
      }
      if (!issued.challengeId) {
        res.status(503).json({ ok: false, message: "Impossible d\u2019envoyer le code. R\u00e9essayez dans quelques minutes." });
        return;
      }
      res.status(201).json({ ok: true, challengeId: issued.challengeId, message: "Un code de v\u00e9rification vous a \u00e9t\u00e9 envoy\u00e9." });
    } catch {
      console.warn("[HEMIP SIGNUP] Account setup failed.");
      res.status(503).json({ ok: false, message: "Le service d\u2019inscription est momentan\u00e9ment indisponible." });
    }
  });

  app.post("/api/auth/otp/request", async (req: Request, res: Response) => {
    if (!sameOrigin(req)) {
      res.status(403).json({ ok: false, message: "Origine de la requ\u00eate refus\u00e9e." });
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({ ok: false, message: "Format de requ\u00eate non pris en charge." });
      return;
    }
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      res.status(422).json({ ok: false, message: "Saisissez une adresse e-mail valide." });
      return;
    }
    if (!emailDeliveryConfigured()) {
      res.status(503).json({ ok: false, message: "Le service de connexion HEMIP est en cours de configuration." });
      return;
    }
    try {
      if (!await allowAuthRequest(email, req.ip || "unknown")) {
        res.setHeader("Retry-After", String(RATE_WINDOW_SECONDS));
        res.status(429).json({ ok: false, message: "Trop de demandes. R\u00e9essayez dans quelques minutes." });
        return;
      }
      const [user, allowed] = await Promise.all([
        prisma.user.findUnique({ where: { email }, select: { isActive: true, registrationStatus: true } }),
        prisma.preEnrolledAccount.findUnique({ where: { email }, select: { isActive: true } }),
      ]);
      const eligible = user
        ? user.isActive && ["ACTIVE", "PENDING_APPROVAL"].includes(user.registrationStatus)
        : Boolean(allowed?.isActive);
      if (!eligible) {
        res.status(200).json({ ok: true, challengeId: randomUUID(), message: GENERIC_REQUEST_MESSAGE });
        return;
      }
      const issued = await issueOtp(email, "email", req, true);
      if (issued.limited) {
        res.setHeader("Retry-After", String(RATE_WINDOW_SECONDS));
        res.status(429).json({ ok: false, message: "Trop de demandes. R\u00e9essayez dans quelques minutes." });
        return;
      }
      res.status(200).json({ ok: true, challengeId: issued.challengeId ?? randomUUID(), message: GENERIC_REQUEST_MESSAGE });
    } catch {
      console.warn("[HEMIP OTP] Request processing failed.");
      res.status(200).json({ ok: true, challengeId: randomUUID(), message: GENERIC_REQUEST_MESSAGE });
    }
  });

  app.post("/api/auth/complete-registration", async (req: Request, res: Response) => {
    if (!sameOrigin(req) || !req.is("application/json")) {
      res.status(403).json({ ok: false, message: "Requ\u00eate non autoris\u00e9e." });
      return;
    }
    const authUser = await getAuthenticatedHemipUser(req);
    if (!authUser) {
      res.status(401).json({ ok: false, message: "Connexion HEMIP requise." });
      return;
    }
    if (authUser.role !== "visitor" || authUser.registrationProfile || authUser.registrationStatus !== "ACTIVE") {
      res.status(409).json({ ok: false, message: "Ce profil a d\u00e9j\u00e0 \u00e9t\u00e9 renseign\u00e9." });
      return;
    }
    const profile = typeof req.body?.profile === "string" ? req.body.profile.toLowerCase() : "";
    if (!REGISTRATION_PROFILES.has(profile)) {
      res.status(422).json({ ok: false, message: "Choisissez un profil valide." });
      return;
    }
    const programCode = typeof req.body?.programCode === "string" ? req.body.programCode.trim().toUpperCase() : "";
    const level = Number(req.body?.level);
    if (profile === "student") {
      if (![1, 2, 3].includes(level)) {
        res.status(422).json({ ok: false, message: "Choisissez un niveau parmi L1, L2 et L3." });
        return;
      }
      const programs = await getProgramOptions();
      if (!programs.some(program => program.code === programCode)) {
        res.status(422).json({ ok: false, message: "Choisissez une fili\u00e8re du catalogue HEMIP." });
        return;
      }
    }
    try {
      const registrationProfile = profile.toUpperCase() as "STUDENT" | "TEACHER" | "ADMINISTRATIVE";
      const updated = await prisma.$transaction(async tx => {
        if (profile === "student") {
          const student = await tx.student.create({
            data: { userId: authUser.id, programCode, level, matricule: null, academicYear: null },
          });
          await tx.studentFinancialStatus.create({ data: { studentId: student.id } });
          return tx.user.update({
            where: { id: authUser.id },
            data: { role: "student", registrationProfile, requestedProgramCode: null, requestedLevel: null },
          });
        }
        return tx.user.update({
          where: { id: authUser.id },
          data: { registrationProfile, registrationStatus: "PENDING_APPROVAL", role: "visitor" },
        });
      });
      res.json({ ok: true, registrationStatus: updated.registrationStatus, role: updated.role });
    } catch {
      res.status(503).json({ ok: false, message: "Le profil n\u2019a pas pu \u00eatre enregistr\u00e9." });
    }
  });

  app.get("/api/auth/session", async (req: Request, res: Response) => {
    const user = await getAuthenticatedHemipUser(req);
    res.setHeader("Cache-Control", "no-store, private");
    if (!user) {
      res.status(401).json({ user: null });
      return;
    }
    res.json({ user });
  });

  if (resolveAuthSecret().length >= 32) {
    app.use("/auth/*", ExpressAuth(authConfig));
  } else {
    app.use("/auth/*", (_req, res) => {
      res.status(503).send("Le service d’authentification HEMIP n’est pas encore configuré.");
    });
  }
}
