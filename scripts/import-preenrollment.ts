import "dotenv/config";
import { readFile } from "node:fs/promises";
import { prisma } from "../server/prisma";

const ALLOWED_ROLES = new Set([
  "visitor",
  "student",
  "teacher",
  "payment_manager",
  "academic_admin",
]);
type ImportRole = "visitor" | "student" | "teacher" | "payment_manager" | "academic_admin";

function parseCsv(source: string): Array<{ email: string; role: string }> {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("Le CSV doit contenir un en-tête et au moins une adresse.");
  const headers = lines[0].split(",").map(value => value.trim().toLowerCase());
  if (headers.join(",") !== "email,role") throw new Error("En-tête attendu exactement : email,role");

  return lines.slice(1).map((line, index) => {
    const [rawEmail, rawRole, extra] = line.split(",").map(value => value.trim());
    const email = rawEmail?.toLowerCase();
    const role = rawRole;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Adresse e-mail invalide à la ligne ${index + 2}.`);
    }
    if (extra !== undefined || !role || !ALLOWED_ROLES.has(role)) {
      throw new Error(`Rôle invalide ou colonne supplémentaire à la ligne ${index + 2}.`);
    }
    return { email, role: role as ImportRole };
  });
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: pnpm users:import -- /chemin/privé/preinscriptions.csv");
  if (!process.env.NEON_DATABASE_URL) throw new Error("NEON_DATABASE_URL doit être défini côté serveur.");
  const accounts = parseCsv(await readFile(file, "utf8"));
  const duplicates = accounts.map(account => account.email).filter((email, i, all) => all.indexOf(email) !== i);
  if (duplicates.length) throw new Error("Le CSV contient des adresses en double.");

  for (const account of accounts) {
    const existing = await prisma.preEnrolledAccount.findUnique({ where: { email: account.email } });
    const user = await prisma.user.findUnique({ where: { email: account.email }, select: { role: true } });
    if (user?.role === "super_admin" && account.role !== "super_admin") {
      throw new Error(`La ligne ${account.email} correspond au super-administrateur; import refusé sans option explicite.`);
    }
    await prisma.preEnrolledAccount.upsert({
      where: { email: account.email },
      create: { email: account.email, role: account.role, isActive: true },
      update: { role: account.role, isActive: true },
    });
    if (!existing) console.log(`Préinscription créée pour ${account.email}.`);
    else console.log(`Préinscription mise à jour pour ${account.email}.`);
  }
  console.log(`${accounts.length} adresse(s) traitée(s). Le CSV n’est pas copié dans le projet.`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : "Échec de l’import de préinscriptions.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
