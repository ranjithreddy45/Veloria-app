"use client";

import { useRouter } from "next/navigation";
import {
  ACQ_DEAL_STAGE,
  ACQ_DEAL_STAGE_LABEL,
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
  model: string | null;
  evalScore: number | string | null;
  ownerName: string;
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
        return (
          <div
            key={stage}
            className="flex w-[280px] shrink-0 flex-col rounded-lg border border-border/60 bg-muted/30"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
              <span className="text-[12.5px] font-medium tracking-[-0.01em] text-foreground">
                {ACQ_DEAL_STAGE_LABEL[stage]}
              </span>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                {items.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 p-2">
              {items.length === 0 && (
                <p className="px-1 py-4 text-center text-[11.5px] text-muted-foreground/70">
                  No deals
                </p>
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
                      "group flex flex-col gap-2 rounded-md border border-border/60 bg-background p-3 text-left",
                      "transition-colors hover:border-border hover:bg-accent/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-medium leading-tight tracking-[-0.01em] text-foreground">
                        {deal.propertyName}
                      </span>
                      <StatusPill
                        label={ACQ_DEAL_STAGE_LABEL[stage]}
                        hue={STAGE_HUE[stage]}
                        size="xs"
                      />
                    </div>

                    <div className="text-[11.5px] text-muted-foreground">
                      {deal.locality}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                        {deal.model ?? "—"}
                      </span>
                      {score != null && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                          Score {score}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground/80">
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
