import type { Metadata } from "next";
import { Gauge, TrendingUp, TrendingDown } from "lucide-react";

import { getQualityScorecard } from "@/actions/quality.actions";
import type { CtqResult } from "@/actions/quality.actions";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { QualityDetail } from "./_components/quality-detail";

export const metadata: Metadata = { title: "Quality & Six Sigma" };

// ============================================================
// Quality & Six Sigma — a read-only scorecard that scores live operational
// metrics (lead SLA, payment punctuality, task on-time, support SLA, handover
// snags, CX rating) on the Six Sigma scale (DPMO → sigma). Additive, admin-gated
// in the action layer. Visual style follows the app's Apple/violet language.
// ============================================================

// Map a sigma value (0–6) to a qualitative grade + accent.
function sigmaGrade(sigma: number): { label: string; tone: string; bar: string } {
  if (sigma >= 6) return { label: "World-class", tone: "text-emerald-600 dark:text-emerald-300", bar: "bg-emerald-500" };
  if (sigma >= 5) return { label: "Excellent", tone: "text-emerald-600 dark:text-emerald-300", bar: "bg-emerald-500" };
  if (sigma >= 4) return { label: "Good", tone: "text-violet-600 dark:text-violet-300", bar: "bg-violet-500" };
  if (sigma >= 3) return { label: "Industry average", tone: "text-amber-600 dark:text-amber-300", bar: "bg-amber-500" };
  if (sigma >= 2) return { label: "Below average", tone: "text-amber-600 dark:text-amber-300", bar: "bg-amber-500" };
  return { label: "Needs attention", tone: "text-rose-600 dark:text-rose-300", bar: "bg-rose-500" };
}

function CtqCard({ ctq }: { ctq: CtqResult }) {
  const grade = sigmaGrade(ctq.sigma);
  const trendUp = ctq.trendSigma > 0;
  const trendFlat = ctq.trendSigma === 0;
  // Position the sigma on a 0–6 track for the progress bar.
  const pct = Math.max(0, Math.min(100, (ctq.sigma / 6) * 100));

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-card transition-premium hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground">
            {ctq.label}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {ctq.domain}
          </p>
        </div>
        {!trendFlat && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              trendUp
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
            )}
          >
            {trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trendUp ? "+" : ""}
            {ctq.trendSigma.toFixed(2)}σ
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-[34px] font-bold tabular-nums leading-none tracking-[-0.03em] text-foreground">
          {ctq.sigma.toFixed(2)}
        </span>
        <span className="pb-1 text-[15px] font-semibold text-muted-foreground">σ</span>
      </div>
      <p className={cn("mt-1.5 text-[12px] font-medium", grade.tone)}>{grade.label}</p>

      <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", grade.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
        <div>
          <p className="text-[11px] text-muted-foreground">Defect rate</p>
          <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
            {ctq.defectRatePct.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Units measured</p>
          <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
            {ctq.units.toLocaleString("en-IN")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function QualityPage() {
  let scorecard: Awaited<ReturnType<typeof getQualityScorecard>> = {
    period: "",
    overallSigma: 0,
    ctqs: [],
  };

  try {
    scorecard = await getQualityScorecard();
  } catch {
    // Safe empty default — action layer also guards, this is belt-and-braces.
  }

  const ctqs = scorecard.ctqs ?? [];
  const overall = scorecard.overallSigma ?? 0;
  const overallGrade = sigmaGrade(overall);
  const overallPct = Math.max(0, Math.min(100, (overall / 6) * 100));

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        title="Quality & Six Sigma"
        eyebrow={scorecard.period || "Live operations"}
        description="DPMO and process sigma scored from live operations data — lead response, payment punctuality, task delivery, support and customer experience. Higher sigma means fewer defects per million opportunities."
      />

      {/* Overall sigma hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-violet-500/10 via-card to-card p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
              <Gauge className="size-6" />
            </span>
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Overall process sigma
              </p>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-[44px] font-bold tabular-nums leading-none tracking-[-0.03em] text-foreground">
                  {overall.toFixed(2)}
                </span>
                <span className="pb-1.5 text-[18px] font-semibold text-muted-foreground">σ</span>
              </div>
              <p className={cn("mt-1 text-[13px] font-medium", overallGrade.tone)}>
                {overallGrade.label}
              </p>
            </div>
          </div>

          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>0σ</span>
              <span>6σ</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", overallGrade.bar)}
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              {ctqs.length} critical-to-quality metric{ctqs.length === 1 ? "" : "s"} measured this period.
            </p>
          </div>
        </div>
      </div>

      {/* CTQ grid */}
      {ctqs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ctqs.map((ctq) => (
            <CtqCard key={ctq.id} ctq={ctq} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-10 text-center">
          <p className="text-[14px] font-medium text-foreground">No quality data yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Sigma scores appear once operational activity is recorded.
          </p>
        </div>
      )}

      {/* Interactive detail (Pareto + control chart) */}
      {ctqs.length > 0 && <QualityDetail ctqs={ctqs} />}
    </div>
  );
}
