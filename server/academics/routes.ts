import type { Express, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { getAuthenticatedHemipUser } from "../auth/routes";
import { getProgramOptions } from "./programs";
import { prisma } from "../prisma";
import { getVapidPublicKey, notifyUsers } from "../notifications/web-push";

const SCHEDULE_ROLES = ["academic_admin", "super_admin"];
const EVALUATION_ROLES = ["evaluation_manager", "super_admin"];

class AcademicWorkflowError extends Error {
  constructor(readonly code: string) { super(code); }
}

function sameOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = (req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host") || "").toLowerCase();
    return parsed.host.toLowerCase() === host && (
      parsed.protocol === "https:" || (parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host))
    );
  } catch {
    return false;
  }
}

async function requireRoles(req: Request, res: Response, roles: string[]) {
  if (req.method !== "GET" && !sameOrigin(req)) {
    res.status(403).json({ message: "Origine de la requête refusée." });
    return null;
  }
  const user = await getAuthenticatedHemipUser(req);
  if (!user) {
    res.status(401).json({ message: "Connexion HEMIP requise." });
    return null;
  }
  if (!roles.includes(user.role)) {
    res.status(403).json({ message: "Ce compte n’a pas les droits nécessaires." });
    return null;
  }
  return user;
}

function text(input: unknown, min = 1, max = 120): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value.length >= min && value.length <= max ? value : null;
}

function parseTime(value: unknown, weekday: number): Date | null {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  const dayOffset = weekday === 0 ? 6 : weekday - 1;
  return new Date(Date.UTC(2024, 0, 1 + dayOffset, hour, minute));
}

async function assignedCourse(courseId: string, teacherId: string) {
  return prisma.course.findFirst({
    where: {
      id: courseId,
      OR: [
        { teacherId },
        { scheduleSlots: { some: { teacherId, isActive: true, isPublished: true } } },
      ],
    },
    include: { scheduleSlots: { where: { teacherId, isActive: true, isPublished: true }, select: { cohort: true } } },
  });
}

function teacherStudentScope(
  course: NonNullable<Awaited<ReturnType<typeof assignedCourse>>>,
  teacherId: string,
): Prisma.StudentWhereInput {
  if (course.teacherId === teacherId || course.scheduleSlots.some(slot => slot.cohort === null)) return {};
  return { cohort: { in: course.scheduleSlots.map(slot => slot.cohort).filter((cohort): cohort is string => Boolean(cohort)) } };
}

export function registerAcademicRoutes(app: Express): void {
  app.get("/api/academics/registration-options", async (_req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ programs: await getProgramOptions(), levels: [1, 2, 3] });
    } catch {
      res.status(503).json({ message: "Le catalogue académique est momentanément indisponible." });
    }
  });

  app.get("/api/academics/catalogue", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, ["teacher", ...SCHEDULE_ROLES, ...EVALUATION_ROLES, "payment_manager"]);
    if (!actor) return;
    try {
      const [courses, teachers, years] = await Promise.all([
        prisma.course.findMany({
          orderBy: [{ programCode: "asc" }, { level: "asc" }, { code: "asc" }],
          include: { teacher: { include: { user: { select: { name: true } } } } },
        }),
        actor.role === "academic_admin" || actor.role === "super_admin"
          ? prisma.teacher.findMany({ where: { isActive: true, deletedAt: null }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { name: "asc" } } })
          : Promise.resolve([]),
        prisma.academicYear.findMany({ orderBy: [{ isCurrent: "desc" }, { label: "desc" }], include: { semesters: { orderBy: { startsAt: "asc" } } } }),
      ]);
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ programs: await getProgramOptions(), courses, teachers, academicYears: years });
    } catch {
      res.status(503).json({ message: "Le catalogue académique est momentanément indisponible." });
    }
  });

  app.get("/api/academics/schedule", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, ["student", "teacher", ...SCHEDULE_ROLES]);
    if (!actor) return;
    try {
      let where: Prisma.ScheduleSlotWhereInput = { isActive: true };
      if (actor.role === "student") {
        const student = await prisma.student.findUnique({ where: { userId: actor.id } });
        if (!student || !student.isActive || student.deletedAt) {
          res.status(404).json({ message: "Aucun profil étudiant actif n’est lié à ce compte." });
          return;
        }
        where = {
          isActive: true,
          isPublished: true,
          programCode: student.programCode,
          level: student.level,
          OR: [{ cohort: null }, { cohort: student.cohort ?? null }],
        };
      } else if (actor.role === "teacher") {
        const teacher = await prisma.teacher.findUnique({ where: { userId: actor.id }, select: { id: true, isActive: true, deletedAt: true } });
        if (!teacher || !teacher.isActive || teacher.deletedAt) {
          res.status(404).json({ message: "Aucun profil enseignant actif n’est lié à ce compte." });
          return;
        }
        where = { isActive: true, isPublished: true, teacherId: teacher.id };
      } else if (req.query.published === "true") {
        where.isPublished = true;
      }
      const slots = await prisma.scheduleSlot.findMany({
        where,
        include: {
          course: { select: { id: true, code: true, title: true, coefficient: true, credits: true } },
          teacher: { include: { user: { select: { name: true } } } },
        },
        orderBy: [{ weekday: "asc" }, { startsAt: "asc" }],
      });
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ slots });
    } catch {
      res.status(503).json({ message: "L’emploi du temps est momentanément indisponible." });
    }
  });

  app.get("/api/academics/student/overview", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, ["student"]);
    if (!actor) return;
    try {
      const student = await prisma.student.findUnique({
        where: { userId: actor.id },
        include: {
          user: { select: { name: true, email: true } },
          financialStatus: true,
          debts: { where: { isArchived: false }, orderBy: { dueAt: "asc" } },
          payments: { where: { status: "validated", isArchived: false }, orderBy: { paidAt: "desc" }, take: 10, select: { amount: true, currency: true, paidAt: true, reference: true } },
          resultSummaries: { orderBy: { publishedAt: "desc" }, include: { semester: { select: { label: true } }, academicYear: { select: { label: true } } } },
        },
      });
      if (!student || !student.isActive || student.deletedAt) {
        res.status(404).json({ message: "Aucun profil étudiant actif n’est lié à ce compte." });
        return;
      }
      const [slots, grades, documents] = await Promise.all([
        prisma.scheduleSlot.findMany({
          where: {
            isActive: true, isPublished: true, programCode: student.programCode, level: student.level,
            OR: [{ cohort: null }, { cohort: student.cohort ?? null }],
          },
          include: { course: { select: { code: true, title: true } }, teacher: { include: { user: { select: { name: true } } } } },
          orderBy: [{ weekday: "asc" }, { startsAt: "asc" }],
        }),
        prisma.gradeRecord.findMany({
          where: { studentId: student.id, isPublished: true, status: "PUBLISHED", deletedAt: null },
          include: { course: { select: { code: true, title: true } }, semester: { select: { label: true } }, academicYear: { select: { label: true } } },
          orderBy: [{ academicYearLabel: "desc" }, { semesterLabel: "desc" }, { courseTitle: "asc" }],
        }),
        prisma.storedDocument.findMany({ where: { studentId: student.id }, select: { id: true, originalName: true, documentType: true, reviewStatus: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      ]);
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ student, slots, publishedGrades: grades, publishedResults: student.resultSummaries, documents });
    } catch {
      res.status(503).json({ message: "L’espace étudiant est momentanément indisponible." });
    }
  });

  app.post("/api/academics/courses", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, SCHEDULE_ROLES);
    if (!actor) return;
    const code = text(req.body?.code, 2, 30)?.toUpperCase();
    const title = text(req.body?.title, 3, 140);
    const programCode = text(req.body?.programCode, 2, 30)?.toUpperCase();
    const level = Number(req.body?.level);
    const coefficient = Number(req.body?.coefficient);
    const credits = Number(req.body?.credits);
    const teacherId = typeof req.body?.teacherId === "string" && req.body.teacherId ? req.body.teacherId : null;
    if (!req.is("application/json") || !code || !title || !programCode || ![1, 2, 3].includes(level) || !Number.isFinite(coefficient) || coefficient <= 0 || coefficient > 20 || !Number.isFinite(credits) || credits < 0 || credits > 120) {
      res.status(422).json({ message: "Vérifiez le code, le titre, la filière, le niveau, le coefficient et les crédits." });
      return;
    }
    try {
      if (!(await getProgramOptions()).some(program => program.code === programCode)) {
        res.status(422).json({ message: "Cette filière n’appartient pas au catalogue HEMIP." });
        return;
      }
      if (teacherId && !await prisma.teacher.findFirst({ where: { id: teacherId, isActive: true, deletedAt: null } })) {
        res.status(422).json({ message: "Choisissez un enseignant actif." });
        return;
      }
      const course = await prisma.$transaction(async tx => {
        const created = await tx.course.create({ data: { code, title, programCode, level, coefficient, credits, teacherId } });
        await tx.auditLog.create({
          data: { actorId: actor.id, action: "course.created", entity: "Course", entityId: created.id, after: { code, title, programCode, level, coefficient, credits, teacherId }, payload: { actorRole: actor.role } },
        });
        return created;
      });
      res.status(201).json({ course });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        res.status(409).json({ message: "Ce code existe déjà pour cette filière et ce niveau." });
        return;
      }
      res.status(503).json({ message: "Le cours n’a pas pu être créé." });
    }
  });

  app.post("/api/academics/schedules", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, SCHEDULE_ROLES);
    if (!actor) return;
    const programCode = text(req.body?.programCode, 2, 30)?.toUpperCase();
    const level = Number(req.body?.level);
    const cohort = typeof req.body?.cohort === "string" ? req.body.cohort.trim().slice(0, 80) || null : null;
    const courseId = text(req.body?.courseId, 1, 100);
    const teacherId = typeof req.body?.teacherId === "string" && req.body.teacherId ? req.body.teacherId : null;
    const weekday = Number(req.body?.weekday);
    const start = parseTime(req.body?.startsAt, weekday);
    const end = parseTime(req.body?.endsAt, weekday);
    const room = text(req.body?.room, 1, 80);
    if (!req.is("application/json") || !programCode || ![1, 2, 3].includes(level) || !courseId || !teacherId || !Number.isInteger(weekday) || weekday < 1 || weekday > 6 || !start || !end || end <= start || !room) {
      res.status(422).json({ message: "Vérifiez la filière, le niveau, le cours, le jour, les horaires et la salle." });
      return;
    }
    try {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course || course.programCode !== programCode || course.level !== level) {
        res.status(422).json({ message: "Le cours ne correspond pas à cette filière et ce niveau." });
        return;
      }
      if (teacherId && !await prisma.teacher.findFirst({ where: { id: teacherId, isActive: true, deletedAt: null } })) {
        res.status(422).json({ message: "Choisissez un enseignant actif." });
        return;
      }
      const slot = await prisma.$transaction(async tx => {
        const existing = await tx.scheduleSlot.findMany({ where: { weekday, isActive: true }, select: { id: true, programCode: true, level: true, cohort: true, teacherId: true, room: true, startsAt: true, endsAt: true } });
        const conflict = existing.find(item => {
          const overlaps = item.startsAt < end && start < item.endsAt;
          if (!overlaps) return false;
          const sameGroup = item.programCode === programCode && item.level === level && (!cohort || !item.cohort || item.cohort === cohort);
          const sameTeacher = Boolean(teacherId && item.teacherId === teacherId);
          const sameRoom = Boolean(room && item.room?.toLowerCase() === room.toLowerCase());
          return sameGroup || sameTeacher || sameRoom;
        });
        if (conflict) return { error: "conflict" as const };
        const created = await tx.scheduleSlot.create({
          data: { programCode, level, cohort, courseId, teacherId, weekday, startsAt: start, endsAt: end, room, isActive: true, isPublished: false },
          include: { course: { select: { code: true, title: true } }, teacher: { include: { user: { select: { name: true } } } } },
        });
        await tx.auditLog.create({
          data: { actorId: actor.id, action: "schedule.slot.created", entity: "ScheduleSlot", entityId: created.id, after: { programCode, level, cohort, courseId, teacherId, weekday, room }, payload: { startsAt: start.toISOString(), endsAt: end.toISOString() } },
        });
        return { slot: created };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ("error" in slot) {
        res.status(409).json({ message: "Conflit d’horaire : vérifiez la salle, l’enseignant et le groupe." });
        return;
      }
      res.status(201).json(slot);
    } catch {
      res.status(503).json({ message: "Le créneau n’a pas pu être enregistré." });
    }
  });

  app.post("/api/academics/schedules/publish", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, SCHEDULE_ROLES);
    if (!actor) return;
    const programCode = text(req.body?.programCode, 2, 30)?.toUpperCase();
    const level = Number(req.body?.level);
    const hasCohort = Object.prototype.hasOwnProperty.call(req.body ?? {}, "cohort");
    const cohort = typeof req.body?.cohort === "string" ? req.body.cohort.trim() || null : null;
    if (!req.is("application/json") || !programCode || ![1, 2, 3].includes(level)) {
      res.status(422).json({ message: "Choisissez une filière et un niveau à publier." });
      return;
    }
    try {
      const result = await prisma.$transaction(async tx => {
        const where: Prisma.ScheduleSlotWhereInput = { programCode, level, isActive: true, isPublished: false };
        if (hasCohort) where.cohort = cohort;
        const slots = await tx.scheduleSlot.findMany({ where, select: { id: true, courseId: true, teacherId: true, weekday: true, room: true, startsAt: true, endsAt: true, cohort: true } });
        if (!slots.length) return { error: "empty" as const };
        const published = await tx.scheduleSlot.updateMany({ where: { id: { in: slots.map(slot => slot.id) } }, data: { isPublished: true, publishedAt: new Date(), publishedById: actor.id } });
        await tx.auditLog.create({ data: { actorId: actor.id, action: "schedule.published", entity: "ScheduleSlot", after: { programCode, level, cohort, count: published.count }, payload: { slotIds: slots.map(slot => slot.id) } } });
        const teacherIds = Array.from(new Set(slots.map(slot => slot.teacherId).filter((id): id is string => Boolean(id))));
        const [students, teachers] = await Promise.all([
          tx.student.findMany({ where: { programCode, level, isActive: true, deletedAt: null, ...(cohort ? { cohort } : {}) }, select: { userId: true } }),
          teacherIds.length ? tx.teacher.findMany({ where: { id: { in: teacherIds }, isActive: true, deletedAt: null }, select: { userId: true } }) : Promise.resolve([]),
        ]);
        return { count: published.count, userIds: Array.from(new Set([...students.map(student => student.userId), ...teachers.map(teacher => teacher.userId)])) };
      });
      if ("error" in result) {
        res.status(409).json({ message: "Aucun créneau brouillon ne correspond à cette filière et ce niveau." });
        return;
      }
      const push = await notifyUsers({
        userIds: result.userIds,
        title: "Emploi du temps publié",
        body: `${programCode} · L${level}${cohort ? ` · ${cohort}` : ""} : votre planning est disponible.`,
        url: "/annonces",
        tag: `hemip-schedule-${programCode}-${level}-${cohort ?? "all"}`,
      }).catch(() => ({ configured: Boolean(getVapidPublicKey()), delivered: 0, removed: 0, failed: 1 }));
      res.json({ count: result.count, push });
    } catch {
      res.status(503).json({ message: "Le planning n’a pas pu être publié." });
    }
  });

  app.get("/api/academics/teacher/courses", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, ["teacher"]);
    if (!actor) return;
    try {
      const teacher = await prisma.teacher.findUnique({ where: { userId: actor.id } });
      if (!teacher || !teacher.isActive || teacher.deletedAt) {
        res.status(404).json({ message: "Aucun profil enseignant actif n’est lié à ce compte." });
        return;
      }
      const [courses, semesters] = await Promise.all([
        prisma.course.findMany({
          where: { OR: [{ teacherId: teacher.id }, { scheduleSlots: { some: { teacherId: teacher.id, isActive: true, isPublished: true } } }] },
          orderBy: [{ programCode: "asc" }, { level: "asc" }, { title: "asc" }],
        }),
        prisma.semester.findMany({ where: { academicYear: { isCurrent: true } }, include: { academicYear: { select: { label: true } } }, orderBy: { startsAt: "asc" } }),
      ]);
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ courses, semesters });
    } catch {
      res.status(503).json({ message: "Les cours assignés sont momentanément indisponibles." });
    }
  });

  app.get("/api/academics/teacher/gradebook", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, ["teacher"]);
    if (!actor) return;
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : "";
    const semesterId = typeof req.query.semesterId === "string" ? req.query.semesterId : "";
    if (!courseId || !semesterId) {
      res.status(422).json({ message: "Choisissez un cours et un semestre." });
      return;
    }
    try {
      const teacher = await prisma.teacher.findUnique({ where: { userId: actor.id } });
      const course = teacher && await assignedCourse(courseId, teacher.id);
      const semester = await prisma.semester.findUnique({ where: { id: semesterId }, include: { academicYear: { select: { label: true } } } });
      if (!teacher || !course || !semester) {
        res.status(404).json({ message: "Le cours ou le semestre est introuvable pour ce compte." });
        return;
      }
      const students = await prisma.student.findMany({
        where: { programCode: course.programCode, level: course.level, isActive: true, deletedAt: null, ...teacherStudentScope(course, teacher.id) },
        select: { id: true, matricule: true, user: { select: { name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      });
      const grades = students.length ? await prisma.gradeRecord.findMany({ where: { studentId: { in: students.map(student => student.id) }, courseId, semesterId } }) : [];
      const byStudent = new Map(grades.map(grade => [grade.studentId, grade]));
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ course, semester, students: students.map(student => ({ ...student, gradeRecord: byStudent.get(student.id) ?? null })) });
    } catch {
      res.status(503).json({ message: "Le relevé de notes est momentanément indisponible." });
    }
  });

  app.post("/api/academics/teacher/grades/submit", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, ["teacher"]);
    if (!actor) return;
    const courseId = text(req.body?.courseId, 1, 100);
    const semesterId = text(req.body?.semesterId, 1, 100);
    const entries = Array.isArray(req.body?.grades) ? req.body.grades as Array<{ studentId?: unknown; grade?: unknown }> : [];
    if (!req.is("application/json") || !courseId || !semesterId || !entries.length || entries.length > 250) {
      res.status(422).json({ message: "Choisissez un cours, un semestre et au moins une note à transmettre." });
      return;
    }
    const cleanEntries = entries.map(entry => ({ studentId: text(entry.studentId, 1, 100), grade: Number(entry.grade) }));
    if (cleanEntries.some(entry => !entry.studentId || !Number.isFinite(entry.grade) || entry.grade < 0 || entry.grade > 20) || new Set(cleanEntries.map(entry => entry.studentId)).size !== cleanEntries.length) {
      res.status(422).json({ message: "Les notes doivent être comprises entre 0 et 20 et chaque étudiant ne doit apparaître qu’une fois." });
      return;
    }
    try {
      const teacher = await prisma.teacher.findUnique({ where: { userId: actor.id } });
      const course = teacher && await assignedCourse(courseId, teacher.id);
      const semester = await prisma.semester.findUnique({ where: { id: semesterId }, include: { academicYear: true } });
      if (!teacher || !course || !semester) {
        res.status(404).json({ message: "Le cours ou le semestre est introuvable pour ce compte." });
        return;
      }
      const students = await prisma.student.findMany({
        where: { id: { in: cleanEntries.map(entry => entry.studentId!) }, programCode: course.programCode, level: course.level, isActive: true, deletedAt: null, ...teacherStudentScope(course, teacher.id) },
        select: { id: true },
      });
      if (students.length !== cleanEntries.length) {
        res.status(403).json({ message: "Une ou plusieurs notes concernent un étudiant hors de cette classe." });
        return;
      }
      const result = await prisma.$transaction(async tx => {
        const existing = await tx.gradeRecord.findMany({ where: { studentId: { in: students.map(student => student.id) }, courseId, semesterId }, select: { id: true, status: true } });
        if (existing.some(record => record.status === "PUBLISHED" || record.status === "VERIFIED")) return { error: "locked" as const };
        const now = new Date();
        for (const entry of cleanEntries) {
          await tx.gradeRecord.upsert({
            where: { studentId_courseId_semesterId: { studentId: entry.studentId!, courseId, semesterId } },
            create: {
              studentId: entry.studentId!, courseId, semesterId, academicYearId: semester.academicYearId,
              grade: entry.grade, coefficient: course.coefficient, credit: course.credits,
              courseCode: course.code, courseTitle: course.title, semesterLabel: semester.label,
              academicYearLabel: semester.academicYear.label, workflow: "draft", status: "SUBMITTED",
              enteredById: actor.id, submittedAt: now, isPublished: false, source: "teacher-entry",
            },
            update: {
              grade: entry.grade, coefficient: course.coefficient, credit: course.credits,
              workflow: "draft", status: "SUBMITTED", enteredById: actor.id,
              submittedAt: now, reviewedById: null, reviewedAt: null, reviewNote: null,
              isPublished: false, publishedAt: null,
            },
          });
        }
        await tx.auditLog.create({ data: { actorId: actor.id, action: "grades.submitted", entity: "AcademicResult", after: { courseId, semesterId, count: cleanEntries.length }, payload: { studentIds: cleanEntries.map(entry => entry.studentId) } } });
        return { submitted: cleanEntries.length };
      });
      if ("error" in result) {
        res.status(409).json({ message: "Des notes déjà vérifiées ou publiées ne peuvent pas être modifiées ici." });
        return;
      }
      res.json(result);
    } catch {
      res.status(503).json({ message: "Les notes n’ont pas pu être transmises." });
    }
  });

  app.get("/api/academics/evaluations/queue", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, EVALUATION_ROLES);
    if (!actor) return;
    try {
      const records = await prisma.gradeRecord.findMany({
        where: { status: { in: ["SUBMITTED", "VERIFIED", "CHANGES_REQUESTED"] }, isPublished: false, deletedAt: null },
        include: {
          student: { include: { user: { select: { name: true, email: true } } } },
          course: { select: { code: true, title: true, programCode: true, level: true } },
          semester: { include: { academicYear: { select: { label: true } } } },
          enteredBy: { select: { name: true } },
        },
        orderBy: [{ submittedAt: "asc" }, { courseTitle: "asc" }],
      });
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ records });
    } catch {
      res.status(503).json({ message: "La file des notes transmises est momentanément indisponible." });
    }
  });

  app.post("/api/academics/evaluations/review", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, EVALUATION_ROLES);
    if (!actor) return;
    const ids = Array.isArray(req.body?.gradeIds) ? Array.from(new Set(req.body.gradeIds.filter((id: unknown) => typeof id === "string" && id.length < 120))) as string[] : [];
    const action = req.body?.action;
    const reviewNote = typeof req.body?.reviewNote === "string" ? req.body.reviewNote.trim().slice(0, 1000) : "";
    if (!req.is("application/json") || !ids.length || ids.length > 500 || !["verify", "return"].includes(action)) {
      res.status(422).json({ message: "Sélectionnez les notes et une décision de vérification." });
      return;
    }
    if (action === "return" && reviewNote.length < 3) {
      res.status(422).json({ message: "Indiquez la correction à effectuer avant de retourner les notes." });
      return;
    }
    try {
      const status = action === "verify" ? "VERIFIED" as const : "CHANGES_REQUESTED" as const;
      const result = await prisma.$transaction(async tx => {
        const changed = await tx.gradeRecord.updateMany({
          where: { id: { in: ids }, status: "SUBMITTED", isPublished: false },
          data: { status, workflow: action === "verify" ? "validated" : "draft", reviewedById: actor.id, reviewedAt: new Date(), reviewNote: reviewNote || null },
        });
        if (changed.count !== ids.length) throw new AcademicWorkflowError("stale");
        await tx.auditLog.create({ data: { actorId: actor.id, action: action === "verify" ? "grades.verified" : "grades.returned", entity: "AcademicResult", after: { ids, status }, reason: reviewNote || null, payload: { count: ids.length } } });
        return { updated: changed.count, status };
      });
      if ("error" in result) {
        res.status(409).json({ message: "Certaines notes ne sont plus en attente de vérification. Actualisez la liste." });
        return;
      }
      res.json(result);
    } catch (error) {
      if (error instanceof AcademicWorkflowError) {
        res.status(409).json({ message: "Certaines notes ne sont plus en attente de vérification. Actualisez la liste." });
        return;
      }
      res.status(503).json({ message: "La vérification n’a pas pu être enregistrée." });
    }
  });

  app.post("/api/academics/evaluations/publish", async (req: Request, res: Response) => {
    const actor = await requireRoles(req, res, EVALUATION_ROLES);
    if (!actor) return;
    const ids = Array.isArray(req.body?.gradeIds) ? Array.from(new Set(req.body.gradeIds.filter((id: unknown) => typeof id === "string" && id.length < 120))) as string[] : [];
    const outcomesInput = req.body?.outcomes && typeof req.body.outcomes === "object" ? req.body.outcomes as Record<string, unknown> : {};
    const creditThreshold = Number(req.body?.creditThreshold);
    const policyNote = typeof req.body?.policyNote === "string" ? req.body.policyNote.trim().slice(0, 1000) : "";
    if (!req.is("application/json") || !ids.length || ids.length > 500 || !Number.isFinite(creditThreshold) || creditThreshold < 0 || creditThreshold > 20) {
      res.status(422).json({ message: "Sélectionnez des notes vérifiées et renseignez le seuil de validation des crédits." });
      return;
    }
    try {
      const records = await prisma.gradeRecord.findMany({
        where: { id: { in: ids }, status: "VERIFIED", isPublished: false, grade: { not: null }, deletedAt: null },
        include: { semester: { include: { academicYear: true } } },
      });
      if (records.length !== ids.length) {
        res.status(409).json({ message: "Toutes les notes sélectionnées doivent être vérifiées, complètes et non publiées." });
        return;
      }
      if (new Set(records.map(record => record.semesterId)).size !== 1 || !records[0]?.semesterId) {
        res.status(409).json({ message: "Publiez séparément les notes d’un seul semestre." });
        return;
      }
      const selectedStudentIds = Array.from(new Set(records.map(record => record.studentId)));
      const semesterId = records[0]!.semesterId!;
      const allSemesterRecords = await prisma.gradeRecord.findMany({
        where: { studentId: { in: selectedStudentIds }, semesterId, deletedAt: null },
        select: { id: true, studentId: true, status: true },
      });
      const selectedRecordIds = new Set(ids);
      const batchIsComplete = allSemesterRecords.length === ids.length &&
        allSemesterRecords.every(record => record.status === "VERIFIED" && selectedRecordIds.has(record.id)) &&
        selectedStudentIds.every(studentId => allSemesterRecords.some(record => record.studentId === studentId));
      if (!batchIsComplete) {
        res.status(409).json({ message: "Toutes les notes enregistrées pour ces étudiants et ce semestre doivent être sélectionnées et vérifiées avant la publication." });
        return;
      }
      const grouped = new Map<string, typeof records>();
      for (const record of records) {
        const bucket = grouped.get(record.studentId) ?? [];
        bucket.push(record);
        grouped.set(record.studentId, bucket);
      }
      for (const studentId of Array.from(grouped.keys())) {
        const outcome = outcomesInput[studentId];
        if (!["ADMITTED", "FAILED", "RESIT"].includes(String(outcome))) {
          res.status(422).json({ message: "Attribuez un statut officiel à chaque étudiant avant publication." });
          return;
        }
      }
      const result = await prisma.$transaction(async tx => {
        const changed = await tx.gradeRecord.updateMany({
          where: { id: { in: ids }, status: "VERIFIED", isPublished: false },
          data: { status: "PUBLISHED", workflow: "published", isPublished: true, publishedAt: new Date() },
        });
        if (changed.count !== ids.length) throw new AcademicWorkflowError("stale");
        const studentIds = Array.from(grouped.keys());
        const semesterId = records[0]!.semesterId!;
        const existingSummaries = await tx.resultSummary.findMany({ where: { studentId: { in: studentIds }, semesterId }, select: { studentId: true } });
        if (existingSummaries.length) throw new AcademicWorkflowError("already_published");
        const summaries = [];
        for (const [studentId, studentRecords] of Array.from(grouped.entries())) {
          const studentSemesterId = studentRecords[0]!.semesterId!;
          const totalWeight = studentRecords.reduce((sum, record) => sum + Number(record.coefficient), 0);
          if (totalWeight <= 0) throw new AcademicWorkflowError("weight");
          const weightedAverage = studentRecords.reduce((sum, record) => sum + Number(record.grade) * Number(record.coefficient), 0) / totalWeight;
          const creditsTotal = studentRecords.reduce((sum, record) => sum + Number(record.credit), 0);
          const creditsEarned = studentRecords.reduce((sum, record) => sum + (Number(record.grade) >= creditThreshold ? Number(record.credit) : 0), 0);
          const semester = studentRecords[0]!.semester!;
          const summary = await tx.resultSummary.create({
            data: {
              studentId, semesterId: studentSemesterId, academicYearId: semester.academicYearId,
              academicYearLabel: semester.academicYear.label, semesterLabel: semester.label,
              weightedAverage: Math.round(weightedAverage * 100) / 100,
              creditsEarned, creditsTotal,
              outcome: String(outcomesInput[studentId]) as "ADMITTED" | "FAILED" | "RESIT",
              policyNote: policyNote || null,
              publishedById: actor.id,
            },
          });
          summaries.push(summary);
        }
        const recipients = await tx.student.findMany({ where: { id: { in: studentIds }, isActive: true, deletedAt: null }, select: { userId: true } });
        await tx.auditLog.create({ data: { actorId: actor.id, action: "results.published", entity: "ResultSummary", after: { summaryIds: summaries.map(summary => summary.id), count: ids.length }, reason: policyNote || null, payload: { gradeIds: ids, creditThreshold } } });
        return { publishedGrades: changed.count, summaries, userIds: recipients.map(student => student.userId) };
      });
      const push = await notifyUsers({
        userIds: result.userIds,
        title: "Résultats publiés",
        body: "Vos résultats officiels HEMIP sont disponibles dans votre espace étudiant.",
        url: "/student/dashboard",
        tag: `hemip-results-${records[0]!.semesterId}`,
      }).catch(() => ({ configured: Boolean(getVapidPublicKey()), delivered: 0, removed: 0, failed: 1 }));
      res.json({ publishedGrades: result.publishedGrades, summaries: result.summaries, push });
    } catch (error) {
      if (error instanceof AcademicWorkflowError) {
        const messages: Record<string, string> = {
          already_published: "Un relevé officiel existe déjà pour un étudiant et ce semestre.",
          weight: "Les coefficients doivent être positifs pour calculer une moyenne.",
          stale: "La file a changé. Actualisez avant de publier.",
        };
        res.status(409).json({ message: messages[error.code] ?? "Publication impossible." });
        return;
      }
      res.status(503).json({ message: "Les résultats n’ont pas pu être publiés." });
    }
  });
}

