import { afterEach, describe, expect, it } from "vitest";
import { resolveAuthSecret } from "./secret";

const previousAuthSecret = process.env.AUTH_SECRET;
const previousJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (previousAuthSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = previousAuthSecret;
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
});

describe("Auth.js secret resolution", () => {
  it("uses a dedicated valid deployment secret", () => {
    process.env.AUTH_SECRET = "dedicated-authjs-secret-with-more-than-32-characters";
    expect(resolveAuthSecret()).toBe(process.env.AUTH_SECRET);
  });

  it("requires AUTH_SECRET and does not inherit a hosting-platform secret", () => {
    delete process.env.AUTH_SECRET;
    process.env.JWT_SECRET = "platform-server-secret-that-is-long-enough-123456";
    expect(resolveAuthSecret()).toBe("");
  });

  it("rejects a short AUTH_SECRET", () => {
    process.env.AUTH_SECRET = "short";
    expect(resolveAuthSecret()).toBe("");
  });
});
