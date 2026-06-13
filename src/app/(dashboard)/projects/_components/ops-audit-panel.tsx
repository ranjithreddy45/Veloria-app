"use client";

// ============================================================
// OpsAuditPanel (Spec F) — the Operations deep audit. Locked until the PM
// requests it (post Internal QC); once available it mirrors the Readiness
// pattern (Spec B) by reusing the checklist kit. Adds critical-item badges
// and a confirm-gated "Sign off audit" action.
// API unchanged: setOpsAuditItem(id, { status }), completeOpsAudit(projectId).
// ============================================================

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, CheckCircle2, SearchX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { type SegmentOption } from "@/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChecklistHeader, CategorySection, ChecklistItem, type ChecklistFilter, type ChecklistItemData,
} from "./checklist-kit";
import { auditTone, countByTone, type ChecklistTone } from "@/lib/projects/ui";
import { setOpsAuditItem, completeOpsAudit } from "@/actions/projects.actions";

const AUDIT_OPTIONS: SegmentOption[] = [
  { value: "PENDING", label: "Pending", tone: "pending" },
  { value: "PASS", label: "Pass", tone: "done" },
  { value: "FAIL", label: "Fail", tone: "danger" },
  { value: "NA", label: "N/A", tone: "na" },
];

type RawAudit = { id: string; category: string; title: string; critical: boolean; status: string };

function matchesFilter(tone: ChecklistTone, filter: ChecklistFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return tone === "pending";
  if (filter === "done") return tone === "done";
  return tone === "na";
}

export function OpsAuditPanel({
  projectId, items: initialItems, canAudit, phase, passedAt, passedByName,
}: {
  projectId: string;
  items: RawAudit[];
  canAudit: boolean;
  phase: string;
  passedAt?: string | null;
  passedByName?: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(initialItems);
  React.useEffect(() => { setItems(initialItems); }, [initialItems]);
  const [filter, setFilter] = React.useState<ChecklistFilter>("all");
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState(false);

  // ---- Locked state: audit not yet requested ----
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <EmptyState
          tone="warning"
          icon={<Lock className="size-5" />}
          title="Operations audit not yet available"
          description="The deep audit checklist unlocks after Internal QC is passed and the PM requests the Operations audit."
          action={
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" size="sm" disabled className="pointer-events-none">
                    <ShieldCheck className="size-4" /> Request audit
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Available to the PM from the workflow once Internal QC passes.</TooltipContent>
            </Tooltip>
          }
        />
      </div>
    );
  }

  const categories = (() => {
    const map = new Map<string, RawAudit[]>();
    for (const it of items) { if (!map.has(it.category)) map.set(it.category, []); map.get(it.category)!.push(it); }
    return [...map.entries()].map(([name, list]) => ({ name, list }));
  })();

  // Default-open categories with anything still pending; init once.
  if (Object.keys(open).length === 0 && categories.length > 0) {
    const init: Record<string, boolean> = {};
    for (const { name, list } of categories) init[name] = list.some((it) => auditTone(it.status) === "pending");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    setTimeout(() => setOpen(init), 0);
  }

  function toggle(name: string) { setOpen((o) => ({ ...o, [name]: !o[name] })); }
  const allOpen = categories.length > 0 && categories.every((c) => open[c.name]);
  function toggleAll() { const v = !allOpen; setOpen(Object.fromEntries(categories.map((c) => [c.name, v]))); }

  async function onChange(item: RawAudit, status: string) {
    if (status === item.status) return;
    const prev = items;
    setItems((cur) => cur.map((it) => (it.id === item.id ? { ...it, status } : it)));
    const res = await setOpsAuditItem(item.id, { status });
    if (!res.success) { setItems(prev); toast.error(res.error ?? "Couldn't update — reverted."); }
    else toast.success("Updated.");
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await completeOpsAudit(projectId);
      if (!res.success) toast.error(res.error ?? "Couldn't sign off.");
      else { toast.success("Audit signed off."); router.refresh(); }
    } finally { setBusy(false); }
  }

  const totals = countByTone(items, auditTone);
  const criticalPending = items.filter((i) => i.critical && auditTone(i.status) === "pending").length;
  const gate = criticalPending > 0 ? `${criticalPending} critical item(s) still open — all critical standards must pass before sign-off.` : undefined;

  const filteredCategories = categories
    .map(({ name, list }) => ({ name, list: list.filter((it) => matchesFilter(auditTone(it.status), filter)), total: list.length }))
    .filter((c) => c.list.length > 0);

  return (
    <div>
      <ChecklistHeader
        title="Audited" pct={totals.pct} done={totals.done} pending={totals.pending} na={totals.na}
        gateMessage={gate} filter={filter} onFilter={setFilter} allOpen={allOpen} onToggleAll={toggleAll}
        doneLabel="pass"
      />

      {passedAt ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="size-4" /> Operations audit passed{passedByName ? ` · ${passedByName}` : ""}.
        </div>
      ) : null}

      {filteredCategories.length === 0 ? (
        <EmptyState icon={<SearchX className="size-5" />} title="No items match this filter" description="Try a different filter." />
      ) : (
        <div className="space-y-3">
          {filteredCategories.map(({ name, list, total }) => {
            const full = categories.find((x) => x.name === name)!.list;
            const fullCounts = countByTone(full, auditTone);
            return (
              <CategorySection
                key={name} name={name}
                done={filter === "all" ? fullCounts.done : list.length} total={total}
                pct={fullCounts.pct} open={open[name] ?? true} onToggle={() => toggle(name)}
              >
                {list.map((it) => {
                  const data: ChecklistItemData = { id: it.id, category: it.category, title: it.title, description: "", status: it.status };
                  return (
                    <ChecklistItem
                      key={it.id} item={data} tone={auditTone(it.status)} options={AUDIT_OPTIONS}
                      onChange={(v) => onChange(it, v)} disabled={!canAudit}
                      badge={it.critical ? (
                        <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                          <ShieldAlert className="size-3" /> critical
                        </span>
                      ) : null}
                    />
                  );
                })}
              </CategorySection>
            );
          })}
        </div>
      )}

      {canAudit && !passedAt && phase === "OPS_AUDIT" && (
        <div className="mt-4 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={busy || criticalPending > 0}>
                <CheckCircle2 className="size-4" /> Sign off audit
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign off the Operations audit?</AlertDialogTitle>
                <AlertDialogDescription>
                  This confirms every critical standard has passed and moves the project to Final Go-Ahead. This is recorded against your name.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={submit}>Sign off</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
