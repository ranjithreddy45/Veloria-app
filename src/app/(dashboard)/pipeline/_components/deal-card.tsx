"use client";

import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Calendar,
} from "lucide-react";
import { DotAvatar } from "@/components/shared/dot-avatar";
import { cn } from "@/lib/utils";
import { DealDetailSheet } from "./deal-detail-sheet";
import type { DealItem } from "./pipeline-board";

// ============================================================
// Indian Currency Formatting
// ============================================================

function formatIndianCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)} K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

function probabilityColor(pct: number): string {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

// ============================================================
// Props
// ============================================================

interface DealCardProps {
  deal: DealItem;
  isOverlay?: boolean;
  onDealUpdated?: () => void;
  onDealDeleted?: () => void;
}

// ============================================================
// Component
// ============================================================

export function DealCard({
  deal,
  isOverlay = false,
  onDealUpdated,
  onDealDeleted,
}: DealCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    data: {
      type: "deal",
      stageId: deal.stageId,
      deal,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const contactName = deal.contact
    ? `${deal.contact.firstName} ${deal.contact.lastName}`
    : "No contact";

  const prob = deal.probability ?? 0;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group cursor-pointer rounded-md border border-border bg-card transition-all duration-150",
          "hover:border-primary/40 hover:bg-card",
          isDragging && "opacity-40",
          isOverlay && "shadow-lg ring-1 ring-primary/40"
        )}
        onClick={() => setSheetOpen(true)}
      >
        <div className="flex flex-col gap-2 p-2.5">
          {/* Title row with drag handle */}
          <div className="flex items-start gap-1.5">
            <button
              className="-ml-1 mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/30 opacity-100 transition-opacity hover:text-muted-foreground [@media(hover:hover)]:opacity-0 group-hover:opacity-100 active:cursor-grabbing"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="size-3" />
            </button>
            <h4 className="flex-1 text-[12.5px] font-medium leading-tight text-foreground line-clamp-2">
              {deal.title}
            </h4>
          </div>

          {/* Contact + assignee row */}
          <div className="flex items-center gap-1.5">
            {deal.contact && (
              <DotAvatar
                seed={deal.contact.id}
                name={contactName}
                size="xs"
              />
            )}
            <span className="flex-1 truncate text-[11.5px] text-muted-foreground">
              {contactName}
              {deal.lead?.eventType ? <span className="text-muted-foreground/60"> · {deal.lead.eventType}</span> : null}
            </span>
          </div>

          {/* Value (large) */}
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold tracking-tight tabular-nums text-foreground">
              {formatIndianCurrency(Number(deal.value))}
            </span>
            {deal.expectedCloseDate && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                <Calendar className="size-3" />
                {formatDate(deal.expectedCloseDate)}
              </span>
            )}
          </div>

          {/* Probability bar + assignee */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground/70 font-medium">
                  Probability
                </span>
                <span className="text-[10.5px] font-medium tabular-nums text-foreground/80">
                  {prob}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", probabilityColor(prob))}
                  style={{ width: `${prob}%` }}
                />
              </div>
            </div>
            {deal.assignedTo && (
              <DotAvatar
                seed={deal.assignedTo.id}
                name={deal.assignedTo.name}
                size="xs"
                className="ml-1"
              />
            )}
          </div>
        </div>
      </div>

      {!isOverlay && (
        <DealDetailSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          deal={deal}
          onDealUpdated={onDealUpdated}
          onDealDeleted={onDealDeleted}
        />
      )}
    </>
  );
}
