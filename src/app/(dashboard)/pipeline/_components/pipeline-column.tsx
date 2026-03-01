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

  const [addDialogOpen, setAddDialogOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "flex h-full w-[300px] min-w-[300px] flex-col rounded-xl bg-zinc-100/80 transition-colors",
        isOver && "bg-indigo-50/80 ring-2 ring-indigo-200",
        isActive && "ring-1 ring-indigo-100"
      )}
    >
      {/* Colored top bar */}
      <div
        className="h-1 rounded-t-xl"
        style={{ backgroundColor: stage.color }}
      />

      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-800">{stage.name}</h3>
          <Badge
            variant="secondary"
            className="h-5 min-w-[20px] justify-center px-1.5 text-[10px] font-semibold"
          >
            {deals.length}
          </Badge>
        </div>
        <span className="text-xs font-medium text-zinc-500">
          {totalValue > 0 && `₹${formatIndianCurrency(totalValue)}`}
        </span>
      </div>

      {/* Deal Cards Container */}
      <div
        ref={setNodeRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
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
          <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 py-8">
            <p className="text-xs text-zinc-400">Drop deals here</p>
          </div>
        )}
      </div>

      {/* Add Deal Button */}
      {!stage.isWonStage && !stage.isLostStage && (
        <div className="p-2 pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-zinc-500 hover:text-indigo-600"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="size-4" />
            Add deal
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
