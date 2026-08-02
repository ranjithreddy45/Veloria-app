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
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {icon && (
        <div className={cn("mb-4 flex size-14 items-center justify-center rounded-2xl [&>svg]:size-6", CHIP_TONE[tone])}>
          {icon}
        </div>
      )}
      <p className="text-copy font-semibold tracking-[-0.01em]">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-body leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
