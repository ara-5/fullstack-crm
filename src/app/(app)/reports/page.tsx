import type { Metadata } from "next";
import Link from "next/link";
import { InlineBar, StatTile } from "@/components/stats";
import { Card, EmptyState, PageHeader, Table, td, th } from "@/components/ui";
import { REPORT_PERIODS, getReportsData } from "@/lib/reports";
import { requireUser } from "@/lib/session";
import { cx, first, formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

const pct = (ratio: number | null) => (ratio === null ? "—" : `${Math.round(ratio * 100)}%`);

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requireUser();
  const requested = Number(first((await searchParams).days));
  const period = REPORT_PERIODS.find((p) => p.days === requested) ?? REPORT_PERIODS[1];
  const { totals, reps, sources } = await getReportsData(user, period.days);
  const topWon = Math.max(0, ...reps.map((r) => r.wonValue));

  return (
    <>
      <PageHeader
        title="Reports"
        description={user.role === "REP" ? "Your sales performance." : "Team sales performance."}
      />

      {/* One filter row scopes everything below it. */}
      <nav aria-label="Report period" className="mb-6 inline-flex flex-wrap rounded-md bg-white p-0.5 text-sm ring-1 ring-slate-300">
        {REPORT_PERIODS.map((p) => (
          <Link
            key={p.days}
            href={`/reports?days=${p.days}`}
            aria-current={p.days === period.days ? "page" : undefined}
            className={cx(
              "rounded px-3 py-1 font-medium",
              p.days === period.days ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Won revenue" value={formatCurrency(totals.wonValue, "USD", true)} hint={`${totals.wonCount} deals won`} />
        <StatTile label="Win rate" value={pct(totals.winRate)} hint={`${totals.wonCount} won · ${totals.lostCount} lost`} />
        <StatTile label="Average deal size" value={totals.avgDeal === null ? "—" : formatCurrency(totals.avgDeal, "USD", true)} hint="Won deals" />
        <StatTile label="Average sales cycle" value={totals.cycleDays === null ? "—" : `${Math.round(totals.cycleDays)} days`} hint="Created to won" />
        <StatTile label="Open pipeline" value={formatCurrency(totals.pipeline, "USD", true)} hint={`${totals.openCount} open deals (current)`} />
      </div>

      <Card title="Performance by owner" className="mt-6" padded={false}>
        {reps.length === 0 ? (
          <div className="p-4">
            <EmptyState>No deal activity in this period.</EmptyState>
          </div>
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Owner</th>
                <th className={`${th} text-right`}>Won revenue</th>
                <th className={th}>
                  <span className="sr-only">Share of top performer</span>
                </th>
                <th className={`${th} text-right`}>Won / lost</th>
                <th className={`${th} text-right`}>Win rate</th>
                <th className={`${th} text-right`}>Avg deal</th>
                <th className={`${th} text-right`}>Avg cycle</th>
                <th className={`${th} text-right`}>Open pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reps.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} font-medium text-slate-900`}>{r.name}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatCurrency(r.wonValue)}</td>
                  <td className={`${td} w-40`}>
                    <InlineBar ratio={topWon ? r.wonValue / topWon : 0} label={`${r.name} won revenue relative to top`} />
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    {r.wonCount} / {r.lostCount}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{pct(r.winRate)}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.avgDeal === null ? "—" : formatCurrency(r.avgDeal)}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.cycleDays === null ? "—" : `${Math.round(r.cycleDays)} d`}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {formatCurrency(r.pipeline)} <span className="text-xs text-slate-400">({r.openCount})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Lead sources" className="mt-6" padded={false}>
        <p className="px-4 pt-3 text-xs text-slate-500">
          Contacts created in this period, and how many are now customers.
        </p>
        {sources.length === 0 ? (
          <div className="p-4">
            <EmptyState>No new contacts in this period.</EmptyState>
          </div>
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Source</th>
                <th className={`${th} text-right`}>Contacts</th>
                <th className={`${th} text-right`}>Customers</th>
                <th className={`${th} text-right`}>Conversion</th>
                <th className={th}>
                  <span className="sr-only">Conversion meter</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((s) => (
                <tr key={s.source}>
                  <td className={`${td} font-medium text-slate-900`}>{s.source}</td>
                  <td className={`${td} text-right tabular-nums`}>{s.contacts}</td>
                  <td className={`${td} text-right tabular-nums`}>{s.customers}</td>
                  <td className={`${td} text-right tabular-nums`}>{pct(s.conversion)}</td>
                  <td className={`${td} w-48`}>
                    <InlineBar ratio={s.conversion} label={`${s.source} conversion rate`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
