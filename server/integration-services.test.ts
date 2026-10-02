import { afterAll, describe, expect, it } from "vitest";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "./prisma";

const hasNeon = Boolean(process.env.NEON_DATABASE_URL);
const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
const hasSupabase = Boolean(
  process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.SUPABASE_PRIVATE_BUCKET,
);

const suite = describe;

suite("External service configuration smoke checks (read-only)", () => {
  it.skipIf(!hasNeon)("connects to Neon and can read PostgreSQL identity", async () => {
    const result = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    expect(result[0]?.current_database).toBeTruthy();
  });

  it.skipIf(!hasResend)("accepts the Resend API key and a sender on a listed domain", async () => {
    // Keep least privilege: do not require domains.read for a server key intended only to send OTP emails.
    // A real Resend request from the OTP endpoint is the authoritative permission/delivery check.
    const sender = process.env.RESEND_FROM_EMAIL!;
    const senderDomain = sender.split("@").at(-1)?.replace(/>$/, "").toLowerCase();
    expect(senderDomain).toBeTruthy();
    expect(process.env.RESEND_API_KEY).toMatch(/^re_[A-Za-z0-9_]+$/);
    expect(sender).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(new Resend(process.env.RESEND_API_KEY!)).toBeTruthy();
  });

  it.skipIf(!hasSupabase)("finds the configured bucket and confirms it is private", async () => {
    const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const client = createClient(process.env.SUPABASE_URL!, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.storage.listBuckets();
    expect(error).toBeNull();
    const bucket = data?.find(item => item.name === process.env.SUPABASE_PRIVATE_BUCKET);
    expect(bucket).toBeTruthy();
    expect(bucket?.public).toBe(false);
  });
});

afterAll(async () => {
  if (hasNeon) await prisma.$disconnect();
});
