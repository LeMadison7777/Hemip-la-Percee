import { randomUUID } from "node:crypto";
import { Express, Request, Response } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../prisma";
import { getAuthenticatedHemipUser } from "../auth/routes";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1 } });
const MIME_TO_EXT = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const DOCUMENT_MANAGER_ROLES = new Set(["payment_manager", "academic_admin", "super_admin"]);
const DOCUMENT_TYPES = new Set(["IDENTITY", "PREVIOUS_DIPLOMA", "OTHER"]);

function storageReady(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
      process.env.SUPABASE_PRIVATE_BUCKET
  );
}

function uploadOriginIsValid(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const requestHost = (req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host") || "").toLowerCase();
    return parsed.host.toLowerCase() === requestHost && (
      parsed.protocol === "https:" || (parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestHost))
    );
  } catch {
    return false;
  }
}

function detectedMime(bytes: Buffer): string | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

function supabase() {
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function rejectMulterError(err: unknown, res: Response): boolean {
  if (!err) return false;
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ message: "Fichier trop volumineux. Taille maximale : 10 Mo." });
  } else if (err instanceof multer.MulterError) {
    res.status(400).json({ message: "Un seul fichier est accepté par opération." });
  } else {
    res.status(400).json({ message: "Fichier impossible à traiter." });
  }
  return true;
}

export function registerSupabaseStorageRoutes(app: Express): void {
  app.post("/api/storage/documents", async (req: Request, res: Response) => {
    if (!uploadOriginIsValid(req)) {
      res.status(403).json({ message: "Origine de la requête refusée." });
      return;
    }
    const user = await getAuthenticatedHemipUser(req);
    if (!user) {
      res.status(401).json({ message: "Connexion HEMIP requise." });
      return;
    }
    if (!DOCUMENT_MANAGER_ROLES.has(user.role) && user.role !== "student") {
      res.status(403).json({ message: "Ce rôle ne peut pas déposer de document." });
      return;
    }
    if (!storageReady()) {
      res.status(503).json({ message: "Le stockage documentaire privé n’est pas encore configuré." });
      return;
    }

    upload.single("file")(req, res, async err => {
      if (rejectMulterError(err, res)) return;
      try {
        const file = req.file;
        if (!file) {
          res.status(422).json({ message: "Choisissez un fichier à déposer." });
          return;
        }
        const actualMime = detectedMime(file.buffer);
        if (!actualMime || !MIME_TO_EXT.has(actualMime)) {
          res.status(415).json({ message: "Format non accepté. Formats autorisés : PDF, JPEG, PNG et WebP." });
          return;
        }
        if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
          res.status(413).json({ message: "Taille de fichier invalide; maximum 10 Mo." });
          return;
        }

        const documentType = typeof req.body?.documentType === "string" ? req.body.documentType : "";
        if (!DOCUMENT_TYPES.has(documentType)) {
          res.status(422).json({ message: "Choisissez une catégorie de document valide." });
          return;
        }
        let studentId = typeof req.body?.studentId === "string" ? req.body.studentId.trim() : "";
        if (user.role === "student") {
          const ownProfile = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true, isActive: true, deletedAt: true } });
          if (!ownProfile || !ownProfile.isActive || ownProfile.deletedAt) {
            res.status(404).json({ message: "Aucun profil étudiant actif n’est lié à ce compte." });
            return;
          }
          studentId = ownProfile.id;
        }
        const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, isActive: true, deletedAt: true } });
        if (!student || !student.isActive || student.deletedAt) {
          res.status(422).json({ message: "Choisissez un profil étudiant actif." });
          return;
        }

        const objectKey = `${student.id}/${randomUUID()}.${MIME_TO_EXT.get(actualMime)}`;
        const bucket = process.env.SUPABASE_PRIVATE_BUCKET!;
        const { error } = await supabase().storage.from(bucket).upload(objectKey, file.buffer, {
          contentType: actualMime,
          upsert: false,
          cacheControl: "0",
        });
        if (error) {
          res.status(503).json({ message: "Le dépôt du document a échoué." });
          return;
        }

        let record;
        try {
          record = await prisma.storedDocument.create({
            data: {
              objectKey,
              uploadedById: user.id,
              originalName: file.originalname.replace(/[\r\n\0]/g, "").slice(0, 180) || "document",
              contentType: actualMime,
              sizeBytes: file.size,
              studentId: student.id,
              documentType: documentType as "IDENTITY" | "PREVIOUS_DIPLOMA" | "OTHER",
              reviewStatus: "SUBMITTED",
            },
            select: { id: true, originalName: true, contentType: true, sizeBytes: true, createdAt: true },
          });
        } catch {
          await supabase().storage.from(bucket).remove([objectKey]);
          res.status(503).json({ message: "Le dépôt du document a échoué." });
          return;
        }
        res.setHeader("Cache-Control", "no-store, private");
        res.status(201).json({ document: record });
      } catch {
        res.status(503).json({ message: "Le stockage documentaire est momentanément indisponible." });
      }
    });
  });

  app.post("/api/storage/documents/:id/signed-read-url", async (req: Request, res: Response) => {
    const user = await getAuthenticatedHemipUser(req);
    if (!user) {
      res.status(401).json({ message: "Connexion HEMIP requise." });
      return;
    }
    if (!storageReady()) {
      res.status(503).json({ message: "Le stockage documentaire privé n’est pas encore configuré." });
      return;
    }
    try {
      const document = await prisma.storedDocument.findUnique({
        where: { id: String(req.params.id) },
        select: { id: true, objectKey: true, uploadedById: true, student: { select: { userId: true } }, originalName: true },
      });
      if (!document) {
        res.status(404).json({ message: "Document introuvable." });
        return;
      }
      const isOwner = document.uploadedById === user.id || document.student?.userId === user.id;
      if (!isOwner && !DOCUMENT_MANAGER_ROLES.has(user.role)) {
        res.status(403).json({ message: "Ce document n’est pas accessible depuis ce compte." });
        return;
      }
      const { data, error } = await supabase().storage
        .from(process.env.SUPABASE_PRIVATE_BUCKET!)
        .createSignedUrl(document.objectKey, 60, { download: document.originalName });
      if (error || !data?.signedUrl) {
        res.status(503).json({ message: "Impossible de créer un lien de consultation." });
        return;
      }
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ signedUrl: data.signedUrl, expiresIn: 60 });
    } catch {
      res.status(503).json({ message: "Le service documentaire est momentanément indisponible." });
    }
  });

  app.get("/api/storage/documents", async (req: Request, res: Response) => {
    const user = await getAuthenticatedHemipUser(req);
    if (!user) {
      res.status(401).json({ message: "Connexion HEMIP requise." });
      return;
    }
    if (user.role !== "student" && !DOCUMENT_MANAGER_ROLES.has(user.role)) {
      res.status(403).json({ message: "Ce rôle ne peut pas consulter les dossiers étudiants." });
      return;
    }
    try {
      const student = user.role === "student" ? await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;
      if (user.role === "student" && !student) {
        res.status(404).json({ message: "Aucun profil étudiant n’est lié à ce compte." });
        return;
      }
      const documents = await prisma.storedDocument.findMany({
        where: student ? { studentId: student.id } : { studentId: { not: null } },
        include: { student: { include: { user: { select: { name: true, email: true } } } }, uploadedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 300,
      });
      res.setHeader("Cache-Control", "no-store, private");
      res.json({ documents });
    } catch {
      res.status(503).json({ message: "Les documents sont momentanément indisponibles." });
    }
  });

  app.post("/api/storage/documents/:id/review", async (req: Request, res: Response) => {
    if (!uploadOriginIsValid(req)) {
      res.status(403).json({ message: "Origine de la requête refusée." });
      return;
    }
    const user = await getAuthenticatedHemipUser(req);
    if (!user) {
      res.status(401).json({ message: "Connexion HEMIP requise." });
      return;
    }
    if (!DOCUMENT_MANAGER_ROLES.has(user.role)) {
      res.status(403).json({ message: "La validation des dossiers est réservée au personnel habilité." });
      return;
    }
    const decision = req.body?.decision;
    if (!req.is("application/json") || !["accept", "reject"].includes(decision)) {
      res.status(422).json({ message: "Décision de validation invalide." });
      return;
    }
    try {
      const document = await prisma.storedDocument.findUnique({ where: { id: String(req.params.id) }, select: { id: true, reviewStatus: true, studentId: true } });
      if (!document || !document.studentId) {
        res.status(404).json({ message: "Document introuvable." });
        return;
      }
      const reviewStatus = decision === "accept" ? "ACCEPTED" : "REJECTED";
      const updated = await prisma.$transaction(async tx => {
        const record = await tx.storedDocument.update({ where: { id: document.id }, data: { reviewStatus, reviewedById: user.id, reviewedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: user.id, action: "student_document.reviewed", entity: "StoredDocument", entityId: document.id, before: { reviewStatus: document.reviewStatus }, after: { reviewStatus }, payload: { studentId: document.studentId } } });
        return record;
      });
      res.json({ document: { id: updated.id, reviewStatus: updated.reviewStatus, reviewedAt: updated.reviewedAt } });
    } catch {
      res.status(503).json({ message: "La décision de validation n’a pas pu être enregistrée." });
    }
  });
}
