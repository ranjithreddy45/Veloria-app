"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/shared/status-pill";
import {
  upsertGrade, toggleGrade, deleteGrade, type GradeListItem,
} from "@/actions/hr-grade.actions";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function ctcRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${inr.format(min)} – ${inr.format(max)}`;
  if (min != null) return `${inr.format(min)}+`;
  return `Up to ${inr.format(max as number)}`;
}

export function GradesAdmin({ grades }: { grades: GradeListItem[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
            <Layers className="size-4.5" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold">Pay grades</h3>
            <p className="text-[12.5px] text-muted-foreground">
              Grades and salary bands available when compensating employees.
            </p>
          </div>
        </div>
        <GradeDialog />
      </div>

      {grades.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No pay grades yet. Add your first grade to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[80px] text-right">Level</TableHead>
                <TableHead className="text-right">CTC range</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[96px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono text-[13px] font-medium">{g.code}</TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.level}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {ctcRange(g.minCtc, g.maxCtc)}
                  </TableCell>
                  <TableCell>
                    <ToggleStatus id={g.id} isActive={g.isActive} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <GradeDialog existing={g} />
                      <DeleteButton id={g.id} name={g.name} />
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

function ToggleStatus({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onToggle() {
    startTransition(async () => {
      const res = await toggleGrade(id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      className="inline-flex items-center gap-1 disabled:opacity-60"
      title={isActive ? "Set inactive" : "Set active"}
    >
      <StatusPill
        label={isActive ? "Active" : "Inactive"}
        hue={isActive ? "emerald" : "slate"}
        size="xs"
      />
    </button>
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await deleteGrade(id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete pay grade</DialogTitle>
        </DialogHeader>
        <p className="py-2 text-sm text-muted-foreground">
          Delete the grade <span className="font-medium text-foreground">{name}</span>? This can&apos;t be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="size-4 animate-spin" />} Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GradeDialog({ existing }: { existing?: GradeListItem }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [code, setCode] = React.useState(existing?.code ?? "");
  const [name, setName] = React.useState(existing?.name ?? "");
  const [level, setLevel] = React.useState(String(existing?.level ?? 0));
  const [minCtc, setMinCtc] = React.useState(existing?.minCtc != null ? String(existing.minCtc) : "");
  const [maxCtc, setMaxCtc] = React.useState(existing?.maxCtc != null ? String(existing.maxCtc) : "");
  const [isActive, setIsActive] = React.useState(existing?.isActive ?? true);

  function reset() {
    setCode(existing?.code ?? "");
    setName(existing?.name ?? "");
    setLevel(String(existing?.level ?? 0));
    setMinCtc(existing?.minCtc != null ? String(existing.minCtc) : "");
    setMaxCtc(existing?.maxCtc != null ? String(existing.maxCtc) : "");
    setIsActive(existing?.isActive ?? true);
  }

  function parseCtc(v: string): number | null {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  function onSave() {
    startTransition(async () => {
      const res = await upsertGrade({
        id: existing?.id,
        code,
        name,
        level: Number(level) || 0,
        minCtc: parseCtc(minCtc),
        maxCtc: parseCtc(maxCtc),
        isActive,
        order: existing?.order ?? 0,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      if (!existing) reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" title="Edit">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" /> Add grade
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit pay grade" : "New pay grade"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. L3" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Level</Label>
              <Input
                type="number"
                min={0}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Senior Executive" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Min CTC (₹)</Label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={minCtc}
                onChange={(e) => setMinCtc(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Max CTC (₹)</Label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={maxCtc}
                onChange={(e) => setMaxCtc(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <label className="flex items-center justify-between gap-2 text-[13px]">
            <span>Active</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
