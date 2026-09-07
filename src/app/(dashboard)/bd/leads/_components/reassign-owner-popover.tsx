"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserCog, Check } from "lucide-react";

import { reassignAcqLead } from "@/actions/acq-lead.actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ============================================================
// Inline owner reassignment, right in the leads table — the BD twin of the
// Sales AssignOwnerPopover. A manager rebalancing the book shouldn't open ten
// detail pages to move ten leads. Rendered only when the viewer holds
// lead:reassign (the server action re-checks regardless).
// ============================================================

export function ReassignOwnerPopover({
  leadId,
  current,
  bdUsers,
}: {
  leadId: string;
  current: { id: string; name: string | null } | null;
  bdUsers: { id: string; name: string | null; role: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const pick = async (userId: string) => {
    if (savingId || userId === current?.id) {
      setOpen(false);
      return;
    }
    setSavingId(userId);
    const res = await reassignAcqLead(leadId, userId);
    setSavingId(null);
    if (!res.success) {
      toast.error(res.error || "Couldn't reassign the lead.");
      return;
    }
    const name = bdUsers.find((u) => u.id === userId)?.name ?? "the new owner";
    toast.success(`Lead moved to ${name}.`);
    setOpen(false);
    router.refresh();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "group inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-muted",
            current ? "text-muted-foreground" : "font-medium text-primary"
          )}
          title="Change owner"
        >
          <span className="truncate">{current?.name ?? "Assign owner"}</span>
          <UserCog className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-2 pb-1 pt-1 text-meta font-medium uppercase tracking-wide text-muted-foreground">
          Move lead to
        </p>
        <div className="max-h-64 overflow-y-auto">
          {bdUsers.length === 0 ? (
            <p className="px-2 py-2 text-detail text-muted-foreground">No BD team members.</p>
          ) : (
            bdUsers.map((u) => {
              const isCurrent = u.id === current?.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={savingId !== null}
                  onClick={() => pick(u.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-body transition-colors hover:bg-muted disabled:opacity-60",
                    isCurrent && "font-medium text-foreground"
                  )}
                >
                  <span className="truncate">{u.name ?? "Unnamed"}</span>
                  {savingId === u.id ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : isCurrent ? (
                    <Check className="size-3.5 shrink-0 text-primary" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
