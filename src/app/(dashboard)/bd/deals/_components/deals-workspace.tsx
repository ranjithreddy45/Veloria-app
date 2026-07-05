"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DealBoard, type AcqDealCard } from "./deal-board";
import { DealList } from "./deal-list";

// ============================================================
// Deals workspace — hosts the List | Board toggle + search over the
// acquisition pipeline. Mirrors the tasks module view-toggle pattern and the
// BD leads search bar so the whole BD area feels consistent.
// ============================================================

export function DealsWorkspace({ deals }: { deals: AcqDealCard[] }) {
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) => {
      const haystack = [
        d.name,
        d.ownerName,
        d.propertyName,
        d.locality,
        d.city,
        d.bdExecutive?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [deals, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* View toggle — segmented control */}
        <div
          role="group"
          aria-label="Deal view"
          className="inline-flex w-fit shrink-0 items-center gap-0.5 rounded-xl border border-border/70 bg-muted/60 p-1"
        >
          {(
            [
              { key: "list", label: "List", Icon: ListIcon },
              { key: "board", label: "Board", Icon: LayoutGrid },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-all",
                view === key
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deal, owner, property, city…"
            className="h-8 w-full pl-8 text-[13px] sm:w-[260px]"
          />
        </div>
      </div>

      {view === "board" ? (
        <DealBoard deals={filtered} />
      ) : (
        <DealList deals={filtered} />
      )}
    </div>
  );
}
