"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// ViewTabs — segmented view switcher (List / Board / Calendar, My / All /
// Unassigned). A sunken well; the active view is a white sheet lifted out of
// it, its icon in plum. Controlled.
// ============================================================

export interface ViewTabOption<V extends string = string> {
  value: V;
  label: string;
  icon?: LucideIcon;
}

interface ViewTabsProps<V extends string> {
  value: V;
  onValueChange: (value: V) => void;
  options: ViewTabOption<V>[];
  className?: string;
}

export function ViewTabs<V extends string>({
  value,
  onValueChange,
  options,
  className,
}: ViewTabsProps<V>) {
  return (
    <div
      role="tablist"
      aria-label="View"
      className={cn(
        // Four or five segments run to ~450px, which is wider than a 375px
        // phone — as a plain `inline-flex` that overflowed the body and made
        // the whole page scroll sideways. On mobile the group becomes its own
        // horizontal scroller (scrollbar hidden, it's a 2-3 item nudge, not a
        // list); from `sm` up it goes back to the shrink-wrapped pill group.
        "flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-[11px] border border-border bg-muted p-[3px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:inline-flex sm:max-w-none sm:overflow-visible",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              // shrink-0 + nowrap: inside the mobile scroller a flex child
              // would otherwise squash and wrap its label to two lines.
              "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-3 text-body font-medium transition-[background-color,color,box-shadow,scale] duration-150 active:scale-[0.97]",
              active
                ? "bg-card text-foreground shadow-[var(--shadow-1),inset_0_0_0_1px_var(--border)] dark:bg-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className={cn("size-3.5", active && "text-primary")} strokeWidth={2} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
