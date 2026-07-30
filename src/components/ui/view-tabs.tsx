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
        "inline-flex items-center gap-0.5 rounded-xl border border-border/70 bg-muted/40 p-0.5",
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
              "inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium transition-all duration-150 active:scale-[0.97]",
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
