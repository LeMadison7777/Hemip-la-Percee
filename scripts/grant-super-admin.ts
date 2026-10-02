import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { normalizeEmail } from "../server/auth/otp-core";
import { prisma } from "../server/prisma";

async function main() {
  const email = normalizeEmail(process.argv[2]);
  if (!email) throw new Error("Usage: pnpm admin:grant-super -- admin@hemip.cg");
  if (!process.env.NEON_DATABASE_URL) throw new Error("NEON_DATABASE_URL doit être défini côté serveur.");
  const current = await prisma.user.findUnique({ where: { email }, select: { isActive: true } });
  if (current && !current.isActive) throw new Error("Ce compte existe mais est désactivé. Réactivez-le par le processus administratif HEMIP avant toute promotion.");

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const confirmation = await rl.question(`Attribuer le rôle super_admin à ${email} ? Tapez exactement cette adresse pour confirmer : `);
    if (confirmation.trim().toLowerCase() !== email) throw new Error("Confirmation différente; aucune modification effectuée.");
  } finally {
    rl.close();
  }

  await prisma.$transaction(async tx => {
    await tx.preEnrolledAccount.upsert({
      where: { email },
      create: { email, role: "super_admin", isActive: true },
      update: { role: "super_admin", isActive: true },
    });
    const user = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await tx.user.update({ where: { id: user.id }, data: { role: "super_admin" } });
    }
  });
  console.log(`Le compte ${email} est autorisé pour le rôle super_admin. La connexion exige toujours son OTP email.`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : "Échec de la promotion.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
