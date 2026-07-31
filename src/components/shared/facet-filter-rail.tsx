"use client";

// ============================================================
// FacetFilterRail — a Zoho-style "Filter by" sidebar. Generic over the row
// type: you pass the items + a list of facet definitions, and it derives the
// options (with live counts), manages multi-select state, and calls back with
// the filtered rows. Selections within a facet are OR'd; across facets AND'd.
// Reusable across every list view (Contacts, Leads, Bookings, …).
// ============================================================

import * as React from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export interface FacetDef<T> {
  key: string;
  label: string;
  /** Pull the facet value(s) off a row. Return null/empty to exclude. */
  get: (item: T) => string | string[] | null | undefined;
  /** Pretty-print a raw value (e.g. INDIVIDUAL → Individual). */
  format?: (value: string) => string;
  /** Max options to show before "show more". */
  max?: number;
}

interface Option { value: string; label: string; count: number }

function optionsFor<T>(items: T[], facet: FacetDef<T>): Option[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const raw = facet.get(it);
    const vals = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
    for (const v of vals) {
      if (v === null || v === undefined || v === "") continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: facet.format ? facet.format(value) : value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function FacetSection<T>({
  facet, items, selected, onToggle,
}: {
  facet: FacetDef<T>;
  items: T[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [showAll, setShowAll] = React.useState(false);
  const options = React.useMemo(() => optionsFor(items, facet), [items, facet]);
  if (options.length === 0) return null;
  const max = facet.max ?? 6;
  const shown = showAll ? options : options.slice(0, max);

  return (
    <div className="border-b border-border/60 py-3 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left focus-ring rounded"
        aria-expanded={open}
      >
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{facet.label}</span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="mt-2 space-y-0.5">
          {shown.map((o) => {
            const checked = selected.has(o.value);
            return (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] transition-premium hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(o.value)}
                  className="size-3.5 shrink-0 accent-primary"
                />
                <span className={cn("min-w-0 flex-1 truncate", checked ? "font-medium text-foreground" : "text-foreground/80")}>{o.label}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{o.count}</span>
              </label>
            );
          })}
          {options.length > max && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="px-1.5 pt-1 text-[11.5px] font-medium text-primary hover:underline">
              {showAll ? "Show less" : `Show ${options.length - max} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function FacetFilterRail<T>({
  items, facets, onChange, className,
}: {
  items: T[];
  facets: FacetDef<T>[];
  onChange: (filtered: T[]) => void;
  className?: string;
}) {
  const [selected, setSelected] = React.useState<Record<string, Set<string>>>({});
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const activeCount = React.useMemo(
    () => Object.values(selected).reduce((s, set) => s + set.size, 0),
    [selected],
  );

  // Apply facets (OR within a facet, AND across facets) and notify the parent.
  const filtered = React.useMemo(() => {
    if (activeCount === 0) return items;
    return items.filter((it) =>
      facets.every((f) => {
        const sel = selected[f.key];
        if (!sel || sel.size === 0) return true;
        const raw = f.get(it);
        const vals = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
        return vals.some((v) => sel.has(v));
      }),
    );
  }, [items, facets, selected, activeCount]);

  React.useEffect(() => { onChange(filtered); }, [filtered, onChange]);

  function toggle(key: string, value: string) {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[key] ?? []);
      if (set.has(value)) set.delete(value); else set.add(value);
      next[key] = set;
      return next;
    });
  }

  // The facet list, declared ONCE and rendered into either the desktop aside or
  // the mobile sheet. Both containers belong to this single component instance,
  // so they share `selected` — mounting the rail twice (once per breakpoint) at
  // the call sites would give each copy its own state and both would fire
  // onChange, fighting over the filtered result.
  const body = (
    <div className="-mt-1">
      {facets.map((f) => (
        <FacetSection key={f.key} facet={f} items={items} selected={selected[f.key] ?? new Set()} onToggle={(v) => toggle(f.key, v)} />
      ))}
    </div>
  );

  const clearButton =
    activeCount > 0 ? (
      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" onClick={() => setSelected({})}>
        <X className="size-3" /> Clear ({activeCount})
      </Button>
    ) : null;

  return (
    <>
      {/* Desktop rail — unchanged. `hidden lg:block` lives HERE now rather than
          being passed in by every call site, so the mobile affordance below can
          never be forgotten by a new caller. */}
      <aside
        className={cn(
          "hidden w-56 shrink-0 rounded-xl border border-border/70 bg-card p-3 shadow-card lg:block",
          className
        )}
      >
        <div className="flex items-center justify-between pb-1">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" /> Filter by
          </span>
          {clearButton}
        </div>
        {body}
      </aside>

      {/* Below lg the rail was simply `hidden`, so these lists had NO faceted
          filtering on a phone or tablet at all. Same state, shown in a sheet. */}
      <div className="w-full lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <div className="flex items-center gap-2">
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 justify-center gap-1.5">
                <SlidersHorizontal className="size-3.5" />
                Filter by
                {activeCount > 0 && (
                  <span className="bg-primary text-primary-foreground numeric ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                    {activeCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            {/* One-tap clear without opening the sheet. */}
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected({})} aria-label="Clear filters">
                <X className="size-4" />
              </Button>
            )}
          </div>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-[15px]">
                <SlidersHorizontal className="size-4" /> Filter by
              </SheetTitle>
            </SheetHeader>
            {body}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelected({})} disabled={activeCount === 0}>
                Clear all
              </Button>
              <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                Show results
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
