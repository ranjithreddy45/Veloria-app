import type { Metadata } from "next";
import {
  Users, CheckCircle2, Handshake, Trophy, XCircle, Phone,
  StickyNote, MapPin, Sparkles, Flame, Megaphone,
} from "lucide-react";
import { getBdAnalytics, getBdExecutives } from "@/actions/acq-analytics.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile, type Accent } from "@/components/ui/stat-tile";
import { BdFilterBar } from "../_components/bd-filter-bar";
import { BdEmployeeChart, type BdEmployeeRow } from "./_components/bd-employee-chart";

export const metadata: Metadata = { title: "BD Dashboard" };
export const dynamic = "force-dynamic";

interface Analytics {
  range: { key: string; label: string; from: string; to: string };
  totals: {
    leadsCold: number; leadsCampaign: number; leadsTotal: number;
    dealsCreated: number; dealsQualified: number; dealsWon: number; dealsLost: number;
    callsMade: number; notesFollowups: number; siteVisitsDone: number;
    taskScore: number; wonValue: number; lostValue: number;
  };
  employees: BdEmployeeRow[];
  leaderboard: { userId: string; name: string; taskScore: number }[];
  leadSources: { source: string; label: string; count: number }[];
  funnel: { key: string; label: string; count: number }[];
  lossReasons: { reason: string; label: string; count: number; value: number }[];
  conversion: { leadToQualified: number; qualifiedToWon: number; winRate: number };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

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

export default async function BdDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; emp?: string }>;
}) {
  const sp = await searchParams;
  const employeeIds = sp.emp ? sp.emp.split(",").filter(Boolean) : null;
  const params = { rangeKey: (sp.range as never) ?? "month", from: sp.from ?? null, to: sp.to ?? null, employeeIds };

  const [execRes, aRes] = await Promise.all([getBdExecutives(), getBdAnalytics(params)]);
  const execs = execRes.success ? execRes.data : [];
  const a = (aRes.success ? aRes.data : null) as Analytics | null;

  const t = a?.totals;
  const funnelMax = a?.funnel[0]?.count ?? 0;

  const kpis: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; accent: Accent; sub?: string }[] = t
    ? [
        { label: "Leads", value: t.leadsTotal, icon: Users, accent: "indigo", sub: `${t.leadsCold} cold · ${t.leadsCampaign} campaign` },
        { label: "Deals Created", value: t.dealsCreated, icon: Handshake, accent: "gold" },
        { label: "Qualified", value: t.dealsQualified, icon: CheckCircle2, accent: "blue" },
        { label: "Won", value: t.dealsWon, icon: Trophy, accent: "emerald", sub: inr(t.wonValue) },
        { label: "Lost", value: t.dealsLost, icon: XCircle, accent: "rose", sub: inr(t.lostValue) },
        { label: "Calls Made", value: t.callsMade, icon: Phone, accent: "amber" },
        { label: "Notes / Follow-ups", value: t.notesFollowups, icon: StickyNote, accent: "teal" },
        { label: "Site Visits", value: t.siteVisitsDone, icon: MapPin, accent: "pink" },
        { label: "Task Score", value: t.taskScore, icon: Sparkles, accent: "gold" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        aura
        eyebrow="Business Development · Acquisition"
        title="BD Dashboard"
        help={<PageHelp id="bd-dashboard" />}
        description="Employee-wise acquisition funnel, activity and leaderboard."
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
                <BdEmployeeChart employees={a.employees} />
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
                  <span>Lead→Qualified <b className="text-foreground">{pct(a.conversion.leadToQualified)}</b></span>
                  <span>Qualified→Won <b className="text-foreground">{pct(a.conversion.qualifiedToWon)}</b></span>
                  <span>Win rate <b className="text-foreground">{pct(a.conversion.winRate)}</b></span>
                </div>
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
                        <th className="px-2 py-2 text-right font-medium">Deals</th>
                        <th className="px-2 py-2 text-right font-medium">Won</th>
                        <th className="px-2 py-2 text-right font-medium">Lost</th>
                        <th className="px-2 py-2 text-right font-medium">Calls</th>
                        <th className="px-2 py-2 text-right font-medium">Notes</th>
                        <th className="px-2 py-2 text-right font-medium">Visits</th>
                        <th className="pl-2 py-2 text-right font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.employees.length === 0 ? (
                        <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">No activity in this period.</td></tr>
                      ) : (
                        a.employees.map((e) => (
                          <tr key={e.userId} className="border-b border-border/60 last:border-0">
                            <td className="py-2 pr-3 font-medium text-foreground">{e.name}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{e.leadsTotal}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{e.dealsCreated}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{e.dealsWon}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{e.dealsLost}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{e.callsMade}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{e.notesFollowups}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{e.siteVisitsDone}</td>
                            <td className="pl-2 py-2 text-right font-semibold tabular-nums">{e.taskScore}</td>
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
                  <Trophy className="size-4 text-amber-500" /> Leaderboard · Task score
                </h2>
                {a.leaderboard.filter((l) => l.taskScore !== 0).length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No points awarded yet in this period.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {a.leaderboard.slice(0, 10).map((l, i, arr) => {
                      // Goal-gradient: surface the small remaining gap to the row above.
                      const chaseGap = i > 0 ? arr[i - 1].taskScore - l.taskScore + 1 : null;
                      return (
                        <li key={l.userId} className="rounded-md px-2 py-1.5 text-[13px] odd:bg-muted/30">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 truncate">
                              <span className="w-6 text-center tabular-nums">{MEDAL[i] ?? i + 1}</span>
                              <span className="truncate text-foreground">{l.name}</span>
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">{l.taskScore.toLocaleString("en-IN")}</span>
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
                    <div className="text-[20px] font-semibold tabular-nums text-foreground">{t!.leadsCold}</div>
                  </div>
                  <div className="flex-1 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Megaphone className="size-3.5 text-indigo-500" /> Campaign</div>
                    <div className="text-[20px] font-semibold tabular-nums text-foreground">{t!.leadsCampaign}</div>
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
                  <p className="text-[13px] text-muted-foreground">No lost deals in this period.</p>
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
