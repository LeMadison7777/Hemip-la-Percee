import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { AnnouncementStatus, UserRole } from "@prisma/client";
import { getAuthenticatedHemipUser } from "../auth/routes";
import { prisma } from "../prisma";
import { getVapidPublicKey, notifyAnnouncement } from "../notifications/web-push";

const PUSH_ENDPOINT_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

function sameOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = (forwardedHost || req.get("host") || "").toLowerCase();
    const protocolAllowed = parsed.protocol === "https:" || (parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestHost));
    return protocolAllowed && parsed.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:" && !endpoint.username && !endpoint.password &&
      PUSH_ENDPOINT_HOSTS.some(host => endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store, private");
}

async function currentUser(req: Request, res: Response, roles: string[]) {
  const user = await getAuthenticatedHemipUser(req);
  noStore(res);
  if (!user) {
    res.status(401).json({ message: "Connectez-vous pour continuer." });
    return null;
  }
  if (!roles.includes(user.role)) {
    res.status(403).json({ message: "Cette action est réservée aux comptes autorisés." });
    return null;
  }
  return user;
}

function rejectCrossSiteMutation(req: Request, res: Response): boolean {
  if (sameOrigin(req)) return false;
  res.status(403).json({ message: "Origine de la requête refusée." });
  return true;
}

export function registerCommunityRoutes(app: Express): void {
  app.get("/api/community/testimonials", async (req: Request, res: Response) => {
    noStore(res);
    try {
      const user = await getAuthenticatedHemipUser(req);
      const entries = await prisma.testimonial.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          body: true,
          showAuthorName: true,
          createdAt: true,
          author: { select: { name: true } },
          _count: { select: { likes: true } },
        },
      });
      const likedEntries = user && ["student", "teacher"].includes(user.role)
        ? await prisma.testimonialLike.findMany({
            where: { userId: user.id, testimonialId: { in: entries.map(entry => entry.id) } },
            select: { testimonialId: true },
          })
        : [];
      const likedIds = new Set(likedEntries.map(entry => entry.testimonialId));
      res.json({
        testimonials: entries.map(entry => ({
          id: entry.id,
          body: entry.body,
          authorName: entry.showAuthorName && entry.author.name ? entry.author.name : null,
          createdAt: entry.createdAt,
          likeCount: entry._count.likes,
          likedByMe: likedIds.has(entry.id),
        })),
        canWrite: user?.role === "student",
        canLike: Boolean(user && ["student", "teacher"].includes(user.role)),
      });
    } catch {
      res.status(503).json({ message: "Les témoignages sont momentanément indisponibles." });
    }
  });

  app.post("/api/community/testimonials", async (req: Request, res: Response) => {
    if (rejectCrossSiteMutation(req, res)) return;
    const user = await currentUser(req, res, ["student"]);
    if (!user) return;
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const showAuthorName = req.body?.showAuthorName === true;
    if (body.length < 20 || body.length > 3000) {
      res.status(422).json({ message: "Le témoignage doit contenir entre 20 et 3 000 caractères." });
      return;
    }
    try {
      const submittedToday = await prisma.testimonial.count({
        where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
      if (submittedToday >= 5) {
        res.status(429).json({ message: "Vous avez atteint la limite de témoignages pour aujourd’hui." });
        return;
      }
      const entry = await prisma.testimonial.create({
        data: { authorId: user.id, body, showAuthorName },
        select: { id: true, createdAt: true },
      });
      res.status(201).json({ testimonial: entry, message: "Merci. Votre témoignage est maintenant publié." });
    } catch {
      res.status(503).json({ message: "Impossible d’enregistrer votre témoignage pour le moment." });
    }
  });

  app.put("/api/community/testimonials/:id/like", async (req: Request, res: Response) => {
    if (rejectCrossSiteMutation(req, res)) return;
    const user = await currentUser(req, res, ["student", "teacher"]);
    if (!user) return;
    try {
      const testimonial = await prisma.testimonial.findFirst({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!testimonial) {
        res.status(404).json({ message: "Ce témoignage n’est pas disponible." });
        return;
      }
      await prisma.testimonialLike.upsert({
        where: { testimonialId_userId: { testimonialId: testimonial.id, userId: user.id } },
        create: { testimonialId: testimonial.id, userId: user.id },
        update: {},
      });
      const likeCount = await prisma.testimonialLike.count({ where: { testimonialId: testimonial.id } });
      res.json({ likedByMe: true, likeCount });
    } catch {
      res.status(503).json({ message: "Impossible d’enregistrer votre mention J’aime." });
    }
  });

  app.delete("/api/community/testimonials/:id/like", async (req: Request, res: Response) => {
    if (rejectCrossSiteMutation(req, res)) return;
    const user = await currentUser(req, res, ["student", "teacher"]);
    if (!user) return;
    try {
      const testimonial = await prisma.testimonial.findFirst({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!testimonial) {
        res.status(404).json({ message: "Ce témoignage n’est pas disponible." });
        return;
      }
      await prisma.testimonialLike.deleteMany({ where: { testimonialId: testimonial.id, userId: user.id } });
      const likeCount = await prisma.testimonialLike.count({ where: { testimonialId: testimonial.id } });
      res.json({ likedByMe: false, likeCount });
    } catch {
      res.status(503).json({ message: "Impossible de modifier votre mention J’aime." });
    }
  });

  app.get("/api/announcements", async (req: Request, res: Response) => {
    const user = await currentUser(req, res, ["student", "teacher", "academic_admin", "evaluation_manager", "payment_manager", "super_admin"]);
    if (!user) return;
    try {
      const now = new Date();
      const announcements = await prisma.announcement.findMany({
        where: {
          status: AnnouncementStatus.PUBLISHED,
          publishedAt: { not: null },
          AND: [
            {
              OR: user.role === "student" || user.role === "teacher"
                ? [{ targetRole: null }, { targetRole: user.role as UserRole }]
                : [{ targetRole: null }, { targetRole: { in: [UserRole.student, UserRole.teacher] } }],
            },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
        orderBy: { publishedAt: "desc" },
        take: 100,
        select: { id: true, title: true, body: true, publishedAt: true, expiresAt: true },
      });
      res.json({ announcements });
    } catch {
      res.status(503).json({ message: "Les annonces sont momentanément indisponibles." });
    }
  });

  app.post("/api/admin/announcements", async (req: Request, res: Response) => {
    if (rejectCrossSiteMutation(req, res)) return;
    const user = await currentUser(req, res, ["academic_admin", "super_admin"]);
    if (!user) return;
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const audience = req.body?.audience;
    const validAudience = ["student", "teacher", "all"].includes(audience);
    if (title.length < 4 || title.length > 140 || body.length < 8 || body.length > 4000 || !validAudience) {
      res.status(422).json({ message: "Vérifiez le titre, le contenu et le public de l’annonce." });
      return;
    }
    let expiresAt: Date | null = null;
    if (req.body?.expiresAt) {
      expiresAt = new Date(String(req.body.expiresAt));
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        res.status(422).json({ message: "La date d’expiration doit se situer dans le futur." });
        return;
      }
    }
    const targetRole: UserRole | null = audience === "student"
      ? UserRole.student
      : audience === "teacher" ? UserRole.teacher : null;
    const publishedAt = new Date();
    try {
      const announcement = await prisma.$transaction(async transaction => {
        const created = await transaction.announcement.create({
          data: {
            title,
            body,
            status: AnnouncementStatus.PUBLISHED,
            targetRole,
            createdById: user.id,
            publishedById: user.id,
            publishedAt,
            expiresAt,
          },
          select: { id: true, title: true, body: true, targetRole: true, publishedAt: true, expiresAt: true },
        });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            action: "announcement.published",
            entity: "Announcement",
            entityId: created.id,
            reason: "Publication d’une annonce HEMIP.",
          },
        });
        return created;
      });
      const push = await notifyAnnouncement({
        id: announcement.id,
        title: announcement.title,
        targetRole: announcement.targetRole === UserRole.student
          ? "student"
          : announcement.targetRole === UserRole.teacher ? "teacher" : null,
      })
        .catch(() => ({ configured: Boolean(getVapidPublicKey()), delivered: 0, removed: 0, failed: 1 }));
      res.status(201).json({ announcement, push });
    } catch {
      res.status(503).json({ message: "Impossible de publier l’annonce pour le moment." });
    }
  });

  app.get("/api/push/public-key", (_req: Request, res: Response) => {
    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      res.status(503).json({ message: "Les notifications push ne sont pas encore configurées." });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({ publicKey });
  });

  app.post("/api/push/subscriptions", async (req: Request, res: Response) => {
    if (rejectCrossSiteMutation(req, res)) return;
    const user = await currentUser(req, res, ["student", "teacher"]);
    if (!user) return;
    if (!getVapidPublicKey()) {
      res.status(503).json({ message: "Les notifications push ne sont pas encore configurées." });
      return;
    }
    const endpoint = req.body?.endpoint;
    const p256dh = req.body?.keys?.p256dh;
    const auth = req.body?.keys?.auth;
    if (!validPushEndpoint(endpoint) || typeof p256dh !== "string" || p256dh.length > 256 || typeof auth !== "string" || auth.length > 256) {
      res.status(422).json({ message: "L’abonnement de ce navigateur n’est pas valide." });
      return;
    }
    try {
      const existing = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { id: true, userId: true } });
      if (existing?.userId && existing.userId !== user.id) {
        res.status(409).json({ message: "Cet abonnement de navigateur est déjà associé à un autre compte." });
        return;
      }
      await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { id: randomUUID(), endpoint, p256dh, auth, userId: user.id },
        update: { p256dh, auth, userId: user.id },
      });
      res.status(204).end();
    } catch {
      res.status(503).json({ message: "Impossible d’enregistrer cet abonnement de notifications." });
    }
  });

  app.delete("/api/push/subscriptions", async (req: Request, res: Response) => {
    if (rejectCrossSiteMutation(req, res)) return;
    const user = await currentUser(req, res, ["student", "teacher"]);
    if (!user) return;
    const endpoint = req.body?.endpoint;
    if (!validPushEndpoint(endpoint)) {
      res.status(422).json({ message: "L’abonnement de ce navigateur n’est pas valide." });
      return;
    }
    try {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
      res.status(204).end();
    } catch {
      res.status(503).json({ message: "Impossible de désactiver les notifications." });
    }
  });
}
