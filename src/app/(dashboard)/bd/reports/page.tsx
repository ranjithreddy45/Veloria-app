import {
  Users,
  Filter,
  Handshake,
  Trophy,
  Gauge,
  Wallet,
  Phone,
  MapPin,
  AlertTriangle,
  Clock,
  Timer,
  XCircle,
  TrendingDown,
  Target,
  CheckCircle2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { getBdExecutives, getBdAnalytics } from "@/actions/acq-analytics.actions";
import {
  getBdPipeline,
  getBdFollowupTracker,
  getBdLostAnalysis,
} from "@/actions/acq-reports.actions";
import { BdFilterBar } from "../_components/bd-filter-bar";
import {
  ReportSection,
  EmptyLine,
  TableScroll,
  Th,
  Td,
  inr,
  fmtDate,
  pct,
} from "./_components/report-primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "BD Reports" };

// ------------------------------------------------------------
// Local shapes mirroring the documented action payloads. The actions
// return Result<unknown>, so we cast `res.data` to these after the
// success check. Any missing field falls back to a safe default.
// ------------------------------------------------------------
interface Exec {
  id: string;
  name: string;
}

interface AnalyticsTotals {
  leadsCold: number;
  leadsCampaign: number;
  leadsTotal: number;
  dealsCreated: number;
  dealsQualified: number;
  dealsWon: number;
  dealsLost: number;
  callsMade: number;
  notesFollowups: number;
  siteVisitsDone: number;
  taskScore: number;
  wonValue: number;
  lostValue: number;
}

interface AnalyticsEmployee {
  userId: string;
  name: string;
  leadsCold: number;
  leadsCampaign: number;
  leadsTotal: number;
  dealsCreated: number;
  dealsQualified: number;
  dealsWon: number;
  dealsLost: number;
  callsMade: number;
  notesFollowups: number;
  siteVisitsDone: number;
  taskScore: number;
}

interface Analytics {
  range: { key: string; label: string; from: string; to: string };
  totals: AnalyticsTotals;
  employees: AnalyticsEmployee[];
  leaderboard: { userId: string; name: string; taskScore: number }[];
  leadSources: { source: string; label: string; count: number }[];
  funnel: { key: string; label: string; count: number }[];
  lossReasons: { reason: string; label: string; count: number; value: number }[];
  conversion: { leadToQualified: number; qualifiedToWon: number; winRate: number };
}

interface PipelineRow {
  id: string;
  name: string;
  client: string;
  contact: string;
  propertyType: string;
  city: string;
  seating: number | string | null;
  stage: string;
  stageLabel: string;
  owner: string;
  expectedCloseDate: string | null;
  lastContact: string | null;
  nextFollowup: string | null;
  probability: number;
  value: number;
  weightedValue: number;
}

interface Pipeline {
  rows: PipelineRow[];
  totalWeighted: number;
  totalValue: number;
  count: number;
}

interface FollowupItem {
  id: string;
  client: string;
  property: string;
  contact: string;
  when: string | null;
  owner: string;
}

interface FollowupTracker {
  overdue: FollowupItem[];
  dueSoon: FollowupItem[];
  atRisk: FollowupItem[];
  counts: { overdue: number; dueSoon: number; atRisk: number };
}

interface LostRow {
  id: string;
  name: string;
  client: string;
  city: string;
  reason: string;
  reasonLabel: string;
  value: number;
  owner: string;
  lostOn: string | null;
}

interface LostAnalysis {
  rows: LostRow[];
  reasons: { reason: string; label: string; count: number; value: number }[];
  trend: { month: string; won: number; lost: number; winRate: number }[];
  totalCount: number;
  totalValue: number;
  range: { label: string };
}

const EMPTY_ANALYTICS: Analytics = {
  range: { key: "month", label: "This month", from: "", to: "" },
  totals: {
    leadsCold: 0,
    leadsCampaign: 0,
    leadsTotal: 0,
    dealsCreated: 0,
    dealsQualified: 0,
    dealsWon: 0,
    dealsLost: 0,
    callsMade: 0,
    notesFollowups: 0,
    siteVisitsDone: 0,
    taskScore: 0,
    wonValue: 0,
    lostValue: 0,
  },
  employees: [],
  leaderboard: [],
  leadSources: [],
  funnel: [],
  lossReasons: [],
  conversion: { leadToQualified: 0, qualifiedToWon: 0, winRate: 0 },
};

const EMPTY_PIPELINE: Pipeline = { rows: [], totalWeighted: 0, totalValue: 0, count: 0 };
const EMPTY_FOLLOWUP: FollowupTracker = {
  overdue: [],
  dueSoon: [],
  atRisk: [],
  counts: { overdue: 0, dueSoon: 0, atRisk: 0 },
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

export default async function BdReportsPage({
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

  const [execRes, analyticsRes, pipelineRes, followupRes, lostRes] = await Promise.all([
    getBdExecutives(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getBdAnalytics(params as any),
    getBdPipeline({ employeeIds }),
    getBdFollowupTracker({ employeeIds }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getBdLostAnalysis(params as any),
  ]);

  const execs: Exec[] = execRes.success ? (execRes.data as Exec[]) : [];
  const a: Analytics = analyticsRes.success ? (analyticsRes.data as Analytics) : EMPTY_ANALYTICS;
  const pipeline: Pipeline = pipelineRes.success ? (pipelineRes.data as Pipeline) : EMPTY_PIPELINE;
  const followup: FollowupTracker = followupRes.success
    ? (followupRes.data as FollowupTracker)
    : EMPTY_FOLLOWUP;
  const lost: LostAnalysis = lostRes.success ? (lostRes.data as LostAnalysis) : EMPTY_LOST;

  const funnelTop = a.funnel.length > 0 ? a.funnel[0].count : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        aura
        eyebrow="Business Development · Acquisition"
        title="BD Reports"
        description="Funnel, pipeline, revenue, follow-ups, losses, and team performance for the selected period."
      />

      {/* Filter bar */}
      <div className="sticky top-2 z-20 -mx-1 rounded-2xl border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          <BdFilterBar employees={execs} />
        </div>
      </div>

      {/* 1. Lead Funnel Overview */}
      <ReportSection
        title="Lead Funnel Overview"
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
                      className="h-full rounded-lg bg-gradient-to-r from-violet-500/30 to-violet-500/10"
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Conversion KPIs */}
          <div className="grid grid-cols-1 gap-3 lg:col-span-1">
            <StatTile
              label="Lead → Qualified"
              value={pct(a.conversion.leadToQualified)}
              accent="blue"
              icon={<Target className="size-4" />}
              sub="Qualification rate"
            />
            <StatTile
              label="Qualified → Won"
              value={pct(a.conversion.qualifiedToWon)}
              accent="gold"
              icon={<Handshake className="size-4" />}
              sub="Close rate from qualified"
            />
            <StatTile
              label="Win rate"
              value={pct(a.conversion.winRate)}
              accent="emerald"
              icon={<Trophy className="size-4" />}
              sub="Overall win rate"
            />
          </div>

          {/* Lead sources */}
          <div className="lg:col-span-2">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Lead sources
            </h3>
            {a.leadSources.length === 0 ? (
              <EmptyLine>No lead sources yet.</EmptyLine>
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
        </div>
      </ReportSection>

      {/* 2. Active Pipeline (Deal Tracker) */}
      <ReportSection title="Active Pipeline · Deal Tracker" description="Open deals weighted by close probability.">
        {/* Single column on a phone. StatTile renders its value at 28px inside
          * an overflow-hidden card; a half-width tile at 375px is ~125px of
          * usable space, which silently CLIPS a figure like ₹1,25,00,000.
          * Money must never be cut off, so money rows stack instead. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Open deals"
            value={pipeline.count}
            accent="indigo"
            icon={<Handshake className="size-4" />}
            sub="In the pipeline"
          />
          <StatTile
            label="Weighted value"
            value={inr(pipeline.totalWeighted)}
            accent="gold"
            icon={<Gauge className="size-4" />}
            sub="Probability-adjusted"
          />
          <StatTile
            label="Total value"
            value={inr(pipeline.totalValue)}
            accent="blue"
            icon={<Wallet className="size-4" />}
            sub="Full deal value"
          />
        </div>

        {pipeline.rows.length === 0 ? (
          <EmptyLine>No open deals in the pipeline.</EmptyLine>
        ) : (
          <TableScroll>
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Contact</Th>
                  <Th>Property</Th>
                  <Th>City</Th>
                  <Th className="text-right">Seating</Th>
                  <Th>Stage</Th>
                  <Th>Owner</Th>
                  <Th>Exp. close</Th>
                  <Th>Next follow-up</Th>
                  <Th className="text-right">Prob.</Th>
                  <Th className="text-right">Weighted</Th>
                </tr>
              </thead>
              <tbody>
                {pipeline.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <Td className="font-medium">{r.client || "—"}</Td>
                    <Td className="text-muted-foreground">{r.contact || "—"}</Td>
                    <Td>{r.propertyType || "—"}</Td>
                    <Td>{r.city || "—"}</Td>
                    <Td className="text-right tabular-nums">
                      {r.seating === null || r.seating === "" ? "—" : r.seating}
                    </Td>
                    <Td>{r.stageLabel || "—"}</Td>
                    <Td className="text-muted-foreground">{r.owner || "—"}</Td>
                    <Td>{fmtDate(r.expectedCloseDate)}</Td>
                    <Td>{fmtDate(r.nextFollowup)}</Td>
                    <Td className="text-right tabular-nums">{Math.round(r.probability || 0)}%</Td>
                    <Td className="text-right tabular-nums">{inr(r.weightedValue)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </ReportSection>

      {/* 3. Bookings & Revenue */}
      <ReportSection title="Bookings & Revenue" description={`Closed-won performance for ${a.range.label}.`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Deals won"
            value={a.totals.dealsWon}
            accent="emerald"
            icon={<Trophy className="size-4" />}
            sub="Closed won this period"
          />
          <StatTile
            label="Won value"
            value={inr(a.totals.wonValue)}
            accent="teal"
            icon={<Wallet className="size-4" />}
            sub="Revenue booked"
          />
          <StatTile
            label="Win rate"
            value={pct(a.conversion.winRate)}
            accent="cyan"
            icon={<CheckCircle2 className="size-4" />}
            sub="Overall win rate"
          />
        </div>
      </ReportSection>

      {/* 4. Follow-up & Activity Tracker */}
      <ReportSection title="Follow-up & Activity Tracker" description="Where follow-ups stand right now, plus activity this period.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="Overdue"
            value={followup.counts.overdue}
            accent="red"
            icon={<AlertTriangle className="size-4" />}
            sub="Past due follow-ups"
          />
          <StatTile
            label="Due in 24h"
            value={followup.counts.dueSoon}
            accent="amber"
            icon={<Clock className="size-4" />}
            sub="Coming up soon"
          />
          <StatTile
            label="At risk"
            value={followup.counts.atRisk}
            accent="indigo"
            icon={<Timer className="size-4" />}
            sub="7+ days no activity"
          />
          <StatTile
            label="Calls made"
            value={a.totals.callsMade}
            accent="blue"
            icon={<Phone className="size-4" />}
            sub="Activity this period"
          />
          <StatTile
            label="Site visits"
            value={a.totals.siteVisitsDone}
            accent="gold"
            icon={<MapPin className="size-4" />}
            sub="Activity this period"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <FollowupList
            title="Overdue"
            items={followup.overdue}
            tone="red"
            empty="Nothing overdue — nice."
          />
          <FollowupList
            title="Due in 24h"
            items={followup.dueSoon}
            tone="amber"
            empty="Nothing due in the next 24 hours."
          />
          <FollowupList
            title="At risk (7+ days quiet)"
            items={followup.atRisk}
            tone="muted"
            empty="No stale deals right now."
          />
        </div>
      </ReportSection>

      {/* 5. Lost Deal Analysis */}
      <ReportSection title="Lost Deal Analysis" description={`Losses and win-rate trend for ${lost.range.label || a.range.label}.`}>
        {/* Stacks on a phone — "Lost value" is a rupee figure that a half-width
          * StatTile clips (see Active Pipeline above). */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile
            label="Deals lost"
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
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Reasons
            </h3>
            {lost.reasons.length === 0 ? (
              <EmptyLine>No lost deals to break down.</EmptyLine>
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
                        <Td>{r.label}</Td>
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
                {lost.trend.map((t) => {
                  // `trend.winRate` arrives from the action already as a PERCENT
                  // (0–100), not a fraction — unlike `conversion.winRate`. Treat it
                  // as such, and clamp so bad data can never render a bar taller
                  // than its 80px track (it used to streak up the whole page).
                  const rate = Math.min(100, Math.max(0, t.winRate || 0));
                  const h = Math.max(4, Math.round((rate / 100) * 80));
                  return (
                    <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {Math.round(rate)}%
                      </span>
                      <div className="flex h-20 w-full items-end overflow-hidden">
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-violet-500/45 to-violet-500/20"
                          style={{ height: `${h}px` }}
                        />
                      </div>
                      <span className="truncate text-[10px] text-muted-foreground">{t.month}</span>
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
            Lost deals
          </h3>
          {lost.rows.length === 0 ? (
            <EmptyLine>No lost deals in this period.</EmptyLine>
          ) : (
            <TableScroll>
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <Th>Client</Th>
                    <Th>City</Th>
                    <Th>Reason</Th>
                    <Th className="text-right">Value</Th>
                    <Th>Owner</Th>
                    <Th>Lost on</Th>
                  </tr>
                </thead>
                <tbody>
                  {lost.rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <Td className="font-medium">{r.client || "—"}</Td>
                      <Td>{r.city || "—"}</Td>
                      <Td className="text-muted-foreground">{r.reasonLabel || "—"}</Td>
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

      {/* 6. Team Performance */}
      <ReportSection title="Team Performance" description={`Per-executive activity and outcomes for ${a.range.label}.`}>
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
                      <Th className="text-right">Leads</Th>
                      <Th className="text-right">Created</Th>
                      <Th className="text-right">Qualified</Th>
                      <Th className="text-right">Won</Th>
                      <Th className="text-right">Lost</Th>
                      <Th className="text-right">Calls</Th>
                      <Th className="text-right">Notes/FU</Th>
                      <Th className="text-right">Visits</Th>
                      <Th className="text-right">Conv.</Th>
                      <Th className="text-right">Score</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.employees.map((e) => {
                      const conv =
                        e.dealsCreated > 0 ? Math.round((e.dealsWon / e.dealsCreated) * 100) : 0;
                      return (
                        <tr key={e.userId} className="border-t border-border/60">
                          <Td className="font-medium">{e.name}</Td>
                          <Td className="text-right tabular-nums">
                            <span>{e.leadsTotal.toLocaleString("en-IN")}</span>
                            <span className="block text-[10px] text-muted-foreground">
                              {e.leadsCold} cold / {e.leadsCampaign} campaign
                            </span>
                          </Td>
                          <Td className="text-right tabular-nums">{e.dealsCreated}</Td>
                          <Td className="text-right tabular-nums">{e.dealsQualified}</Td>
                          <Td className="text-right tabular-nums">{e.dealsWon}</Td>
                          <Td className="text-right tabular-nums">{e.dealsLost}</Td>
                          <Td className="text-right tabular-nums">{e.callsMade}</Td>
                          <Td className="text-right tabular-nums">{e.notesFollowups}</Td>
                          <Td className="text-right tabular-nums">{e.siteVisitsDone}</Td>
                          <Td className="text-right tabular-nums">{conv}%</Td>
                          <Td className="text-right font-semibold tabular-nums">{e.taskScore}</Td>
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
              Leaderboard · Task score
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
                        {l.taskScore.toLocaleString("en-IN")}
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
// Follow-up list card (Overdue / Due soon / At risk).
// ------------------------------------------------------------
function FollowupList({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: FollowupItem[];
  tone: "red" | "amber" | "muted";
  empty: string;
}) {
  const headTone =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 px-4 py-4">
        <div className={`flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.04em] ${headTone}`}>
          <span>{title}</span>
          <span className="tabular-nums">{items.length}</span>
        </div>
        {items.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {it.client || "—"}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {fmtDate(it.when)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
                  <span className="truncate">
                    {[it.property, it.contact].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="shrink-0 truncate">{it.owner || "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
