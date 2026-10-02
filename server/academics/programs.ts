import { prisma } from "../prisma";

// These codes are the HEMIP formations already shown in the public catalogue.
const PUBLIC_PROGRAM_CODES = ["MRH", "GFC", "BFA", "CIT", "DAE", "LT", "EE", "MI", "AII", "GL", "RT", "GP", "GC", "RP", "ENR"];

export async function getProgramOptions() {
  const [courses, students] = await Promise.all([
    prisma.course.findMany({ distinct: ["programCode"], select: { programCode: true } }),
    prisma.student.findMany({ where: { isActive: true, deletedAt: null }, distinct: ["programCode"], select: { programCode: true } }),
  ]);
  const codes = new Set(PUBLIC_PROGRAM_CODES);
  for (const row of [...courses, ...students]) {
    const code = row.programCode.trim();
    if (code) codes.add(code);
  }
  return Array.from(codes).sort((a, b) => a.localeCompare(b)).map(code => ({ code, label: code }));
}

