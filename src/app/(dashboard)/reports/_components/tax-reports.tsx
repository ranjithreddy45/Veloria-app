"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { IndianRupee, Receipt, Loader2 } from "lucide-react";
import {
  getGSTReport,
  type DateRange,
  type GSTReportData,
} from "@/actions/report.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ReportExportButton } from "./report-export-button";

// ============================================================
// Helpers
// ============================================================

function formatINR(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

// ============================================================
// Component
// ============================================================

interface TaxReportsProps {
  range: DateRange;
}

export function TaxReports({ range }: TaxReportsProps) {
  const [data, setData] = React.useState<GSTReportData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    getGSTReport(range).then((res) => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading tax data...
      </div>
    );
  }

  if (!data) return null;

  const gstConfig: ChartConfig = {
    cgst: { label: "CGST", color: "hsl(217, 91%, 60%)" },
    sgst: { label: "SGST", color: "hsl(142, 71%, 45%)" },
  };

  // Compute totals for the footer
  const totals = data.months.reduce(
    (acc, row) => ({
      taxableAmount: acc.taxableAmount + row.taxableAmount,
      cgst: acc.cgst + row.cgst,
      sgst: acc.sgst + row.sgst,
      totalTax: acc.totalTax + row.totalTax,
    }),
    { taxableAmount: 0, cgst: 0, sgst: 0, totalTax: 0 }
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Taxable Amount</p>
                <p className="text-2xl font-bold">{formatINR(data.totalTaxable)}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-100">
                <IndianRupee className="size-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Tax Collected</p>
                <p className="text-2xl font-bold">{formatINR(data.totalTax)}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                <Receipt className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 1: Monthly GST Summary Chart */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly GST Summary</CardTitle>
          <p className="text-xs text-muted-foreground">CGST and SGST breakdown by month</p>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {data.months.length > 0 ? (
            <ChartContainer config={gstConfig} className="h-[300px] w-full">
              <BarChart data={data.months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(240, 5%, 92%)" />
                <XAxis dataKey="month" tickFormatter={(v) => v.split(" ")[0]} fontSize={12} />
                <YAxis tickFormatter={(v) => formatINR(v)} width={60} fontSize={12} />
                <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                <Bar dataKey="cgst" stackId="gst" fill="hsl(217, 91%, 60%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="sgst" stackId="gst" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No GST data</p>
          )}
        </CardContent>
      </Card>

      {/* Card 2: GST Detail Table */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">GST Detail</CardTitle>
              <p className="text-xs text-muted-foreground">Monthly tax breakdown</p>
            </div>
            {data.months.length > 0 && (
              <ReportExportButton
                data={data.months as unknown as Record<string, unknown>[]}
                columns={[
                  { key: "month", label: "Month" },
                  { key: "taxableAmount", label: "Taxable Amount" },
                  { key: "cgst", label: "CGST" },
                  { key: "sgst", label: "SGST" },
                  { key: "totalTax", label: "Total Tax" },
                ]}
                filename="gst-detail"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {data.months.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Taxable Amount (₹)</TableHead>
                  <TableHead className="text-right">CGST (₹)</TableHead>
                  <TableHead className="text-right">SGST (₹)</TableHead>
                  <TableHead className="text-right">Total Tax (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.months.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right">{formatINR(row.taxableAmount)}</TableCell>
                    <TableCell className="text-right">{formatINR(row.cgst)}</TableCell>
                    <TableCell className="text-right">{formatINR(row.sgst)}</TableCell>
                    <TableCell className="text-right">{formatINR(row.totalTax)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(totals.taxableAmount)}</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(totals.cgst)}</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(totals.sgst)}</TableCell>
                  <TableCell className="text-right font-bold">{formatINR(totals.totalTax)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No GST data</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
