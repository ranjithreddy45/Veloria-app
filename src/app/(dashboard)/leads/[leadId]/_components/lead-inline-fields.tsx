"use client";

// ============================================================
// LeadInlineFields — inline (auto-save) editors for the Lead detail page so the
// most-changed fields don't require opening the full Edit form:
//   • Assignee (owner)     → updateLead({ assignedToId })
//   • Next follow-up date  → updateLead({ followUpDate })
// Each control saves on change via the existing updateLead server action and
// refreshes the route. The full Edit button remains for everything else.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, Loader2Icon, UserIcon, ClockIcon } from "lucide-react";
import { toast } from "sonner";

import { updateLead } from "@/actions/lead.actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const UNASSIGNED = "__unassigned__";

interface LeadInlineFieldsProps {
  leadId: string;
  assignedToId: string | null;
  followUpDate: string | Date | null;
  users: { id: string; name: string | null }[];
}

export function LeadInlineFields({
  leadId,
  assignedToId,
  followUpDate,
  users,
}: LeadInlineFieldsProps) {
  const router = useRouter();
  const [savingAssignee, setSavingAssignee] = React.useState(false);
  const [savingFollowUp, setSavingFollowUp] = React.useState(false);

  async function saveAssignee(value: string) {
    const next = value === UNASSIGNED ? null : value;
    if (next === (assignedToId ?? null)) return;
    setSavingAssignee(true);
    try {
      const result = await updateLead(leadId, { assignedToId: next ?? "" });
      if (result.success) {
        toast.success("Owner updated");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update owner");
    } finally {
      setSavingAssignee(false);
    }
  }

  async function saveFollowUp(date: Date | undefined) {
    setSavingFollowUp(true);
    try {
      const result = await updateLead(leadId, { followUpDate: date ?? null });
      if (result.success) {
        toast.success(date ? "Follow-up updated" : "Follow-up cleared");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update follow-up");
    } finally {
      setSavingFollowUp(false);
    }
  }

  const followUp = followUpDate ? new Date(followUpDate) : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Assignee */}
      <div className="flex items-start gap-3">
        <UserIcon className="text-muted-foreground mt-2 size-4" />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">Owner</p>
          <Select
            value={assignedToId ?? UNASSIGNED}
            onValueChange={saveAssignee}
            disabled={savingAssignee}
          >
            <SelectTrigger className="mt-1 h-8 w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name ?? "Unnamed"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Follow-up date */}
      <div className="flex items-start gap-3">
        <ClockIcon className="text-muted-foreground mt-2 size-4" />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">Next follow-up</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={savingFollowUp}
                className={cn(
                  "mt-1 h-8 w-full justify-start text-left font-normal",
                  !followUp && "text-muted-foreground"
                )}
              >
                {savingFollowUp ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : (
                  <CalendarIcon className="mr-2 size-4" />
                )}
                {followUp ? format(followUp, "dd MMM yyyy") : "Set a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={followUp}
                onSelect={(d) => saveFollowUp(d ?? undefined)}
              />
              {followUp && (
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => saveFollowUp(undefined)}
                  >
                    Clear follow-up
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
