import type { Metadata } from "next";
import { ActivityList } from "@/components/activity-list";
import { MonthlyWonChart, PipelineStageChart } from "@/components/charts";
import { ChartTable, InlineBar, StatTile } from "@/components/stats";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { getDashboardData } from "@/lib/reports";
import { requireUser } from "@/lib/session";
import { first, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const denied = first((await searchParams).denied) === "1";
  const { kpis, monthly, stages, leaderboard, upcomingTasks } = await getDashboardData(user);
  const isRep = user.role === "REP";
  const topWon = leaderboard[0]?.won ?? 0;

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
        <StatTile label="Open pipeline" value={formatCurrency(kpis.pipelineValue, "USD", true)} hint={`${kpis.openDeals} open deals`} />
        <StatTile label="Weighted forecast" value={formatCurrency(kpis.weightedForecast, "USD", true)} hint="Value × stage probability" />
        <StatTile label="Won this month" value={formatCurrency(kpis.wonThisMonth, "USD", true)} hint={`${formatCurrency(kpis.wonLastMonth, "USD", true)} last month`} />
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
        <Card title="Won revenue by month" className="lg:col-span-3">
          <MonthlyWonChart data={monthly} />
          <ChartTable
            caption="Won revenue by month"
            headers={["Month", "Won revenue", "Deals"]}
            rows={monthly.map((m) => [m.month, formatCurrency(m.won), m.deals])}
          />
        </Card>
        <Card title="Open pipeline by stage" className="lg:col-span-2">
          <PipelineStageChart data={stages} />
          <ChartTable
            caption="Open pipeline by stage"
            headers={["Stage", "Deals", "Value"]}
            rows={stages.map((s) => [s.stage, s.count, formatCurrency(s.value)])}
          />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="My upcoming tasks" className="lg:col-span-3" actions={<ButtonLink href="/tasks" variant="ghost">All tasks</ButtonLink>}>
          <ActivityList activities={upcomingTasks} emptyText="No open tasks with a due date." />
        </Card>
        <Card title={isRep ? "My wins, last 6 months" : "Top performers, last 6 months"} className="lg:col-span-2">
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
                    <td className="py-2 text-right tabular-nums text-slate-800">{formatCurrency(row.won, "USD", true)}</td>
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
