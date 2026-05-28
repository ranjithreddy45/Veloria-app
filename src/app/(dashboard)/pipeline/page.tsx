import type { Metadata } from "next";
import { getPipelineStages, getPipelineStats } from "@/actions/pipeline.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PipelineBoard } from "./_components/pipeline-board";

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
  // Sum the value of all "won" stages from the per-stage breakdown.
  const wonValue =
    stats?.stageStats
      ?.filter((s) => s.isWonStage)
      .reduce((sum, s) => sum + s.totalValue, 0) ?? 0;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-5">
      <PageHeader
        title="Pipeline"
        eyebrow={
          <div className="flex items-center gap-3">
            <span>Sales · Kanban</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{totalDeals}</span> deals
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{formatIndianCurrency(totalValue)}</span> open
            </span>
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
      />

      <div className="flex-1 overflow-hidden">
        <PipelineBoard initialStages={stages} />
      </div>
    </div>
  );
}
