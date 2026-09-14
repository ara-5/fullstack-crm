"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIsDark } from "@/components/theme";
import { formatCurrency } from "@/lib/utils";

// Chart tokens from the dataviz reference palette. Single-series charts use
// categorical slot 1 only (validated against both card surfaces), so no legend
// is needed: the card title names the series.
const LIGHT = {
  series: "#2a78d6",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  muted: "#6b6a66",
  inkSecondary: "#52514e",
  cursor: "rgba(42,120,214,0.08)",
  tooltip: { background: "#ffffff", color: "#0b0b0b", border: "1px solid rgba(11,11,11,0.10)" },
};
const DARK = {
  series: "#3987e5",
  grid: "#1e293b",
  baseline: "#334155",
  muted: "#a3afc2",
  inkSecondary: "#cbd5e1",
  cursor: "rgba(57,135,229,0.14)",
  tooltip: { background: "#0f172a", color: "#f8fafc", border: "1px solid rgba(255,255,255,0.12)" },
};

function useChartTheme() {
  const t = useIsDark() ? DARK : LIGHT;
  return {
    ...t,
    tooltipStyle: { ...t.tooltip, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", fontSize: 12 },
  };
}

export function MonthlyWonChart({
  data,
  currency,
}: {
  data: { month: string; won: number; deals: number }[];
  currency: string;
}) {
  const t = useChartTheme();
  return (
    <div className="h-64" role="img" aria-label="Column chart of won revenue per month for the last six months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={t.grid} />
          <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: t.baseline }} tick={{ fill: t.muted, fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: t.muted, fontSize: 12 }}
            tickFormatter={(v: number) => formatCurrency(v, currency, true)}
          />
          <Tooltip
            cursor={{ fill: t.cursor }}
            contentStyle={t.tooltipStyle}
            labelStyle={{ color: t.tooltip.color }}
            itemStyle={{ color: t.tooltip.color }}
            formatter={(value, _name, item) => [
              `${formatCurrency(Number(value), currency)} · ${item.payload.deals} deal${item.payload.deals === 1 ? "" : "s"}`,
              "Won",
            ]}
          />
          <Bar dataKey="won" fill={t.series} maxBarSize={24} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PipelineStageChart({
  data,
  currency,
}: {
  data: { label: string; value: number; count: number }[];
  currency: string;
}) {
  const t = useChartTheme();
  return (
    <div className="h-56" role="img" aria-label="Bar chart of open pipeline value by stage">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap="30%">
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={112}
            tick={{ fill: t.inkSecondary, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: t.cursor }}
            contentStyle={t.tooltipStyle}
            labelStyle={{ color: t.tooltip.color }}
            itemStyle={{ color: t.tooltip.color }}
            formatter={(value) => [formatCurrency(Number(value), currency), "Pipeline"]}
          />
          <Bar dataKey="value" fill={t.series} maxBarSize={24} radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => formatCurrency(Number(v), currency, true)}
              style={{ fill: t.inkSecondary, fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
