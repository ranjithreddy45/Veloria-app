import {
  Filter, Target, Trophy, CalendarClock, Wallet, Coins,
  AlertTriangle, Clock, Timer, XCircle, TrendingDown, TrendingUp,
  BarChart3, CalendarDays, CalendarRange, CheckCircle2, Inbox, PieChart, ThumbsUp, Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { getSalesExecutives, getSalesAnalytics } from "@/actions/sales-analytics.actions";
import {
  getSalesEventTracker,
  getSalesRevenueCollections,
  getSalesFollowupAlerts,
  getSalesLostAnalysis,
} from "@/actions/sales-reports.actions";
import { BdFilterBar } from "@/app/(dashboard)/bd/_components/bd-filter-bar";
import {
  ReportSection,
  TableScroll,
  Th,
  Td,
  inr,
  fmtDate,
  pct,
} from "@/app/(dashboard)/bd/reports/_components/report-primitives";

/** Micro sub-heading inside a report section. */
const SUB_HEAD = "mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
/** Shared body-row treatment for the hand-rolled report tables. */
const ROW = "border-t border-border/60 transition-colors hover:bg-muted/40";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales Reports" };

// ------------------------------------------------------------
// Local shapes mirroring the documented action payloads. The actions
// return Result<unknown>, so we cast `res.data` after the success check.
// ------------------------------------------------------------
interface Exec {
  id: string;
  name: string;
}

interface AnalyticsTotals {
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
  revenueBooked: number;
  lostValue: number;
  salesScore: number;
}

interface AnalyticsEmployee {
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

interface Analytics {
  range: { key: string; label: string; from: string; to: string };
  totals: AnalyticsTotals;
  employees: AnalyticsEmployee[];
  leaderboard: { userId: string; name: string; salesScore: number }[];
  leadSources: { source: string; label: string; count: number }[];
  funnel: { key: string; label: string; count: number }[];
  lossReasons: { reason: string; label: string; count: number; value: number }[];
  conversion: { enquiryToBooking: number; winRate: number };
  avgDaysEnquiryToBooking: number | null;
  avgUpsellPerBooking: number;
}

interface EventRow {
  id: string;
  ref: string;
  event: string;
  eventType: string;
  status: string;
  client: string;
  eventDate: string | null;
  hall: string;
  guests: number | string | null;
  tier: string;
  total: number;
  pctPaid: number;
  owner: string;
  nextMilestone: { label: string; due: string | null } | null;
}

interface EventTracker {
  rows: EventRow[];
  count: number;
}

interface MilestoneStat {
  due: number;
  paid: number;
  count: number;
}

interface RevenueCollections {
  revenueBooked: number;
  advanceCollected: number;
  pendingCollection: number;
  upsellRevenue: number;
  milestones: { advance: MilestoneStat; part: MilestoneStat; final: MilestoneStat };
  range: { label: string };
}

interface OverdueItem {
  id: string;
  ref: string;
  client: string;
  event: string;
  amount: number;
  when: string | null;
  owner: string;
}

interface FollowupItem {
  id: string;
  client: string;
  when: string | null;
  owner: string;
}

interface FollowupAlerts {
  overdue: OverdueItem[];
  followups: FollowupItem[];
  stale: OverdueItem[];
  counts: { overdue: number; followups: number; stale: number };
}

interface LostRow {
  id: string;
  client: string;
  reason: string;
  value: number;
  eventType: string;
  owner: string;
  lostOn: string | null;
}

interface LostAnalysis {
  rows: LostRow[];
  reasons: { reason: string; count: number; value: number }[];
  trend: { month: string; won: number; lost: number; winRate: number }[];
  totalCount: number;
  totalValue: number;
  range: { label: string };
}

const EMPTY_ANALYTICS: Analytics = {
  range: { key: "month", label: "This month", from: "", to: "" },
  totals: {
    enquiriesCold: 0,
    enquiriesCampaign: 0,
    enquiriesTotal: 0,
    siteVisits: 0,
    quotationsSent: 0,
    paymentLinksSent: 0,
    advanceCollected: 0,
    bookingsConfirmed: 0,
    bookingsLost: 0,
    upsellValue: 0,
    revenueBooked: 0,
    lostValue: 0,
    salesScore: 0,
  },
  employees: [],
  leaderboard: [],
  leadSources: [],
  funnel: [],
  lossReasons: [],
  conversion: { enquiryToBooking: 0, winRate: 0 },
  avgDaysEnquiryToBooking: null,
  avgUpsellPerBooking: 0,
};

const EMPTY_TRACKER: EventTracker = { rows: [], count: 0 };
const EMPTY_MILESTONE: MilestoneStat = { due: 0, paid: 0, count: 0 };
const EMPTY_REVENUE: RevenueCollections = {
  revenueBooked: 0,
  advanceCollected: 0,
  pendingCollection: 0,
  upsellRevenue: 0,
  milestones: { advance: EMPTY_MILESTONE, part: EMPTY_MILESTONE, final: EMPTY_MILESTONE },
  range: { label: "" },
};
const EMPTY_ALERTS: FollowupAlerts = {
  overdue: [],
  followups: [],
  stale: [],
  counts: { overdue: 0, followups: 0, stale: 0 },
};
const EMPTY_LOST: LostAnalysis = {
  rows: [],
  reasons: [],
  trend: [],
  totalCount: 0,
  totalValue: 0,
  range: { label: "" },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SalesReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const range = first(sp.range) ?? "month";
  const from = first(sp.from);
  const to = first(sp.to);
  const emp = first(sp.emp);
  const employeeIds = emp ? emp.split(",").filter(Boolean) : null;

  const params = { rangeKey: range, from, to, employeeIds } as const;

  const [execRes, analyticsRes, trackerRes, revenueRes, alertsRes, lostRes] = await Promise.all([
    getSalesExecutives(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSalesAnalytics(params as any),
    getSalesEventTracker({ employeeIds }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSalesRevenueCollections(params as any),
    getSalesFollowupAlerts({ employeeIds }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSalesLostAnalysis(params as any),
  ]);

  const execs: Exec[] = execRes.success ? (execRes.data as Exec[]) : [];
  const a: Analytics = analyticsRes.success ? (analyticsRes.data as Analytics) : EMPTY_ANALYTICS;
  const tracker: EventTracker = trackerRes.success ? (trackerRes.data as EventTracker) : EMPTY_TRACKER;
  const revenue: RevenueCollections = revenueRes.success
    ? (revenueRes.data as RevenueCollections)
    : EMPTY_REVENUE;
  const alerts: FollowupAlerts = alertsRes.success ? (alertsRes.data as FollowupAlerts) : EMPTY_ALERTS;
  const lost: LostAnalysis = lostRes.success ? (lostRes.data as LostAnalysis) : EMPTY_LOST;

  const funnelTop = a.funnel.length > 0 ? a.funnel[0].count : 0;

  const milestoneRows: { label: string; stat: MilestoneStat }[] = [
    { label: "Advance (20%)", stat: revenue.milestones.advance },
    { label: "Part (60%)", stat: revenue.milestones.part },
    { label: "Final (20%)", stat: revenue.milestones.final },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow="Sales · Bookings"
        icon={BarChart3}
        accent="gold"
        title="Sales Reports"
        description="Funnel, bookings, revenue, follow-ups, losses, and team performance for the selected period."
        help={
          <span className="numeric inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <CalendarRange className="size-3.5" aria-hidden />
            {a.range.label}
          </span>
        }
      />

      {/* Filter bar */}
      <div className="sticky top-2 z-20 -mx-1 rounded-2xl border border-border/70 bg-card/80 px-3 py-2.5 shadow-card backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="flex items-center gap-2">
          <Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="hidden text-[11px] uppercase tracking-wide text-muted-foreground sm:inline">Filters</span>
          <BdFilterBar employees={execs} />
        </div>
      </div>

      {/* 1. Booking Funnel Overview */}
      <ReportSection
        title="Booking Funnel Overview"
        description={`Stage-to-stage progression for ${a.range.label}.`}
      >
        {a.funnel.length === 0 ? (
          <EmptyState
            className="px-0 py-12"
            icon={<PieChart />}
            title="No funnel activity in this period"
            description="Nothing entered the funnel between these dates. Widen the range or clear the employee filter to see stage-to-stage movement."
          />
        ) : (
          <div className="space-y-2">
            {a.funnel.map((row, i) => {
              const width = funnelTop > 0 ? Math.min(100, Math.round((row.count / funnelTop) * 100)) : 0;
              const prev = i > 0 ? a.funnel[i - 1].count : null;
              const stepConv = prev && prev > 0 ? Math.round((row.count / prev) * 100) : null;
              return (
                <div key={row.key} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 truncate text-[13px] text-muted-foreground sm:w-40">
                    {row.label}
                  </div>
                  <div className="relative h-8 flex-1 overflow-hidden rounded-lg border border-border/70 bg-muted/25">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500/35 to-violet-500/10"
                      style={{ width: `${width}%` }}
                    />
                    <div className="numeric absolute inset-0 flex items-center px-3 text-[13px] font-medium text-foreground">
                      {row.count.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="numeric w-16 shrink-0 text-right text-[12px] text-muted-foreground">
                    {stepConv === null ? "—" : `${stepConv}%`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Enquiry → Booking"
            value={pct(a.conversion.enquiryToBooking)}
            accent="blue"
            icon={<Target className="size-4" />}
            sub="Conversion rate"
          />
          <StatTile
            label="Win rate"
            value={pct(a.conversion.winRate)}
            accent="emerald"
            icon={<Trophy className="size-4" />}
            sub="Overall win rate"
          />
          <StatTile
            label="Avg enquiry → booking"
            value={`${a.avgDaysEnquiryToBooking ?? "—"} days`}
            accent="gold"
            icon={<CalendarClock className="size-4" />}
            sub="Time to close"
          />
          <StatTile
            label="Avg upsell / booking"
            value={inr(a.avgUpsellPerBooking)}
            accent="amber"
            icon={<TrendingUp className="size-4" />}
            sub="Add-on value"
          />
        </div>

        {/* Lead sources */}
        <div>
          <h3 className={SUB_HEAD}>Enquiry sources</h3>
          {a.leadSources.length === 0 ? (
            <EmptyState
              className="px-0 py-10"
              icon={<Inbox />}
              title="No enquiry sources recorded"
              description="Tag incoming enquiries with a source to see which channels actually fill the funnel."
            />
          ) : (
            <TableScroll>
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <Th>Source</Th>
                    <Th className="text-right">Count</Th>
                  </tr>
                </thead>
                <tbody>
                  {a.leadSources.map((s) => (
                    <tr key={s.source} className={ROW}>
                      <Td>{s.label}</Td>
                      <Td className="numeric text-right">{s.count.toLocaleString("en-IN")}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      </ReportSection>

      {/* 2. Event Calendar & Booking Tracker */}
      <ReportSection
        title="Event Calendar & Booking Tracker"
        description="Bookings sorted by event date, with payment progress and next milestone."
      >
        {tracker.rows.length === 0 ? (
          <EmptyState
            className="px-0 py-12"
            icon={<CalendarDays />}
            title="No bookings to track right now"
            description="Confirmed bookings appear here sorted by event date, with payment progress and the next milestone due."
          />
        ) : (
          <TableScroll>
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <Th>Ref</Th>
                  <Th>Client</Th>
                  <Th>Event date</Th>
                  <Th>Hall</Th>
                  <Th className="text-right">Guests</Th>
                  <Th>Tier</Th>
                  <Th>Status</Th>
                  <Th className="text-right">% paid</Th>
                  <Th>Owner</Th>
                  <Th>Next milestone</Th>
                </tr>
              </thead>
              <tbody>
                {tracker.rows.map((r) => (
                  <tr key={r.id} className={ROW}>
                    <Td className="numeric font-medium">{r.ref || "—"}</Td>
                    <Td className="font-medium">{r.client || "—"}</Td>
                    <Td className="numeric">{fmtDate(r.eventDate)}</Td>
                    <Td>{r.hall || "—"}</Td>
                    <Td className="numeric text-right">
                      {r.guests === null || r.guests === "" ? "—" : r.guests}
                    </Td>
                    <Td>{r.tier || "—"}</Td>
                    <Td className="text-muted-foreground">{r.status || "—"}</Td>
                    <Td className="text-right">
                      {(() => {
                        const paidPct = Math.round(r.pctPaid || 0);
                        const barPct = Math.min(100, Math.max(0, paidPct));
                        const done = barPct >= 100;
                        return (
                          <span className="inline-flex items-center justify-end gap-2">
                            <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                              <span
                                className={`block h-full rounded-full ${
                                  done
                                    ? "bg-success"
                                    : "bg-gradient-to-r from-violet-500 to-success"
                                }`}
                                style={{ width: `${barPct}%` }}
                              />
                            </span>
                            <span
                              className={`numeric w-9 text-right ${done ? "text-success font-medium" : ""}`}
                            >
                              {paidPct}%
                            </span>
                          </span>
                        );
                      })()}
                    </Td>
                    <Td className="text-muted-foreground">{r.owner || "—"}</Td>
                    <Td className="text-muted-foreground">
                      {r.nextMilestone
                        ? `${r.nextMilestone.label} · ${fmtDate(r.nextMilestone.due)}`
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </ReportSection>

      {/* 3. Revenue & Collections */}
      <ReportSection
        title="Revenue & Collections"
        description={`Booked revenue and collection status for ${revenue.range.label || a.range.label}.`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Revenue booked"
            value={inr(revenue.revenueBooked)}
            accent="emerald"
            icon={<Wallet className="size-4" />}
            sub="Confirmed bookings"
          />
          <StatTile
            label="Advance collected"
            value={inr(revenue.advanceCollected)}
            accent="teal"
            icon={<Coins className="size-4" />}
            sub="Received so far"
          />
          <StatTile
            label="Pending collection"
            value={inr(revenue.pendingCollection)}
            accent="amber"
            icon={<Clock className="size-4" />}
            sub="Still due"
          />
          <StatTile
            label="Upsell revenue"
            value={inr(revenue.upsellRevenue)}
            accent="gold"
            icon={<TrendingUp className="size-4" />}
            sub="Add-on value"
          />
        </div>

        <div>
          <h3 className={SUB_HEAD}>20 / 60 / 20 milestones</h3>
          <TableScroll>
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <Th>Milestone</Th>
                  <Th className="text-right">Due</Th>
                  <Th className="text-right">Paid</Th>
                  <Th className="text-right">Count</Th>
                </tr>
              </thead>
              <tbody>
                {milestoneRows.map((m) => (
                  <tr key={m.label} className={ROW}>
                    <Td className="font-medium">{m.label}</Td>
                    <Td className="numeric text-right">{inr(m.stat.due)}</Td>
                    <Td className="numeric text-right">{inr(m.stat.paid)}</Td>
                    <Td className="numeric text-right">{(m.stat.count || 0).toLocaleString("en-IN")}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </ReportSection>

      {/* 4. Follow-up & Payment Alerts */}
      <ReportSection
        title="Follow-up & Payment Alerts"
        description="Where payments and quote follow-ups stand right now."
      >
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            label="Overdue payments"
            value={alerts.counts.overdue}
            accent="red"
            icon={<AlertTriangle className="size-4" />}
            sub="Past due"
          />
          <StatTile
            label="Quote follow-ups"
            value={alerts.counts.followups}
            accent="amber"
            icon={<Clock className="size-4" />}
            sub="Due today"
          />
          <StatTile
            label="No payment 7+ days"
            value={alerts.counts.stale}
            accent="indigo"
            icon={<Timer className="size-4" />}
            sub="Stale bookings"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Overdue payments */}
          <AlertCard title="Overdue payments" tone="red" count={alerts.overdue.length} empty="Nothing overdue — nice.">
            {alerts.overdue.map((it) => (
              <li key={it.id} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">{it.client || "—"}</span>
                  <span className="numeric text-destructive shrink-0 text-[12px] font-semibold">
                    {inr(it.amount)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
                  <span className="truncate">
                    {[it.ref, it.event].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="numeric shrink-0">{fmtDate(it.when)}</span>
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{it.owner || "—"}</div>
              </li>
            ))}
          </AlertCard>

          {/* Today's quote follow-ups */}
          <AlertCard title="Today's quote follow-ups" tone="amber" count={alerts.followups.length} empty="No quote follow-ups due today.">
            {alerts.followups.map((it) => (
              <li key={it.id} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">{it.client || "—"}</span>
                  <span className="numeric shrink-0 text-[11px] text-muted-foreground">{fmtDate(it.when)}</span>
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{it.owner || "—"}</div>
              </li>
            ))}
          </AlertCard>

          {/* No payment 7+ days */}
          <AlertCard title="No payment 7+ days" tone="muted" count={alerts.stale.length} empty="No stale bookings right now.">
            {alerts.stale.map((it) => (
              <li key={it.id} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">{it.client || "—"}</span>
                  <span className="numeric shrink-0 text-[12px] font-semibold text-foreground">{inr(it.amount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
                  <span className="truncate">
                    {[it.ref, it.event].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="shrink-0 truncate">{it.owner || "—"}</span>
                </div>
              </li>
            ))}
          </AlertCard>
        </div>
      </ReportSection>

      {/* 5. Lost Booking Analysis */}
      <ReportSection
        title="Lost Booking Analysis"
        description={`Losses and win-rate trend for ${lost.range.label || a.range.label}.`}
      >
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Bookings lost"
            value={lost.totalCount}
            accent="red"
            icon={<XCircle className="size-4" />}
            sub="In this period"
          />
          <StatTile
            label="Lost value"
            value={inr(lost.totalValue)}
            accent="amber"
            icon={<TrendingDown className="size-4" />}
            sub="Revenue not captured"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Loss reasons */}
          <div>
            <h3 className={SUB_HEAD}>Reasons</h3>
            {lost.reasons.length === 0 ? (
              <EmptyState
                className="px-0 py-10"
                icon={<ThumbsUp />}
                tone="success"
                title="Nothing to break down"
                description="No bookings were marked lost in this period, so there are no reasons to analyse."
              />
            ) : (
              <TableScroll>
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <Th>Reason</Th>
                      <Th className="text-right">Count</Th>
                      <Th className="text-right">Value</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {lost.reasons.map((r) => (
                      <tr key={r.reason} className={ROW}>
                        <Td>{r.reason}</Td>
                        <Td className="numeric text-right">{r.count.toLocaleString("en-IN")}</Td>
                        <Td className="numeric text-right">{inr(r.value)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </div>

          {/* Win-rate trend */}
          <div>
            <h3 className={SUB_HEAD}>Win-rate trend (6 months)</h3>
            {lost.trend.length === 0 ? (
              <EmptyState
                className="px-0 py-10"
                icon={<TrendingUp />}
                title="Not enough history yet"
                description="Once a few months of won and lost bookings accumulate, the win-rate trend plots here."
              />
            ) : (
              <div className="flex items-end gap-2">
                {lost.trend.map((tr) => {
                  // `trend.winRate` arrives from the action already as a PERCENT
                  // (0–100), not a fraction — unlike `conversion.winRate`. Treat it
                  // as such, and clamp so bad data can never render a bar taller
                  // than its 80px track (it used to streak up the whole page).
                  const rate = Math.min(100, Math.max(0, tr.winRate || 0));
                  const h = Math.max(4, Math.round((rate / 100) * 80));
                  return (
                    <div key={tr.month} className="group flex flex-1 flex-col items-center gap-1">
                      <span className="numeric text-[10px] font-medium text-muted-foreground">
                        {Math.round(rate)}%
                      </span>
                      <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-muted/25">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-violet-500/50 to-violet-500/20 transition-colors group-hover:from-violet-500/70 group-hover:to-violet-500/30"
                          style={{ height: `${h}px` }}
                        />
                      </div>
                      <span className="numeric truncate text-[10px] text-muted-foreground">{tr.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Lost rows */}
        <div>
          <h3 className={SUB_HEAD}>Lost bookings</h3>
          {lost.rows.length === 0 ? (
            <EmptyState
              className="px-0 py-12"
              icon={<ThumbsUp />}
              tone="success"
              title="No bookings lost in this period"
              description="Nothing slipped away between these dates. Lost bookings land here with their reason, value and owner."
            />
          ) : (
            <TableScroll>
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <Th>Client</Th>
                    <Th>Reason</Th>
                    <Th>Event type</Th>
                    <Th className="text-right">Value</Th>
                    <Th>Owner</Th>
                    <Th>Lost on</Th>
                  </tr>
                </thead>
                <tbody>
                  {lost.rows.map((r) => (
                    <tr key={r.id} className={ROW}>
                      <Td className="font-medium">{r.client || "—"}</Td>
                      <Td className="text-muted-foreground">{r.reason || "—"}</Td>
                      <Td>{r.eventType || "—"}</Td>
                      <Td className="numeric text-right">{inr(r.value)}</Td>
                      <Td className="text-muted-foreground">{r.owner || "—"}</Td>
                      <Td className="numeric">{fmtDate(r.lostOn)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      </ReportSection>

      {/* 6. Sales Team Performance */}
      <ReportSection
        title="Sales Team Performance"
        description={`Per-executive bookings and outcomes for ${a.range.label}.`}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Employee table */}
          <div className="lg:col-span-2">
            {a.employees.length === 0 ? (
              <EmptyState
                className="px-0 py-12"
                icon={<Users />}
                title="No executive activity in this period"
                description="Widen the date range or clear the employee filter to see per-executive bookings, conversion and revenue."
              />
            ) : (
              <TableScroll>
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <Th>Employee</Th>
                      <Th className="text-right">Bookings closed</Th>
                      <Th className="text-right">Conv.</Th>
                      <Th className="text-right">Revenue</Th>
                      <Th className="text-right">Avg upsell / bkg</Th>
                      <Th className="text-right">Score</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.employees.map((e) => {
                      const conv =
                        e.enquiriesTotal > 0
                          ? Math.round((e.bookingsConfirmed / e.enquiriesTotal) * 100)
                          : 0;
                      const avgUpsell =
                        e.bookingsConfirmed > 0 ? e.upsellValue / e.bookingsConfirmed : 0;
                      return (
                        <tr key={e.userId} className={ROW}>
                          <Td className="font-medium">{e.name}</Td>
                          <Td className="numeric text-right">{e.bookingsConfirmed}</Td>
                          <Td className="numeric text-right">{conv}%</Td>
                          <Td className="numeric text-right">{inr(e.revenue)}</Td>
                          <Td className="numeric text-right">{inr(avgUpsell)}</Td>
                          <Td className="numeric text-right font-semibold">{e.salesScore}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </div>

          {/* Leaderboard */}
          <div>
            <h3 className={SUB_HEAD}>Leaderboard · Sales score</h3>
            {a.leaderboard.length === 0 ? (
              <EmptyState
                className="px-0 py-10"
                icon={<Trophy />}
                title="No scores yet"
                description="Sales scores appear here as the team logs site visits, quotations and confirmed bookings."
              />
            ) : (
              <ol className="space-y-1.5">
                {a.leaderboard.map((l, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  return (
                    <li
                      key={l.userId}
                      className={`flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-[13px] transition-colors hover:bg-muted/40 ${i === 0 ? "bg-amber-500/8" : "bg-muted/20"}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="numeric w-6 shrink-0 text-center text-muted-foreground">
                          {medal ?? i + 1}
                        </span>
                        <span className="truncate font-medium text-foreground">{l.name}</span>
                      </span>
                      <span className="numeric shrink-0 font-semibold text-foreground">
                        {l.salesScore.toLocaleString("en-IN")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </ReportSection>
    </div>
  );
}

// ------------------------------------------------------------
// Tone-coded alert list card (Overdue / Follow-ups / Stale).
// ------------------------------------------------------------
function AlertCard({
  title,
  tone,
  count,
  empty,
  children,
}: {
  title: string;
  tone: "red" | "amber" | "muted";
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  const headTone =
    tone === "red"
      ? "text-destructive"
      : tone === "amber"
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <Card className="gap-0 py-0 transition-shadow hover:shadow-card-hover">
      <CardContent className="space-y-3 px-4 py-4">
        <div className={`flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide ${headTone}`}>
          <span>{title}</span>
          <span className="numeric rounded-full bg-muted/60 px-2 py-0.5 text-foreground">{count}</span>
        </div>
        {count === 0 ? (
          <EmptyState
            className="px-0 py-8"
            icon={<CheckCircle2 />}
            tone={tone === "muted" ? "neutral" : "success"}
            title={empty}
          />
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}
