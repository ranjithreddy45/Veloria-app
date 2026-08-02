"use client";

import React, { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DealCard } from "./deal-card";
import { AddDealDialog } from "./add-deal-dialog";
import type { PipelineStageData, DealItem } from "./pipeline-board";

// ============================================================
// Indian Currency Formatting
// ============================================================

function formatIndianCurrency(value: number): string {
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(1)}Cr`;
  }
  if (value >= 100000) {
    return `${(value / 100000).toFixed(1)}L`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================
// Props
// ============================================================

interface PipelineColumnProps {
  stage: PipelineStageData;
  deals: DealItem[];
  isActive?: boolean;
  onDealCreated: () => void;
  onDealUpdated: () => void;
  onDealDeleted: () => void;
}

// ============================================================
// Component
// ============================================================

export function PipelineColumn({
  stage,
  deals,
  isActive,
  onDealCreated,
  onDealUpdated,
  onDealDeleted,
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      type: "stage",
      stageId: stage.id,
    },
  });

  const dealIds = useMemo(() => deals.map((d) => d.id), [deals]);

  const totalValue = useMemo(
    () => deals.reduce((sum, d) => sum + Number(d.value), 0),
    [deals]
  );

  // Probability-weighted forecast for this stage (open stages only).
  const weightedValue = useMemo(
    () =>
      stage.isWonStage || stage.isLostStage
        ? 0
        : deals.reduce((sum, d) => sum + Number(d.value) * ((d.probability ?? 0) / 100), 0),
    [deals, stage.isWonStage, stage.isLostStage]
  );

  const [addDialogOpen, setAddDialogOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "flex h-full w-[300px] min-w-[300px] flex-col rounded-lg border border-border bg-muted/40 transition-colors",
        isOver && "bg-primary/[0.04] border-primary/40",
        isActive && "border-primary/20"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/60 px-3 py-2.5 rounded-t-lg">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ backgroundColor: stage.color }}
            aria-hidden
          />
          <h3 className="truncate text-detail font-semibold uppercase tracking-[0.04em] text-foreground">
            {stage.name}
          </h3>
          <Badge
            variant="outline"
            className="h-4.5 min-w-[18px] justify-center rounded px-1 text-meta font-medium tabular-nums text-muted-foreground border-border bg-background"
          >
            {deals.length}
          </Badge>
        </div>
        {totalValue > 0 && (
          <span className="flex flex-col items-end leading-tight">
            <span className="text-meta font-semibold tabular-nums text-foreground/80">
              ₹{formatIndianCurrency(totalValue)}
            </span>
            {weightedValue > 0 && (
              <span className="text-meta tabular-nums text-indigo-500" title="Probability-weighted forecast">
                ~₹{formatIndianCurrency(Math.round(weightedValue))}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Deal Cards Container */}
      <div
        ref={setNodeRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-2"
      >
        <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onDealUpdated={onDealUpdated}
              onDealDeleted={onDealDeleted}
            />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border py-8">
            <p className="text-meta text-muted-foreground/70">Drop deals here</p>
          </div>
        )}
      </div>

      {/* Add Deal Button */}
      {!stage.isWonStage && !stage.isLostStage && (
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start gap-1.5 text-detail text-muted-foreground hover:text-foreground"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="size-3.5" />
            New deal
          </Button>
        </div>
      )}

      <AddDealDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        stageId={stage.id}
        stageName={stage.name}
        onDealCreated={onDealCreated}
      />
    </div>
  );
}
