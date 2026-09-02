"use client";

// Inline owner assignment for the leads list — an unassigned lead shows an
// "Assign" control right in the Owner column, so routing the Unassigned inbox
// never requires opening each lead. Reps load lazily on first open; assignment
// goes through the existing updateLead action (validation + activity log).

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { getAssignableUsers, updateLead } from "@/actions/lead.actions";
import { DotAvatar } from "@/components/shared/dot-avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Rep = { id: string; name: string | null };

export function AssignOwnerPopover({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reps, setReps] = React.useState<Rep[] | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open || reps !== null) return;
    let active = true;
    getAssignableUsers().then((res) => {
      if (!active) return;
      if (res.success) setReps(res.data);
      else {
        toast.error(res.error);
        setReps([]);
      }
    });
    return () => {
      active = false;
    };
  }, [open, reps]);

  function assign(rep: Rep) {
    startTransition(async () => {
      const res = await updateLead(leadId, { assignedToId: rep.id });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Assigned to ${rep.name ?? "the selected owner"}.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Stop the row's click-through navigation — this control acts here.
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-detail text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <UserPlus className="size-3" />
          Assign
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-56 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {reps === null ? (
          <div className="flex items-center justify-center gap-2 p-3 text-detail text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading team…
          </div>
        ) : reps.length === 0 ? (
          <p className="p-3 text-detail text-muted-foreground">No assignable users found.</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {reps.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => assign(r)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body transition-colors hover:bg-muted",
                    pending && "opacity-60"
                  )}
                >
                  <DotAvatar seed={r.id} name={r.name} size="xs" />
                  <span className="truncate">{r.name ?? "Unnamed user"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
