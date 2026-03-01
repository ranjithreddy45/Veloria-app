"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { IndianRupee, Loader2, Clock } from "lucide-react";
import {
  getVendorPaymentReport,
  getNetRevenueReport,
  type DateRange,
  type VendorPaymentReportData,
  type NetRevenueReportData,
} from "@/actions/report.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (value >= 10000000) return `\u20B9${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `\u20B9${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `\u20B9${(value / 1000).toFixed(0)}K`;
  return `\u20B9${value.toLocaleString("en-IN")}`;
}

// ============================================================
// Component
// ============================================================

interface VendorReportsProps {
  range: DateRange;
}

export function VendorReports({ range }: VendorReportsProps) {
  const [vendorData, setVendorData] = React.useState<VendorPaymentReportData | null>(null);
  const [netData, setNetData] = React.useState<NetRevenueReportData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      getVendorPaymentReport(range),
      getNetRevenueReport(range),
    ]).then(([vendorRes, netRes]) => {
      if (vendorRes.success) setVendorData(vendorRes.data);
      if (netRes.success) setNetData(netRes.data);
      setLoading(false);
    });
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading vendor data...
      </div>
    );
  }

  const netRevenueConfig: ChartConfig = {
    grossRevenue: { label: "Gross Revenue", color: "hsl(142, 71%, 45%)" },
    vendorCosts: { label: "Vendor Costs", color: "hsl(0, 84%, 60%)" },
    netRevenue: { label: "Net Revenue", color: "hsl(217, 91%, 60%)" },
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Vendor Payment Summary */}
      {vendorData && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Vendor Payment Summary</CardTitle>
                <p className="text-xs text-zinc-500">Payment status across all vendors</p>
              </div>
              <ReportExportButton
                data={vendorData.vendors as unknown as Record<string, unknown>[]}
                columns={[
                  { key: "name", label: "Vendor Name" },
                  { key: "category", label: "Category" },
                  { key: "totalPaid", label: "Paid" },
                  { key: "approved", label: "Approved" },
                  { key: "pending", label: "Pending" },
                ]}
                filename="vendor-payments"
              />
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {/* KPI Row */}
            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg bg-green-50 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-green-100">
                  <IndianRupee className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-600">Total Paid to Vendors</p>
                  <p className="text-lg font-bold text-green-700">{formatINR(vendorData.totalPaid)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100">
                  <Clock className="size-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-amber-600">Total Pending</p>
                  <p className="text-lg font-bold text-amber-700">{formatINR(vendorData.totalPending)}</p>
                </div>
              </div>
            </div>

            {/* Visual Charts Row: Payment Status Pie + Top Vendors Bar */}
            {vendorData.vendors.length > 0 && (
              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                {/* Payment Status Distribution Pie */}
                {(() => {
                  const statusData = [
                    { name: "Paid", value: vendorData.totalPaid, fill: "hsl(142, 71%, 45%)" },
                    { name: "Pending", value: vendorData.totalPending, fill: "hsl(38, 92%, 50%)" },
                  ].filter((d) => d.value > 0);
                  return (
                    <div>
                      <p className="mb-2 text-xs font-medium text-zinc-500 text-center">Payment Status Distribution</p>
                      <ChartContainer
                        config={statusData.reduce((acc, s) => {
                          acc[s.name] = { label: s.name, color: s.fill };
                          return acc;
                        }, {} as Record<string, { label: string; color: string }>)}
                        className="mx-auto h-[200px] w-full"
                      >
                        <PieChart>
                          <Tooltip content={<ChartTooltipContent hideLabel formatter={(v) => formatINR(Number(v))} />} />
                          <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" nameKey="name" stroke="white" strokeWidth={2}>
                            {statusData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="mt-2 flex items-center justify-center gap-6">
                        {statusData.map((s) => (
                          <div key={s.name} className="flex items-center gap-2">
                            <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.fill }} />
                            <span className="text-xs text-zinc-600">{s.name}: {formatINR(s.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Top Vendors by Amount Paid */}
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-500 text-center">Top Vendors by Amount Paid</p>
                  <ChartContainer
                    config={{ totalPaid: { label: "Total Paid", color: "hsl(142, 71%, 45%)" } }}
                    className="h-[200px] w-full"
                  >
                    <BarChart
                      data={[...vendorData.vendors]
                        .sort((a, b) => b.totalPaid - a.totalPaid)
                        .slice(0, 6)
                        .map((v) => ({
                          name: v.name.length > 14 ? v.name.slice(0, 14) + "…" : v.name,
                          totalPaid: v.totalPaid,
                        }))}
                      layout="vertical"
                      margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(240, 5%, 92%)" />
                      <XAxis type="number" tickFormatter={(v) => formatINR(v)} fontSize={12} />
                      <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                      <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                      <Bar dataKey="totalPaid" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {/* Vendor Table */}
            {vendorData.vendors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left">
                      <th className="pb-2 pr-4 font-medium text-zinc-500">Vendor Name</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-500">Category</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Paid</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Approved</th>
                      <th className="pb-2 font-medium text-zinc-500 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorData.vendors.map((vendor) => (
                      <tr key={vendor.vendorId} className="border-b border-zinc-100">
                        <td className="py-2.5 pr-4 font-medium">{vendor.name}</td>
                        <td className="py-2.5 pr-4 text-zinc-600">{vendor.category}</td>
                        <td className="py-2.5 pr-4 text-right text-green-700">{formatINR(vendor.totalPaid)}</td>
                        <td className="py-2.5 pr-4 text-right text-blue-700">{formatINR(vendor.approved)}</td>
                        <td className="py-2.5 text-right text-amber-700">{formatINR(vendor.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">No vendor payment data</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card 2: Net Revenue Analysis */}
      {netData && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Net Revenue Analysis</CardTitle>
            <p className="text-xs text-zinc-500">Gross revenue vs vendor costs per month</p>
          </CardHeader>
          <CardContent className="pb-4">
            {/* KPI Row */}
            <div className="mb-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-green-50 px-3 py-2">
                <p className="text-xs text-green-600">Total Gross Revenue</p>
                <p className="text-lg font-bold text-green-700">{formatINR(netData.totalGross)}</p>
              </div>
              <div className="rounded-lg bg-red-50 px-3 py-2">
                <p className="text-xs text-red-600">Total Vendor Costs</p>
                <p className="text-lg font-bold text-red-700">{formatINR(netData.totalVendorCosts)}</p>
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-2">
                <p className="text-xs text-blue-600">Net Revenue</p>
                <p className="text-lg font-bold text-blue-700">{formatINR(netData.totalNet)}</p>
              </div>
            </div>

            {/* Grouped Bar Chart + Line */}
            {netData.months.length > 0 ? (
              <ChartContainer config={netRevenueConfig} className="h-[350px] w-full">
                <ComposedChart data={netData.months} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(240, 5%, 92%)" />
                  <XAxis dataKey="month" tickFormatter={(v) => v.split(" ")[0]} fontSize={12} />
                  <YAxis tickFormatter={(v) => formatINR(v)} width={60} fontSize={12} />
                  <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                  <Bar dataKey="grossRevenue" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="vendorCosts" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line
                    type="monotone"
                    dataKey="netRevenue"
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(217, 91%, 60%)" }}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">No revenue data</p>
            )}

            {/* Legend */}
            <div className="mt-3 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: "hsl(142, 71%, 45%)" }} />
                <span className="text-xs text-zinc-600">Gross Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: "hsl(0, 84%, 60%)" }} />
                <span className="text-xs text-zinc-600">Vendor Costs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: "hsl(217, 91%, 60%)" }} />
                <span className="text-xs text-zinc-600">Net Revenue</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
