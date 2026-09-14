import type { Metadata } from "next";
import { LiveRefresh } from "@/components/live-refresh";
import { ButtonLink, PageHeader, buttonClass } from "@/components/ui";
import { OPEN_STAGES } from "@/lib/constants";
import { listDeals } from "@/lib/crm";
import { env } from "@/lib/env";
import { getDealHealthMap, getDealsVersion } from "@/lib/health";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { DealBoard, type BoardDeal } from "./board";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  const user = await requireUser();
  // Open deals plus anything closed in the last 90 days.
  const [deals, version] = await Promise.all([listDeals(user, { recentClosedDays: 90 }), getDealsVersion(user)]);
  const health = await getDealHealthMap(deals);

  const currency = env.CURRENCY;
  const open = deals.filter((d) => (OPEN_STAGES as string[]).includes(d.stage));
  const openInCurrency = open.filter((d) => d.currency === currency);
  const pipeline = openInCurrency.reduce((sum, d) => sum + d.value, 0);
  const weighted = openInCurrency.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0);
  const atRisk = [...health.values()].filter((h) => h.level === "at_risk").length;

  const boardDeals: BoardDeal[] = deals.map((d) => {
    const h = health.get(d.id);
    return {
      id: d.id,
      title: d.title,
      value: d.value,
      currency: d.currency,
      stage: d.stage,
      companyName: d.company?.name ?? null,
      ownerName: d.owner?.name ?? null,
      expectedClose: d.expectedClose?.toISOString() ?? null,
      health: h ? { level: h.level, score: h.score } : null,
    };
  });

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Deals <LiveRefresh endpoint="/api/deals/version" version={version} />
          </span>
        }
        description={`${open.length} open · ${formatCurrency(pipeline, currency)} pipeline · ${formatCurrency(weighted, currency)} weighted forecast · ${atRisk} at risk`}
        actions={
          <>
            {can.exportData(user) && (
              // eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler
              <a className={buttonClass("secondary")} href="/api/export/deals">
                Export CSV
              </a>
            )}
            <ButtonLink href="/deals/new">New deal</ButtonLink>
          </>
        }
      />
      <p className="mb-3 text-xs text-slate-500">
        Drag cards between stages. Health scores flag deals that have gone quiet, missed their close date or lack a next
        step. Won and lost columns show the last 90 days.
      </p>
      <DealBoard deals={boardDeals} currency={currency} />
    </>
  );
}
