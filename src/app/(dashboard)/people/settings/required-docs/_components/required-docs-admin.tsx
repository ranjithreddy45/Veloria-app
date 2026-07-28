"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  upsertRequiredDocType,
  toggleRequiredDocType,
  deleteRequiredDocType,
  type RequiredDocTypeRow,
} from "@/actions/hr-required-docs.actions";

// appliesTo option list — inline here so the server action file exports only
// async functions ("use server" constraint).
const APPLIES_TO_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "All employees" },
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
];
const APPLIES_TO_LABEL: Record<string, string> = Object.fromEntries(
  APPLIES_TO_OPTIONS.map((o) => [o.value, o.label])
);

interface Overview {
  employeesWithMissing: number;
  scanned: number;
  capped: boolean;
  cap: number;
}

export function RequiredDocsAdmin({
  types,
  overview,
}: {
  types: RequiredDocTypeRow[];
  overview: Overview;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-200/70 bg-blue-50/60 p-3.5 text-[12.5px] leading-relaxed text-blue-900 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Missing mandatory documents are surfaced on the employee profile and
          gate activation — an employee can't be moved to Active until every
          mandatory document that applies to their employment type is on file.
          {overview.employeesWithMissing > 0 && (
            <>
              {" "}
              <span className="font-semibold">
                {overview.employeesWithMissing}
              </span>{" "}
              active employee
              {overview.employeesWithMissing === 1 ? " is" : "s are"} currently
              missing at least one mandatory document
              {overview.capped ? ` (of the first ${overview.cap} scanned)` : ""}.
            </>
          )}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold">Required document types</h3>
            <p className="text-[12.5px] text-muted-foreground">
              The documents every employee must have on file. Scope each to an
              employment type, or apply to all.
            </p>
          </div>
          <DocTypeDialog />
        </div>

        {types.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No required documents yet. Add things like “PAN Card”, “Aadhaar”,
            “Offer Letter”, or “Signed Contract”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Mandatory</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[92px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id} className={t.active ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <StatusPill
                        label={APPLIES_TO_LABEL[t.appliesTo] ?? t.appliesTo}
                        hue={t.appliesTo === "ALL" ? "blue" : "slate"}
                        size="xs"
                      />
                    </TableCell>
                    <TableCell>
                      {t.mandatory ? (
                        <StatusPill label="Mandatory" hue="amber" size="xs" />
                      ) : (
                        <StatusPill label="Optional" hue="slate" size="xs" />
                      )}
                    </TableCell>
                    <TableCell>
                      <ActiveToggle id={t.id} active={t.active} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-0.5">
                        <DocTypeDialog existing={t} />
                        <DeleteButton id={t.id} name={t.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
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
      onCheckedChange={() =>
        startTransition(async () => {
          const res = await toggleRequiredDocType(id);
          if (!res.success) {
            toast.error(res.error);
            return;
          }
          router.refresh();
        })
      }
      aria-label={active ? "Deactivate document type" : "Activate document type"}
    />
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-destructive"
      disabled={pending}
      title="Delete document type"
      onClick={() =>
        startTransition(async () => {
          if (!window.confirm(`Delete “${name}”? This can't be undone.`)) return;
          const res = await deleteRequiredDocType(id);
          if (!res.success) {
            toast.error(res.error);
            return;
          }
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}

function DocTypeDialog({ existing }: { existing?: RequiredDocTypeRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState(existing?.name ?? "");
  const [appliesTo, setAppliesTo] = React.useState(existing?.appliesTo ?? "ALL");
  const [mandatory, setMandatory] = React.useState(existing?.mandatory ?? true);
  const [order, setOrder] = React.useState(String(existing?.order ?? 0));

  function reset() {
    if (existing) return;
    setName("");
    setAppliesTo("ALL");
    setMandatory(true);
    setOrder("0");
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await upsertRequiredDocType({
        id: existing?.id,
        name,
        appliesTo,
        mandatory,
        order: Number.parseInt(order, 10) || 0,
      });
      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setError(null);
      }}
    >
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" /> Add document type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit document type" : "New required document"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Document name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PAN Card"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Applies to</Label>
            <Select value={appliesTo} onValueChange={setAppliesTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLIES_TO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Sort order</Label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="w-28"
            />
          </div>
          <label className="flex items-center justify-between rounded-lg border p-2.5">
            <span className="text-[13px]">
              Mandatory
              <span className="block text-[11.5px] text-muted-foreground">
                Blocks employee activation until on file.
              </span>
            </span>
            <Switch checked={mandatory} onCheckedChange={setMandatory} />
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
