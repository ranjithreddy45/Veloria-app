import type React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The dashboard's section panel: a rounded-2xl card with a small uppercase
 * label, optionally an action on the right.
 *
 * Deliberately NOT the shared `Card`. Card carries `surface-glass` and is used
 * by ~300 screens including ones that wrap dense tables; this is the lighter,
 * flatter panel the dashboard uses for its own blocks, so adopting it on a
 * landing page cannot disturb anything already inside a Card.
 */
export function SectionPanel({
  label,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  /** Small uppercase label, e.g. "TODAY'S EVENTS". */
  label?: React.ReactNode;
  icon?: LucideIcon;
  /** Right-aligned control on the label row (a filter, a "view all" link). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col rounded-2xl border border-border bg-card p-5", className)}>
      {(label || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            {label && (
              <p className="truncate text-meta font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("min-w-0", bodyClassName)}>{children}</div>
    </div>
  );
}
