import "server-only";
import type { Actor } from "@/lib/crm";
import { OPEN_STAGES } from "@/lib/constants";
import { scoreDeal, type DealHealth } from "@/lib/deal-health";
import { ownerScope } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ScorableDeal = { id: string; stage: string; createdAt: Date; expectedClose: Date | null };

/** Health for each open deal, derived from its activity history. */
export async function getDealHealthMap(deals: ScorableDeal[]) {
  const open = deals.filter((d) => (OPEN_STAGES as string[]).includes(d.stage));
  const result = new Map<string, DealHealth>();
  if (open.length === 0) return result;

  const activities = await prisma.activity.findMany({
    where: { dealId: { in: open.map((d) => d.id) } },
    select: { dealId: true, type: true, createdAt: true, completedAt: true, dueAt: true },
  });
  const byDeal = Map.groupBy(activities, (a) => a.dealId);
  const now = new Date();

  for (const deal of open) {
    const items = byDeal.get(deal.id) ?? [];
    const touched = items.flatMap((a) => [a.createdAt, a.completedAt]).filter((d): d is Date => d !== null);
    const openTasks = items.filter((a) => a.type !== "NOTE" && !a.completedAt);
    const health = scoreDeal(
      {
        stage: deal.stage,
        createdAt: deal.createdAt,
        expectedClose: deal.expectedClose,
        lastActivityAt: touched.length ? new Date(Math.max(...touched.map((d) => d.getTime()))) : null,
        overdueTasks: openTasks.filter((a) => a.dueAt && a.dueAt < now).length,
        hasUpcomingTask: openTasks.some((a) => !a.dueAt || a.dueAt >= now),
      },
      now,
    );
    if (health) result.set(deal.id, health);
  }
  return result;
}

/** Open deals with the lowest health scores, for the dashboard. */
export async function getDealsNeedingAttention(actor: Actor, take = 5) {
  const deals = await prisma.deal.findMany({
    where: { ...ownerScope(actor), stage: { in: OPEN_STAGES } },
    select: { id: true, title: true, stage: true, value: true, currency: true, createdAt: true, expectedClose: true },
    take: 500,
  });
  const health = await getDealHealthMap(deals);
  return deals
    .map((deal) => ({ ...deal, health: health.get(deal.id)! }))
    .filter((d) => d.health && d.health.level !== "healthy")
    .sort((a, b) => a.health.score - b.health.score)
    .slice(0, take);
}

/** Cheap fingerprint of the deals a user can see; changes whenever any deal changes. */
export async function getDealsVersion(actor: Actor) {
  const agg = await prisma.deal.aggregate({
    where: ownerScope(actor),
    _max: { updatedAt: true },
    _count: { _all: true },
  });
  return `${agg._count._all}:${agg._max.updatedAt?.getTime() ?? 0}`;
}
