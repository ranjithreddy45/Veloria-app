"use client";

// ============================================================
// Checklist kit — shared building blocks for the Readiness (Spec B) and
// Ops Audit (Spec F) panels. Generic over the raw status vocabulary via a
// `toneOf` resolver + writable `options`, so both panels reuse the exact same
// item row, category accordion, status control, and sticky header.
// ============================================================

import * as React from "react";
import { Check, ChevronDown, Minus, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Donut } from "@/components/ui/donut";
import { SegmentedControl, type SegmentOption } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { healthTextClass, healthBarClass, type ChecklistTone } from "@/lib/projects/ui";

export interface ChecklistItemData {
  id: string;
  category: string;
  title: string;
  description: string;
  status: string;
}

const TONE_ACCENT: Record<ChecklistTone, string> = {
  done: "border-l-emerald-400",
  pending: "border-l-amber-400",
  na: "border-l-zinc-300 dark:border-l-zinc-600",
};

function ToneDot({ tone }: { tone: ChecklistTone }) {
  if (tone === "done") return <Check className="size-3.5 text-emerald-600" strokeWidth={3} />;
  if (tone === "na") return <Minus className="size-3.5 text-muted-foreground" strokeWidth={3} />;
  return <Circle className="size-3 fill-amber-400 text-amber-400" />;
}

// ------------------------------------------------------------
// StatusControl — segmented pills on >=sm, compact Select on mobile.
// ------------------------------------------------------------
export function StatusControl({
  value, tone, options, onChange, disabled, ariaLabel,
}: {
  value: string;
  tone: ChecklistTone;
  options: SegmentOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  // The active pill is the option whose value matches; if the raw status isn't
  // directly writable (e.g. IN_PROGRESS / FAIL), fall back to the option that
  // shares its tone so the control still reflects state.
  const active = options.find((o) => o.value === value)?.value
    ?? options.find((o) => o.tone === tone)?.value
    ?? options[0].value;

  return (
    <>
      <div className="hidden sm:block">
        <SegmentedControl
          options={options}
          value={active}
          onChange={onChange}
          ariaLabel={ariaLabel}
          size="sm"
          disabled={disabled}
        />
      </div>
      <div className="sm:hidden">
        <Select value={active} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="h-8 w-28" aria-label={ariaLabel}><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

// ------------------------------------------------------------
// ChecklistItem — status dot, title, clamped description w/ "more", control.
// ------------------------------------------------------------
export function ChecklistItem({
  item, tone, options, onChange, disabled, badge,
}: {
  item: ChecklistItemData;
  tone: ChecklistTone;
  options: SegmentOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const descId = `desc-${item.id}`;
  const long = (item.description?.length ?? 0) > 90;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-l-2 border-transparent bg-card px-3 py-2.5 transition-premium hover:shadow-card-hover",
        TONE_ACCENT[tone],
      )}
    >
      <span
        key={tone}
        className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center", tone === "done" && "animate-check-pop")}
        aria-hidden
      >
        <ToneDot tone={tone} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium leading-snug">
          <span>{item.title}</span>
          {badge}
        </div>
        {item.description && (
          <div className="mt-0.5">
            <p id={descId} className={cn("text-xs text-muted-foreground", !expanded && "line-clamp-2")}>
              {item.description}
            </p>
            {long && (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={descId}
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 text-meta font-medium text-primary hover:underline focus-ring rounded"
              >
                {expanded ? "less" : "more"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0">
        <StatusControl
          value={item.status}
          tone={tone}
          options={options}
          onChange={onChange}
          disabled={disabled}
          ariaLabel={`${item.title}, status`}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// CategorySection — collapsible accordion with mini progress.
// ------------------------------------------------------------
export function CategorySection({
  name, done, total, pct, open, onToggle, children,
}: {
  name: string;
  done: number;
  total: number;
  pct: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-premium hover:bg-muted/40 focus-ring"
      >
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", !open && "-rotate-90")} />
        <span className="flex-1 text-sm font-semibold">{name}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{done}/{total}</span>
          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
            <span className={cn("block h-full rounded-full transition-[width] duration-300 ease-out", healthBarClass(pct))} style={{ width: `${pct}%` }} />
          </span>
        </span>
      </button>
      {/* Lazy-render body only when expanded — keeps initial paint fast. */}
      {open && <div className="space-y-1.5 px-3 pb-3">{children}</div>}
    </div>
  );
}

// ------------------------------------------------------------
// ChecklistHeader — sticky sub-header: donut + counts + gate + filter.
// ------------------------------------------------------------
export type ChecklistFilter = "all" | "pending" | "done" | "na";

export function ChecklistHeader({
  title, pct, done, pending, na, gateMessage, filter, onFilter, allOpen, onToggleAll, doneLabel = "done",
}: {
  title: string;
  pct: number;
  done: number;
  pending: number;
  na: number;
  gateMessage?: string;
  filter: ChecklistFilter;
  onFilter: (f: ChecklistFilter) => void;
  allOpen: boolean;
  onToggleAll: () => void;
  doneLabel?: string;
}) {
  const filters: SegmentOption<ChecklistFilter>[] = [
    { value: "all", label: "All", tone: "neutral" },
    { value: "pending", label: "Pending", tone: "pending" },
    { value: "done", label: doneLabel === "done" ? "Done" : "Pass", tone: "done" },
    { value: "na", label: "N/A", tone: "na" },
  ];

  return (
    <div className="sticky top-0 z-10 -mx-1 mb-3 rounded-xl border bg-card/95 px-4 py-3 shadow-card backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <Donut value={pct} size={44} colorClass={healthTextClass(pct)} ariaLabel={`${title} ${pct}% ready`} />
          <div className="leading-tight">
            <div className="text-sm font-semibold">{pct}% {title.toLowerCase()}</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {done} {doneLabel} · {pending} pending · {na} N/A
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SegmentedControl
            options={filters}
            value={filter}
            onChange={onFilter}
            ariaLabel={`Filter ${title}`}
            size="sm"
          />
          <Button variant="ghost" size="sm" onClick={onToggleAll} className="text-xs">
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        </div>
      </div>
      {gateMessage && (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-warning/12 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <svg className="mt-px size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{gateMessage}</span>
        </div>
      )}
    </div>
  );
}
