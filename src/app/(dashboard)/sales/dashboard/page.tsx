import type { Metadata } from "next";
import {
  Users, MapPin, FileText, Link2, Wallet, CheckCircle2, XCircle,
  Sparkles, TrendingUp, Trophy, Flame, Megaphone, Inbox,
  AlertTriangle, CalendarRange, Gauge, PieChart, ThumbsUp,
} from "lucide-react";
import { getSalesAnalytics, getSalesExecutives } from "@/actions/sales-analytics.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile, type Accent } from "@/components/ui/stat-tile";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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

/** Quiet card heading, shared by every panel on this page. */
const PANEL_TITLE = "text-body font-semibold tracking-[-0.01em] text-foreground";
/** Micro field label. */
const MICRO_LABEL = "text-meta uppercase tracking-wide text-muted-foreground";

function FunnelBar({ label, count, max, conv }: { label: string; count: number; max: number; conv: string | null }) {
  const w = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-body text-muted-foreground sm:w-36">{label}</div>
      <div className="relative h-8 flex-1 overflow-hidden rounded-lg border border-border/70 bg-muted/25">
        <div className="h-full bg-gradient-to-r from-violet-500/35 to-violet-500/10" style={{ width: `${w}%` }} />
        <div className="numeric absolute inset-0 flex items-center px-3 text-body font-medium text-foreground">
          {count.toLocaleString("en-IN")}
        </div>
      </div>
      <div className="numeric w-12 shrink-0 text-right text-detail text-muted-foreground">{conv ?? "—"}</div>
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

  const period = a?.range.label ?? "This period";

  const withPeriod = (extra?: string) => (extra ? `${extra} · ${period}` : period);

  const kpis: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; accent: Accent; sub?: string }[] = t
    ? [
        // Two distinct counts — previously conflated under a single "Enquiries"
        // tile that actually showed the Lead count.
        // Every tile is scoped to the selected period; the Enquiry and Leads
        // LISTS are not. Same trap as the BD dashboard: without the period
        // printed on the tile, "Leads created 8" next to a list of 43 reads as
        // two screens disagreeing rather than two different questions.
        { label: "Enquiries created", value: t.enquiriesCreated, icon: Inbox, accent: "cyan", sub: withPeriod(empFiltered ? "All staff — not employee-filtered" : "New enquiries (contacts)") },
        { label: "Leads created", value: t.leadsCreated, icon: Users, accent: "indigo", sub: withPeriod(`${t.enquiriesCold} cold · ${t.enquiriesCampaign} campaign`) },
        { label: "Site Visits", value: t.siteVisits, icon: MapPin, accent: "pink", sub: withPeriod() },
        { label: "Quotations Sent", value: t.quotationsSent, icon: FileText, accent: "blue", sub: withPeriod() },
        { label: "Payment Links", value: t.paymentLinksSent, icon: Link2, accent: "teal", sub: withPeriod() },
        { label: "Advance Collected", value: t.advanceCollected, icon: Wallet, accent: "emerald", sub: withPeriod(inr(t.advanceCollected)) },
        { label: "Bookings Confirmed", value: t.bookingsConfirmed, icon: CheckCircle2, accent: "gold", sub: withPeriod() },
        { label: "Bookings Lost", value: t.bookingsLost, icon: XCircle, accent: "rose", sub: withPeriod() },
        { label: "Upsell Value", value: t.upsellValue, icon: TrendingUp, accent: "amber", sub: withPeriod(inr(t.upsellValue)) },
        { label: "Sales Score", value: t.salesScore, icon: Sparkles, accent: "gold", sub: withPeriod() },
      ]
    : [];

  // Ratio strip under the funnel — both ratios are computed off Lead rows, not
  // Contact rows.
  const funnelStats: { label: string; value: string }[] = a
    ? [
        { label: "Lead → booking", value: pct(a.conversion.enquiryToBooking) },
        { label: "Win rate", value: pct(a.conversion.winRate) },
        { label: "Avg lead → booking", value: a.avgDaysEnquiryToBooking != null ? `${a.avgDaysEnquiryToBooking} days` : "—" },
        { label: "Avg upsell / booking", value: inr(a.avgUpsellPerBooking) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Sales · Bookings"
        icon={Gauge}
        accent="gold"
        title="Sales Dashboard"
        description="Employee-wise sales funnel, activity and leaderboard."
        help={
          a ? (
            <span className="numeric inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-meta font-medium text-muted-foreground">
              <CalendarRange className="size-3.5" aria-hidden />
              {a.range.label}
            </span>
          ) : undefined
        }
      >
        <BdFilterBar employees={execs} />
      </PageHeader>

      {!a ? (
        <Card className="gap-0 py-0">
          <CardContent className="px-5 py-5">
            <EmptyState
              icon={<AlertTriangle />}
              tone="warning"
              title="We couldn't load the sales analytics"
              description="The report service didn't return data for this period. Try a different date range, or refresh the page in a moment."
            />
          </CardContent>
        </Card>
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
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className={PANEL_TITLE}>Employee performance</h2>
                  <span className={MICRO_LABEL}>Top 12</span>
                </div>
                <SalesEmployeeChart employees={a.employees} />
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="space-y-4 px-5 py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className={PANEL_TITLE}>Funnel</h2>
                  <span className={MICRO_LABEL}>Step conv.</span>
                </div>
                {a.funnel.length === 0 ? (
                  <EmptyState
                    className="px-0 py-10"
                    icon={<PieChart />}
                    title="No funnel activity yet"
                    description="Once leads move through site visits and quotations, the stage-by-stage drop-off shows up here."
                  />
                ) : (
                  <div className="space-y-2">
                    {a.funnel.map((row, i) => {
                      const prev = i > 0 ? a.funnel[i - 1].count : 0;
                      const conv = i > 0 && prev > 0 ? pct(row.count / prev) : null;
                      return <FunnelBar key={row.key} label={row.label} count={row.count} max={funnelMax} conv={conv} />;
                    })}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-4">
                  {funnelStats.map((s) => (
                    <div key={s.label} className="space-y-1">
                      <div className={MICRO_LABEL}>{s.label}</div>
                      <div className="numeric text-copy font-semibold text-foreground">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Goal-gradient: small remaining distance to beat last month's booked revenue */}
                {a.lastMonthRevenue != null && a.lastMonthRevenue > 0 && (
                  t!.revenueBooked < a.lastMonthRevenue ? (
                    <div className="numeric bg-warning/10 text-warning ring-warning/20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-detail font-medium ring-1 ring-inset">
                      <TrendingUp className="size-3.5" aria-hidden />
                      {inr(a.lastMonthRevenue - t!.revenueBooked)} to beat last month
                    </div>
                  ) : (
                    <div className="numeric bg-success/10 text-success ring-success/20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-detail font-medium ring-1 ring-inset">
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
                <h2 className={PANEL_TITLE}>By employee</h2>
                {a.employees.length === 0 ? (
                  <EmptyState
                    className="px-0 py-12"
                    icon={<Users />}
                    title="No employee activity in this period"
                    description="Widen the date range or clear the employee filter to see how the team performed."
                  />
                ) : (
                  <Table className="text-detail">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-3">Employee</TableHead>
                        <TableHead className="px-3 text-right">Leads</TableHead>
                        <TableHead className="px-3 text-right">Site visits</TableHead>
                        <TableHead className="px-3 text-right">Quotes</TableHead>
                        <TableHead className="px-3 text-right">Confirmed</TableHead>
                        <TableHead className="px-3 text-right">Lost</TableHead>
                        <TableHead className="px-3 text-right">Advance ₹</TableHead>
                        <TableHead className="px-3 text-right">Upsell ₹</TableHead>
                        <TableHead className="px-3 text-right">Revenue ₹</TableHead>
                        <TableHead className="px-3 text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {a.employees.map((e) => (
                        <TableRow key={e.userId} className="border-border/60">
                          <TableCell className="px-3 py-2.5 font-medium text-foreground">{e.name}</TableCell>
                          <TableCell className="numeric px-3 py-2.5 text-right">{e.enquiriesTotal}</TableCell>
                          <TableCell className="numeric px-3 py-2.5 text-right">{e.siteVisits}</TableCell>
                          <TableCell className="numeric px-3 py-2.5 text-right">{e.quotationsSent}</TableCell>
                          <TableCell className="numeric text-success px-3 py-2.5 text-right">{e.bookingsConfirmed}</TableCell>
                          <TableCell className="numeric text-destructive px-3 py-2.5 text-right">{e.bookingsLost}</TableCell>
                          <TableCell className="numeric px-3 py-2.5 text-right">{inr(e.advanceCollected)}</TableCell>
                          <TableCell className="numeric px-3 py-2.5 text-right">{inr(e.upsellValue)}</TableCell>
                          <TableCell className="numeric px-3 py-2.5 text-right">{inr(e.revenue)}</TableCell>
                          <TableCell className="numeric px-3 py-2.5 text-right font-semibold text-foreground">{e.salesScore}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 px-5 py-5">
                <h2 className={`flex items-center gap-1.5 ${PANEL_TITLE}`}>
                  <Trophy className="size-4 text-amber-500" aria-hidden /> Leaderboard · Sales score
                </h2>
                {a.leaderboard.filter((l) => l.salesScore !== 0).length === 0 ? (
                  <EmptyState
                    className="px-0 py-10"
                    icon={<Trophy />}
                    title="No points awarded yet"
                    description="Sales scores appear here as the team logs site visits, quotations and confirmed bookings."
                  />
                ) : (
                  <ol className="space-y-1">
                    {a.leaderboard.slice(0, 10).map((l, i, arr) => {
                      // Goal-gradient: surface the small remaining gap to the row above.
                      const chaseGap = i > 0 ? arr[i - 1].salesScore - l.salesScore + 1 : null;
                      return (
                        <li
                          key={l.userId}
                          className={`rounded-xl px-2.5 py-2 text-body transition-colors hover:bg-muted/50 ${i === 0 ? "bg-amber-500/8" : "odd:bg-muted/25"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="numeric w-6 shrink-0 text-center text-muted-foreground">{MEDAL[i] ?? i + 1}</span>
                              <span className="truncate font-medium text-foreground">{l.name}</span>
                            </span>
                            <span className="numeric shrink-0 font-semibold text-foreground">{l.salesScore.toLocaleString("en-IN")}</span>
                          </div>
                          {chaseGap !== null && (
                            <div className="numeric pl-8 text-meta text-muted-foreground">▲ {chaseGap.toLocaleString("en-IN")} pts to #{i}</div>
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
              <CardContent className="space-y-4 px-5 py-5">
                <h2 className={PANEL_TITLE}>Leads by source</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 transition-shadow hover:shadow-card-hover">
                    <div className="flex items-center gap-1.5 text-detail text-muted-foreground">
                      <Flame className="size-3.5 text-orange-500" aria-hidden /> Cold
                    </div>
                    <div className="numeric mt-1.5 text-title font-semibold leading-none text-foreground">{t!.enquiriesCold}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 transition-shadow hover:shadow-card-hover">
                    <div className="flex items-center gap-1.5 text-detail text-muted-foreground">
                      <Megaphone className="size-3.5 text-indigo-500" aria-hidden /> Campaign
                    </div>
                    <div className="numeric mt-1.5 text-title font-semibold leading-none text-foreground">{t!.enquiriesCampaign}</div>
                  </div>
                </div>
                {a.leadSources.length === 0 ? (
                  <EmptyState
                    className="px-0 py-8"
                    icon={<Inbox />}
                    title="No source breakdown yet"
                    description="Tag incoming leads with a source to see which channels actually fill the funnel."
                  />
                ) : (
                  <ul className="divide-y divide-border/50">
                    {a.leadSources.map((s) => (
                      <li key={s.source} className="flex items-center justify-between gap-3 py-2 text-body">
                        <span className="truncate text-muted-foreground">{s.label}</span>
                        <span className="numeric font-medium text-foreground">{s.count.toLocaleString("en-IN")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 px-5 py-5">
                <h2 className={PANEL_TITLE}>Loss reasons</h2>
                {a.lossReasons.length === 0 ? (
                  <EmptyState
                    className="px-0 py-10"
                    icon={<ThumbsUp />}
                    tone="success"
                    title="No bookings lost in this period"
                    description="Nothing slipped away — when a booking is marked lost, the reason and its value land here."
                  />
                ) : (
                  <ul className="divide-y divide-border/50">
                    {a.lossReasons.map((r) => (
                      <li key={r.reason} className="flex items-center justify-between gap-3 py-2 text-body">
                        <span className="truncate text-muted-foreground">{r.label}</span>
                        <span className="numeric font-medium text-foreground">{r.count} · {inr(r.value)}</span>
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
