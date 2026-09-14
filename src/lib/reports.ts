import "server-only";
import { DEAL_STAGES, OPEN_STAGES } from "@/lib/constants";
import { activityInclude, type Actor } from "@/lib/crm";
import { env } from "@/lib/env";
import { ownerScope } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;
const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);
const isOpen = (stage: string) => (OPEN_STAGES as string[]).includes(stage);

// Money totals only include deals in the reporting currency (env CURRENCY);
// adding amounts across currencies without exchange rates would be wrong.
const inReportingCurrency = (d: { currency: string }) => d.currency === env.CURRENCY;

export async function getDashboardData(actor: Actor) {
  const scope = ownerScope(actor);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [allOpenDeals, allWonDeals, closed90, overdueTasks, newContacts, prevContacts, upcomingTasks, users] =
    await Promise.all([
      prisma.deal.findMany({
        where: { ...scope, stage: { in: OPEN_STAGES } },
        select: { value: true, probability: true, stage: true, currency: true },
      }),
      prisma.deal.findMany({
        where: { ...scope, stage: "WON", closedAt: { gte: sixMonthsAgo } },
        select: { value: true, closedAt: true, ownerId: true, currency: true },
      }),
      prisma.deal.groupBy({
        by: ["stage"],
        where: { ...scope, stage: { in: ["WON", "LOST"] }, closedAt: { gte: addDays(now, -90) } },
        _count: { _all: true },
      }),
      prisma.activity.count({
        where: { ...scope, completedAt: null, type: { not: "NOTE" }, dueAt: { lt: now } },
      }),
      prisma.contact.count({ where: { ...scope, createdAt: { gte: addDays(now, -30) } } }),
      prisma.contact.count({ where: { ...scope, createdAt: { gte: addDays(now, -60), lt: addDays(now, -30) } } }),
      prisma.activity.findMany({
        where: { ...scope, ownerId: actor.id, completedAt: null, type: { not: "NOTE" }, dueAt: { not: null } },
        orderBy: { dueAt: "asc" },
        take: 6,
        include: activityInclude,
      }),
      prisma.user.findMany({ select: { id: true, name: true } }),
    ]);

  const openDeals = allOpenDeals.filter(inReportingCurrency);
  const wonDeals = allWonDeals.filter(inReportingCurrency);
  const won90 = closed90.find((g) => g.stage === "WON")?._count._all ?? 0;
  const lost90 = closed90.find((g) => g.stage === "LOST")?._count._all ?? 0;
  const closedAt = (d: { closedAt: Date | null }) => d.closedAt ?? now;

  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: d.toLocaleString("en-US", { month: "short" }),
      won: 0,
      deals: 0,
    };
  });
  for (const deal of wonDeals) {
    const at = closedAt(deal);
    const bucket = monthly.find((m) => m.key === `${at.getFullYear()}-${at.getMonth()}`);
    if (bucket) {
      bucket.won += deal.value;
      bucket.deals += 1;
    }
  }

  const stages = DEAL_STAGES.filter((s) => isOpen(s.id)).map((s) => {
    const inStage = openDeals.filter((d) => d.stage === s.id);
    return { stage: s.label, label: `${s.label} (${inStage.length})`, count: inStage.length, value: sum(inStage.map((d) => d.value)) };
  });

  const names = new Map(users.map((u) => [u.id, u.name]));
  const byOwner = new Map<string, { name: string; won: number; deals: number }>();
  for (const deal of wonDeals) {
    const id = deal.ownerId ?? "unassigned";
    const row = byOwner.get(id) ?? { name: names.get(id) ?? "Unassigned", won: 0, deals: 0 };
    row.won += deal.value;
    row.deals += 1;
    byOwner.set(id, row);
  }

  return {
    currency: env.CURRENCY,
    kpis: {
      pipelineValue: sum(openDeals.map((d) => d.value)),
      openDeals: allOpenDeals.length,
      excludedOpenDeals: allOpenDeals.length - openDeals.length,
      weightedForecast: sum(openDeals.map((d) => (d.value * d.probability) / 100)),
      wonThisMonth: sum(wonDeals.filter((d) => closedAt(d) >= startOfMonth).map((d) => d.value)),
      wonLastMonth: sum(
        wonDeals.filter((d) => closedAt(d) >= startOfLastMonth && closedAt(d) < startOfMonth).map((d) => d.value),
      ),
      winRate: won90 + lost90 > 0 ? won90 / (won90 + lost90) : null,
      closed90: won90 + lost90,
      overdueTasks,
      newContacts,
      prevContacts,
    },
    monthly: monthly.map(({ month, won, deals }) => ({ month, won, deals })),
    stages,
    leaderboard: [...byOwner.values()].sort((a, b) => b.won - a.won),
    upcomingTasks,
  };
}

export const REPORT_PERIODS = [
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last 12 months" },
] as const;

type ReportDeal = { value: number; stage: string; ownerId: string | null; createdAt: Date; closedAt: Date | null; currency: string };

export async function getReportsData(actor: Actor, days: number) {
  const scope = ownerScope(actor);
  const since = addDays(new Date(), -days);

  const [deals, contactGroups, users] = await Promise.all([
    prisma.deal.findMany({
      where: { ...scope, OR: [{ stage: { in: OPEN_STAGES } }, { closedAt: { gte: since } }] },
      select: { value: true, stage: true, ownerId: true, createdAt: true, closedAt: true, currency: true },
    }),
    prisma.contact.groupBy({
      by: ["source", "status"],
      where: { ...scope, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: actor.role === "REP" ? { id: actor.id } : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const summarize = (subset: ReportDeal[]) => {
    const open = subset.filter((d) => isOpen(d.stage));
    const won = subset.filter((d) => d.stage === "WON" && d.closedAt && d.closedAt >= since);
    const lost = subset.filter((d) => d.stage === "LOST" && d.closedAt && d.closedAt >= since);
    const wonInCurrency = won.filter(inReportingCurrency);
    const wonValue = sum(wonInCurrency.map((d) => d.value));
    return {
      openCount: open.length,
      pipeline: sum(open.filter(inReportingCurrency).map((d) => d.value)),
      wonCount: won.length,
      wonValue,
      lostCount: lost.length,
      winRate: won.length + lost.length > 0 ? won.length / (won.length + lost.length) : null,
      avgDeal: wonInCurrency.length ? wonValue / wonInCurrency.length : null,
      cycleDays: won.length
        ? sum(won.map((d) => (d.closedAt!.getTime() - d.createdAt.getTime()) / DAY)) / won.length
        : null,
    };
  };

  const reps = users
    .map((u) => ({ id: u.id, name: u.name, ...summarize(deals.filter((d) => d.ownerId === u.id)) }))
    .filter((r) => r.openCount + r.wonCount + r.lostCount > 0)
    .sort((a, b) => b.wonValue - a.wonValue);

  const sources = new Map<string, { source: string; contacts: number; customers: number }>();
  for (const g of contactGroups) {
    const source = g.source ?? "Unknown";
    const row = sources.get(source) ?? { source, contacts: 0, customers: 0 };
    row.contacts += g._count._all;
    if (g.status === "CUSTOMER") row.customers += g._count._all;
    sources.set(source, row);
  }

  return {
    currency: env.CURRENCY,
    excludedDeals: deals.filter((d) => !inReportingCurrency(d)).length,
    totals: summarize(deals),
    reps,
    sources: [...sources.values()]
      .map((s) => ({ ...s, conversion: s.contacts ? s.customers / s.contacts : 0 }))
      .sort((a, b) => b.contacts - a.contacts),
  };
}
