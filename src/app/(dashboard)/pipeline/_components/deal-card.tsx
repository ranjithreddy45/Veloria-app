"use client";

import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Calendar,
  User,
  IndianRupee,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { DealDetailSheet } from "./deal-detail-sheet";
import type { DealItem } from "./pipeline-board";

// ============================================================
// Indian Currency Formatting
// ============================================================

function formatIndianCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
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

  const assigneeInitials = deal.assignedTo?.name
    ? deal.assignedTo.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group cursor-pointer rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md",
          isDragging && "opacity-40 shadow-lg",
          isOverlay && "shadow-xl ring-2 ring-indigo-300"
        )}
      >
        {/* Left colored border accent */}
        <div className="flex">
          <div
            className="w-1 shrink-0 rounded-l-lg"
            style={{ backgroundColor: deal.stage.color }}
          />

          <div className="flex flex-1 flex-col p-3">
            {/* Top row: drag handle + title */}
            <div className="flex items-start gap-1">
              <button
                className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-zinc-300 opacity-0 transition-opacity hover:text-zinc-500 group-hover:opacity-100 active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="size-3.5" />
              </button>
              <div
                className="flex-1 min-w-0"
                onClick={() => setSheetOpen(true)}
              >
                <h4 className="text-sm font-medium leading-tight text-zinc-800 line-clamp-2">
                  {deal.title}
                </h4>
              </div>
            </div>

            {/* Contact name */}
            <div
              className="mt-1.5 flex items-center gap-1.5"
              onClick={() => setSheetOpen(true)}
            >
              <User className="size-3 text-zinc-400" />
              <span className="text-xs text-zinc-500 truncate">
                {contactName}
              </span>
            </div>

            {/* Value + Probability row */}
            <div
              className="mt-2 flex items-center justify-between"
              onClick={() => setSheetOpen(true)}
            >
              <div className="flex items-center gap-1">
                <IndianRupee className="size-3 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-700">
                  {formatIndianCurrency(Number(deal.value))}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="size-3 text-zinc-400" />
                <span className="text-xs text-zinc-500">
                  {deal.probability}%
                </span>
              </div>
            </div>

            {/* Bottom row: close date + assignee */}
            <div
              className="mt-2 flex items-center justify-between"
              onClick={() => setSheetOpen(true)}
            >
              {deal.expectedCloseDate ? (
                <div className="flex items-center gap-1">
                  <Calendar className="size-3 text-zinc-400" />
                  <span className="text-[11px] text-zinc-400">
                    {formatDate(deal.expectedCloseDate)}
                  </span>
                </div>
              ) : (
                <div />
              )}

              {deal.assignedTo && (
                <Avatar className="size-5">
                  <AvatarImage src={deal.assignedTo.image ?? undefined} />
                  <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700">
                    {assigneeInitials}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
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
