// ============================================================
// EmptyState — a friendly centered placeholder for empty / filtered / locked
// panels. Icon in a soft token-colored chip, a title, a muted line, and an
// optional action slot.
// ============================================================

import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Visual tone of the icon chip. */
  tone?: "neutral" | "success" | "warning";
  className?: string;
}

const CHIP_TONE = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && (
        <div className={cn("mb-3 flex size-11 items-center justify-center rounded-full", CHIP_TONE[tone])}>
          {icon}
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
