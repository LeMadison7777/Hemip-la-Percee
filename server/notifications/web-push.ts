import webPush from "web-push";
import { prisma } from "../prisma";

export function getVapidPublicKey(): string | null {
  const key = process.env.VAPID_PUBLIC_KEY?.trim();
  return key && process.env.VAPID_PRIVATE_KEY?.trim() && process.env.VAPID_SUBJECT?.trim() ? key : null;
}

export async function notifyUsers(input: {
  userIds: string[];
  title: string;
  body: string;
  url: "/student/dashboard" | "/teacher/dashboard" | "/annonces";
  tag: string;
}): Promise<{ configured: boolean; delivered: number; removed: number; failed: number }> {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return { configured: false, delivered: 0, removed: 0, failed: 0 };
  const userIds = Array.from(new Set(input.userIds)).slice(0, 1000);
  if (!userIds.length) return { configured: true, delivered: 0, removed: 0, failed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds }, user: { is: { isActive: true, role: { in: ["student", "teacher"] } } } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  const payload = JSON.stringify({
    title: input.title.slice(0, 100),
    body: input.body.slice(0, 140),
    url: input.url,
    tag: input.tag.slice(0, 120),
  });
  const outcomes = await Promise.allSettled(subscriptions.map(async subscription => {
    try {
      await webPush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { vapidDetails: { subject, publicKey, privateKey }, TTL: 300, urgency: "normal" },
      );
      return "delivered" as const;
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        return "removed" as const;
      }
      return "failed" as const;
    }
  }));
  return outcomes.reduce((counts, outcome) => {
    if (outcome.status === "fulfilled") counts[outcome.value] += 1;
    else counts.failed += 1;
    return counts;
  }, { configured: true, delivered: 0, removed: 0, failed: 0 });
}

export async function notifyAnnouncement(input: {
  id: string;
  title: string;
  targetRole: "student" | "teacher" | null;
}): Promise<{ configured: boolean; delivered: number; removed: number; failed: number }> {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    return { configured: false, delivered: 0, removed: 0, failed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: {
        is: {
          isActive: true,
          role: input.targetRole ? input.targetRole : { in: ["student", "teacher"] },
        },
      },
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const outcomes = await Promise.allSettled(subscriptions.map(async subscription => {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          title: input.title,
          body: "Une nouvelle information est disponible dans votre espace HEMIP.",
          url: "/annonces",
          tag: `hemip-announcement-${input.id}`,
        }),
        { vapidDetails: { subject, publicKey, privateKey }, TTL: 300, urgency: "normal" },
      );
      return "delivered" as const;
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        return "removed" as const;
      }
      return "failed" as const;
    }
  }));

  return outcomes.reduce((counts, outcome) => {
    if (outcome.status === "fulfilled") counts[outcome.value] += 1;
    else counts.failed += 1;
    return counts;
  }, { configured: true, delivered: 0, removed: 0, failed: 0 });
}
