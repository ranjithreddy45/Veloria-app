"use client";

// ============================================================
// WorkflowStepper (Spec A) — a single animated 9-node stepper.
//  - One horizontal track; a 2px connector filled up to & incl. the current
//    node with the brand color, the rest muted.
//  - Complete = filled brand + white check; current = filled brand, larger,
//    soft ring/glow; upcoming = outlined circle + muted number.
//  - Labels in a second grid row, centered, two-line wrap with a fixed min-height.
//  - ≥1024px: even CSS-grid track. 640–1024px: horizontal scroll + scroll-snap,
//    current node auto-scrolled into view. <640px: compact bar + a Sheet that
//    expands the full (vertical) stepper.
//  - Motion (connector fill, check-pop, staggered entrance) is gated globally
//    by prefers-reduced-motion.
//  - a11y: <ol> with aria-current="step" + descriptive aria-labels per node.
// ============================================================

import * as React from "react";
import { Check, ChevronRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export type StepStatus = "complete" | "current" | "upcoming";
export interface Step { key: string; label: string; status: StepStatus }

function Node({ step, index, isLast }: { step: Step; index: number; isLast: boolean }) {
  const { status } = step;
  const base = "flex items-center justify-center rounded-full font-semibold tabular-nums transition-premium";
  if (status === "complete") {
    return (
      <span className={cn(base, "size-[22px] bg-primary text-primary-foreground")} aria-hidden>
        <Check className="size-3.5 animate-check-pop" strokeWidth={3} />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className={cn(base, "size-7 bg-primary text-primary-foreground text-xs ring-4 ring-primary/15")} aria-hidden>
        {index + 1}
      </span>
    );
  }
  return (
    <span className={cn(base, "size-[22px] border border-border bg-card text-meta text-muted-foreground")} aria-hidden>
      {index + 1}
    </span>
  );
}

export function WorkflowStepper({
  stages,
  currentIndex,
  gateMessage,
  className,
}: {
  stages: Step[];
  currentIndex: number;
  onReopen?: (targetStageKey: string) => void;
  gateMessage?: string;
  className?: string;
}) {
  const n = stages.length;
  const fillPct = n > 1 ? (Math.max(0, currentIndex) / (n - 1)) * 100 : 0;
  const inset = `calc((100% / ${n}) / 2)`;
  const current = stages[currentIndex] ?? stages[stages.length - 1];

  const scrollRef = React.useRef<HTMLOListElement>(null);
  const currentRef = React.useRef<HTMLLIElement>(null);
  React.useEffect(() => {
    // Auto-center the current node when the track is horizontally scrollable.
    currentRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [currentIndex]);

  function ariaLabel(s: Step, i: number) {
    return `Stage ${i + 1} of ${n}, ${s.label}, ${s.status}`;
  }

  return (
    <Card className={cn("border-0 shadow-card", className)}>
      {/* ≥640px: full horizontal track (scrolls between 640–1024). */}
      <div className="hidden px-4 py-4 sm:block">
        <ol
          ref={scrollRef}
          className="relative grid snap-x-track overflow-x-auto pb-1"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(84px, 1fr))` }}
        >
          {/* Connector track (behind nodes) */}
          <div aria-hidden className="pointer-events-none absolute top-[14px] h-0.5" style={{ left: inset, right: inset }}>
            <div className="h-full w-full rounded-full bg-muted" />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${fillPct}%` }}
            />
          </div>

          {stages.map((s, i) => (
            <li
              key={s.key}
              ref={i === currentIndex ? currentRef : undefined}
              aria-current={s.status === "current" ? "step" : undefined}
              aria-label={ariaLabel(s, i)}
              className="relative z-[1] flex snap-node flex-col items-center gap-2"
            >
              <span
                className="animate-node-in flex h-7 items-center"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <Node step={s} index={i} isLast={i === n - 1} />
              </span>
              <span
                className={cn(
                  "min-h-[2.4em] px-1 text-center text-detail leading-tight",
                  s.status === "upcoming" ? "font-normal text-muted-foreground" : "font-medium text-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* <640px: compact bar + expandable full stepper in a Sheet. */}
      <div className="px-4 py-3 sm:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${fillPct}%` }} />
            </div>
            <p className="truncate text-xs font-medium">
              Stage {Math.min(currentIndex + 1, n)} of {n} · {current?.label}
            </p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Show all stages" className="shrink-0">
                <ChevronRight className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><ListChecks className="size-4" /> Workflow stages</SheetTitle>
              </SheetHeader>
              <ol className="space-y-3 px-4 pb-6">
                {stages.map((s, i) => (
                  <li key={s.key} aria-current={s.status === "current" ? "step" : undefined} aria-label={ariaLabel(s, i)} className="flex items-center gap-3">
                    <Node step={s} index={i} isLast={i === n - 1} />
                    <span className={cn("text-sm", s.status === "upcoming" ? "text-muted-foreground" : "font-medium")}>{s.label}</span>
                  </li>
                ))}
              </ol>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {gateMessage && (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg bg-warning/12 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <svg className="mt-px size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{gateMessage}</span>
        </div>
      )}
    </Card>
  );
}
