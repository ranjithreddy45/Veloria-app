"use client";

// ============================================================
// ReadinessPanel (Spec B) — sticky sub-header with donut + counts + gate +
// filter, collapsible categories with mini-progress, segmented status control,
// clamped descriptions, optimistic updates with rollback. Composes checklist-kit.
// API unchanged: calls the existing setReadinessItem(id, { status }).
// ============================================================

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { type SegmentOption } from "@/components/ui/segmented-control";
import {
  ChecklistHeader, CategorySection, ChecklistItem, type ChecklistFilter, type ChecklistItemData,
} from "./checklist-kit";
import { readinessTone, countByTone, type ChecklistTone } from "@/lib/projects/ui";
import { setReadinessItem } from "@/actions/projects.actions";

const READINESS_OPTIONS: SegmentOption[] = [
  { value: "DONE", label: "Done", tone: "done" },
  { value: "PENDING", label: "Pending", tone: "pending" },
  { value: "NA", label: "N/A", tone: "na" },
];

type RawItem = { id: string; category: string; title: string; standard: string; status: string };

function matchesFilter(tone: ChecklistTone, filter: ChecklistFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return tone === "pending";
  if (filter === "done") return tone === "done";
  return tone === "na";
}

export function ReadinessPanel({
  projectId, items: initialItems, canUpdate, gateMessage,
}: {
  projectId: string;
  items: RawItem[];
  canUpdate: boolean;
  gateMessage?: string;
}) {
  const [items, setItems] = React.useState(initialItems);
  React.useEffect(() => { setItems(initialItems); }, [initialItems]);

  const [filter, setFilter] = React.useState<ChecklistFilter>("all");

  // Category grouping (stable order).
  const categories = React.useMemo(() => {
    const map = new Map<string, RawItem[]>();
    for (const it of items) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push(it);
    }
    return [...map.entries()].map(([name, list]) => ({ name, list }));
  }, [items]);

  // Expand/collapse state, persisted per project. Default: expand categories
  // that have pending items; collapse 100%-complete ones.
  const storageKey = `veloria.readiness.open.${projectId}`;
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    let stored: Record<string, boolean> | null = null;
    try { const raw = localStorage.getItem(storageKey); if (raw) stored = JSON.parse(raw); } catch {}
    const next: Record<string, boolean> = {};
    for (const { name, list } of categories) {
      if (stored && name in stored) next[name] = stored[name];
      else next[name] = list.some((it) => readinessTone(it.status) === "pending");
    }
    setOpen(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function persist(next: Record<string, boolean>) {
    setOpen(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }
  function toggle(name: string) { persist({ ...open, [name]: !open[name] }); }
  const allOpen = categories.length > 0 && categories.every((c) => open[c.name]);
  function toggleAll() {
    const v = !allOpen;
    persist(Object.fromEntries(categories.map((c) => [c.name, v])));
  }

  // Optimistic status change with rollback.
  async function onChange(item: RawItem, status: string) {
    if (status === item.status) return;
    const prev = items;
    setItems((cur) => cur.map((it) => (it.id === item.id ? { ...it, status } : it)));
    const res = await setReadinessItem(item.id, { status });
    if (!res.success) {
      setItems(prev);
      toast.error(res.error ?? "Couldn't update — reverted.");
    } else {
      toast.success("Updated.");
    }
  }

  const totals = countByTone(items, readinessTone);

  // Filtered view.
  const filteredCategories = categories
    .map(({ name, list }) => ({
      name,
      list: list.filter((it) => matchesFilter(readinessTone(it.status), filter)),
      total: list.length,
    }))
    .filter((c) => c.list.length > 0);

  const nothing = filteredCategories.length === 0;

  return (
    <div>
      <ChecklistHeader
        title="Ready"
        pct={totals.pct}
        done={totals.done}
        pending={totals.pending}
        na={totals.na}
        gateMessage={gateMessage}
        filter={filter}
        onFilter={setFilter}
        allOpen={allOpen}
        onToggleAll={toggleAll}
      />

      {nothing ? (
        filter === "pending" ? (
          <EmptyState
            tone="success"
            icon={<CheckCircle2 className="size-5" />}
            title="Nothing pending"
            description="Every standard has been signed off or marked N/A."
          />
        ) : (
          <EmptyState
            icon={<SearchX className="size-5" />}
            title="No items match this filter"
            description="Try a different filter to see more."
          />
        )
      ) : (
        <div className="space-y-3">
          {filteredCategories.map(({ name, list, total }) => {
            const full = categories.find((x) => x.name === name)!.list;
            const fullCounts = countByTone(full, readinessTone);
            // When filtered, show matching/total; otherwise done/total.
            return (
              <CategorySection
                key={name}
                name={name}
                done={filter === "all" ? fullCounts.done : list.length}
                total={total}
                pct={fullCounts.pct}
                open={open[name] ?? true}
                onToggle={() => toggle(name)}
              >
                {list.map((it) => {
                  const data: ChecklistItemData = {
                    id: it.id, category: it.category, title: it.title, description: it.standard, status: it.status,
                  };
                  return (
                    <ChecklistItem
                      key={it.id}
                      item={data}
                      tone={readinessTone(it.status)}
                      options={READINESS_OPTIONS}
                      onChange={(v) => onChange(it, v)}
                      disabled={!canUpdate}
                    />
                  );
                })}
              </CategorySection>
            );
          })}
        </div>
      )}
    </div>
  );
}
