import "server-only";
import { prisma } from "@/lib/prisma";

export type NotificationInput = {
  userId: string;
  type: "assigned" | "deal_won" | "deal_lost" | "task_assigned";
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  /** Skip entirely when this equals userId — don't notify people about their own actions. */
  skipIfActor?: string;
};

export async function notify(input: NotificationInput) {
  if (!input.userId || input.userId === input.skipIfActor) return;
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
      link: input.link,
    },
  });
}

export async function listNotifications(userId: string, take = 20) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markNotificationRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
