"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { setEmployeeCustomFields } from "@/actions/hr-config.actions";
import { requestProfileChange } from "@/actions/hr-change-request.actions";

export interface ActiveFieldDef {
  id: string; key: string; label: string; type: string; options: string | null; required: boolean;
}

// ---- Custom fields card (read + inline edit for hr:write) ----
export function CustomFieldsCard({
  employeeId, defs, values, canWrite,
}: {
  employeeId: string; defs: ActiveFieldDef[]; values: Record<string, unknown>; canWrite: boolean;
}) {
  if (defs.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Additional details</h3>
        {canWrite && <EditCustomFields employeeId={employeeId} defs={defs} values={values} />}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {defs.map((d) => {
          const v = values?.[d.key];
          const display =
            d.type === "BOOLEAN" ? (v ? "Yes" : v === false ? "No" : null) : v != null && v !== "" ? String(v) : null;
          return (
            <div key={d.key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-[13px]">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="font-medium">{display || <span className="text-muted-foreground/50">—</span>}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditCustomFields({
  employeeId, defs, values,
}: {
  employeeId: string; defs: ActiveFieldDef[]; values: Record<string, unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [state, setState] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    defs.forEach((d) => { const v = values?.[d.key]; init[d.key] = v == null ? "" : String(v); });
    return init;
  });

  async function save() {
    setSaving(true);
    const payload: Record<string, unknown> = {};
    defs.forEach((d) => {
      const raw = state[d.key];
      if (d.type === "NUMBER") payload[d.key] = raw === "" ? null : Number(raw);
      else if (d.type === "BOOLEAN") payload[d.key] = raw === "true";
      else payload[d.key] = raw;
    });
    await setEmployeeCustomFields(employeeId, payload);
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Pencil className="size-3.5" /> Edit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Additional details</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {defs.map((d) => (
            <div key={d.key} className="space-y-1.5">
              <Label className="text-[12.5px]">{d.label}{d.required && <span className="text-red-500"> *</span>}</Label>
              {d.type === "SELECT" ? (
                <Select value={state[d.key] || ""} onValueChange={(v) => setState((s) => ({ ...s, [d.key]: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {(d.options ?? "").split(",").map((o) => o.trim()).filter(Boolean).map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : d.type === "BOOLEAN" ? (
                <Select value={state[d.key] || ""} onValueChange={(v) => setState((s) => ({ ...s, [d.key]: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={d.type === "NUMBER" ? "number" : d.type === "DATE" ? "date" : "text"}
                  value={state[d.key] || ""}
                  onChange={(e) => setState((s) => ({ ...s, [d.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Request profile change (self-service → HR approval) ----
export function RequestEditButton({
  employeeId, current,
}: {
  employeeId: string; current: { phone: string | null; personalEmail: string | null; workLocation: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [phone, setPhone] = React.useState(current.phone ?? "");
  const [personalEmail, setPersonalEmail] = React.useState(current.personalEmail ?? "");
  const [workLocation, setWorkLocation] = React.useState(current.workLocation ?? "");
  const [note, setNote] = React.useState("");

  async function submit() {
    setSaving(true); setMsg(null);
    const res = await requestProfileChange(employeeId, { phone, personalEmail, workLocation }, note || undefined);
    setSaving(false);
    if (!res.success) { setMsg(res.error); return; }
    setOpen(false);
    setMsg(null);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><MessageSquarePlus className="size-3.5" /> Request edit</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a profile change</DialogTitle>
          <DialogDescription>HR will review and approve these changes before they apply.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Personal email</Label>
            <Input value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Work location</Label>
            <Input value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this change?" /></div>
        </div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
