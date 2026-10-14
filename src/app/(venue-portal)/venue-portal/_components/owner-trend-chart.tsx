"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// ============================================================
// Owner dashboard — six-month trend (counts only).
// ------------------------------------------------------------
// Three series side by side per month. Colours are validated as a set
// (adjacent-pair colour-blind separation and 3:1 against the card, light and
// dark): sky-600 for enquiries (the calendar's enquiry hue), violet-600 for
// converted, emerald-600 for bookings (the calendar's "booked" hue). A legend
// names them so colour is never the only cue, and a screen-reader table
// carries the same numbers.
// ============================================================

export interface TrendPoint {
  key: string;
  label: string;
  leads: number;
  converted: number;
  bookings: number;
}

const config = {
  leads: { label: "Leads", color: "#0284c7" },
  converted: { label: "Converted", color: "#7c3aed" },
  bookings: { label: "Bookings", color: "#059669" },
} satisfies ChartConfig;

export function OwnerTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <>
      <ChartContainer config={config} className="aspect-auto h-[240px] w-full sm:h-[280px]">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} fontSize={12} />
          <ChartTooltip cursor={{ fillOpacity: 0.5 }} content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="leads" fill="var(--color-leads)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="converted" fill="var(--color-converted)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="bookings" fill="var(--color-bookings)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ChartContainer>

      {/* The wrapper carries sr-only, not the table: a <table> ignores the
          1px width and its full width leaked into the page's scroll width. */}
      <div className="sr-only">
        <table>
          <caption>Leads, converted leads and confirmed bookings per month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Leads</th>
              <th scope="col">Converted</th>
              <th scope="col">Bookings</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.key}>
                <th scope="row">{m.label}</th>
                <td>{m.leads}</td>
                <td>{m.converted}</td>
                <td>{m.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
