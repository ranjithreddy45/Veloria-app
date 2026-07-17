import type { Metadata } from "next";
import {
  Users, MapPin, FileText, Link2, Wallet, CheckCircle2, XCircle,
  Sparkles, TrendingUp, Trophy, Flame, Megaphone, Inbox,
} from "lucide-react";
import { getSalesAnalytics, getSalesExecutives } from "@/actions/sales-analytics.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile, type Accent } from "@/components/ui/stat-tile";
import { BdFilterBar } from "@/app/(dashboard)/bd/_components/bd-filter-bar";
import { SalesEmployeeChart, type SalesEmployeeRow } from "./_components/sales-employee-chart";

export const metadata: Metadata = { title: "Sales Dashboard" };
export const dynamic = "force-dynamic";

interface Analytics {
  range: { key: string; label: string; from: string; to: string };
  totals: {
    enquiriesCold: number; enquiriesCampaign: number; enquiriesTotal: number;
    siteVisits: number; quotationsSent: number; paymentLinksSent: number;
    advanceCollected: number; bookingsConfirmed: number; bookingsLost: number;
    upsellValue: number; revenueBooked: number; lostValue: number; salesScore: number;
    /** Contact rows created in range (date range only — Contact has no owner column). */
    enquiriesCreated: number;
    /** Lead rows created in range, employee-filtered by Lead.assignedToId. */
    leadsCreated: number;
  };
  employees: SalesEmployeeRow[];
  leaderboard: { userId: string; name: string; salesScore: number }[];
  leadSources: { source: string; label: string; count: number }[];
  funnel: { key: string; label: string; count: number }[];
  lossReasons: { reason: string; label: string; count: number; value: number }[];
  conversion: { enquiryToBooking: number; winRate: number };
  avgDaysEnquiryToBooking: number | null;
  avgUpsellPerBooking: number;
  lastMonthRevenue: number | null;
}

const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;
const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

function FunnelBar({ label, count, max, conv }: { label: string; count: number; max: number; conv: string | null }) {
  const w = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-[13px] text-muted-foreground sm:w-36">{label}</div>
      <div className="relative h-7 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
        <div className="h-full rounded-lg bg-gradient-to-r from-violet-500/30 to-violet-500/10" style={{ width: `${w}%` }} />
        <div className="absolute inset-0 flex items-center px-3 text-[13px] font-medium tabular-nums text-foreground">
          {count.toLocaleString("en-IN")}
        </div>
      </div>
      <div className="w-12 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">{conv ?? ""}</div>
    </div>
  );
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; emp?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range ?? "month";
  const employeeIds = sp.emp ? sp.emp.split(",").filter(Boolean) : null;
  const params = { rangeKey: range, from: sp.from ?? null, to: sp.to ?? null, employeeIds };
  // Contact (enquiry) rows carry no owner column, so the enquiry count is always
  // all-staff. Flag it on the tile when an employee filter is active.
  const empFiltered = !!employeeIds?.length;

  const [execRes, aRes] = await Promise.all([
    getSalesExecutives(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSalesAnalytics(params as any),
  ]);
  const execs = execRes.success ? (execRes.data as { id: string; name: string }[]) : [];
  const a = (aRes.success ? (aRes.data as Analytics) : null) as Analytics | null;

  const t = a?.totals;
  const funnelMax = a?.funnel[0]?.count ?? 0;

  const kpis: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; accent: Accent; sub?: string }[] = t
    ? [
        // Two distinct counts — previously conflated under a single "Enquiries"
        // tile that actually showed the Lead count.
        { label: "Enquiries created", value: t.enquiriesCreated, icon: Inbox, accent: "cyan", sub: empFiltered ? "All staff — not employee-filtered" : "New enquiries (contacts)" },
        { label: "Leads created", value: t.leadsCreated, icon: Users, accent: "indigo", sub: `${t.enquiriesCold} cold · ${t.enquiriesCampaign} campaign` },
        { label: "Site Visits", value: t.siteVisits, icon: MapPin, accent: "pink" },
        { label: "Quotations Sent", value: t.quotationsSent, icon: FileText, accent: "blue" },
        { label: "Payment Links", value: t.paymentLinksSent, icon: Link2, accent: "teal" },
        { label: "Advance Collected", value: t.advanceCollected, icon: Wallet, accent: "emerald", sub: inr(t.advanceCollected) },
        { label: "Bookings Confirmed", value: t.bookingsConfirmed, icon: CheckCircle2, accent: "violet" },
        { label: "Bookings Lost", value: t.bookingsLost, icon: XCircle, accent: "rose" },
        { label: "Upsell Value", value: t.upsellValue, icon: TrendingUp, accent: "amber", sub: inr(t.upsellValue) },
        { label: "Sales Score", value: t.salesScore, icon: Sparkles, accent: "violet" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        aura
        eyebrow="Sales · Bookings"
        title="Sales Dashboard"
        description="Employee-wise sales funnel, activity and leaderboard."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <BdFilterBar employees={execs} />
        {a && <span className="text-[12px] text-muted-foreground">Showing: <b className="text-foreground">{a.range.label}</b></span>}
      </div>

      {!a ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Couldn&apos;t load analytics.</CardContent></Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kpis.map((k) => (
              <StatTile key={k.label} label={k.label} value={k.value} accent={k.accent} icon={<k.icon className="size-4" />} sub={k.sub} />
            ))}
          </div>

          {/* Employee chart + funnel */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="gap-0 py-0 lg:col-span-2">
              <CardContent className="space-y-4 px-5 py-5">
                <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">Employee performance</h2>
                <SalesEmployeeChart employees={a.employees} />
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="space-y-4 px-5 py-5">
                <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">Funnel</h2>
                <div className="space-y-2">
                  {a.funnel.map((row, i) => {
                    const prev = i > 0 ? a.funnel[i - 1].count : 0;
                    const conv = i > 0 && prev > 0 ? pct(row.count / prev) : null;
                    return <FunnelBar key={row.key} label={row.label} count={row.count} max={funnelMax} conv={conv} />;
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[12px] text-muted-foreground">
                  {/* Both ratios are computed off Lead rows, not Contact rows. */}
                  <span>Lead→Booking <b className="text-foreground">{pct(a.conversion.enquiryToBooking)}</b></span>
                  <span>Win rate <b className="text-foreground">{pct(a.conversion.winRate)}</b></span>
                  <span>Avg lead→booking <b className="text-foreground">{a.avgDaysEnquiryToBooking ?? "—"} days</b></span>
                  <span>Avg upsell/booking <b className="text-foreground">{inr(a.avgUpsellPerBooking)}</b></span>
                </div>
                {/* Goal-gradient: small remaining distance to beat last month's booked revenue */}
                {a.lastMonthRevenue != null && a.lastMonthRevenue > 0 && (
                  t!.revenueBooked < a.lastMonthRevenue ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[12px] font-medium tabular-nums text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/25">
                      <TrendingUp className="size-3.5" />
                      {inr(a.lastMonthRevenue - t!.revenueBooked)} to beat last month
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-medium tabular-nums text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/25">
                      🎉 Last month beaten by {inr(t!.revenueBooked - a.lastMonthRevenue)}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>

          {/* Employee table + leaderboard */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="gap-0 py-0 lg:col-span-2">
              <CardContent className="space-y-3 px-5 py-5">
                <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">By employee</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Employee</th>
                        <th className="px-2 py-2 text-right font-medium">Leads</th>
                        <th className="px-2 py-2 text-right font-medium">Site visits</th>
                        <th className="px-2 py-2 text-right font-medium">Quotes</th>
                        <th className="px-2 py-2 text-right font-medium">Confirmed</th>
                        <th className="px-2 py-2 text-right font-medium">Lost</th>
                        <th className="px-2 py-2 text-right font-medium">Advance ₹</th>
                        <th className="px-2 py-2 text-right font-medium">Upsell ₹</th>
                        <th className="px-2 py-2 text-right font-medium">Revenue ₹</th>
                        <th className="pl-2 py-2 text-right font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.employees.length === 0 ? (
                        <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">No activity in this period.</td></tr>
                      ) : (
                        a.employees.map((e) => (
                          <tr key={e.userId} className="border-b border-border/60 last:border-0">
                            <td className="py-2 pr-3 font-medium text-foreground">{e.name}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{e.enquiriesTotal}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{e.siteVisits}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{e.quotationsSent}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{e.bookingsConfirmed}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{e.bookingsLost}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{inr(e.advanceCollected)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{inr(e.upsellValue)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{inr(e.revenue)}</td>
                            <td className="pl-2 py-2 text-right font-semibold tabular-nums">{e.salesScore}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 px-5 py-5">
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                  <Trophy className="size-4 text-amber-500" /> Leaderboard · Sales score
                </h2>
                {a.leaderboard.filter((l) => l.salesScore !== 0).length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No points awarded yet in this period.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {a.leaderboard.slice(0, 10).map((l, i, arr) => {
                      // Goal-gradient: surface the small remaining gap to the row above.
                      const chaseGap = i > 0 ? arr[i - 1].salesScore - l.salesScore + 1 : null;
                      return (
                        <li key={l.userId} className="rounded-md px-2 py-1.5 text-[13px] odd:bg-muted/30">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 truncate">
                              <span className="w-6 text-center tabular-nums">{MEDAL[i] ?? i + 1}</span>
                              <span className="truncate text-foreground">{l.name}</span>
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">{l.salesScore.toLocaleString("en-IN")}</span>
                          </div>
                          {chaseGap !== null && (
                            <div className="pl-8 text-[11px] tabular-nums text-muted-foreground">▲ {chaseGap.toLocaleString("en-IN")} pts to #{i}</div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Source split + loss reasons */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 px-5 py-5">
                <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">Leads by source</h2>
                <div className="flex gap-3">
                  <div className="flex-1 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Flame className="size-3.5 text-orange-500" /> Cold</div>
                    <div className="text-[20px] font-semibold tabular-nums text-foreground">{t!.enquiriesCold}</div>
                  </div>
                  <div className="flex-1 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Megaphone className="size-3.5 text-indigo-500" /> Campaign</div>
                    <div className="text-[20px] font-semibold tabular-nums text-foreground">{t!.enquiriesCampaign}</div>
                  </div>
                </div>
                {a.leadSources.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {a.leadSources.map((s) => (
                      <li key={s.source} className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="truncate text-muted-foreground">{s.label}</span>
                        <span className="font-medium tabular-nums text-foreground">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 px-5 py-5">
                <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">Loss reasons</h2>
                {a.lossReasons.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No lost bookings in this period.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {a.lossReasons.map((r) => (
                      <li key={r.reason} className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="truncate text-muted-foreground">{r.label}</span>
                        <span className="font-medium tabular-nums text-foreground">{r.count} · {inr(r.value)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
