import Link from "next/link";
import { EmptyState, StatusBadge } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

export function DealList({
  deals,
}: {
  deals: { id: string; title: string; value: number; currency: string; stage: string }[];
}) {
  if (deals.length === 0) return <EmptyState>No deals yet.</EmptyState>;
  return (
    <ul className="divide-y divide-slate-100">
      {deals.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-2">
          <Link href={`/deals/${d.id}`} className="min-w-0 truncate text-sm font-medium text-slate-900 hover:text-indigo-600">
            {d.title}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm tabular-nums text-slate-700">{formatCurrency(d.value, d.currency)}</span>
            <StatusBadge value={d.stage} />
          </div>
        </li>
      ))}
    </ul>
  );
}
