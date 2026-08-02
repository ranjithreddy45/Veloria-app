"use client";

// ============================================================
// Employee-wise Sales metric bar chart — pick a metric, compare execs.
// Renders a horizontal bar per employee for the selected metric.
// ============================================================

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export interface SalesEmployeeRow {
  userId: string;
  name: string;
  enquiriesCold: number;
  enquiriesCampaign: number;
  enquiriesTotal: number;
  siteVisits: number;
  quotationsSent: number;
  paymentLinksSent: number;
  advanceCollected: number;
  bookingsConfirmed: number;
  bookingsLost: number;
  upsellValue: number;
  revenue: number;
  salesScore: number;
}

const METRICS: { key: keyof SalesEmployeeRow; label: string; color: string }[] = [
  // enquiriesTotal counts Lead rows (field name kept — /sales/reports reads it).
  { key: "enquiriesTotal", label: "Leads", color: "#6366f1" },
  { key: "siteVisits", label: "Site visits", color: "#ec4899" },
  { key: "quotationsSent", label: "Quotations", color: "#0ea5e9" },
  { key: "paymentLinksSent", label: "Payment links", color: "#14b8a6" },
  { key: "advanceCollected", label: "Advance ₹", color: "#10b981" },
  { key: "bookingsConfirmed", label: "Confirmed", color: "#22c55e" },
  { key: "bookingsLost", label: "Lost", color: "#ef4444" },
  { key: "upsellValue", label: "Upsell ₹", color: "#f59e0b" },
  { key: "salesScore", label: "Sales score", color: "#a855f7" },
];

export function SalesEmployeeChart({ employees }: { employees: SalesEmployeeRow[] }) {
  const [metricKey, setMetricKey] = useState<keyof SalesEmployeeRow>("enquiriesTotal");
  const metric = METRICS.find((m) => m.key === metricKey)!;

  const data = [...employees]
    .map((e) => ({ name: e.name, value: Number(e[metricKey]) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {METRICS.map((m) => {
          const active = metricKey === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetricKey(m.key)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-2.5 py-1 text-detail font-medium transition-colors duration-200",
                active
                  ? "border-transparent text-white shadow-card"
                  : "border-border/70 bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
              )}
              style={active ? { backgroundColor: m.color } : undefined}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {data.length === 0 ? (
        <EmptyState
          className="px-0 py-12"
          icon={<BarChart3 />}
          title="Nothing to compare yet"
          description="No employee activity matched the selected period or filter. Widen the date range to see the team side by side."
        />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 12, fill: "currentColor" }}
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
              wrapperClassName="text-foreground"
              contentStyle={{
                fontSize: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                boxShadow: "0 8px 24px oklch(0 0 0 / 10%)",
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 2 }}
              itemStyle={{ color: "var(--popover-foreground)" }}
              formatter={(v: number) => [v.toLocaleString("en-IN"), metric.label]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
              {data.map((_, i) => (
                <Cell key={i} fill={metric.color} fillOpacity={0.9} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                offset={8}
                className="fill-muted-foreground"
                fontSize={11}
                formatter={(v: number) => v.toLocaleString("en-IN")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
