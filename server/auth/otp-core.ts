import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_SECONDS = 180;
export const OTP_DIGITS = 6;
export const OTP_MAX_ATTEMPTS = 5;
export const RATE_WINDOW_SECONDS = 15 * 60;
export const EMAIL_RATE_LIMIT = 3;
export const IP_RATE_LIMIT = 10;

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function hashScope(secret: string, scope: string, value: string): string {
  return createHmac("sha256", secret).update(`${scope}\0${value}`).digest("hex");
}

export function createOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(OTP_DIGITS, "0");
}

export function isOtpFormat(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export function hashOtp(secret: string, emailHash: string, challengeId: string, code: string): string {
  return createHmac("sha256", secret)
    .update(`${emailHash}\0${challengeId}\0${code}`)
    .digest("hex");
}

export function constantTimeHashEquals(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function otpExpiry(from: Date): Date {
  return new Date(from.getTime() + OTP_TTL_SECONDS * 1000);
}
