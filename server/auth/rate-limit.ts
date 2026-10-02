import { prisma } from "../prisma";
import { EMAIL_RATE_LIMIT, hashScope, IP_RATE_LIMIT, RATE_WINDOW_SECONDS } from "./otp-core";
import { resolveAuthSecret } from "./secret";

async function bumpRateLimit(keyHash: string, limit: number, now: Date): Promise<boolean> {
  const resetBefore = new Date(now.getTime() - RATE_WINDOW_SECONDS * 1000);
  const rows = await prisma.$queryRaw<Array<{ requestCount: number }>>`
    INSERT INTO "OtpRateLimit" ("keyHash", "windowStartedAt", "requestCount", "updatedAt")
    VALUES (${keyHash}, ${now}, 1, ${now})
    ON CONFLICT ("keyHash") DO UPDATE SET
      "requestCount" = CASE
        WHEN "OtpRateLimit"."windowStartedAt" <= ${resetBefore} THEN 1
        ELSE "OtpRateLimit"."requestCount" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "OtpRateLimit"."windowStartedAt" <= ${resetBefore} THEN ${now}
        ELSE "OtpRateLimit"."windowStartedAt"
      END,
      "updatedAt" = ${now}
    RETURNING "requestCount"
  `;
  return (rows[0]?.requestCount ?? limit + 1) <= limit;
}

export async function allowAuthRequest(email: string, ipAddress: string): Promise<boolean> {
  const now = new Date();
  const secret = resolveAuthSecret();
  const ipHash = hashScope(secret, "ip", ipAddress || "unknown");
  const [emailAllowed, ipAllowed] = await Promise.all([
    bumpRateLimit(hashScope(secret, "limit-email", email), EMAIL_RATE_LIMIT, now),
    bumpRateLimit(hashScope(secret, "limit-ip", ipHash), IP_RATE_LIMIT, now),
  ]);
  return emailAllowed && ipAllowed;
}
