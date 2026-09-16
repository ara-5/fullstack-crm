import "server-only";
import { prisma } from "@/lib/prisma";

const ACTIVE_WINDOW_MS = 20_000;

export async function heartbeat(userId: string, entityType: string, entityId: string) {
  await prisma.presence.upsert({
    where: { userId_entityType_entityId: { userId, entityType, entityId } },
    update: { lastSeenAt: new Date() },
    create: { userId, entityType, entityId },
  });
  // Bound table growth without a dedicated cron: occasionally sweep long-stale rows.
  if (Math.random() < 0.05) {
    await prisma.presence.deleteMany({ where: { lastSeenAt: { lt: new Date(Date.now() - ACTIVE_WINDOW_MS * 10) } } });
  }
}

export async function listViewers(entityType: string, entityId: string, excludeUserId: string) {
  const rows = await prisma.presence.findMany({
    where: { entityType, entityId, userId: { not: excludeUserId }, lastSeenAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) } },
    include: { user: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({ id: r.user.id, name: r.user.name }));
}
