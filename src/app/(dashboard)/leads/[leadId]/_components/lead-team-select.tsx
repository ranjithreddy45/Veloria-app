"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setLeadSalesTeam } from "@/actions/lead.actions";
import { SALES_TEAMS, UNSORTED, salesTeamLabel } from "@/lib/crm/sales-team";

// Which sales team's CRM this lead sits in. Moving it is logged, and from then
// on the event type never re-sorts it.
export function LeadTeamSelect({ leadId, currentTeam }: { leadId: string; currentTeam: string | null }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const value = currentTeam ?? UNSORTED;

  async function onChange(next: string) {
    if (next === value) return;
    setPending(true);
    try {
      const team = next === UNSORTED ? null : next;
      const res = await setLeadSalesTeam(leadId, team);
      if (res.success) {
        toast.success(team ? `Moved to the ${salesTeamLabel(team)} team` : "Moved to Unsorted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to move the lead");
    } finally {
      setPending(false);
    }
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-8 w-auto gap-1.5" aria-label="Sales team">
        <Users className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SALES_TEAMS.map((t) => (
          <SelectItem key={t.key} value={t.key}>
            {t.label} team
          </SelectItem>
        ))}
        <SelectItem value={UNSORTED}>Unsorted</SelectItem>
      </SelectContent>
    </Select>
  );
}
