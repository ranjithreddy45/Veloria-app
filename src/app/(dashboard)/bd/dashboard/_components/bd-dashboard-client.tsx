"use client";

import React, { useState, useMemo } from "react";
import {
  Users, CheckCircle2, Handshake, Trophy, XCircle, Phone,
  StickyNote, MapPin, Sparkles, TrendingUp, Info, ArrowUpRight, ExternalLink, RotateCcw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { format, parseISO } from "date-fns";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface EmployeeRow {
  userId: string; name: string;
  leadsCold: number; leadsCampaign: number; leadsTotal: number;
  dealsCreated: number; dealsQualified: number; dealsWon: number; dealsLost: number;
  callsMade: number; notesFollowups: number; siteVisitsDone: number; taskScore: number;
}

interface Analytics {
  range: { key: string; label: string; from: string; to: string };
  totals: {
    leadsCold: number; leadsCampaign: number; leadsTotal: number;
    dealsCreated: number; dealsQualified: number; dealsWon: number; dealsLost: number;
    callsMade: number; notesFollowups: number; siteVisitsDone: number;
    taskScore: number; wonValue: number; lostValue: number;
  };
  employees: EmployeeRow[];
  leaderboard: { userId: string; name: string; taskScore: number }[];
  leadSources: { source: string; label: string; count: number }[];
  funnel: { key: string; label: string; count: number }[];
  lossReasons: { reason: string; label: string; count: number; value: number }[];
  conversion: { leadToQualified: number; qualifiedToWon: number; winRate: number };
  pipelineTrend: { date: string; leads: number; dealsCreated: number; qualified: number; won: number; lost: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const pct = (n: number) => `${Math.round(n * 100)}%`;
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const SOURCE_COLORS: Record<string, string> = {
  COLD_CALL: "#6366f1",
  REFERRAL: "#a855f7",
  WEBSITE: "#06b6d4",
  WALK_IN: "#10b981",
  SOCIAL_MEDIA: "#f59e0b",
  BROKER: "#f97316",
  OTHER: "#64748b",
};

const LEADERBOARD_AVATAR_COLORS = [
  "#f59e0b","#ef4444","#10b981","#6366f1","#a855f7",
  "#06b6d4","#f97316","#ec4899","#14b8a6","#8b5cf6",
];

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline (with gradient fill, no deps)
// ─────────────────────────────────────────────────────────────────────────────
function Sparkline({ data, color, w = 90, h = 36 }: { data: number[]; color: string; w?: number; h?: number }) {
  const id = React.useId();
  if (!data.length || data.every((v) => v === 0)) {
    // Flat line
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
        <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={color} strokeWidth={1.5} strokeOpacity={0.5} />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  });
  
  const fillPts = `0,${h} ${pts.join(" ")} ${w},${h}`;
  
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${id})`} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card — icon left, number + sub, sparkline middle-right
// ─────────────────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number | string;
  sub1?: string;
  sub2?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  sparkColor: string;
  sparkData: number[];
  trend?: "up" | "down" | "none";
  trendColor?: string;
}

function KpiCard({ label, value, sub1, sub2, icon: Icon, iconBg, iconColor, sparkColor, sparkData, trend, trendColor }: KpiCardProps) {
  return (
    <div className="relative flex justify-between rounded-2xl border border-border bg-card p-4 overflow-hidden min-w-0">
      
      {/* Sparkline — middle right */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-90 pointer-events-none">
        <Sparkline data={sparkData} color={sparkColor} w={80} h={40} />
      </div>

      <div className="flex flex-col gap-1.5 z-10 w-full pr-[80px]">
        {/* Icon + label row */}
        <div className="flex items-center gap-2.5">
          <div className={`rounded-full p-1.5 ${iconBg}`}>
            <Icon className={`size-3.5 ${iconColor}`} />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">{label}</span>
        </div>

        {/* Big number */}
        <div className="text-3xl font-bold text-foreground leading-none tabular-nums tracking-tight mt-1.5">
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </div>

        {/* Sub-text rows */}
        <div className="mt-1 flex flex-col gap-1">
          {sub1 && (
            <div className={`flex items-center gap-1 text-[11px] font-semibold ${trendColor || "text-muted-foreground"} truncate`}>
              {trend === "up" && <ArrowUpRight className="size-3.5 shrink-0" strokeWidth={3} />}
              {trend === "down" && <ArrowUpRight className="size-3.5 shrink-0 rotate-90" strokeWidth={3} />}
              <span className="truncate">{sub1}</span>
            </div>
          )}
          {sub2 && <div className="text-[10px] text-muted-foreground">{sub2}</div>}
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Funnel Bar — flat colors and dynamic width
// ─────────────────────────────────────────────────────────────────────────────
function FunnelRow({ label, count, maxCount, convPct, index }: { label: string; count: number; maxCount: number; convPct: string; index: number }) {
  const w = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  
  const COLORS = [
    "bg-blue-500",
    "bg-indigo-500",
    "bg-indigo-400",
    "bg-violet-500",
    "bg-fuchsia-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
  ];
  const color = COLORS[index] || COLORS[COLORS.length - 1];

  // Taper down slightly (1.5% per step) so it doesn't look too squished horizontally
  const bgWidth = 100 - (index * 1.5);

  return (
    <div className="flex items-center gap-3 h-[32px]">
      <div className="w-[120px] shrink-0 text-[12px] font-medium text-muted-foreground text-right pr-2 truncate">{label}</div>
      <div className="flex-1 flex justify-center h-full">
        <div 
          className="relative h-full rounded-md bg-muted" 
          style={{ width: `${bgWidth}%` }}
        >
          {/* Fill */}
          {count > 0 && (
            <div
              className={`absolute left-0 top-0 h-full rounded-md ${color} transition-all duration-700`}
              style={{ width: `${w}%` }}
            />
          )}
        </div>
      </div>
      <div className="w-8 shrink-0 text-right text-[12px] font-bold text-foreground tabular-nums">{count}</div>
      <div className="w-10 shrink-0 text-right text-[12px] text-muted-foreground tabular-nums">{convPct}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee Performance — tab pills + horizontal bars with numbers on right
// ─────────────────────────────────────────────────────────────────────────────
const EMP_METRICS: { key: keyof EmployeeRow; label: string; color: string }[] = [
  { key: "leadsTotal",     label: "Leads",              color: "#6366f1" },
  { key: "dealsCreated",   label: "Deals created",      color: "#8b5cf6" },
  { key: "dealsQualified", label: "Qualified",          color: "#0ea5e9" },
  { key: "dealsWon",       label: "Won",                color: "#10b981" },
  { key: "dealsLost",      label: "Lost",               color: "#ef4444" },
  { key: "callsMade",      label: "Calls",              color: "#f59e0b" },
  { key: "notesFollowups", label: "Notes / follow-ups", color: "#14b8a6" },
  { key: "siteVisitsDone", label: "Site visits",        color: "#ec4899" },
  { key: "taskScore",      label: "Task score",         color: "#a855f7" },
];

function EmployeePerformance({ employees }: { employees: EmployeeRow[] }) {
  const [activeKey, setActiveKey] = useState<keyof EmployeeRow>("leadsTotal");
  const metric = EMP_METRICS.find((m) => m.key === activeKey)!;

  const sorted = useMemo(
    () =>
      [...employees]
        .map((e) => ({ userId: e.userId, name: e.name.split(" ").slice(0, 2).join(" "), value: Number(e[activeKey]) || 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12),
    [employees, activeKey]
  );
  const maxVal = sorted[0]?.value || 1;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Metric tab pills — scrollable row */}
      <div className="flex flex-wrap gap-1.5">
        {EMP_METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveKey(m.key)}
            className="rounded-full px-3 py-0.5 text-[11px] font-semibold border transition-all whitespace-nowrap"
            style={
              activeKey === m.key
                ? { backgroundColor: m.color, borderColor: m.color, color: "#fff" }
                : { borderColor: "rgba(255,255,255,0.1)", color: "#94a3b8", background: "transparent" }
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Bars + names + numbers */}
      <div className="space-y-1 flex-1 overflow-hidden">
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No data for this period.</p>
        ) : (
          sorted.map((row) => {
            const w = maxVal > 0 ? Math.round((row.value / maxVal) * 100) : 0;
            return (
              <div key={row.userId} className="flex items-center gap-2 h-6">
                <div className="w-28 shrink-0 text-[11px] text-muted-foreground truncate">{row.name}</div>
                <div className="flex-1 relative h-4 rounded overflow-hidden bg-muted">
                  {row.value > 0 && (
                    <div
                      className="h-full rounded transition-all duration-500"
                      style={{ width: `${w}%`, backgroundColor: metric.color, opacity: 0.85 }}
                    />
                  )}
                </div>
                <div className="w-8 shrink-0 text-right text-[11px] font-bold text-foreground tabular-nums">{row.value}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip for line chart
// ─────────────────────────────────────────────────────────────────────────────
function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  let lbl = label ?? "";
  try { lbl = format(parseISO(lbl), "d MMM"); } catch {}
  return (
    <div className="rounded-xl border border-border bg-card/95 p-2.5 shadow-xl text-xs backdrop-blur">
      <p className="text-muted-foreground font-semibold mb-1.5 text-[11px]">{lbl}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground capitalize text-[11px]">{p.name}</span>
          <span className="ml-auto font-bold text-foreground tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────────────────────────
export function BdDashboardClient({ data: a }: { data: Analytics }) {
  const t = a.totals;
  const funnelMax = a.funnel[0]?.count || 1;
  const totalSources = a.leadSources.reduce((s, x) => s + x.count, 0) || 1;

  // Sparkline data — daily trend for each metric
  const trend = a.pipelineTrend;
  const sparkLeads       = trend.map((d) => d.leads);
  const sparkDeals       = trend.map((d) => d.dealsCreated);
  const sparkQualified   = trend.map((d) => d.qualified);
  const sparkWon         = trend.map((d) => d.won);

  // x-axis date labels for pipeline chart
  const trendChart = useMemo(() => {
    const pts = trend.length > 31
      ? trend.filter((_, i) => i % Math.ceil(trend.length / 31) === 0)
      : trend;
    return pts.map((d) => ({
      ...d,
      lbl: (() => { try { return format(parseISO(d.date), "d MMM"); } catch { return d.date; } })(),
    }));
  }, [trend]);

  return (
    <div className="flex flex-col gap-4 p-5">

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ROW 1 — 5 KPI cards: Leads, Deals Created, Qualified, Won, Lost */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Leads" value={t.leadsTotal}
          sub1={`+${t.leadsCold} cold · ${t.leadsCampaign} campaign`}
          sub2={a.range.label}
          icon={Users} iconBg="bg-indigo-500/20" iconColor="text-indigo-400"
          sparkColor="#6366f1" sparkData={sparkLeads}
          trend="up" trendColor="text-emerald-400"
        />
        <KpiCard
          label="Deals Created" value={t.dealsCreated}
          sub1="Deals created"
          sub2={a.range.label}
          icon={Handshake} iconBg="bg-amber-500/20" iconColor="text-amber-400"
          sparkColor="#f59e0b" sparkData={sparkDeals}
          trend="up" trendColor="text-emerald-400"
        />
        <KpiCard
          label="Qualified" value={t.dealsQualified}
          sub1={`${pct(a.conversion.leadToQualified)} conversion from leads`}
          sub2={a.range.label}
          icon={CheckCircle2} iconBg="bg-sky-500/20" iconColor="text-sky-400"
          sparkColor="#0ea5e9" sparkData={sparkQualified}
          trend="down" trendColor="text-sky-400"
        />
        <KpiCard
          label="Won" value={t.dealsWon}
          sub1={`${pct(a.conversion.winRate)} win rate`}
          sub2={a.range.label}
          icon={Trophy} iconBg="bg-emerald-500/20" iconColor="text-emerald-400"
          sparkColor="#10b981" sparkData={sparkWon}
          trend="down" trendColor="text-emerald-400"
        />
        <KpiCard
          label="Lost" value={t.dealsLost}
          sub1={t.lostValue > 0 ? `${inr(t.lostValue)} total value` : undefined}
          sub2={a.range.label}
          icon={XCircle} iconBg="bg-rose-500/20" iconColor="text-rose-400"
          sparkColor="#ef4444" sparkData={trend.map((d) => d.lost ?? 0)}
          trend="down" trendColor="text-rose-400"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ROW 2 — 4 KPI cards: Calls, Notes, Site Visits, Task Score   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Calls Made" value={t.callsMade}
          sub1="— vs last month"
          sub2={a.range.label}
          icon={Phone} iconBg="bg-amber-500/20" iconColor="text-amber-400"
          sparkColor="#f59e0b" sparkData={trend.map(() => 0)}
          trend="none" trendColor="text-muted-foreground"
        />
        <KpiCard
          label="Notes / Follow-ups" value={t.notesFollowups}
          sub1={t.notesFollowups > 0 ? `+${t.notesFollowups} this month` : "— vs last month"}
          sub2={a.range.label}
          icon={StickyNote} iconBg="bg-teal-500/20" iconColor="text-teal-400"
          sparkColor="#14b8a6" sparkData={trend.map(() => 0)}
          trend={t.notesFollowups > 0 ? "up" : "none"} trendColor={t.notesFollowups > 0 ? "text-emerald-400" : "text-muted-foreground"}
        />
        <KpiCard
          label="Site Visits" value={t.siteVisitsDone}
          sub1="— vs last month"
          sub2={a.range.label}
          icon={MapPin} iconBg="bg-pink-500/20" iconColor="text-pink-400"
          sparkColor="#ec4899" sparkData={trend.map(() => 0)}
          trend="none" trendColor="text-muted-foreground"
        />
        <KpiCard
          label="Task Score" value={t.taskScore}
          sub1={`Total points · ${a.range.label}`}
          icon={Sparkles} iconBg="bg-violet-500/20" iconColor="text-violet-400"
          sparkColor="#a855f7" sparkData={trend.map(() => 0)}
          trend="none" trendColor="text-muted-foreground"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ROW 3 — Acquisition Funnel  |  Employee Performance           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Acquisition Funnel */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-4">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              Acquisition Funnel
              <Info className="size-3.5 text-muted-foreground" />
            </h2>
            <div className="text-[11px] text-muted-foreground text-right leading-relaxed">
              Conversion rate: Lead → Qualified{" "}
              <span className="text-foreground font-semibold">{pct(a.conversion.leadToQualified)}</span>
              {" "}| Qualified → Won{" "}
              <span className="text-foreground font-semibold">{pct(a.conversion.qualifiedToWon)}</span>
            </div>
          </div>
          <div className="flex flex-col justify-center flex-1 space-y-3 mt-4 mb-2">
            {a.funnel.map((row, i) => {
              const prev = i > 0 ? a.funnel[i - 1].count : 0;
              const convPct = i === 0 ? "100%" : (prev > 0 ? `${Math.round((row.count / prev) * 100)}%` : "0%");
              return (
                <FunnelRow
                  key={row.key}
                  label={row.label}
                  count={row.count}
                  maxCount={funnelMax}
                  convPct={convPct}
                  index={i}
                />
              );
            })}
          </div>
        </div>

        {/* Employee Performance */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">Employee performance</h2>
          <EmployeePerformance employees={a.employees} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ROW 4 — Pipeline Trend (60%)  |  Leads by Source (40%)       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

        {/* Pipeline Trend — 3/5 width */}
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-3">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              Pipeline trend
              <Info className="size-3.5 text-muted-foreground" />
            </h2>
            {/* Legend */}
            <div className="ml-auto flex items-center gap-4">
              {[
                { key: "leads", color: "#6366f1", label: "Leads" },
                { key: "dealsCreated", color: "#f97316", label: "Deals Created" },
                { key: "qualified", color: "#a855f7", label: "Qualified" },
                { key: "won", color: "#10b981", label: "Won" },
                { key: "lost", color: "#ef4444", label: "Lost" },
              ].map((l) => (
                <span key={l.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          {trendChart.every((d) => d.leads === 0) ? (
            <div className="flex h-44 items-center justify-center text-muted-foreground text-sm">
              No trend data for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendChart} margin={{ left: -16, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="lbl" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
                <Tooltip content={<TrendTooltip />} />
                <Line type="monotone" dataKey="leads"        name="Leads"        stroke="#6366f1" strokeWidth={2} dot={{ r: 2, fill: "#6366f1" }} />
                <Line type="monotone" dataKey="dealsCreated" name="Deals Created" stroke="#f97316" strokeWidth={2} dot={{ r: 2, fill: "#f97316" }} />
                <Line type="monotone" dataKey="qualified"    name="Qualified"    stroke="#a855f7" strokeWidth={2} dot={{ r: 2, fill: "#a855f7" }} />
                <Line type="monotone" dataKey="won"          name="Won"          stroke="#10b981" strokeWidth={2} dot={{ r: 2, fill: "#10b981" }} />
                <Line type="monotone" dataKey="lost"         name="Lost"         stroke="#ef4444" strokeWidth={2} dot={{ r: 2, fill: "#ef4444" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Leads by Source — 2/5 width */}
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-foreground mb-4">Leads by source</h2>
          {a.leadSources.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No data yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              {/* Donut with center number */}
              <div className="relative shrink-0">
                <PieChart width={130} height={130}>
                  <Pie
                    data={a.leadSources}
                    dataKey="count"
                    cx={65} cy={65}
                    innerRadius={42} outerRadius={60}
                    strokeWidth={0}
                  >
                    {a.leadSources.map((s) => (
                      <Cell key={s.source} fill={SOURCE_COLORS[s.source] ?? "#6366f1"} />
                    ))}
                  </Pie>
                </PieChart>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-foreground tabular-nums">{t.leadsTotal}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight text-center">Total Leads</span>
                </div>
              </div>

              {/* Legend list */}
              <div className="flex-1 space-y-2">
                {a.leadSources.map((s) => {
                  const p = Math.round((s.count / totalSources) * 100);
                  return (
                    <div key={s.source} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[s.source] ?? "#6366f1" }} />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{s.label}</span>
                      <span className="text-xs font-bold text-foreground tabular-nums w-6 text-right">{s.count}</span>
                      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{p}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ROW 5 — By Employee Table (60%)  |  Leaderboard (40%)        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 h-[400px]">

        {/* By Employee table — 3/5 */}
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-3 flex flex-col h-full overflow-hidden">
          <h2 className="text-sm font-bold text-foreground mb-4 shrink-0">By employee</h2>
          <div className="overflow-auto flex-1 pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {["Employee","Leads","Deals","Won","Lost","Calls","Notes","Visits","Score"].map((h, idx) => (
                    <th
                      key={h}
                      className={`py-1.5 sticky top-0 bg-card z-10 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${idx === 0 ? "text-left pr-3 w-32" : "text-right px-1.5"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.employees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                      No activity in this period.
                    </td>
                  </tr>
                ) : (
                  a.employees.map((e) => (
                    <tr key={e.userId} className="border-b border-border last:border-0 hover:bg-accent transition-colors">
                      <td className="py-1.5 pr-3 font-semibold text-foreground max-w-[120px] truncate">{e.name}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">{e.leadsTotal}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">{e.dealsCreated}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-emerald-400 font-semibold">{e.dealsWon}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-rose-400 font-semibold">{e.dealsLost}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">{e.callsMade}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">{e.notesFollowups}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-muted-foreground">{e.siteVisitsDone}</td>
                      <td className="pl-1.5 py-1.5 text-right font-black tabular-nums text-foreground">{e.taskScore}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leaderboard — 2/5 */}
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Trophy className="size-4 text-amber-400" />
              Leaderboard · Task score
            </h2>
            <a href="/bd/reports" className="flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-300 font-semibold">
              View all <ArrowUpRight className="size-3" />
            </a>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {a.leaderboard.filter((l) => l.taskScore > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No points awarded yet in this period.</p>
            ) : (
              <ol className="space-y-1.5">
                {a.leaderboard.slice(0, 10).map((l, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  const avatarColor = LEADERBOARD_AVATAR_COLORS[i % LEADERBOARD_AVATAR_COLORS.length];
                  const initial = l.name.trim().charAt(0).toUpperCase();
                  return (
                    <li key={l.userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
                      {/* Rank */}
                      <div className="w-5 shrink-0 text-center">
                        {medal
                          ? <span className="text-sm">{medal}</span>
                          : <span className="text-xs font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                        }
                      </div>

                      {/* Avatar */}
                      <div
                        className="size-7 rounded-full flex items-center justify-center text-[11px] font-black text-foreground shrink-0 ring-2 ring-black/40"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {initial}
                      </div>

                      {/* Name */}
                      <span className="flex-1 text-xs font-semibold text-foreground truncate">{l.name}</span>

                      {/* Score */}
                      <span className="text-sm font-black text-foreground tabular-nums">
                        {l.taskScore.toLocaleString("en-IN")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ROW 6 — Loss Reasons (50%)  |  Recent Activity (50%)         */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Loss Reasons */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground mb-4">
            <XCircle className="size-4 text-rose-400" />
            Loss reasons
          </h2>
          {a.lossReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lost deals in this period. 🎉</p>
          ) : (
            <div className="space-y-2">
              {a.lossReasons.map((r) => (
                <div key={r.reason} className="flex items-center justify-between gap-3 border-b border-white/[0.05] last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full bg-rose-400 shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{r.label}</span>
                  </div>
                  <span className="text-xs font-bold text-rose-300 tabular-nums shrink-0">
                    {r.count} · {inr(r.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <TrendingUp className="size-4 text-indigo-400" />
              Recent activity
            </h2>
            <a href="/bd/leads" className="flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-300 font-semibold">
              View all <ArrowUpRight className="size-3" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground">No recent activity available for the selected period.</p>
        </div>
      </div>

    </div>
  );
}
