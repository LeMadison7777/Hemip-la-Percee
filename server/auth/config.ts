import { Prisma } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "@auth/express/providers/credentials";
import Google from "@auth/express/providers/google";
import type { ExpressAuthConfig } from "@auth/express";
import { prisma } from "../prisma";
import { verifyPassword } from "./password";
import { allowAuthRequest } from "./rate-limit";
import { resolveAuthSecret } from "./secret";
import {
  constantTimeHashEquals,
  hashOtp,
  hashScope,
  isOtpFormat,
  normalizeEmail,
  OTP_MAX_ATTEMPTS,
} from "./otp-core";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const AUTH_SECRET = resolveAuthSecret();
const providers: NonNullable<ExpressAuthConfig["providers"]> = [];

if (process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()) {
  providers.push(Google({
    clientId: process.env.GOOGLE_CLIENT_ID.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET.trim(),
    allowDangerousEmailAccountLinking: true,
  }));
}

async function consumeChallenge(
  tx: Prisma.TransactionClient,
  email: string,
  challengeId: string,
  code: string,
  purpose: "email" | "signup-email",
  now: Date,
): Promise<boolean> {
  const identifierHash = hashScope(AUTH_SECRET, purpose, email);
  const challenge = await tx.otpChallenge.findUnique({ where: { id: challengeId } });
  if (
    !challenge || challenge.identifierHash !== identifierHash || challenge.consumedAt !== null ||
    challenge.expiresAt <= now || challenge.attempts >= Math.min(challenge.maxAttempts, OTP_MAX_ATTEMPTS)
  ) return false;

  const candidateHash = hashOtp(AUTH_SECRET, identifierHash, challengeId, code);
  if (!constantTimeHashEquals(challenge.codeHash, candidateHash)) {
    await tx.otpChallenge.updateMany({
      where: {
        id: challengeId,
        identifierHash,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: Math.min(challenge.maxAttempts, OTP_MAX_ATTEMPTS) },
      },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  const consumed = await tx.otpChallenge.updateMany({
    where: {
      id: challengeId,
      identifierHash,
      codeHash: candidateHash,
      consumedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: Math.min(challenge.maxAttempts, OTP_MAX_ATTEMPTS) },
    },
    data: { consumedAt: now },
  });
  return consumed.count === 1;
}

providers.push(Credentials({
  id: "hemip-password",
  name: "HEMIP email and password",
  credentials: {
    email: { label: "E-mail", type: "email" },
    password: { label: "Mot de passe", type: "password" },
  },
  async authorize(credentials, request) {
    const email = normalizeEmail(credentials?.email);
    const password = typeof credentials?.password === "string" ? credentials.password : "";
    if (!email || !password || password.length > 256 || AUTH_SECRET.length < 32) return null;

    try {
      const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const ipAddress = forwardedIp || request.headers.get("x-real-ip") || "unknown";
      if (!await allowAuthRequest(email, ipAddress)) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      const eligible = Boolean(user?.isActive && ["ACTIVE", "PENDING_APPROVAL"].includes(user.registrationStatus));
      if (!eligible || !await verifyPassword(password, user?.passwordHash)) return null;
      return { id: user!.id, email: user!.email, name: user!.name, role: user!.role };
    } catch {
      console.warn("[HEMIP AUTH] Password sign-in failed.");
      return null;
    }
  },
}));

providers.push(Credentials({
  id: "hemip-otp",
  name: "HEMIP email OTP",
  credentials: {
    email: { label: "E-mail", type: "email" },
    challengeId: { label: "OTP challenge" },
    code: { label: "Code OTP", type: "text" },
  },
  async authorize(credentials) {
    const email = normalizeEmail(credentials?.email);
    const challengeId = typeof credentials?.challengeId === "string" ? credentials.challengeId : "";
    const code = credentials?.code;
    if (!email || !challengeId || !isOtpFormat(code) || AUTH_SECRET.length < 32) return null;

    return prisma.$transaction(async tx => {
      const now = new Date();
      const existing = await tx.user.findUnique({ where: { email } });
      const preEnrolled = await tx.preEnrolledAccount.findUnique({ where: { email } });
      if (
        (existing && (!existing.isActive || existing.registrationStatus === "PENDING_EMAIL" || existing.registrationStatus === "REJECTED")) ||
        (!existing && !preEnrolled?.isActive)
      ) return null;

      if (!await consumeChallenge(tx, email, challengeId, code, "email", now)) return null;
      const user = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { emailVerified: now } })
        : await tx.user.create({
            data: {
              email,
              emailVerified: now,
              role: preEnrolled!.role,
              registrationStatus: "ACTIVE",
              isActive: true,
            },
          });
      return { id: user.id, email: user.email, name: user.name, role: user.role };
    });
  },
}));

providers.push(Credentials({
  id: "hemip-signup-otp",
  name: "HEMIP account verification",
  credentials: {
    email: { label: "E-mail", type: "email" },
    challengeId: { label: "Signup challenge" },
    code: { label: "Code OTP", type: "text" },
  },
  async authorize(credentials) {
    const email = normalizeEmail(credentials?.email);
    const challengeId = typeof credentials?.challengeId === "string" ? credentials.challengeId : "";
    const code = credentials?.code;
    if (!email || !challengeId || !isOtpFormat(code) || AUTH_SECRET.length < 32) return null;

    return prisma.$transaction(async tx => {
      const now = new Date();
      const existing = await tx.user.findUnique({ where: { email } });
      if (
        !existing || !existing.isActive || existing.registrationStatus !== "PENDING_EMAIL" ||
        !existing.registrationProfile
      ) return null;
      if (!await consumeChallenge(tx, email, challengeId, code, "signup-email", now)) return null;

      if (existing.registrationProfile === "STUDENT") {
        const programCode = existing.requestedProgramCode?.trim();
        const level = existing.requestedLevel;
        if (!programCode || !level || ![1, 2, 3].includes(level)) return null;
        const student = await tx.student.create({
          data: {
            userId: existing.id,
            programCode,
            level,
            matricule: null,
            academicYear: null,
          },
        });
        await tx.studentFinancialStatus.create({ data: { studentId: student.id } });
        const user = await tx.user.update({
          where: { id: existing.id },
          data: {
            role: "student",
            registrationStatus: "ACTIVE",
            emailVerified: now,
            requestedProgramCode: null,
            requestedLevel: null,
          },
        });
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      }

      const user = await tx.user.update({
        where: { id: existing.id },
        data: { role: "visitor", registrationStatus: "PENDING_APPROVAL", emailVerified: now },
      });
      await tx.preEnrolledAccount.deleteMany({ where: { email } });
      return { id: user.id, email: user.email, name: user.name, role: user.role };
    });
  },
}));

export const authConfig: ExpressAuthConfig = {
  basePath: "/auth",
  secret: AUTH_SECRET,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  pages: { signIn: "/auth" },
  session: { strategy: "jwt", maxAge: SESSION_TTL_SECONDS },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const googleUser = user as typeof user & { emailVerified?: Date | null };
      if (!googleUser.email || !googleUser.emailVerified || !googleUser.id) return false;
      const record = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isActive: true, registrationStatus: true },
      });
      return Boolean(
        record?.isActive &&
        record.registrationStatus !== "PENDING_EMAIL" &&
        record.registrationStatus !== "REJECTED"
      );
    },
    async jwt({ token, user }) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const tokenState = token as typeof token & {
        hemipRole?: string;
        hemipAuthAt?: number;
        hemipRegistrationStatus?: string;
        hemipRegistrationProfile?: string | null;
      };
      if (user) {
        const authUser = user as typeof user & { role?: string };
        tokenState.hemipRole = authUser.role ?? "visitor";
        tokenState.hemipAuthAt = nowSeconds;
      }
      if (!token.sub || !tokenState.hemipAuthAt || !tokenState.hemipRole || AUTH_SECRET.length < 32) return null;

      const userRecord = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { id: true, email: true, role: true, isActive: true, registrationStatus: true, registrationProfile: true },
      });
      if (
        !userRecord?.isActive || !userRecord.email ||
        userRecord.registrationStatus === "PENDING_EMAIL" || userRecord.registrationStatus === "REJECTED"
      ) return null;
      if (userRecord.role !== tokenState.hemipRole) {
        if (tokenState.hemipRole !== "visitor" || userRecord.registrationStatus !== "ACTIVE") return null;
        tokenState.hemipRole = userRecord.role;
      }
      if (nowSeconds - tokenState.hemipAuthAt >= SESSION_TTL_SECONDS) return null;

      tokenState.hemipRegistrationStatus = userRecord.registrationStatus;
      tokenState.hemipRegistrationProfile = userRecord.registrationProfile;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as typeof session.user & {
          id: string;
          role: string;
          registrationStatus: string;
          registrationProfile: string | null;
        };
        const state = token as typeof token & {
          hemipRole?: string;
          hemipRegistrationStatus?: string;
          hemipRegistrationProfile?: string | null;
        };
        sessionUser.id = String(token.sub ?? "");
        sessionUser.role = String(state.hemipRole ?? "visitor");
        sessionUser.registrationStatus = String(state.hemipRegistrationStatus ?? "ACTIVE");
        sessionUser.registrationProfile = state.hemipRegistrationProfile ?? null;
      }
      return session;
    },
  },
};
