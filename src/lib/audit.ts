import "server-only";
import type { Prisma } from "@prisma/client";
import type { Changes } from "@/lib/diff";
import { prisma } from "@/lib/prisma";

export type AuditEntity = "contact" | "company" | "deal" | "activity";
export type AuditAction = "created" | "updated" | "deleted" | "stage_changed" | "completed" | "reopened";

export async function recordAudit(entry: {
  actorId: string | null;
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  summary?: string;
  changes?: Changes;
}) {
  // Skip no-op updates (e.g. saving a form without changing anything).
  if (entry.action === "updated" && (!entry.changes || Object.keys(entry.changes).length === 0)) return;
  await prisma.auditLog.create({
    data: {
      userId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      summary: entry.summary,
      changes: entry.changes as Prisma.InputJsonObject | undefined,
    },
  });
}

export function listAuditEntries(entityType: AuditEntity, entityId: string, take = 25) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });
}

export function listRecentAudit(take = 30) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });
}
