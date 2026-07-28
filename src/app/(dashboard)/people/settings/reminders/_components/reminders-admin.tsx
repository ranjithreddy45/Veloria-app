"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import {
  upsertReminderRule, toggleReminderRule, deleteReminderRule,
} from "@/actions/hr-reminder.actions";

export interface ReminderRule {
  id: string;
  name: string;
  trigger: string;
  daysBefore: number;
  channel: string;
  audienceRole: string | null;
  messageTpl: string | null;
  active: boolean;
  lastRunOn: string | Date | null;
}

// Option lists live in the client component (server actions can only export async fns).
const TRIGGER_OPTIONS: { value: string; label: string }[] = [
  { value: "BIRTHDAY", label: "Birthday" },
  { value: "WORK_ANNIVERSARY", label: "Work anniversary" },
  { value: "DOC_EXPIRY", label: "Document expiry" },
  { value: "PROBATION_END", label: "Probation end" },
  { value: "CONTRACT_END", label: "Contract end" },
];
const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "INAPP", label: "In-app" },
];

const TRIGGER_LABELS = Object.fromEntries(TRIGGER_OPTIONS.map((o) => [o.value, o.label]));
const CHANNEL_LABELS = Object.fromEntries(CHANNEL_OPTIONS.map((o) => [o.value, o.label]));

export function RemindersAdmin({ rules }: { rules: ReminderRule[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold">Reminder rules</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Rules are evaluated by the daily HR cron.
          </p>
        </div>
        <RuleDialog />
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No reminder rules yet. Add one to nudge the team ahead of birthdays, anniversaries,
          document expiries and more.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead className="text-right">Days before</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[88px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <StatusPill label={TRIGGER_LABELS[r.trigger] ?? r.trigger} hue="violet" size="xs" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.daysBefore}</TableCell>
                  <TableCell>{CHANNEL_LABELS[r.channel] ?? r.channel}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.audienceRole || "The employee"}
                  </TableCell>
                  <TableCell>
                    <ActiveToggle id={r.id} active={r.active} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <RuleDialog existing={r} />
                      <DeleteButton id={r.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Switch
      checked={active}
      disabled={pending}
      onCheckedChange={() => {
        startTransition(async () => {
          const res = await toggleReminderRule(id);
          if (!res.success) { toast.error(res.error); return; }
          router.refresh();
        });
      }}
      aria-label="Toggle rule active"
    />
  );
}

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await deleteReminderRule(id);
          if (!res.success) { toast.error(res.error); return; }
          router.refresh();
        });
      }}
      title="Delete rule"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}

function RuleDialog({ existing }: { existing?: ReminderRule }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [name, setName] = React.useState(existing?.name ?? "");
  const [trigger, setTrigger] = React.useState(existing?.trigger ?? "BIRTHDAY");
  const [daysBefore, setDaysBefore] = React.useState(String(existing?.daysBefore ?? 0));
  const [channel, setChannel] = React.useState(existing?.channel ?? "EMAIL");
  const [audienceRole, setAudienceRole] = React.useState(existing?.audienceRole ?? "");
  const [messageTpl, setMessageTpl] = React.useState(existing?.messageTpl ?? "");

  function reset() {
    setName(""); setTrigger("BIRTHDAY"); setDaysBefore("0");
    setChannel("EMAIL"); setAudienceRole(""); setMessageTpl("");
  }

  function save() {
    startTransition(async () => {
      const res = await upsertReminderRule({
        id: existing?.id,
        name,
        trigger,
        daysBefore: Number(daysBefore),
        channel,
        audienceRole: audienceRole || undefined,
        messageTpl: messageTpl || undefined,
        active: existing?.active ?? true,
      });
      if (!res.success) { toast.error(res.error); return; }
      setOpen(false);
      if (!existing) reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add reminder</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit reminder" : "New reminder"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Birthday wishes"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Trigger</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Days before</Label>
              <Input
                type="number" min={0} step={1}
                value={daysBefore}
                onChange={(e) => setDaysBefore(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Audience role <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              value={audienceRole}
              onChange={(e) => setAudienceRole(e.target.value)}
              placeholder="e.g. HR_MANAGER — leave blank to notify the employee"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Message template <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              value={messageTpl}
              onChange={(e) => setMessageTpl(e.target.value)}
              placeholder="Happy birthday, {{name}}!"
              rows={3}
            />
            <p className="text-[11.5px] text-muted-foreground">
              Use <code className="rounded bg-muted px-1 py-0.5">{"{{name}}"}</code> and{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{{date}}"}</code> as placeholders.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={save} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
