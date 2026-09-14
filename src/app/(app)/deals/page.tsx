import type { Metadata } from "next";
import { ButtonLink, PageHeader, buttonClass } from "@/components/ui";
import { OPEN_STAGES } from "@/lib/constants";
import { listDeals } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { DealBoard, type BoardDeal } from "./board";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  const user = await requireUser();
  // Open deals plus anything closed in the last 90 days.
  const deals = await listDeals(user, { recentClosedDays: 90 });

  const open = deals.filter((d) => (OPEN_STAGES as string[]).includes(d.stage));
  const pipeline = open.reduce((sum, d) => sum + d.value, 0);
  const weighted = open.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0);

  const boardDeals: BoardDeal[] = deals.map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value,
    currency: d.currency,
    stage: d.stage,
    companyName: d.company?.name ?? null,
    ownerName: d.owner?.name ?? null,
    expectedClose: d.expectedClose?.toISOString() ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Deals"
        description={`${open.length} open · ${formatCurrency(pipeline)} pipeline · ${formatCurrency(weighted)} weighted forecast`}
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
      <p className="mb-3 text-xs text-slate-500">Drag cards between stages. Won and lost columns show the last 90 days.</p>
      <DealBoard deals={boardDeals} />
    </>
  );
}
