"use client";

import { useRouter } from "next/navigation";
import {
  ACQ_DEAL_STAGE,
  ACQ_DEAL_STAGE_LABEL,
  ACQ_DEAL_MODEL_LABEL,
  type AcqDealModel,
  type AcqDealStage,
} from "@/lib/acq/constants";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";

export interface AcqDealCard {
  id: string;
  name: string;
  stage: AcqDealStage;
  propertyName: string;
  locality: string;
  city?: string | null;
  model: string | null;
  evalScore: number | string | null;
  ownerName: string;
  projectedFeeValue?: number | string | null;
  updatedAt?: string | null;
  seatingTheatre?: number | null;
  seatingFloating?: number | null;
  banquetSizeSft?: number | null;
  bdExecutive?: { id: string; name: string | null } | null;
}

// Stage → hue mapping for the pills (Linear-style semantic colors).
const STAGE_HUE: Record<AcqDealStage, Parameters<typeof StatusPill>[0]["hue"]> = {
  QUALIFIED: "cyan",
  EVALUATION: "blue",
  EVALUATION_COMPLETED: "indigo",
  PROPOSAL_SENT: "violet",
  NEGOTIATION: "amber",
  CONTRACT_SENT: "orange",
  SIGNED: "teal",
  WON: "emerald",
  LOST: "red",
  ON_HOLD: "slate",
};

// Column chrome per stage — dot + soft column wash (kept in step with
// STAGE_HUE so the same stage reads the same colour everywhere).
const STAGE_STYLE: Record<AcqDealStage, { dot: string; wash: string }> = {
  QUALIFIED: { dot: "bg-cyan-500", wash: "bg-cyan-50/50 dark:bg-cyan-950/20" },
  EVALUATION: { dot: "bg-blue-500", wash: "bg-blue-50/50 dark:bg-blue-950/20" },
  EVALUATION_COMPLETED: { dot: "bg-indigo-500", wash: "bg-indigo-50/50 dark:bg-indigo-950/20" },
  PROPOSAL_SENT: { dot: "bg-violet-500", wash: "bg-violet-50/50 dark:bg-violet-950/20" },
  NEGOTIATION: { dot: "bg-amber-500", wash: "bg-amber-50/50 dark:bg-amber-950/20" },
  CONTRACT_SENT: { dot: "bg-orange-500", wash: "bg-orange-50/50 dark:bg-orange-950/20" },
  SIGNED: { dot: "bg-teal-500", wash: "bg-teal-50/50 dark:bg-teal-950/20" },
  WON: { dot: "bg-emerald-500", wash: "bg-emerald-50/50 dark:bg-emerald-950/20" },
  LOST: { dot: "bg-red-500", wash: "bg-red-50/50 dark:bg-red-950/20" },
  ON_HOLD: { dot: "bg-slate-400", wash: "bg-slate-50/60 dark:bg-slate-900/30" },
};

// Columns: every stage except LOST (WON and ON_HOLD are shown).
const BOARD_STAGES = ACQ_DEAL_STAGE.filter(
  (s): s is AcqDealStage => s !== "LOST"
);

export function DealBoard({ deals }: { deals: AcqDealCard[] }) {
  const router = useRouter();

  const byStage = new Map<AcqDealStage, AcqDealCard[]>();
  for (const stage of BOARD_STAGES) byStage.set(stage, []);
  for (const deal of deals) {
    const bucket = byStage.get(deal.stage);
    if (bucket) bucket.push(deal);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {BOARD_STAGES.map((stage) => {
        const items = byStage.get(stage) ?? [];
        const style = STAGE_STYLE[stage];
        return (
          <div
            key={stage}
            className={cn(
              "flex w-[280px] shrink-0 flex-col rounded-xl border border-border/60",
              style.wash
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-detail font-semibold tracking-[-0.01em] text-foreground">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", style.dot)} />
                {ACQ_DEAL_STAGE_LABEL[stage]}
              </span>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background/80 px-1.5 text-meta font-semibold tabular-nums text-muted-foreground ring-1 ring-border/60">
                {items.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 p-2.5">
              {items.length === 0 && (
                <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border/70 px-1 py-6 text-center">
                  <span aria-hidden className={cn("size-2 rounded-full opacity-50", style.dot)} />
                  <p className="text-meta text-muted-foreground/70">No deals</p>
                </div>
              )}
              {items.map((deal) => {
                const score =
                  deal.evalScore == null || deal.evalScore === ""
                    ? null
                    : Number(deal.evalScore);
                const owner = deal.ownerName ?? "—";
                const bdExec = deal.bdExecutive?.name ?? "Unassigned";
                return (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => router.push(`/bd/deals/${deal.id}`)}
                    className={cn(
                      "group flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 text-left shadow-xs",
                      "transition-all hover:-translate-y-px hover:border-border hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-body font-medium leading-tight tracking-[-0.01em] text-foreground">
                        {deal.propertyName}
                      </span>
                      <StatusPill
                        label={ACQ_DEAL_STAGE_LABEL[stage]}
                        hue={STAGE_HUE[stage]}
                        size="xs"
                      />
                    </div>

                    <div className="text-meta text-muted-foreground">
                      {deal.locality}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                        {/* Label map, so REVENUE_MARGIN reads "Revenue Margin". */}
                        {(deal.model &&
                          ACQ_DEAL_MODEL_LABEL[deal.model as AcqDealModel]) ??
                          deal.model ??
                          "—"}
                      </span>
                      {score != null && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                          Score {score}
                        </span>
                      )}
                      {(deal.seatingTheatre || deal.seatingFloating) && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                          {Math.max(deal.seatingTheatre ?? 0, deal.seatingFloating ?? 0)} seats
                        </span>
                      )}
                      {deal.banquetSizeSft ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                          {deal.banquetSizeSft.toLocaleString("en-IN")} sqft
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between text-meta text-muted-foreground/80">
                      <span className="truncate">Owner: {owner}</span>
                      <span className="shrink-0 pl-2 text-muted-foreground/60">{bdExec}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
