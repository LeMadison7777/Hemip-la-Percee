import { PrismaClient } from "@prisma/client";
import { prismaRuntimeUrl } from "./prisma-url";

const globalForPrisma = globalThis as typeof globalThis & {
  hemipPrisma?: PrismaClient;
};

const runtimeDatabaseUrl = prismaRuntimeUrl(process.env.NEON_DATABASE_URL);
export const prisma = globalForPrisma.hemipPrisma ?? new PrismaClient(
  runtimeDatabaseUrl ? { datasources: { db: { url: runtimeDatabaseUrl } } } : undefined,
);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.hemipPrisma = prisma;
}
