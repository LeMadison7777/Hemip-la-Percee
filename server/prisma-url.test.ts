import { describe, expect, it } from "vitest";
import { prismaRuntimeUrl } from "./prisma-url";

describe("Prisma runtime pool URL", () => {
  it("bounds the default pool per stateless replica", () => {
    const url = new URL(prismaRuntimeUrl("postgresql://user:pass@host.example/db?sslmode=require")!);
    expect(url.searchParams.get("connection_limit")).toBe("5");
    expect(url.searchParams.get("pool_timeout")).toBe("20");
  });

  it("preserves an explicit pool size", () => {
    const url = new URL(prismaRuntimeUrl("postgresql://user:pass@host.example/db?connection_limit=3")!);
    expect(url.searchParams.get("connection_limit")).toBe("3");
    expect(url.searchParams.get("pool_timeout")).toBe("20");
  });

  it("does not require a Neon URL during source generation", () => {
    expect(prismaRuntimeUrl(undefined)).toBeUndefined();
  });
});
