"use client";

// ============================================================
// Employee-wise Sales metric bar chart — pick a metric, compare execs.
// Renders a horizontal bar per employee for the selected metric.
// ============================================================

import { useState } from "react";
import {
  Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from "recharts";
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
  { key: "enquiriesTotal", label: "Enquiries", color: "#6366f1" },
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
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetricKey(m.key)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
              metricKey === m.key
                ? "border-transparent text-white"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
            )}
            style={metricKey === m.key ? { backgroundColor: m.color } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          No data for the selected period / employees.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
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
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
              formatter={(v: number) => [v.toLocaleString("en-IN"), metric.label]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
              {data.map((_, i) => (
                <Cell key={i} fill={metric.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
