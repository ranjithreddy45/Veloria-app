"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { IndianRupee, Loader2 } from "lucide-react";
import {
  getPaymentMethodReport,
  getSettlementReport,
  getDepositReport,
  getRevenueBreakdownReport,
  getDiscountReport,
  type DateRange,
  type PaymentMethodReportData,
  type SettlementReportData,
  type DepositReportData,
  type RevenueBreakdownData,
  type DiscountReportData,
} from "@/actions/report.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
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

const STATUS_BADGE_CLASSES: Record<string, string> = {
  PAID: "bg-green-100 text-green-700 border-green-200",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700 border-amber-200",
  SENT: "bg-blue-100 text-blue-700 border-blue-200",
  OVERDUE: "bg-red-100 text-red-700 border-red-200",
  DRAFT: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

// ============================================================
// Component
// ============================================================

interface FinancialReportsProps {
  range: DateRange;
}

export function FinancialReports({ range }: FinancialReportsProps) {
  const [paymentData, setPaymentData] = React.useState<PaymentMethodReportData | null>(null);
  const [settlementData, setSettlementData] = React.useState<SettlementReportData | null>(null);
  const [depositData, setDepositData] = React.useState<DepositReportData | null>(null);
  const [breakdownData, setBreakdownData] = React.useState<RevenueBreakdownData | null>(null);
  const [discountData, setDiscountData] = React.useState<DiscountReportData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      getPaymentMethodReport(range),
      getSettlementReport(range),
      getDepositReport(range),
      getRevenueBreakdownReport(range),
      getDiscountReport(range),
    ]).then(([paymentRes, settlementRes, depositRes, breakdownRes, discountRes]) => {
      if (paymentRes.success) setPaymentData(paymentRes.data);
      if (settlementRes.success) setSettlementData(settlementRes.data);
      if (depositRes.success) setDepositData(depositRes.data);
      if (breakdownRes.success) setBreakdownData(breakdownRes.data);
      if (discountRes.success) setDiscountData(discountRes.data);
      setLoading(false);
    });
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading financial data...
      </div>
    );
  }

  // Chart configs
  const paymentMethodConfig: ChartConfig = paymentData
    ? paymentData.methods.reduce((acc, item) => {
        acc[item.method] = { label: item.method.replace(/_/g, " "), color: item.fill };
        return acc;
      }, {} as ChartConfig)
    : {};

  const categoryConfig: ChartConfig = breakdownData
    ? breakdownData.categories.reduce((acc, item) => {
        acc[item.category] = { label: item.category, color: item.fill };
        return acc;
      }, {} as ChartConfig)
    : {};

  return (
    <div className="space-y-6">
      {/* Row 1: Payment Method Breakdown + Settlement Report */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Card 1: Payment Method Breakdown */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Method Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">Distribution by payment method</p>
          </CardHeader>
          <CardContent className="pb-4">
            {/* KPI */}
            <div className="mb-4 flex items-start justify-between rounded-lg bg-zinc-50 p-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Total Payments Collected</p>
                <p className="text-xl font-bold">{formatINR(paymentData?.total ?? 0)}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100">
                <IndianRupee className="size-4 text-emerald-600" />
              </div>
            </div>

            {paymentData && paymentData.methods.length > 0 ? (
              <>
                <ChartContainer config={paymentMethodConfig} className="mx-auto h-[220px] w-full">
                  <PieChart>
                    <Tooltip content={<ChartTooltipContent hideLabel formatter={(v) => formatINR(Number(v))} />} />
                    <Pie
                      data={paymentData.methods}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="amount"
                      nameKey="method"
                      stroke="white"
                      strokeWidth={2}
                    >
                      {paymentData.methods.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
                  {paymentData.methods.map((item) => (
                    <div key={item.method} className="flex items-center gap-2">
                      <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="truncate text-xs text-muted-foreground">{item.method.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No payment data</p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Payment Settlement Report */}
        <Card className="border-zinc-200/80 shadow-sm lg:col-span-8">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Payment Settlements</CardTitle>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs font-normal">
                    Invoiced: {formatINR(settlementData?.totalInvoiced ?? 0)}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-normal">
                    Paid: {formatINR(settlementData?.totalPaid ?? 0)}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-normal">
                    Outstanding: {formatINR(settlementData?.totalOutstanding ?? 0)}
                  </Badge>
                </div>
              </div>
              {settlementData && (
                <ReportExportButton
                  data={settlementData.bookings as unknown as Record<string, unknown>[]}
                  columns={[
                    { key: "eventName", label: "Event Name" },
                    { key: "invoiced", label: "Invoiced" },
                    { key: "paid", label: "Paid" },
                    { key: "outstanding", label: "Outstanding" },
                    { key: "status", label: "Status" },
                  ]}
                  filename="payment-settlements"
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {/* Settlement Stacked Bar Chart: Paid vs Outstanding per Booking */}
            {settlementData && settlementData.bookings.length > 0 && (
              <div className="mb-6">
                <ChartContainer
                  config={{
                    paid: { label: "Paid", color: "hsl(142, 71%, 45%)" },
                    outstanding: { label: "Outstanding", color: "hsl(0, 84%, 60%)" },
                  }}
                  className="h-[220px] w-full"
                >
                  <BarChart
                    data={settlementData.bookings.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(240, 5%, 92%)" />
                    <XAxis type="number" tickFormatter={(v) => formatINR(v)} fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="eventName"
                      width={130}
                      fontSize={11}
                      tickFormatter={(v) => (v.length > 18 ? v.slice(0, 18) + "…" : v)}
                    />
                    <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="paid" stackId="settlement" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="outstanding" stackId="settlement" fill="hsl(0, 84%, 60%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            {settlementData && settlementData.bookings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Name</TableHead>
                    <TableHead className="text-right">Invoiced (₹)</TableHead>
                    <TableHead className="text-right">Paid (₹)</TableHead>
                    <TableHead className="text-right">Outstanding (₹)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlementData.bookings.map((row) => (
                    <TableRow key={row.bookingId}>
                      <TableCell className="font-medium">{row.eventName}</TableCell>
                      <TableCell className="text-right">{formatINR(row.invoiced)}</TableCell>
                      <TableCell className="text-right">{formatINR(row.paid)}</TableCell>
                      <TableCell className="text-right">{formatINR(row.outstanding)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-meta",
                            STATUS_BADGE_CLASSES[row.status] ?? "bg-zinc-100 text-zinc-500 border-zinc-200"
                          )}
                        >
                          {row.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No settlement data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Card 3: Advance Deposits */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Advance Deposits</CardTitle>
              <p className="text-xs text-muted-foreground">
                Total deposits: {formatINR(depositData?.totalDeposits ?? 0)}
              </p>
            </div>
            {depositData && (
              <ReportExportButton
                data={depositData.deposits as unknown as Record<string, unknown>[]}
                columns={[
                  { key: "eventName", label: "Event" },
                  { key: "contactName", label: "Client" },
                  { key: "amount", label: "Amount" },
                  { key: "method", label: "Method" },
                  { key: "paidAt", label: "Date" },
                ]}
                filename="advance-deposits"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {/* Deposits by Payment Method Bar Chart */}
          {depositData && depositData.deposits.length > 0 && (() => {
            const methodTotals = depositData.deposits.reduce((acc, d) => {
              const method = d.method.replace(/_/g, " ");
              acc[method] = (acc[method] ?? 0) + d.amount;
              return acc;
            }, {} as Record<string, number>);
            const methodChartData = Object.entries(methodTotals)
              .map(([method, amount]) => ({ method, amount }))
              .sort((a, b) => b.amount - a.amount);
            const DEPOSIT_COLORS = [
              "hsl(239, 84%, 67%)", "hsl(160, 84%, 39%)", "hsl(30, 95%, 50%)",
              "hsl(340, 82%, 52%)", "hsl(270, 70%, 55%)", "hsl(200, 75%, 50%)",
            ];
            return (
              <div className="mb-6">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Deposits by Payment Method</p>
                <ChartContainer
                  config={methodChartData.reduce((acc, item, i) => {
                    acc[item.method] = { label: item.method, color: DEPOSIT_COLORS[i % DEPOSIT_COLORS.length] };
                    return acc;
                  }, {} as ChartConfig)}
                  className="h-[180px] w-full"
                >
                  <BarChart data={methodChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(240, 5%, 92%)" />
                    <XAxis dataKey="method" fontSize={12} />
                    <YAxis tickFormatter={(v) => formatINR(v)} width={60} fontSize={12} />
                    <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {methodChartData.map((_, i) => (
                        <Cell key={i} fill={DEPOSIT_COLORS[i % DEPOSIT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            );
          })()}

          {depositData && depositData.deposits.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {depositData.deposits.map((row, i) => (
                  <TableRow key={`${row.bookingId}-${i}`}>
                    <TableCell className="font-medium">{row.eventName}</TableCell>
                    <TableCell>{row.contactName}</TableCell>
                    <TableCell className="text-right">{formatINR(row.amount)}</TableCell>
                    <TableCell>{row.method.replace(/_/g, " ")}</TableCell>
                    <TableCell>{row.paidAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No deposit data</p>
          )}
        </CardContent>
      </Card>

      {/* Card 4: Revenue by Category */}
      {breakdownData && breakdownData.categories.length > 0 && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Category</CardTitle>
            <p className="text-xs text-muted-foreground">Breakdown across service categories</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ChartContainer config={categoryConfig} className="h-[250px] w-full">
              <BarChart
                data={breakdownData.categories}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(240, 5%, 92%)" />
                <XAxis type="number" tickFormatter={(v) => formatINR(v)} fontSize={12} />
                <YAxis type="category" dataKey="category" width={120} fontSize={12} />
                <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {breakdownData.categories.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Card 5: Discounts Applied */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Discounts Applied</CardTitle>
              <p className="text-xs text-muted-foreground">
                Total discounts given: {formatINR(discountData?.totalDiscounts ?? 0)}
              </p>
            </div>
            {discountData && (
              <ReportExportButton
                data={discountData.discounts as unknown as Record<string, unknown>[]}
                columns={[
                  { key: "quoteNumber", label: "Quote #" },
                  { key: "eventName", label: "Event" },
                  { key: "subtotal", label: "Subtotal" },
                  { key: "discountPercent", label: "Discount %" },
                  { key: "discountAmount", label: "Discount Amount" },
                  { key: "contactName", label: "Client" },
                ]}
                filename="discounts-applied"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {/* Discounts by Event Horizontal Bar Chart */}
          {discountData && discountData.discounts.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Discount Amount by Event</p>
              <ChartContainer
                config={{ discountAmount: { label: "Discount", color: "hsl(30, 95%, 50%)" } }}
                className="h-[200px] w-full"
              >
                <BarChart
                  data={discountData.discounts.slice(0, 8).map((d) => ({
                    name: d.eventName.length > 20 ? d.eventName.slice(0, 20) + "…" : d.eventName,
                    discountAmount: d.discountAmount,
                    discountPercent: d.discountPercent,
                  }))}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(240, 5%, 92%)" />
                  <XAxis type="number" tickFormatter={(v) => formatINR(v)} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={140} fontSize={11} />
                  <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                  <Bar dataKey="discountAmount" fill="hsl(30, 95%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}

          {discountData && discountData.discounts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Subtotal (₹)</TableHead>
                  <TableHead className="text-right">Discount %</TableHead>
                  <TableHead className="text-right">Discount Amount (₹)</TableHead>
                  <TableHead>Client</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountData.discounts.map((row, i) => (
                  <TableRow key={`${row.quoteNumber}-${i}`}>
                    <TableCell className="font-medium">{row.quoteNumber}</TableCell>
                    <TableCell>{row.eventName}</TableCell>
                    <TableCell className="text-right">{formatINR(row.subtotal)}</TableCell>
                    <TableCell className="text-right">{row.discountPercent}%</TableCell>
                    <TableCell className="text-right">{formatINR(row.discountAmount)}</TableCell>
                    <TableCell>{row.contactName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No discount data</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
