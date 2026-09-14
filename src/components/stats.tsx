import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

/**
 * Stat tile: label · value · optional delta · optional hint.
 * Delta direction is shown with an arrow and sign, never color alone.
 */
export function StatTile({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { value: number; label: string; upIsGood?: boolean };
}) {
  const good = delta ? (delta.value >= 0) === (delta.upIsGood ?? true) : false;
  return (
    <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {delta && delta.value !== 0 && (
        <p className={cx("mt-1 text-xs font-medium", good ? "text-emerald-700" : "text-red-700")}>
          {delta.value > 0 ? "▲ +" : "▼ "}
          {delta.value.toLocaleString("en-US")} {delta.label}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Thin horizontal meter: same-hue lighter track, series-colored fill. */
export function InlineBar({ ratio, label }: { ratio: number; label: string }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      className="h-1.5 w-full min-w-16 rounded-full bg-viz-track"
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-1.5 rounded-full bg-viz-series" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Accessible table twin for a chart. */
export function ChartTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800">View as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              {headers.map((h, i) => (
                <th key={h} className={cx("py-1.5 pr-4 font-medium", i > 0 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-slate-100 last:border-0">
                {row.map((cell, i) => (
                  <td key={i} className={cx("py-1.5 pr-4 text-slate-700", i > 0 && "text-right tabular-nums")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
