"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { upsertCustomFieldDef, deleteCustomFieldDef } from "@/actions/hr-config.actions";

export interface FieldDef {
  id: string; key: string; label: string; type: string;
  options: string | null; required: boolean; isActive: boolean; order: number;
}

const TYPE_LABELS: Record<string, string> = {
  TEXT: "Text", NUMBER: "Number", DATE: "Date", SELECT: "Dropdown", BOOLEAN: "Yes / No",
};

export function CustomFieldsAdmin({ defs }: { defs: FieldDef[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Custom employee fields</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Add fields to every employee profile without code — unlimited, never licence-gated.
          </p>
        </div>
        <FieldDialog />
      </div>

      {defs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No custom fields yet. Add things like “T-shirt size”, “Blood group”, or “Laptop asset tag”.
        </div>
      ) : (
        <div className="divide-y">
          {defs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <GripVertical className="size-4 shrink-0 text-muted-foreground/40" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{d.label}</span>
                  {d.required && <StatusPill label="Required" hue="amber" size="xs" />}
                  {!d.isActive && <StatusPill label="Inactive" hue="slate" size="xs" />}
                </div>
                <span className="text-[12px] text-muted-foreground">
                  {TYPE_LABELS[d.type] ?? d.type}{d.options ? ` · ${d.options}` : ""} · {d.key}
                </span>
              </div>
              <FieldDialog existing={d} />
              {d.isActive && <DeleteButton id={d.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-red-600"
      disabled={busy}
      onClick={async () => { setBusy(true); await deleteCustomFieldDef(id); setBusy(false); router.refresh(); }}
      title="Deactivate field"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}

function FieldDialog({ existing }: { existing?: FieldDef }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [label, setLabel] = React.useState(existing?.label ?? "");
  const [type, setType] = React.useState(existing?.type ?? "TEXT");
  const [options, setOptions] = React.useState(existing?.options ?? "");
  const [required, setRequired] = React.useState(existing?.required ?? false);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await upsertCustomFieldDef({
      id: existing?.id, label, type, options: options || undefined, required, isActive: existing?.isActive ?? true,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    if (!existing) { setLabel(""); setType("TEXT"); setOptions(""); setRequired(false); }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><Pencil className="size-4" /></Button>
        ) : (
          <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add field</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{existing ? "Edit field" : "New custom field"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Blood group" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {type === "SELECT" && (
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Choices (comma-separated)</Label>
              <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="A+, A-, B+, O+ ..." />
            </div>
          )}
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="size-4" />
            Required field
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
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
