"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";

// Chart tokens (reference dataviz palette, light mode). Single-series charts use
// categorical slot 1 only, so no legend is needed: the card title names the series.
export const CHART = {
  series: "#2a78d6",
  track: "#cde2fb",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  muted: "#898781",
  inkSecondary: "#52514e",
};

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid rgba(11,11,11,0.10)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: 12,
  color: "#0b0b0b",
};

export function MonthlyWonChart({ data }: { data: { month: string; won: number; deals: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Column chart of won revenue per month for the last six months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: CHART.baseline }}
            tick={{ fill: CHART.muted, fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: CHART.muted, fontSize: 12 }}
            tickFormatter={(v: number) => formatCurrency(v, "USD", true)}
          />
          <Tooltip
            cursor={{ fill: "rgba(42,120,214,0.08)" }}
            contentStyle={tooltipStyle}
            formatter={(value, _name, item) => [
              `${formatCurrency(Number(value))} · ${item.payload.deals} deal${item.payload.deals === 1 ? "" : "s"}`,
              "Won",
            ]}
          />
          <Bar dataKey="won" fill={CHART.series} maxBarSize={24} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PipelineStageChart({ data }: { data: { label: string; value: number; count: number }[] }) {
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
            tick={{ fill: CHART.inkSecondary, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(42,120,214,0.08)" }}
            contentStyle={tooltipStyle}
            formatter={(value) => [formatCurrency(Number(value)), "Pipeline"]}
          />
          <Bar dataKey="value" fill={CHART.series} maxBarSize={24} radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => formatCurrency(Number(v), "USD", true)}
              style={{ fill: CHART.inkSecondary, fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
