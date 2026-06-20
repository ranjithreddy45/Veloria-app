import type { Metadata } from "next";
import { getPipelineStages, getPipelineStats } from "@/actions/pipeline.actions";
import { PageHeader } from "@/components/layout/page-header";
import { HelpHint } from "@/components/layout/help-hint";
import { PipelineBoard } from "./_components/pipeline-board";
import { ScoreAllDealsButton } from "./_components/score-all-deals-button";
import { SyncLeadsButton } from "./_components/sync-leads-button";

export const metadata: Metadata = { title: "Sales Pipeline" };

// Indian number formatting utility
function formatIndianCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)} K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export default async function PipelinePage() {
  const [stagesResult, statsResult] = await Promise.all([
    getPipelineStages(),
    getPipelineStats(),
  ]);

  const stages = stagesResult.success ? stagesResult.data : [];
  const stats = statsResult.success ? statsResult.data : null;

  const totalValue = stats?.totalValue ?? 0;
  const totalDeals = stats?.totalDeals ?? 0;
  const weightedForecast = stats?.weightedForecast ?? 0;
  // Sum the value of all "won" stages from the per-stage breakdown.
  const wonValue =
    stats?.stageStats
      ?.filter((s) => s.isWonStage)
      .reduce((sum, s) => sum + s.totalValue, 0) ?? 0;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-5">
      <PageHeader
        aura
        title="Pipeline"
        help={
          <HelpHint title="What is a Deal?">
            <p>
              A <strong>Deal</strong> is a qualified opportunity you&rsquo;re
              actively working to close — a Lead that got serious. Each deal sits
              in one <em>stage</em> of this Kanban (New Inquiry → … → Event
              Executed).
            </p>
            <p>
              Drag a deal between columns to update its stage; its value and win
              probability update automatically. A won deal becomes a confirmed{" "}
              <strong>Booking</strong>.
            </p>
            <p className="text-foreground/70">
              Flow: Contact → Lead (enquiry) → <strong>Deal</strong> (pipeline) →
              Booking (confirmed event).
            </p>
          </HelpHint>
        }
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Sales · Kanban</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{totalDeals}</span> deals
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{formatIndianCurrency(totalValue)}</span> open
            </span>
            {weightedForecast > 0 && (
              <>
                <span className="h-3 w-px bg-border" />
                <span className="text-indigo-600 dark:text-indigo-400">
                  <span className="font-semibold tabular-nums">{formatIndianCurrency(weightedForecast)}</span> forecast
                </span>
              </>
            )}
            {wonValue > 0 && (
              <>
                <span className="h-3 w-px bg-border" />
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="font-semibold tabular-nums">{formatIndianCurrency(wonValue)}</span> won
                </span>
              </>
            )}
          </div>
        }
        description="Drag deals through stages — values and probability auto-update."
      >
        <SyncLeadsButton />
        <ScoreAllDealsButton />
      </PageHeader>

      <div className="flex-1 overflow-hidden">
        <PipelineBoard initialStages={stages} />
      </div>
    </div>
  );
}
