"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserXIcon, ArrowRightIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reassignLeadsFromInactiveStaff } from "@/actions/stranded-leads.actions";

// ============================================================
// "Open leads still with people who have left" — shown on User Management
// only when there are some. Moves them all to one person, or shares them
// round-robin within each lead's sales team (the chosen person takes the
// leads whose team has nobody on it). Open tasks and deals follow the lead.
// ============================================================

interface Owner {
  userId: string;
  name: string | null;
  email: string;
  openLeads: number;
}
interface Destination {
  id: string;
  name: string | null;
  role: string;
  salesTeam: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  SALES_EXEC: "Sales Exec",
  SALES_HEAD: "Sales Head",
  EVENT_COORDINATOR: "Event Coordinator",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

export function StrandedLeadsCard({
  owners,
  destinations,
}: {
  owners: Owner[];
  destinations: Destination[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(owners.map((o) => o.userId)));
  const [mode, setMode] = React.useState<"person" | "team">("person");
  const [toUserId, setToUserId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const total = owners.reduce((s, o) => s + o.openLeads, 0);
  const chosenCount = owners.filter((o) => selected.has(o.userId)).reduce((s, o) => s + o.openLeads, 0);
  const teamMembers = destinations.filter((d) => d.salesTeam).length;

  React.useEffect(() => {
    setSelected(new Set(owners.map((o) => o.userId)));
  }, [owners]);

  if (owners.length === 0) return null;

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0 || !toUserId) return;
    setSaving(true);
    try {
      const res = await reassignLeadsFromInactiveStaff({ fromUserIds: [...selected], mode, toUserId });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const { moved, byAssignee } = res.data;
      const who = byAssignee.map((b) => `${b.name ?? "someone"} ${b.count}`).join(", ");
      toast.success(moved === 1 ? `1 lead moved (${who})` : `${moved} leads moved (${who})`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not move the leads. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <UserXIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium">
                {total === 1 ? "1 open lead is" : `${total} open leads are`} still with people who have left
              </p>
              <p className="text-muted-foreground text-sm">
                Nobody is reminded about them and nobody calls.{" "}
                {owners
                  .slice(0, 4)
                  .map((o) => `${o.name ?? o.email} (${o.openLeads})`)
                  .join(", ")}
                {owners.length > 4 ? ` and ${owners.length - 4} more` : ""}.
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="shrink-0">
            Move leads
            <ArrowRightIcon className="ml-2 size-4" />
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Move leads from people who have left</DialogTitle>
            <DialogDescription>
              Their open tasks and deals on these leads move too. The new owners are notified once, with the
              full list. Won and lost leads stay where they are.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Whose leads</p>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {owners.map((o) => (
                  <label key={o.userId} className="flex cursor-pointer items-center gap-3 text-sm">
                    <Checkbox checked={selected.has(o.userId)} onCheckedChange={(v) => toggle(o.userId, v === true)} />
                    <span className="flex-1">{o.name ?? o.email}</span>
                    <span className="text-muted-foreground tabular-nums">{o.openLeads}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">How</p>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as "person" | "team")} className="gap-2">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <RadioGroupItem value="person" className="mt-0.5" />
                  <span>All to one person</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <RadioGroupItem value="team" className="mt-0.5" disabled={teamMembers === 0} />
                  <span>
                    Share across each lead&apos;s sales team, in turn
                    <span className="text-muted-foreground block">
                      {teamMembers === 0
                        ? "Nobody is on a Wedding, Corporate or Social team yet (Settings → Sales teams)."
                        : "Leads whose team has nobody on it go to the person below."}
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>{mode === "person" ? "Give them to" : "Anything left over goes to"}</Label>
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name ?? "Unnamed"} · {ROLE_LABEL[d.role] ?? d.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || selected.size === 0 || !toUserId}>
              {saving ? "Moving…" : chosenCount === 1 ? "Move 1 lead" : `Move ${chosenCount} leads`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
