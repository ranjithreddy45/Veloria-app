import {
  Filter, Target, Trophy, CalendarClock, Wallet, Coins,
  AlertTriangle, Clock, Timer, XCircle, TrendingDown, TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
  EmptyLine,
  TableScroll,
  Th,
  Td,
  inr,
  fmtDate,
  pct,
} from "@/app/(dashboard)/bd/reports/_components/report-primitives";

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
    <div className="flex flex-col gap-6">
      <PageHeader
        aura
        eyebrow="Sales · Bookings"
        title="Sales Reports"
        description="Funnel, bookings, revenue, follow-ups, losses, and team performance for the selected period."
      />

      {/* Filter bar */}
      <div className="sticky top-2 z-20 -mx-1 rounded-2xl border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          <BdFilterBar employees={execs} />
        </div>
      </div>

      {/* 1. Booking Funnel Overview */}
      <ReportSection
        title="Booking Funnel Overview"
        description={`Stage-to-stage progression for ${a.range.label}.`}
      >
        {a.funnel.length === 0 ? (
          <EmptyLine>No funnel activity in this period.</EmptyLine>
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
                  <div className="relative h-7 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-violet-500/25 to-fuchsia-500/15"
                      style={{ width: `${width}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3 text-[13px] font-medium tabular-nums text-foreground">
                      {row.count.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="w-16 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
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
            accent="violet"
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
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Enquiry sources
          </h3>
          {a.leadSources.length === 0 ? (
            <EmptyLine>No enquiry sources yet.</EmptyLine>
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
                    <tr key={s.source} className="border-t border-border/60">
                      <Td>{s.label}</Td>
                      <Td className="text-right tabular-nums">{s.count.toLocaleString("en-IN")}</Td>
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
          <EmptyLine>No bookings to track in this period.</EmptyLine>
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
                  <tr key={r.id} className="border-t border-border/60">
                    <Td className="font-medium">{r.ref || "—"}</Td>
                    <Td>{r.client || "—"}</Td>
                    <Td>{fmtDate(r.eventDate)}</Td>
                    <Td>{r.hall || "—"}</Td>
                    <Td className="text-right tabular-nums">
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
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                              <span
                                className={`block h-full rounded-full ${
                                  done
                                    ? "bg-emerald-500"
                                    : "bg-gradient-to-r from-violet-500 to-emerald-500"
                                }`}
                                style={{ width: `${barPct}%` }}
                              />
                            </span>
                            <span
                              className={`tabular-nums ${done ? "font-medium text-emerald-600" : ""}`}
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
            accent="violet"
            icon={<TrendingUp className="size-4" />}
            sub="Add-on value"
          />
        </div>

        <div>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            20 / 60 / 20 milestones
          </h3>
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
                  <tr key={m.label} className="border-t border-border/60">
                    <Td className="font-medium">{m.label}</Td>
                    <Td className="text-right tabular-nums">{inr(m.stat.due)}</Td>
                    <Td className="text-right tabular-nums">{inr(m.stat.paid)}</Td>
                    <Td className="text-right tabular-nums">{(m.stat.count || 0).toLocaleString("en-IN")}</Td>
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
            accent="rose"
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
          <AlertCard title="Overdue payments" tone="rose" count={alerts.overdue.length} empty="Nothing overdue — nice.">
            {alerts.overdue.map((it) => (
              <li key={it.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">{it.client || "—"}</span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {inr(it.amount)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
                  <span className="truncate">
                    {[it.ref, it.event].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="shrink-0 tabular-nums">{fmtDate(it.when)}</span>
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{it.owner || "—"}</div>
              </li>
            ))}
          </AlertCard>

          {/* Today's quote follow-ups */}
          <AlertCard title="Today's quote follow-ups" tone="amber" count={alerts.followups.length} empty="No quote follow-ups due today.">
            {alerts.followups.map((it) => (
              <li key={it.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">{it.client || "—"}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtDate(it.when)}</span>
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{it.owner || "—"}</div>
              </li>
            ))}
          </AlertCard>

          {/* No payment 7+ days */}
          <AlertCard title="No payment 7+ days" tone="muted" count={alerts.stale.length} empty="No stale bookings right now.">
            {alerts.stale.map((it) => (
              <li key={it.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">{it.client || "—"}</span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">{inr(it.amount)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
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
            accent="rose"
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
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Reasons
            </h3>
            {lost.reasons.length === 0 ? (
              <EmptyLine>No lost bookings to break down.</EmptyLine>
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
                      <tr key={r.reason} className="border-t border-border/60">
                        <Td>{r.reason}</Td>
                        <Td className="text-right tabular-nums">{r.count.toLocaleString("en-IN")}</Td>
                        <Td className="text-right tabular-nums">{inr(r.value)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </div>

          {/* Win-rate trend */}
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Win-rate trend (6 months)
            </h3>
            {lost.trend.length === 0 ? (
              <EmptyLine>Not enough history yet.</EmptyLine>
            ) : (
              <div className="flex items-end gap-2">
                {lost.trend.map((tr) => {
                  const h = Math.max(4, Math.round((tr.winRate || 0) * 80));
                  return (
                    <div key={tr.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {Math.round((tr.winRate || 0) * 100)}%
                      </span>
                      <div className="flex h-20 w-full items-end">
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-violet-500/40 to-fuchsia-500/30"
                          style={{ height: `${h}px` }}
                        />
                      </div>
                      <span className="truncate text-[10px] text-muted-foreground">{tr.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Lost rows */}
        <div>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Lost bookings
          </h3>
          {lost.rows.length === 0 ? (
            <EmptyLine>No lost bookings in this period.</EmptyLine>
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
                    <tr key={r.id} className="border-t border-border/60">
                      <Td className="font-medium">{r.client || "—"}</Td>
                      <Td className="text-muted-foreground">{r.reason || "—"}</Td>
                      <Td>{r.eventType || "—"}</Td>
                      <Td className="text-right tabular-nums">{inr(r.value)}</Td>
                      <Td className="text-muted-foreground">{r.owner || "—"}</Td>
                      <Td>{fmtDate(r.lostOn)}</Td>
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
              <EmptyLine>No executive activity in this period.</EmptyLine>
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
                        <tr key={e.userId} className="border-t border-border/60">
                          <Td className="font-medium">{e.name}</Td>
                          <Td className="text-right tabular-nums">{e.bookingsConfirmed}</Td>
                          <Td className="text-right tabular-nums">{conv}%</Td>
                          <Td className="text-right tabular-nums">{inr(e.revenue)}</Td>
                          <Td className="text-right tabular-nums">{inr(avgUpsell)}</Td>
                          <Td className="text-right font-semibold tabular-nums">{e.salesScore}</Td>
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
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Leaderboard · Sales score
            </h3>
            {a.leaderboard.length === 0 ? (
              <EmptyLine>No scores yet.</EmptyLine>
            ) : (
              <ol className="space-y-1.5">
                {a.leaderboard.map((l, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  return (
                    <li
                      key={l.userId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[13px]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-6 shrink-0 text-center tabular-nums text-muted-foreground">
                          {medal ?? i + 1}
                        </span>
                        <span className="truncate font-medium text-foreground">{l.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground">
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
  tone: "rose" | "amber" | "muted";
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  const headTone =
    tone === "rose"
      ? "text-rose-600 dark:text-rose-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 px-4 py-4">
        <div className={`flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.04em] ${headTone}`}>
          <span>{title}</span>
          <span className="tabular-nums">{count}</span>
        </div>
        {count === 0 ? (
          <p className="text-[12px] text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}
