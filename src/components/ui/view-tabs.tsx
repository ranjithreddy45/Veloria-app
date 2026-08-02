"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// ViewTabs — ClickUp-style segmented view switcher (List / Board / Calendar).
// A small pill-group; the active view gets the violet pill. Controlled.
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
        "flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl border border-border/70 bg-muted/40 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-detail font-medium transition-all duration-150 active:scale-[0.97]",
              active
                ? "bg-primary/[0.12] text-primary shadow-[inset_0_0_0_1px_oklch(0.45_0.11_162/0.18)] dark:bg-primary/20"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            )}
          >
            {Icon && <Icon className="size-3.5" strokeWidth={active ? 2.4 : 2} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
