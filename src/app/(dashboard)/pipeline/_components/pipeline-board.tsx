"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { moveDeal } from "@/actions/pipeline.actions";
import { PipelineColumn } from "./pipeline-column";
import { DealCard } from "./deal-card";
import { ConvertDealDialog } from "./convert-deal-dialog";

// ============================================================
// Types
// ============================================================

export type DealContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
};

export type DealLead = {
  id: string;
  title: string;
  source: string;
  eventType: string | null;
  eventDate: string | null;
  guestCount: number | null;
  estimatedValue: unknown;
};

export type DealAssignee = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type DealStage = {
  id: string;
  name: string;
  color: string;
  isWonStage: boolean;
  isLostStage: boolean;
};

export type DealItem = {
  id: string;
  title: string;
  value: number;
  probability: number;
  expectedCloseDate: string | null;
  notes: string | null;
  wonDate: string | null;
  lostDate: string | null;
  lostReason: string | null;
  orderInStage: number;
  createdAt: string;
  updatedAt: string;
  stageId: string;
  leadId: string;
  assignedToId: string | null;
  lead: DealLead;
  assignedTo: DealAssignee | null;
  stage: DealStage;
  contact: DealContact | null;
  // AI scoring fields
  aiScore?: number | null;
  aiScoreReason?: string | null;
  aiFactors?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  aiScoredAt?: string | Date | null;
};

export type PipelineStageData = {
  id: string;
  name: string;
  order: number;
  color: string;
  isDefault: boolean;
  isWonStage: boolean;
  isLostStage: boolean;
  createdAt: string;
  updatedAt: string;
  deals: DealItem[];
};

interface PipelineBoardProps {
  initialStages: PipelineStageData[];
}

// ============================================================
// Component
// ============================================================

export function PipelineBoard({ initialStages }: PipelineBoardProps) {
  const [stages, setStages] = useState<PipelineStageData[]>(initialStages);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Deal-to-booking conversion dialog
  const [convertDeal, setConvertDeal] = useState<DealItem | null>(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  // Find the deal being dragged
  const activeDeal = useMemo(() => {
    if (!activeId) return null;
    for (const stage of stages) {
      const deal = stage.deals.find((d) => d.id === activeId);
      if (deal) return deal;
    }
    return null;
  }, [activeId, stages]);

  // Sensors with activation constraints to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // ========================================
  // Drag Handlers
  // ========================================

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Find which stage the deal belongs to
    const dealData = active.data.current;
    if (dealData?.stageId) {
      setActiveStageId(dealData.stageId);
    }
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeIdStr = active.id as string;
      const overIdStr = over.id as string;

      // Find the source stage
      let sourceStage: PipelineStageData | undefined;
      let sourceIndex = -1;
      for (const stage of stages) {
        const idx = stage.deals.findIndex((d) => d.id === activeIdStr);
        if (idx !== -1) {
          sourceStage = stage;
          sourceIndex = idx;
          break;
        }
      }

      if (!sourceStage || sourceIndex === -1) return;

      // Determine the target stage
      let targetStage: PipelineStageData | undefined;
      let targetIndex = -1;

      // Check if over is a stage (column)
      targetStage = stages.find((s) => s.id === overIdStr);
      if (targetStage) {
        // Dropping onto a column — put at end
        targetIndex = targetStage.deals.length;
      } else {
        // Dropping onto another deal — find which stage it belongs to
        for (const stage of stages) {
          const idx = stage.deals.findIndex((d) => d.id === overIdStr);
          if (idx !== -1) {
            targetStage = stage;
            targetIndex = idx;
            break;
          }
        }
      }

      if (!targetStage) return;
      if (sourceStage.id === targetStage.id) return; // Same stage, handled by DragEnd

      // Move the deal from source to target (optimistic)
      setStages((prev) => {
        const updated = prev.map((s) => ({ ...s, deals: [...s.deals] }));

        const srcStageIdx = updated.findIndex(
          (s) => s.id === sourceStage!.id
        );
        const tgtStageIdx = updated.findIndex(
          (s) => s.id === targetStage!.id
        );

        if (srcStageIdx === -1 || tgtStageIdx === -1) return prev;

        const [movedDeal] = updated[srcStageIdx].deals.splice(sourceIndex, 1);
        if (!movedDeal) return prev;

        const insertIdx = Math.min(
          targetIndex,
          updated[tgtStageIdx].deals.length
        );
        updated[tgtStageIdx].deals.splice(insertIdx, 0, {
          ...movedDeal,
          stageId: targetStage!.id,
          stage: {
            id: targetStage!.id,
            name: targetStage!.name,
            color: targetStage!.color,
            isWonStage: targetStage!.isWonStage,
            isLostStage: targetStage!.isLostStage,
          },
        });

        return updated;
      });
    },
    [stages]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);
      setActiveStageId(null);

      if (!over) return;

      const activeIdStr = active.id as string;
      const overIdStr = over.id as string;

      // Find current stage and index of the active deal
      let currentStage: PipelineStageData | undefined;
      let currentIndex = -1;
      for (const stage of stages) {
        const idx = stage.deals.findIndex((d) => d.id === activeIdStr);
        if (idx !== -1) {
          currentStage = stage;
          currentIndex = idx;
          break;
        }
      }

      if (!currentStage || currentIndex === -1) return;

      // Determine target position
      let targetStage: PipelineStageData | undefined;
      let targetIndex = -1;

      // Check if over is a column
      targetStage = stages.find((s) => s.id === overIdStr);
      if (targetStage) {
        targetIndex = targetStage.deals.findIndex(
          (d) => d.id === activeIdStr
        );
        if (targetIndex === -1) {
          targetIndex = targetStage.deals.length;
        }
      } else {
        // Over is a deal
        for (const stage of stages) {
          const idx = stage.deals.findIndex((d) => d.id === overIdStr);
          if (idx !== -1) {
            targetStage = stage;
            targetIndex = idx;
            break;
          }
        }
      }

      if (!targetStage) return;

      // If same stage, handle reorder
      if (currentStage.id === targetStage.id && activeIdStr !== overIdStr) {
        const overIndex = currentStage.deals.findIndex(
          (d) => d.id === overIdStr
        );
        if (overIndex !== -1 && overIndex !== currentIndex) {
          setStages((prev) =>
            prev.map((s) =>
              s.id === currentStage!.id
                ? { ...s, deals: arrayMove(s.deals, currentIndex, overIndex) }
                : s
            )
          );
          targetIndex = overIndex;
        }
      }

      // Persist the move to the server
      const result = await moveDeal(
        activeIdStr,
        targetStage.id,
        targetIndex
      );

      if (result.success) {
        if (result.data.isWonStage) {
          // Find the deal that was moved to show the conversion dialog
          const wonDeal = stages
            .flatMap((s) => s.deals)
            .find((d) => d.id === activeIdStr);
          if (wonDeal) {
            setConvertDeal(wonDeal);
            setShowConvertDialog(true);
          }
          toast.success("Deal Won! 🎉", {
            description: "Create a booking from this deal.",
            duration: 5000,
          });
        } else if (result.data.isLostStage) {
          toast.error("Deal Lost", {
            description: "The deal has been moved to the lost stage.",
          });
        }
      } else {
        toast.error("Failed to move deal", {
          description: result.error,
        });
        // Revert on failure
        setStages(initialStages);
      }
    },
    [stages, initialStages]
  );

  // ========================================
  // Deal Lifecycle Callbacks (passed to children)
  // ========================================

  const handleDealCreated = useCallback(() => {
    // We rely on revalidatePath in the server action
    // but also refresh local state
    window.location.reload();
  }, []);

  const handleDealUpdated = useCallback(() => {
    window.location.reload();
  }, []);

  const handleDealDeleted = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={scrollRef}
        className="flex h-full gap-4 overflow-x-auto pb-4"
        style={{ scrollbarGutter: "stable" }}
      >
        {stages.map((stage) => (
          <PipelineColumn
            key={stage.id}
            stage={stage}
            deals={stage.deals}
            isActive={activeStageId === stage.id}
            onDealCreated={handleDealCreated}
            onDealUpdated={handleDealUpdated}
            onDealDeleted={handleDealDeleted}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal ? (
          <div className="rotate-2 scale-105">
            <DealCard deal={activeDeal} isOverlay />
          </div>
        ) : null}
      </DragOverlay>

      {/* Deal-to-Booking Conversion Dialog */}
      <ConvertDealDialog
        deal={convertDeal}
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
      />
    </DndContext>
  );
}
