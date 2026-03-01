"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================================
// Approval Status Color Map
// ============================================================

const APPROVAL_STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  DELEGATED: "bg-blue-100 text-blue-800 border-blue-200",
  CANCELLED: "bg-muted text-foreground border-border",
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DELEGATED: "Delegated",
  CANCELLED: "Cancelled",
};

// ============================================================
// ApprovalStatusBadge Props
// ============================================================

interface ApprovalStatusBadgeProps {
  status: string;
  className?: string;
}

// ============================================================
// ApprovalStatusBadge Component
// ============================================================

export function ApprovalStatusBadge({
  status,
  className,
}: ApprovalStatusBadgeProps) {
  const colorClasses =
    APPROVAL_STATUS_COLORS[status] ?? "bg-muted text-foreground border-border";

  const label = APPROVAL_STATUS_LABELS[status] ?? status.replace(/_/g, " ");

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border font-medium", colorClasses, className)}
    >
      <span
        className="inline-block size-1.5 rounded-full bg-current opacity-70"
        aria-hidden
      />
      {label}
    </Badge>
  );
}
