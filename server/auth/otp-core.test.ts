import { describe, expect, it } from "vitest";
import {
  constantTimeHashEquals,
  createOtp,
  hashOtp,
  hashScope,
  isOtpFormat,
  normalizeEmail,
  OTP_DIGITS,
  OTP_TTL_SECONDS,
  otpExpiry,
} from "./otp-core";

describe("HEMIP one-time email codes", () => {
  it("normalizes email addresses and rejects invalid input", () => {
    expect(normalizeEmail("  Etudiant@Hemip.cg ")).toBe("etudiant@hemip.cg");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("creates a six-digit string, preserving possible leading zeroes", () => {
    for (let index = 0; index < 100; index += 1) {
      const code = createOtp();
      expect(code).toMatch(/^\d{6}$/);
      expect(code).toHaveLength(OTP_DIGITS);
      expect(isOtpFormat(code)).toBe(true);
    }
    expect(isOtpFormat("12345")).toBe(false);
    expect(isOtpFormat("123456x")).toBe(false);
  });

  it("expires codes after the specified three-minute TTL", () => {
    const now = new Date("2026-09-27T15:00:00.000Z");
    expect(OTP_TTL_SECONDS).toBe(180);
    expect(otpExpiry(now).getTime() - now.getTime()).toBe(180_000);
  });

  it("binds the digest to the email, challenge, and server secret", () => {
    const secret = "test-secret-that-is-long-enough-for-this-unit-test";
    const emailHash = hashScope(secret, "email", "a@hemip.cg");
    const valid = hashOtp(secret, emailHash, "challenge-1", "034198");
    expect(constantTimeHashEquals(valid, hashOtp(secret, emailHash, "challenge-1", "034198"))).toBe(true);
    expect(constantTimeHashEquals(valid, hashOtp(secret, emailHash, "challenge-1", "034199"))).toBe(false);
    expect(constantTimeHashEquals(valid, hashOtp(secret, emailHash, "challenge-2", "034198"))).toBe(false);
    expect(constantTimeHashEquals(valid, hashOtp("another-secret-long-enough", emailHash, "challenge-1", "034198"))).toBe(false);
    expect(constantTimeHashEquals("bad", valid)).toBe(false);
  });
});
