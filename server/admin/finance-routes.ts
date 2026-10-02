import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Resend } from "resend";
import { getAuthenticatedHemipUser } from "../auth/routes";
import { prisma } from "../prisma";

const FINANCE_ROLES = ["payment_manager", "super_admin"];

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

async function requireRole(req: Request, res: Response, roles: string[]) {
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

function text(input: unknown, min = 1, max = 180): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return value.length >= min && value.length <= max ? value : null;
}

async function recalculateBalance(tx: Prisma.TransactionClient, studentId: string) {
  const [debts, payments] = await Promise.all([
    tx.debtRecord.findMany({ where: { studentId, isArchived: false }, orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }], select: { id: true, amountDue: true, isSettled: true, settledAt: true } }),
    tx.paymentRecord.aggregate({ where: { studentId, isArchived: false, status: "validated" }, _sum: { amount: true } }),
  ]);
  const due = debts.reduce((sum, debt) => sum + Number(debt.amountDue), 0);
  const paid = Number(payments._sum.amount ?? 0);
  const balanceDue = Math.max(0, Math.round((due - paid) * 100) / 100);
  let unallocated = paid;
  const recalculatedAt = new Date();
  for (const debt of debts) {
    const amount = Number(debt.amountDue);
    const settled = unallocated >= amount;
    unallocated = Math.max(0, unallocated - amount);
    if (settled !== debt.isSettled) {
      await tx.debtRecord.update({ where: { id: debt.id }, data: { isSettled: settled, settledAt: settled ? recalculatedAt : null } });
    }
  }
  await tx.studentFinancialStatus.upsert({
    where: { studentId },
    create: { studentId, balanceDue, clearedForResults: balanceDue === 0, lastRecalculatedAt: new Date() },
    update: { balanceDue, clearedForResults: balanceDue === 0, lastRecalculatedAt: new Date() },
  });
  return balanceDue;
}

export function registerFinanceRoutes(app: Express): void {
  app.get("/api/admin/finance", async (req: Request, res: Response) => {
    const actor = await requireRole(req, res, FINANCE_ROLES);
    if (!actor) return;
    try {
      const [students, pendingPayments, pendingDocuments, feePlans] = await Promise.all([
        prisma.student.findMany({
          where: { isActive: true, deletedAt: null },
          take: 250,
          orderBy: { user: { name: "asc" } },
          include: {
            user: { select: { name: true, email: true } },
            financialStatus: true,
            debts: { where: { isArchived: false }, orderBy: { dueAt: "asc" }, take: 20 },
            payments: { where: { isArchived: false }, orderBy: { createdAt: "desc" }, take: 10 },
          },
        }),
        prisma.paymentRecord.findMany({ where: { status: "pending", isArchived: false }, include: { student: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "asc" }, take: 250 }),
        prisma.storedDocument.findMany({ where: { reviewStatus: "SUBMITTED", studentId: { not: null } }, include: { student: { include: { user: { select: { name: true, email: true } } } }, uploadedBy: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" }, take: 250 }),
        prisma.feePlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      ]);
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ students, pendingPayments, pendingDocuments, feePlans });
    } catch {
      res.status(503).json({ message: "Le tableau financier est momentanément indisponible." });
    }
  });

  app.get("/api/student/finance", async (req: Request, res: Response) => {
    const actor = await requireRole(req, res, ["student"]);
    if (!actor) return;
    try {
      const student = await prisma.student.findUnique({
        where: { userId: actor.id },
        include: {
          financialStatus: true,
          debts: { where: { isArchived: false }, orderBy: { dueAt: "asc" } },
          payments: { where: { isArchived: false }, orderBy: { createdAt: "desc" }, take: 50 },
        },
      });
      if (!student || !student.isActive || student.deletedAt) {
        res.status(404).json({ message: "Aucun profil étudiant actif n’est lié à ce compte." });
        return;
      }
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ financialStatus: student.financialStatus, debts: student.debts, payments: student.payments });
    } catch {
      res.status(503).json({ message: "La situation financière est momentanément indisponible." });
    }
  });

  app.post("/api/admin/students/:id/profile", async (req: Request, res: Response) => {
    const actor = await requireRole(req, res, FINANCE_ROLES);
    if (!actor) return;
    const matricule = text(req.body?.matricule, 2, 40);
    const academicYear = text(req.body?.academicYear, 4, 30);
    const cohort = typeof req.body?.cohort === "string" ? req.body.cohort.trim().slice(0, 80) || null : null;
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim().slice(0, 40) || null : null;
    const dateOfBirth = req.body?.dateOfBirth ? new Date(req.body.dateOfBirth) : null;
    if (!req.is("application/json") || !matricule || !academicYear || (dateOfBirth && Number.isNaN(dateOfBirth.getTime()))) {
      res.status(422).json({ message: "Le matricule et l’année académique sont requis; vérifiez aussi la date de naissance." });
      return;
    }
    try {
      const student = await prisma.$transaction(async tx => {
        const before = await tx.student.findUnique({ where: { id: String(req.params.id) }, select: { id: true, matricule: true, academicYear: true, cohort: true } });
        if (!before) return null;
        const updated = await tx.student.update({ where: { id: before.id }, data: { matricule, academicYear, cohort, phone, dateOfBirth } });
        await tx.auditLog.create({ data: { actorId: actor.id, action: "student.profile.finalized", entity: "StudentProfile", entityId: before.id, before, after: { matricule, academicYear, cohort, phone, dateOfBirth }, payload: {} } });
        return updated;
      });
      if (!student) {
        res.status(404).json({ message: "Profil étudiant introuvable." });
        return;
      }
      res.json({ student: { id: student.id, matricule: student.matricule, academicYear: student.academicYear, cohort: student.cohort } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        res.status(409).json({ message: "Ce matricule est déjà attribué." });
        return;
      }
      res.status(503).json({ message: "Le dossier étudiant n’a pas pu être mis à jour." });
    }
  });

  app.post("/api/admin/debts", async (req: Request, res: Response) => {
    const actor = await requireRole(req, res, FINANCE_ROLES);
    if (!actor) return;
    const studentId = text(req.body?.studentId, 1, 100);
    const description = text(req.body?.description, 3, 180);
    const amountDue = Number(req.body?.amountDue);
    const dueAt = req.body?.dueAt ? new Date(req.body.dueAt) : null;
    const feePlanId = typeof req.body?.feePlanId === "string" && req.body.feePlanId ? req.body.feePlanId : null;
    if (!req.is("application/json") || !studentId || !description || !Number.isFinite(amountDue) || amountDue <= 0 || amountDue > 100_000_000 || (dueAt && Number.isNaN(dueAt.getTime()))) {
      res.status(422).json({ message: "Vérifiez l’étudiant, le libellé, le montant et la date d’échéance." });
      return;
    }
    try {
      const debt = await prisma.$transaction(async tx => {
        const student = await tx.student.findUnique({ where: { id: studentId }, select: { id: true, isActive: true, deletedAt: true } });
        if (!student || !student.isActive || student.deletedAt) return null;
        const created = await tx.debtRecord.create({ data: { studentId, description, amountDue, dueAt, feePlanId } });
        const balanceDue = await recalculateBalance(tx, studentId);
        await tx.auditLog.create({ data: { actorId: actor.id, action: "finance.debt.created", entity: "DebtRecord", entityId: created.id, after: { description, amountDue, dueAt: dueAt?.toISOString() ?? null, studentId, balanceDue }, payload: { feePlanId } } });
        return created;
      });
      if (!debt) {
        res.status(404).json({ message: "Étudiant introuvable ou inactif." });
        return;
      }
      res.status(201).json({ debt });
    } catch {
      res.status(503).json({ message: "La mensualité n’a pas pu être enregistrée." });
    }
  });

  app.post("/api/admin/payments", async (req: Request, res: Response) => {
    const actor = await requireRole(req, res, FINANCE_ROLES);
    if (!actor) return;
    const studentId = text(req.body?.studentId, 1, 100);
    const amount = Number(req.body?.amount);
    const method = typeof req.body?.method === "string" ? req.body.method : "";
    const reference = text(req.body?.reference, 3, 100);
    const feePlanId = typeof req.body?.feePlanId === "string" && req.body.feePlanId ? req.body.feePlanId : null;
    const paidAt = req.body?.paidAt ? new Date(req.body.paidAt) : new Date();
    if (!req.is("application/json") || !studentId || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000 || !["cash", "mobile_money", "bank_transfer", "other"].includes(method) || !reference || Number.isNaN(paidAt.getTime())) {
      res.status(422).json({ message: "Vérifiez l’étudiant, le montant, le mode, la référence et la date." });
      return;
    }
    try {
      const payment = await prisma.$transaction(async tx => {
        const student = await tx.student.findUnique({ where: { id: studentId }, select: { id: true, isActive: true, deletedAt: true } });
        if (!student || !student.isActive || student.deletedAt) return null;
        const created = await tx.paymentRecord.create({
          data: { studentId, feePlanId, amount, currency: "XAF", method: method as "cash" | "mobile_money" | "bank_transfer" | "other", reference, paidAt, status: "pending", validated: false, recordedById: actor.id },
        });
        await tx.auditLog.create({ data: { actorId: actor.id, action: "finance.payment.recorded", entity: "Payment", entityId: created.id, after: { studentId, amount, currency: "XAF", method, reference, status: "pending" }, payload: { feePlanId } } });
        return created;
      });
      if (!payment) {
        res.status(404).json({ message: "Étudiant introuvable ou inactif." });
        return;
      }
      res.status(201).json({ payment });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        res.status(409).json({ message: "Cette référence de paiement existe déjà." });
        return;
      }
      res.status(503).json({ message: "Le paiement n’a pas pu être enregistré." });
    }
  });

  app.post("/api/admin/payments/:id/validate", async (req: Request, res: Response) => {
    const actor = await requireRole(req, res, FINANCE_ROLES);
    if (!actor) return;
    const reason = text(req.body?.reason, 3, 500);
    try {
      const result = await prisma.$transaction(async tx => {
        const payment = await tx.paymentRecord.findUnique({ where: { id: String(req.params.id) } });
        if (!payment || payment.isArchived) return { error: "missing" as const };
        if (payment.status === "validated") return { error: "already" as const };
        const updated = await tx.paymentRecord.update({
          where: { id: payment.id },
          data: { status: "validated", validated: true, validatedById: actor.id, validatedAt: new Date() },
        });
        const balanceDue = await recalculateBalance(tx, payment.studentId);
        await tx.auditLog.create({ data: { actorId: actor.id, action: "finance.payment.validated", entity: "Payment", entityId: payment.id, reason, before: { status: payment.status }, after: { status: updated.status, balanceDue }, payload: {} } });
        return { payment: updated, balanceDue };
      });
      if ("error" in result) {
        res.status(result.error === "missing" ? 404 : 409).json({ message: result.error === "missing" ? "Paiement introuvable." : "Ce paiement est déjà validé." });
        return;
      }
      res.json(result);
    } catch {
      res.status(503).json({ message: "La validation du paiement a échoué." });
    }
  });

  app.post("/api/admin/debts/:id/reminder", async (req: Request, res: Response) => {
    const actor = await requireRole(req, res, FINANCE_ROLES);
    if (!actor) return;
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
      res.status(503).json({ message: "Le service d’envoi des relances n’est pas configuré." });
      return;
    }
    try {
      const debt = await prisma.debtRecord.findUnique({
        where: { id: String(req.params.id) },
        include: { student: { include: { user: { select: { name: true, email: true } } } } },
      });
      if (!debt || debt.isArchived || debt.isSettled) {
        res.status(404).json({ message: "Échéance introuvable ou déjà réglée." });
        return;
      }
      const email = debt.student.user.email;
      const name = debt.student.user.name ?? "étudiant";
      const resend = new Resend(process.env.RESEND_API_KEY);
      const sent = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: "Rappel d’échéance de scolarité HEMIP",
        text: "Bonjour " + name + ",\n\nNous vous rappelons l’échéance « " + debt.description + " » de " + Number(debt.amountDue).toLocaleString("fr-FR") + " FCFA" + (debt.dueAt ? ", prévue le " + debt.dueAt.toLocaleDateString("fr-FR") : "") + ". Pour toute question, veuillez contacter le service administratif HEMIP.\n\nHEMIP · La Percée",
      });
      if (sent.error) {
        res.status(503).json({ message: "La relance n’a pas pu être envoyée." });
        return;
      }
      await prisma.auditLog.create({ data: { actorId: actor.id, action: "finance.debt.reminder_sent", entity: "DebtRecord", entityId: debt.id, after: { studentId: debt.studentId, description: debt.description }, payload: { messageId: sent.data?.id ?? randomUUID() } } });
      res.json({ sent: true });
    } catch {
      res.status(503).json({ message: "Le service de relance est momentanément indisponible." });
    }
  });
}

