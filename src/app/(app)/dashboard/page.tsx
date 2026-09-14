import type { Metadata } from "next";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { MonthlyWonChart, PipelineStageChart } from "@/components/charts";
import { HealthBadge } from "@/components/health-badge";
import { ChartTable, InlineBar, StatTile } from "@/components/stats";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { getDealsNeedingAttention } from "@/lib/health";
import { getDashboardData } from "@/lib/reports";
import { requireUser } from "@/lib/session";
import { first, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const denied = first((await searchParams).denied) === "1";
  const [{ currency, kpis, monthly, stages, leaderboard, upcomingTasks }, attention] = await Promise.all([
    getDashboardData(user),
    getDealsNeedingAttention(user, 5),
  ]);
  const isRep = user.role === "REP";
  const topWon = leaderboard[0]?.won ?? 0;
  const money = (value: number) => formatCurrency(value, currency, true);

  return (
    <>
      {denied && (
        <p role="alert" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You don&apos;t have access to that page.
        </p>
      )}
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name.split(" ")[0]}. ${isRep ? "Showing your records." : "Showing the whole team."}`}
        actions={<ButtonLink href="/deals/new">New deal</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Open pipeline"
          value={money(kpis.pipelineValue)}
          hint={
            kpis.excludedOpenDeals
              ? `${kpis.openDeals} open deals (${kpis.excludedOpenDeals} in other currencies not included)`
              : `${kpis.openDeals} open deals`
          }
        />
        <StatTile label="Weighted forecast" value={money(kpis.weightedForecast)} hint="Value × stage probability" />
        <StatTile label="Won this month" value={money(kpis.wonThisMonth)} hint={`${money(kpis.wonLastMonth)} last month`} />
        <StatTile
          label="Win rate (90 days)"
          value={kpis.winRate === null ? "—" : `${Math.round(kpis.winRate * 100)}%`}
          hint={`${kpis.closed90} closed deals`}
        />
        <StatTile label="Overdue tasks" value={kpis.overdueTasks} hint={kpis.overdueTasks ? "Needs attention" : "All caught up"} />
        <StatTile
          label="New contacts (30 days)"
          value={kpis.newContacts}
          delta={{ value: kpis.newContacts - kpis.prevContacts, label: "vs prior 30 days" }}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title={`Won revenue by month (${currency})`} className="lg:col-span-3">
          <MonthlyWonChart data={monthly} currency={currency} />
          <ChartTable
            caption="Won revenue by month"
            headers={["Month", "Won revenue", "Deals"]}
            rows={monthly.map((m) => [m.month, formatCurrency(m.won, currency), m.deals])}
          />
        </Card>
        <Card title="Open pipeline by stage" className="lg:col-span-2">
          <PipelineStageChart data={stages} currency={currency} />
          <ChartTable
            caption="Open pipeline by stage"
            headers={["Stage", "Deals", "Value"]}
            rows={stages.map((s) => [s.stage, s.count, formatCurrency(s.value, currency)])}
          />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Deals needing attention" actions={<ButtonLink href="/deals" variant="ghost">Pipeline</ButtonLink>}>
          {attention.length === 0 ? (
            <EmptyState>Every open deal looks healthy.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((deal) => (
                <li key={deal.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/deals/${deal.id}`} className="min-w-0 text-sm font-medium text-slate-900 hover:text-indigo-600">
                      {deal.title}
                    </Link>
                    <HealthBadge health={deal.health} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {deal.health.reasons[0]}
                    {deal.health.reasons.length > 1 && ` · +${deal.health.reasons.length - 1} more`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="My upcoming tasks" actions={<ButtonLink href="/tasks" variant="ghost">All tasks</ButtonLink>}>
          <ActivityList activities={upcomingTasks} emptyText="No open tasks with a due date." />
        </Card>

        <Card title={isRep ? "My wins, last 6 months" : "Top performers, last 6 months"}>
          {leaderboard.length === 0 ? (
            <EmptyState>No won deals yet.</EmptyState>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Won revenue by owner</caption>
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 font-medium">Owner</th>
                  <th className="pb-2 font-medium">
                    <span className="sr-only">Share of top performer</span>
                  </th>
                  <th className="pb-2 text-right font-medium">Won</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.name} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.deals} deal{row.deals === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="w-2/5 py-2 pr-3">
                      <InlineBar ratio={topWon ? row.won / topWon : 0} label={`${row.name} relative to top performer`} />
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-800">{money(row.won)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
