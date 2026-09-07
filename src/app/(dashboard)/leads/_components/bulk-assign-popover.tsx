"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

import { bulkAssignLeads } from "@/actions/bulk.actions";
import { getAssignableUsers } from "@/actions/lead.actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ============================================================
// Bulk "Assign to" — lives in the BulkActionBar's `extra` slot. Select rows,
// pick a rep, every selected lead moves in one write (bulkAssignLeads:
// leads:assign-gated, assignee validated, per-lead audit rows).
// Reps are fetched lazily on first open, once per mount — the bar appears and
// disappears with every selection, so fetching on mount would refetch forever.
// ============================================================

type Rep = { id: string; name: string | null };

export function BulkAssignPopover({
  selectedIds,
  onDone,
}: {
  selectedIds: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reps, setReps] = React.useState<Rep[] | null>(null);
  const [loadingReps, setLoadingReps] = React.useState(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const loadReps = React.useCallback(async () => {
    if (reps !== null || loadingReps) return;
    setLoadingReps(true);
    const res = await getAssignableUsers();
    setLoadingReps(false);
    if (res.success) setReps(res.data);
    else toast.error(res.error || "Couldn't load the team list.");
  }, [reps, loadingReps]);

  const pick = async (rep: Rep) => {
    if (savingId) return;
    setSavingId(rep.id);
    const res = await bulkAssignLeads({ ids: selectedIds, assignedToId: rep.id });
    setSavingId(null);
    if (!res.success) {
      toast.error(res.error || "Couldn't assign the leads.");
      return;
    }
    toast.success(
      `Assigned ${res.data.count} lead${res.data.count === 1 ? "" : "s"} to ${rep.name ?? "the selected owner"}.`
    );
    setOpen(false);
    onDone();
    router.refresh();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void loadReps();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={savingId !== null}>
          {savingId ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <UserPlus className="mr-1.5 size-3.5" />
          )}
          Assign to
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="w-56 p-1.5">
        <p className="px-2 pb-1 pt-1 text-meta font-medium uppercase tracking-wide text-muted-foreground">
          Assign {selectedIds.length} lead{selectedIds.length === 1 ? "" : "s"} to
        </p>
        <div className="max-h-64 overflow-y-auto">
          {loadingReps || reps === null ? (
            <div className="flex items-center gap-2 px-2 py-2 text-detail text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading team…
            </div>
          ) : reps.length === 0 ? (
            <p className="px-2 py-2 text-detail text-muted-foreground">No assignable users.</p>
          ) : (
            reps.map((rep) => (
              <button
                key={rep.id}
                type="button"
                disabled={savingId !== null}
                onClick={() => pick(rep)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-body transition-colors hover:bg-muted disabled:opacity-60"
                )}
              >
                <span className="truncate">{rep.name ?? "Unnamed"}</span>
                {savingId === rep.id && (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
