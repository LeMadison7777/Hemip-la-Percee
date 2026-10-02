import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: string, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(Buffer.from(key));
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const key = await derive(password, salt, SCRYPT_OPTIONS.N, SCRYPT_OPTIONS.r, SCRYPT_OPTIONS.p);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined): Promise<boolean> {
  if (!encoded || password.length > 256) return false;
  const [algorithm, nText, rText, pText, salt, keyText, ...extra] = encoded.split("$");
  const n = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (
    algorithm !== "scrypt" || extra.length || !salt || !keyText ||
    !Number.isSafeInteger(n) || n < 16_384 || n > 65_536 ||
    !Number.isSafeInteger(r) || r < 1 || r > 16 ||
    !Number.isSafeInteger(p) || p < 1 || p > 4
  ) return false;

  try {
    const expected = Buffer.from(keyText, "base64url");
    const actual = await derive(password, salt, n, r, p);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

