import type { Express, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { normalizeEmail } from "../auth/otp-core";
import { getAuthenticatedHemipUser } from "../auth/routes";
import { hashPassword } from "../auth/password";
import { prisma } from "../prisma";

const DIRECT_ROLES = new Set(["teacher", "academic_admin", "evaluation_manager", "payment_manager", "super_admin"]);
const ADMIN_STAFF_ROLES = new Set(["academic_admin", "evaluation_manager", "payment_manager"]);
const PRE_ENROLL_ROLES = new Set(["visitor", "student", "teacher", "payment_manager", "academic_admin"]);

function sameOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = (req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host") || "").toLowerCase();
    return parsed.host.toLowerCase() === host && (
      parsed.protocol === "https:" || (parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host))
    );
  } catch {
    return false;
  }
}

async function superAdmin(req: Request, res: Response) {
  if (!sameOrigin(req) && req.method !== "GET") {
    res.status(403).json({ message: "Origine de la requête refusée." });
    return null;
  }
  const user = await getAuthenticatedHemipUser(req);
  if (!user) {
    res.status(401).json({ message: "Connexion HEMIP requise." });
    return null;
  }
  if (user.role !== "super_admin") {
    res.status(403).json({ message: "Cette opération est réservée au Super Admin." });
    return null;
  }
  return user;
}

function requiredText(input: unknown, min: number, max: number): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value.length >= min && value.length <= max ? value : null;
}

export function registerAdminAccountRoutes(app: Express): void {
  app.get("/api/admin/overview", async (req: Request, res: Response) => {
    const actor = await superAdmin(req, res);
    if (!actor) return;
    try {
      const [users, activeUsers, students, teachers, courses, schedules, publishedSchedules, results, payments, debts, announcements, testimonials, documents] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true, registrationStatus: "ACTIVE" } }),
        prisma.student.count({ where: { isActive: true, deletedAt: null } }),
        prisma.teacher.count({ where: { isActive: true, deletedAt: null } }),
        prisma.course.count(),
        prisma.scheduleSlot.count({ where: { isActive: true } }),
        prisma.scheduleSlot.count({ where: { isActive: true, isPublished: true } }),
        prisma.resultSummary.count(),
        prisma.paymentRecord.count({ where: { isArchived: false } }),
        prisma.debtRecord.count({ where: { isArchived: false } }),
        prisma.announcement.count(),
        prisma.testimonial.count(),
        prisma.storedDocument.count(),
      ]);
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ counts: { users, activeUsers, students, teachers, courses, schedules, publishedSchedules, results, payments, debts, announcements, testimonials, documents } });
    } catch {
      res.status(503).json({ message: "La vue globale est momentanément indisponible." });
    }
  });

  app.get("/api/admin/accounts/pending", async (req: Request, res: Response) => {
    const actor = await superAdmin(req, res);
    if (!actor) return;
    try {
      const accounts = await prisma.user.findMany({
        where: { registrationStatus: "PENDING_APPROVAL", registrationProfile: { in: ["TEACHER", "ADMINISTRATIVE"] } },
        select: { id: true, name: true, email: true, registrationProfile: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ accounts });
    } catch {
      res.status(503).json({ message: "Les demandes en attente sont momentanément indisponibles." });
    }
  });

  app.get("/api/admin/accounts", async (req: Request, res: Response) => {
    const actor = await superAdmin(req, res);
    if (!actor) return;
    try {
      const accounts = await prisma.user.findMany({
        orderBy: [{ createdAt: "desc" }, { email: "asc" }],
        select: { id: true, name: true, email: true, role: true, registrationStatus: true, isActive: true, createdAt: true },
      });
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ accounts });
    } catch {
      res.status(503).json({ message: "La liste des comptes est momentanément indisponible." });
    }
  });

  app.post("/api/admin/accounts/:id/access", async (req: Request, res: Response) => {
    const actor = await superAdmin(req, res);
    if (!actor) return;
    const accountId = String(req.params.id);
    const isActive = req.body?.isActive;
    const reason = requiredText(req.body?.reason, 3, 500);
    if (!req.is("application/json") || typeof isActive !== "boolean" || !reason) {
      res.status(422).json({ message: "Choisissez l’état d’accès et indiquez un motif d’au moins 3 caractères." });
      return;
    }
    if (!isActive && accountId === actor.id) {
      res.status(409).json({ message: "Vous ne pouvez pas désactiver votre propre compte Super Admin." });
      return;
    }
    try {
      const result = await prisma.$transaction(async tx => {
        const account = await tx.user.findUnique({ where: { id: accountId }, select: { id: true, role: true, registrationStatus: true, isActive: true } });
        if (!account) return { error: "missing" as const };
        if (account.registrationStatus !== "ACTIVE") return { error: "workflow" as const };
        if (account.isActive === isActive) return { error: "unchanged" as const };
        if (!isActive && account.role === "super_admin") {
          const activeSuperAdmins = await tx.user.count({ where: { role: "super_admin", isActive: true, registrationStatus: "ACTIVE" } });
          if (activeSuperAdmins <= 1) return { error: "last_super_admin" as const };
        }
        const updated = await tx.user.update({ where: { id: account.id }, data: { isActive } });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: isActive ? "account.access.enabled" : "account.access.disabled",
            entity: "User",
            entityId: account.id,
            reason,
            before: { isActive: account.isActive, role: account.role },
            after: { isActive: updated.isActive, role: updated.role },
            payload: {},
          },
        });
        return { account: { id: updated.id, isActive: updated.isActive } };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ("error" in result) {
        const messages: Record<string, string> = {
          missing: "Compte introuvable.",
          workflow: "Les comptes en attente ou refusés doivent suivre leur procédure d’inscription.",
          unchanged: "Cet état d’accès est déjà appliqué.",
          last_super_admin: "Au moins un autre compte Super Admin actif doit rester disponible.",
        };
        const errorCode = result.error ?? "unknown";
        res.status(errorCode === "missing" ? 404 : 409).json({ message: messages[errorCode] ?? "La modification d’accès a été refusée." });
        return;
      }
      res.json(result);
    } catch {
      res.status(503).json({ message: "La modification d’accès n’a pas pu être enregistrée." });
    }
  });

  app.post("/api/admin/accounts/:id/decision", async (req: Request, res: Response) => {
    const actor = await superAdmin(req, res);
    if (!actor) return;
    const decision = req.body?.decision;
    const accountId = String(req.params.id);
    if (!req.is("application/json") || !["approve", "reject"].includes(decision)) {
      res.status(422).json({ message: "Décision invalide." });
      return;
    }
    try {
      const result = await prisma.$transaction(async tx => {
        const account = await tx.user.findUnique({ where: { id: accountId } });
        if (!account || account.registrationStatus !== "PENDING_APPROVAL" || !account.registrationProfile) return { error: "not_pending" as const };
        if (decision === "reject") {
          await tx.user.update({ where: { id: account.id }, data: { registrationStatus: "REJECTED", isActive: false } });
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              action: "account.registration.rejected",
              entity: "User",
              entityId: account.id,
              reason: requiredText(req.body?.reason, 3, 500),
              before: { registrationStatus: account.registrationStatus, role: account.role },
              after: { registrationStatus: "REJECTED", isActive: false },
              payload: { registrationProfile: account.registrationProfile },
            },
          });
          return { status: "REJECTED" as const };
        }

        let assignedRole: "teacher" | "academic_admin" | "evaluation_manager" | "payment_manager";
        if (account.registrationProfile === "TEACHER") {
          assignedRole = "teacher";
        } else {
          const selected = typeof req.body?.assignedRole === "string" ? req.body.assignedRole : "";
          if (!ADMIN_STAFF_ROLES.has(selected)) return { error: "role_required" as const };
          assignedRole = selected as typeof assignedRole;
        }
        const existingTeacher = assignedRole === "teacher"
          ? await tx.teacher.findUnique({ where: { userId: account.id } })
          : null;
        const employeeCode = requiredText(req.body?.employeeCode, 2, 40);
        const department = requiredText(req.body?.department, 2, 100);
        if (assignedRole === "teacher" && !existingTeacher && (!employeeCode || !department)) {
          return { error: "teacher_details_required" as const };
        }
        const updated = await tx.user.update({
          where: { id: account.id },
          data: { role: assignedRole, registrationStatus: "ACTIVE", isActive: true },
        });
        if (assignedRole === "teacher" && !existingTeacher) {
          await tx.teacher.create({
            data: { userId: account.id, employeeCode: employeeCode!, department: department!, legacyCourses: [] },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "account.registration.approved",
            entity: "User",
            entityId: account.id,
            reason: requiredText(req.body?.reason, 3, 500),
            before: { registrationStatus: account.registrationStatus, role: account.role },
            after: { registrationStatus: updated.registrationStatus, role: updated.role },
            payload: { registrationProfile: account.registrationProfile },
          },
        });
        return { status: "ACTIVE" as const, role: updated.role };
      });
      if ("error" in result) {
        const status = result.error === "not_pending" ? 404 : 422;
        const message = result.error === "not_pending" ? "Cette demande n’est plus en attente." :
          result.error === "teacher_details_required" ? "Un matricule employé et un département sont requis pour approuver l’enseignant." :
          "Choisissez le rôle administratif à attribuer.";
        res.status(status).json({ message });
        return;
      }
      res.json(result);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        res.status(409).json({ message: "Ce matricule employé est déjà attribué." });
        return;
      }
      res.status(503).json({ message: "La décision n’a pas pu être enregistrée." });
    }
  });

  app.post("/api/admin/accounts", async (req: Request, res: Response) => {
    const actor = await superAdmin(req, res);
    if (!actor) return;
    if (!req.is("application/json")) {
      res.status(415).json({ message: "Format de requête non pris en charge." });
      return;
    }
    const name = requiredText(req.body?.name, 3, 160);
    const email = normalizeEmail(req.body?.email);
    const role = typeof req.body?.role === "string" ? req.body.role : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const employeeCode = requiredText(req.body?.employeeCode, 2, 40);
    const department = requiredText(req.body?.department, 2, 100);
    if (!name || !email || !DIRECT_ROLES.has(role) || (password && (password.length < 8 || password.length > 256))) {
      res.status(422).json({ message: "Vérifiez le nom, l’adresse e-mail, le rôle et le mot de passe (8 caractères minimum)." });
      return;
    }
    if (role === "teacher" && (!employeeCode || !department)) {
      res.status(422).json({ message: "Un matricule employé et un département sont requis pour créer un enseignant." });
      return;
    }
    try {
      const passwordHash = password ? await hashPassword(password) : null;
      const user = await prisma.$transaction(async tx => {
        const created = await tx.user.create({
          data: {
            name,
            email,
            role: role as "teacher" | "academic_admin" | "evaluation_manager" | "payment_manager" | "super_admin",
            registrationStatus: "ACTIVE",
            registrationProfile: role === "teacher" ? "TEACHER" : "ADMINISTRATIVE",
            passwordHash,
            isActive: true,
          },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        if (role === "teacher") {
          await tx.teacher.create({ data: { userId: created.id, employeeCode: employeeCode!, department: department!, legacyCourses: [] } });
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "account.created_by_super_admin",
            entity: "User",
            entityId: created.id,
            after: { role: created.role, email: created.email },
            payload: { registrationProfile: role === "teacher" ? "TEACHER" : "ADMINISTRATIVE" },
          },
        });
        return created;
      });
      res.status(201).json({ account: user });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        res.status(409).json({ message: "Cette adresse ou ce matricule employé est déjà utilisé." });
        return;
      }
      res.status(503).json({ message: "Le compte n’a pas pu être créé." });
    }
  });

  app.post("/api/admin/accounts/pre-enroll/import", async (req: Request, res: Response) => {
    const actor = await superAdmin(req, res);
    if (!actor) return;
    if (!req.is("application/json")) {
      res.status(415).json({ message: "Format de requête non pris en charge." });
      return;
    }
    const input = req.body?.accounts;
    if (!Array.isArray(input) || input.length < 1 || input.length > 1000) {
      res.status(422).json({ message: "Importez entre 1 et 1 000 adresses valides." });
      return;
    }
    const accounts: Array<{ email: string; role: string }> = [];
    for (let index = 0; index < input.length; index += 1) {
      const row = input[index] as { email?: unknown; role?: unknown } | null;
      const email = normalizeEmail(row?.email);
      const role = typeof row?.role === "string" ? row.role : "";
      if (!email || !PRE_ENROLL_ROLES.has(role)) {
        res.status(422).json({ message: `Adresse ou rôle invalide à la ligne ${index + 2}.` });
        return;
      }
      accounts.push({ email, role });
    }
    const duplicateEmails = accounts.map(account => account.email).filter((email, index, all) => all.indexOf(email) !== index);
    if (duplicateEmails.length) {
      res.status(422).json({ message: "Le fichier contient des adresses en double." });
      return;
    }

    try {
      const result = await prisma.$transaction(async tx => {
        const existingUsers = await tx.user.findMany({
          where: { email: { in: accounts.map(account => account.email) } },
          select: { email: true },
        });
        if (existingUsers.length) return { error: "existing_users" as const, emails: existingUsers.map(user => user.email) };

        const existingReservations = await tx.preEnrolledAccount.findMany({
          where: { email: { in: accounts.map(account => account.email) } },
          select: { email: true },
        });
        const existingEmails = new Set(existingReservations.map(account => account.email));
        for (const account of accounts) {
          await tx.preEnrolledAccount.upsert({
            where: { email: account.email },
            create: { email: account.email, role: account.role as "visitor" | "student" | "teacher" | "payment_manager" | "academic_admin", isActive: true },
            update: { role: account.role as "visitor" | "student" | "teacher" | "payment_manager" | "academic_admin", isActive: true },
          });
        }
        const created = accounts.filter(account => !existingEmails.has(account.email)).length;
        const updated = accounts.length - created;
        const roles = accounts.reduce<Record<string, number>>((counts, account) => {
          counts[account.role] = (counts[account.role] ?? 0) + 1;
          return counts;
        }, {});
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "accounts.pre_enrollment_imported",
            entity: "PreEnrolledAccount",
            after: { count: accounts.length, created, updated, roles },
          },
        });
        return { created, updated };
      });
      if ("error" in result) {
        res.status(409).json({ message: `Certaines adresses ont déjà un compte HEMIP : ${(result.emails ?? []).join(", ")}. L’import ne modifie pas les comptes existants.` });
        return;
      }
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        res.status(409).json({ message: "Une de ces adresses vient d’être utilisée. Actualisez le fichier puis recommencez." });
        return;
      }
      res.status(503).json({ message: "L’import des adresses n’a pas pu être enregistré." });
    }
  });
}

