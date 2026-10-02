import type { Metadata } from "next";
import { getBdAnalytics, getBdExecutives } from "@/actions/acq-analytics.actions";
import { BdFilterBar } from "../_components/bd-filter-bar";
import { BdDashboardClient } from "./_components/bd-dashboard-client";
import { BdDashboardHeader } from "./_components/bd-dashboard-header";
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
      <BdDashboardHeader />

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
