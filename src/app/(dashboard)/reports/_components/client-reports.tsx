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
} from "recharts";
import { Loader2, Users } from "lucide-react";
import {
  getVIPClientReport,
  getClientTypeReport,
  getClientLedger,
  type DateRange,
  type VIPClientData,
  type ClientTypeReportData,
  type ClientLedgerData,
} from "@/actions/report.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

interface ClientReportsProps {
  range: DateRange;
}

export function ClientReports({ range }: ClientReportsProps) {
  const [vipData, setVipData] = React.useState<VIPClientData | null>(null);
  const [typeData, setTypeData] = React.useState<ClientTypeReportData | null>(null);
  const [ledgerData, setLedgerData] = React.useState<ClientLedgerData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [contactId, setContactId] = React.useState("");
  const [ledgerLoading, setLedgerLoading] = React.useState(false);
  const [ledgerError, setLedgerError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      getVIPClientReport(),
      getClientTypeReport(range),
    ]).then(([vipRes, typeRes]) => {
      if (vipRes.success) setVipData(vipRes.data);
      if (typeRes.success) setTypeData(typeRes.data);
      setLoading(false);
    });
  }, [range]);

  const handleLoadLedger = () => {
    if (!contactId.trim()) return;
    setLedgerLoading(true);
    setLedgerError(null);
    setLedgerData(null);
    getClientLedger(contactId.trim()).then((res) => {
      if (res.success) {
        setLedgerData(res.data);
      } else {
        setLedgerError(res.error ?? "Failed to load ledger");
      }
      setLedgerLoading(false);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading client data...
      </div>
    );
  }

  const typeConfig: ChartConfig = typeData
    ? typeData.types.reduce((acc, item) => {
        acc[item.type] = { label: item.type, color: item.fill };
        return acc;
      }, {} as ChartConfig)
    : {};

  return (
    <div className="space-y-6">
      {/* Card 1: VIP Clients Table */}
      {vipData && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">VIP Clients</CardTitle>
                <p className="text-xs text-zinc-500">Gold &amp; Platinum loyalty tier clients</p>
              </div>
              <ReportExportButton
                data={vipData.clients as unknown as Record<string, unknown>[]}
                columns={[
                  { key: "name", label: "Client Name" },
                  { key: "email", label: "Email" },
                  { key: "tier", label: "Tier" },
                  { key: "points", label: "Points" },
                  { key: "totalSpend", label: "Total Spend" },
                  { key: "bookingCount", label: "Bookings" },
                ]}
                filename="vip-clients"
              />
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {/* VIP Clients – Top Spenders Bar Chart */}
            {vipData.clients.length > 0 && (
              <div className="mb-6">
                <p className="mb-2 text-xs font-medium text-zinc-500">Top VIP Clients by Total Spend</p>
                <ChartContainer
                  config={{ totalSpend: { label: "Total Spend", color: "hsl(262, 83%, 58%)" } }}
                  className="h-[220px] w-full"
                >
                  <BarChart
                    data={[...vipData.clients]
                      .sort((a, b) => b.totalSpend - a.totalSpend)
                      .slice(0, 8)
                      .map((c) => ({
                        name: c.name.length > 16 ? c.name.slice(0, 16) + "…" : c.name,
                        totalSpend: c.totalSpend,
                        tier: c.tier,
                      }))}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(240, 5%, 92%)" />
                    <XAxis type="number" tickFormatter={(v) => formatINR(v)} fontSize={12} />
                    <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                    <Tooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                    <Bar dataKey="totalSpend" radius={[0, 4, 4, 0]}>
                      {[...vipData.clients]
                        .sort((a, b) => b.totalSpend - a.totalSpend)
                        .slice(0, 8)
                        .map((c, i) => (
                          <Cell
                            key={i}
                            fill={c.tier === "PLATINUM" ? "hsl(262, 83%, 58%)" : "hsl(38, 92%, 50%)"}
                          />
                        ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <div className="mt-2 flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: "hsl(262, 83%, 58%)" }} />
                    <span className="text-xs text-zinc-600">Platinum</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: "hsl(38, 92%, 50%)" }} />
                    <span className="text-xs text-zinc-600">Gold</span>
                  </div>
                </div>
              </div>
            )}

            {vipData.clients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left">
                      <th className="pb-2 pr-4 font-medium text-zinc-500">Client Name</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-500">Email</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-500">Tier</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Points</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Total Spend</th>
                      <th className="pb-2 font-medium text-zinc-500 text-right">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vipData.clients.map((client) => (
                      <tr key={client.contactId} className="border-b border-zinc-100">
                        <td className="py-2.5 pr-4 font-medium">{client.name}</td>
                        <td className="py-2.5 pr-4 text-zinc-600">{client.email}</td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              client.tier === "PLATINUM"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-amber-100 text-amber-700"
                            )}
                          >
                            {client.tier}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right">{client.points.toLocaleString()}</td>
                        <td className="py-2.5 pr-4 text-right">{formatINR(client.totalSpend)}</td>
                        <td className="py-2.5 text-right">{client.bookingCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">No VIP clients found</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card 2: Client Type Breakdown Pie Chart */}
      {typeData && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Client Type Breakdown</CardTitle>
            <p className="text-xs text-zinc-500">Individual vs Corporate clients</p>
          </CardHeader>
          <CardContent className="pb-4">
            {/* KPI: Total Clients */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-100">
                <Users className="size-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">Total Clients</p>
                <p className="text-xl font-bold">{typeData.totalClients}</p>
              </div>
            </div>

            {typeData.types.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Bookings Pie */}
                <div>
                  <p className="mb-2 text-center text-xs font-medium text-zinc-500">Bookings</p>
                  <ChartContainer config={typeConfig} className="mx-auto h-[200px] w-full">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={typeData.types}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="bookingCount"
                        nameKey="type"
                        stroke="white"
                        strokeWidth={2}
                      >
                        {typeData.types.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>

                {/* Revenue Pie */}
                <div>
                  <p className="mb-2 text-center text-xs font-medium text-zinc-500">Revenue</p>
                  <ChartContainer config={typeConfig} className="mx-auto h-[200px] w-full">
                    <PieChart>
                      <Tooltip content={<ChartTooltipContent hideLabel formatter={(v) => formatINR(Number(v))} />} />
                      <Pie
                        data={typeData.types}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="revenue"
                        nameKey="type"
                        stroke="white"
                        strokeWidth={2}
                      >
                        {typeData.types.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">No client data</p>
            )}

            {typeData.types.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-6">
                {typeData.types.map((item) => (
                  <div key={item.type} className="flex items-center gap-2">
                    <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span className="text-xs text-zinc-600">{item.type}</span>
                    <span className="text-xs font-medium">{item.bookingCount} bookings</span>
                    <span className="text-xs text-zinc-400">({formatINR(item.revenue)})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card 3: Client Ledger Lookup */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Client Ledger Lookup</CardTitle>
          <p className="text-xs text-zinc-500">Search and view a client&apos;s financial history</p>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="contactId" className="mb-1 block text-xs font-medium text-zinc-500">
                Contact ID
              </label>
              <Input
                id="contactId"
                placeholder="Enter contact ID..."
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLoadLedger();
                }}
              />
            </div>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={handleLoadLedger}
              disabled={ledgerLoading || !contactId.trim()}
            >
              {ledgerLoading ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Load Ledger
            </Button>
          </div>

          {ledgerError && (
            <p className="mt-3 text-sm text-red-500">{ledgerError}</p>
          )}

          {ledgerData && (
            <div className="mt-6 space-y-4">
              {/* Client Info & KPI Badges */}
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-semibold">
                  {ledgerData.contactName}
                </h3>
                <span className="text-xs text-zinc-400">{ledgerData.contactEmail}</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-lg bg-blue-50 px-3 py-2">
                  <p className="text-xs text-blue-600">Total Invoiced</p>
                  <p className="text-sm font-bold text-blue-700">{formatINR(ledgerData.totalInvoiced)}</p>
                </div>
                <div className="rounded-lg bg-green-50 px-3 py-2">
                  <p className="text-xs text-green-600">Total Paid</p>
                  <p className="text-sm font-bold text-green-700">{formatINR(ledgerData.totalPaid)}</p>
                </div>
                <div className={cn(
                  "rounded-lg px-3 py-2",
                  ledgerData.balance > 0 ? "bg-red-50" : "bg-zinc-50"
                )}>
                  <p className={cn("text-xs", ledgerData.balance > 0 ? "text-red-600" : "text-zinc-600")}>Balance</p>
                  <p className={cn("text-sm font-bold", ledgerData.balance > 0 ? "text-red-700" : "text-zinc-700")}>
                    {formatINR(ledgerData.balance)}
                  </p>
                </div>
              </div>

              {/* Ledger Visual Breakdown: Invoice Status + Payment Method */}
              {(ledgerData.invoices.length > 0 || ledgerData.payments.length > 0) && (
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Invoice Status Pie */}
                  {ledgerData.invoices.length > 0 && (() => {
                    const STATUS_COLORS: Record<string, string> = {
                      PAID: "hsl(142, 71%, 45%)", SENT: "hsl(217, 91%, 60%)",
                      OVERDUE: "hsl(0, 84%, 60%)", DRAFT: "hsl(240, 5%, 65%)",
                      CANCELLED: "hsl(240, 5%, 80%)", PARTIALLY_PAID: "hsl(38, 92%, 50%)",
                    };
                    const statusCounts = ledgerData.invoices.reduce((acc, inv) => {
                      acc[inv.status] = (acc[inv.status] ?? 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);
                    const statusChartData = Object.entries(statusCounts).map(([status, count]) => ({
                      status: status.replace(/_/g, " "),
                      count,
                      fill: STATUS_COLORS[status] ?? "hsl(240, 5%, 65%)",
                    }));
                    return (
                      <div>
                        <p className="mb-1 text-xs font-medium text-zinc-500 text-center">Invoice Status</p>
                        <ChartContainer
                          config={statusChartData.reduce((acc, s) => {
                            acc[s.status] = { label: s.status, color: s.fill };
                            return acc;
                          }, {} as ChartConfig)}
                          className="mx-auto h-[180px] w-full"
                        >
                          <PieChart>
                            <Tooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2} dataKey="count" nameKey="status" stroke="white" strokeWidth={2}>
                              {statusChartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
                          {statusChartData.map((s) => (
                            <div key={s.status} className="flex items-center gap-1.5">
                              <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.fill }} />
                              <span className="text-[11px] text-zinc-600">{s.status} ({s.count})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Payment Method Pie */}
                  {ledgerData.payments.length > 0 && (() => {
                    const METHOD_COLORS: Record<string, string> = {
                      UPI: "hsl(262, 83%, 58%)", BANK_TRANSFER: "hsl(217, 91%, 60%)",
                      RAZORPAY: "hsl(142, 71%, 45%)", CASH: "hsl(38, 92%, 50%)",
                      CHEQUE: "hsl(340, 82%, 52%)", CREDIT_CARD: "hsl(200, 75%, 50%)",
                      DEBIT_CARD: "hsl(30, 95%, 50%)",
                    };
                    const methodTotals = ledgerData.payments.reduce((acc, p) => {
                      acc[p.method] = (acc[p.method] ?? 0) + p.amount;
                      return acc;
                    }, {} as Record<string, number>);
                    const methodChartData = Object.entries(methodTotals).map(([method, amount]) => ({
                      method: method.replace(/_/g, " "),
                      amount,
                      fill: METHOD_COLORS[method] ?? "hsl(240, 5%, 65%)",
                    }));
                    return (
                      <div>
                        <p className="mb-1 text-xs font-medium text-zinc-500 text-center">Payment Methods</p>
                        <ChartContainer
                          config={methodChartData.reduce((acc, m) => {
                            acc[m.method] = { label: m.method, color: m.fill };
                            return acc;
                          }, {} as ChartConfig)}
                          className="mx-auto h-[180px] w-full"
                        >
                          <PieChart>
                            <Tooltip content={<ChartTooltipContent hideLabel formatter={(v) => formatINR(Number(v))} />} />
                            <Pie data={methodChartData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2} dataKey="amount" nameKey="method" stroke="white" strokeWidth={2}>
                              {methodChartData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
                          {methodChartData.map((m) => (
                            <div key={m.method} className="flex items-center gap-1.5">
                              <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: m.fill }} />
                              <span className="text-[11px] text-zinc-600">{m.method} ({formatINR(m.amount)})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Invoices Table */}
              <div>
                <h4 className="mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Invoices</h4>
                {ledgerData.invoices.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-left">
                          <th className="pb-2 pr-4 font-medium text-zinc-500">Invoice #</th>
                          <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Amount</th>
                          <th className="pb-2 pr-4 font-medium text-zinc-500">Status</th>
                          <th className="pb-2 font-medium text-zinc-500">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.invoices.map((inv) => (
                          <tr key={inv.id} className="border-b border-zinc-100">
                            <td className="py-2 pr-4 font-mono text-xs">{inv.number}</td>
                            <td className="py-2 pr-4 text-right">{formatINR(inv.amount)}</td>
                            <td className="py-2 pr-4">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  inv.status === "PAID" && "bg-green-100 text-green-700",
                                  inv.status === "SENT" && "bg-blue-100 text-blue-700",
                                  inv.status === "OVERDUE" && "bg-red-100 text-red-700",
                                  inv.status === "DRAFT" && "bg-zinc-100 text-zinc-700",
                                  inv.status === "CANCELLED" && "bg-zinc-100 text-zinc-400",
                                  inv.status === "PARTIALLY_PAID" && "bg-amber-100 text-amber-700"
                                )}
                              >
                                {inv.status.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="py-2 text-zinc-600">{inv.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-zinc-400">No invoices found</p>
                )}
              </div>

              {/* Payments Table */}
              <div>
                <h4 className="mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Payments</h4>
                {ledgerData.payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-left">
                          <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Amount</th>
                          <th className="pb-2 pr-4 font-medium text-zinc-500">Method</th>
                          <th className="pb-2 font-medium text-zinc-500">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.payments.map((p) => (
                          <tr key={p.id} className="border-b border-zinc-100">
                            <td className="py-2 pr-4 text-right font-medium text-green-700">
                              {formatINR(p.amount)}
                            </td>
                            <td className="py-2 pr-4">
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                                {p.method.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="py-2 text-zinc-600">{p.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-zinc-400">No payments found</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
