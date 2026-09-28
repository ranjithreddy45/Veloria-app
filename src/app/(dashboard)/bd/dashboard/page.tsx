import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 as BarChart3Icon } from "lucide-react";
import { getBdAnalytics, getBdExecutives } from "@/actions/acq-analytics.actions";
import { BdFilterBar } from "../_components/bd-filter-bar";
import { BdDashboardClient } from "./_components/bd-dashboard-client";
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
  employees: {
    userId: string; name: string;
    leadsCold: number; leadsCampaign: number; leadsTotal: number;
    dealsCreated: number; dealsQualified: number; dealsWon: number; dealsLost: number;
    callsMade: number; notesFollowups: number; siteVisitsDone: number; taskScore: number;
  }[];
  leaderboard: { userId: string; name: string; taskScore: number }[];
  leadSources: { source: string; label: string; count: number }[];
  funnel: { key: string; label: string; count: number }[];
  lossReasons: { reason: string; label: string; count: number; value: number }[];
  conversion: { leadToQualified: number; qualifiedToWon: number; winRate: number };
  pipelineTrend: { date: string; leads: number; dealsCreated: number; qualified: number; won: number; lost: number }[];
}

export default async function BdDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; emp?: string }>;
}) {
  const sp = await searchParams;
  const employeeIds = sp.emp ? sp.emp.split(",").filter(Boolean) : null;
  const params = {
    rangeKey: (sp.range as never) ?? "month",
    from: sp.from ?? null,
    to: sp.to ?? null,
    employeeIds,
  };

  const [execRes, aRes] = await Promise.all([getBdExecutives(), getBdAnalytics(params)]);
  const execs = execRes.success ? execRes.data : [];
  const a = (aRes.success ? aRes.data : null) as Analytics | null;

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-border">
        <div>
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground mb-0.5">
            Business Development · Acquisition
          </p>
          <h1 className="text-[1.75rem] font-black text-foreground tracking-tight leading-tight">
            BD Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Employee-wise acquisition funnel, activity and leaderboard.
          </p>
        </div>
        <Link
          href="/bd/reports"
          className="flex items-center gap-2 shrink-0 mt-1 rounded-xl border border-border bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-border hover:border-white/20 transition-all"
        >
          <BarChart3Icon className="size-4" />
          Full reports
        </Link>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-border">
        <BdFilterBar employees={execs} />
        {a && (
          <span className="text-xs text-muted-foreground">
            Showing:{" "}
            <span className="font-bold text-foreground">{a.range.label}</span>
          </span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      {!a ? (
        <div className="flex flex-1 items-center justify-center py-20 text-muted-foreground text-sm">
          Couldn&apos;t load analytics. Try refreshing.
        </div>
      ) : (
        <BdDashboardClient data={a} />
      )}
    </div>
  );
}
