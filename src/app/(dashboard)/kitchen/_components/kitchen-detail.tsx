"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  X,
  Pencil,
  IndianRupee,
  Users,
  Receipt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatINR } from "@/lib/utils";
import {
  type KitchenPlanDTO,
  type KitchenPlanItemDTO,
  updateKitchenPlan,
  addPlanItem,
  updatePlanItem,
  deletePlanItem,
} from "@/actions/kitchen.actions";
import { STATUS_LABEL, statusHue, fmtEventDate } from "./kitchen-format";

const STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED"] as const;

export function KitchenDetail({
  plan,
  canWrite,
}: {
  plan: KitchenPlanDTO;
  canWrite: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/kitchen"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> All plans
          </Link>
          {plan.beoId && (
            <Link
              href={`/beo/${plan.beoId}`}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              View Function Sheet (BEO)
            </Link>
          )}
        </div>
      </div>

      <Header plan={plan} canWrite={canWrite} onChange={refresh} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IndentTable plan={plan} canWrite={canWrite} onChange={refresh} />
        </div>
        <div className="flex flex-col gap-5">
          <CostSummary plan={plan} />
          <ActualsCard plan={plan} canWrite={canWrite} onChange={refresh} />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Header — event title, editable covers, status control
// ------------------------------------------------------------
function Header({
  plan,
  canWrite,
  onChange,
}: {
  plan: KitchenPlanDTO;
  canWrite: boolean;
  onChange: () => void;
}) {
  const [editingCovers, setEditingCovers] = React.useState(false);
  const [covers, setCovers] = React.useState(String(plan.covers));
  const [busy, setBusy] = React.useState(false);

  async function saveCovers() {
    const n = Number(covers);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid cover count");
      return;
    }
    setBusy(true);
    const res = await updateKitchenPlan(plan.id, { covers: n });
    setBusy(false);
    if (res.success) {
      toast.success("Covers updated");
      setEditingCovers(false);
      onChange();
    } else toast.error(res.error);
  }

  async function changeStatus(status: string) {
    setBusy(true);
    const res = await updateKitchenPlan(plan.id, { status });
    setBusy(false);
    if (res.success) {
      toast.success("Status updated");
      onChange();
    } else toast.error(res.error);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-medium tracking-[-0.01em]">
            {plan.eventName ?? "Untitled event"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {fmtEventDate(plan.eventDate)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            {editingCovers && canWrite ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  value={covers}
                  onChange={(e) => setCovers(e.target.value)}
                  className="h-8 w-24"
                />
                <Button size="icon" variant="ghost" className="size-8" onClick={saveCovers} disabled={busy}>
                  <Check className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => {
                    setCovers(String(plan.covers));
                    setEditingCovers(false);
                  }}
                  disabled={busy}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 text-sm font-medium tabular-nums",
                  canWrite && "hover:underline",
                )}
                onClick={() => canWrite && setEditingCovers(true)}
                disabled={!canWrite}
              >
                {plan.covers} covers
                {canWrite && <Pencil className="size-3 text-muted-foreground" />}
              </button>
            )}
          </div>

          {canWrite ? (
            <Select value={plan.status} onValueChange={changeStatus} disabled={busy}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <StatusPill label={STATUS_LABEL[plan.status] ?? plan.status} hue={statusHue(plan.status)} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Indent / BOM table
// ------------------------------------------------------------
function IndentTable({
  plan,
  canWrite,
  onChange,
}: {
  plan: KitchenPlanDTO;
  canWrite: boolean;
  onChange: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Ingredient indent (BOM)</h2>
          <span className="text-xs text-muted-foreground">
            {plan.items.length} item{plan.items.length === 1 ? "" : "s"}
          </span>
        </div>

        {plan.items.length === 0 && !canWrite ? (
          <div className="p-8">
            <EmptyState
              icon={<Receipt className="size-6" />}
              title="No ingredients yet"
              description="The indent is empty."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Ingredient</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Est. unit cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Line total</th>
                  {canWrite && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {plan.items.map((it) => (
                  <ItemRow key={it.id} item={it} canWrite={canWrite} onChange={onChange} />
                ))}
                {canWrite && <AddItemRow planId={plan.id} onChange={onChange} />}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemRow({
  item,
  canWrite,
  onChange,
}: {
  item: KitchenPlanItemDTO;
  canWrite: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    name: item.name,
    category: item.category ?? "",
    quantity: String(item.quantity),
    unit: item.unit ?? "",
    estUnitCost: String(item.estUnitCost),
  });

  async function save() {
    if (!form.name.trim()) {
      toast.error("Ingredient name is required");
      return;
    }
    setBusy(true);
    const res = await updatePlanItem(item.id, {
      name: form.name,
      category: form.category,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      estUnitCost: Number(form.estUnitCost) || 0,
    });
    setBusy(false);
    if (res.success) {
      toast.success("Ingredient updated");
      setEditing(false);
      onChange();
    } else toast.error(res.error);
  }

  async function remove() {
    setBusy(true);
    const res = await deletePlanItem(item.id);
    setBusy(false);
    if (res.success) {
      toast.success("Ingredient removed");
      onChange();
    } else toast.error(res.error);
  }

  if (editing && canWrite) {
    return (
      <tr className="border-b last:border-0">
        <td className="px-4 py-2">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8" />
        </td>
        <td className="px-4 py-2">
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-8" />
        </td>
        <td className="px-4 py-2">
          <Input
            type="number"
            min={0}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="h-8 text-right"
          />
        </td>
        <td className="px-4 py-2">
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-8" />
        </td>
        <td className="px-4 py-2">
          <Input
            type="number"
            min={0}
            value={form.estUnitCost}
            onChange={(e) => setForm({ ...form, estUnitCost: e.target.value })}
            className="h-8 text-right"
          />
        </td>
        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
          {formatINR((Number(form.quantity) || 0) * (Number(form.estUnitCost) || 0))}
        </td>
        <td className="px-4 py-2">
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" className="size-8" onClick={save} disabled={busy}>
              <Check className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(false)} disabled={busy}>
              <X className="size-4" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group border-b last:border-0 transition-colors hover:bg-muted/40">
      <td className="px-4 py-2.5 font-medium">{item.name}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{item.category ?? "—"}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{item.quantity}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{item.unit ?? "—"}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(item.estUnitCost)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatINR(item.lineTotal)}</td>
      {canWrite && (
        <td className="px-4 py-2.5">
          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(true)} disabled={busy}>
              <Pencil className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8 text-rose-600" onClick={remove} disabled={busy}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

function AddItemRow({ planId, onChange }: { planId: string; onChange: () => void }) {
  const empty = { name: "", category: "", quantity: "", unit: "", estUnitCost: "" };
  const [form, setForm] = React.useState(empty);
  const [busy, setBusy] = React.useState(false);

  async function add() {
    if (!form.name.trim()) {
      toast.error("Ingredient name is required");
      return;
    }
    setBusy(true);
    const res = await addPlanItem(planId, {
      name: form.name,
      category: form.category,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      estUnitCost: Number(form.estUnitCost) || 0,
    });
    setBusy(false);
    if (res.success) {
      toast.success("Ingredient added");
      setForm(empty);
      onChange();
    } else toast.error(res.error);
  }

  const lineTotal = (Number(form.quantity) || 0) * (Number(form.estUnitCost) || 0);

  return (
    <tr className="border-t bg-muted/20">
      <td className="px-4 py-2">
        <Input
          placeholder="Add ingredient…"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-8"
        />
      </td>
      <td className="px-4 py-2">
        <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-8" />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          className="h-8 text-right"
        />
      </td>
      <td className="px-4 py-2">
        <Input placeholder="kg" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-8" />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={form.estUnitCost}
          onChange={(e) => setForm({ ...form, estUnitCost: e.target.value })}
          className="h-8 text-right"
        />
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
        {formatINR(lineTotal)}
      </td>
      <td className="px-4 py-2">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={add} disabled={busy}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ------------------------------------------------------------
// Cost summary card — est food cost, cost/cover, vs ₹/plate benchmark
// ------------------------------------------------------------
function CostSummary({ plan }: { plan: KitchenPlanDTO }) {
  const benchmark = plan.perPlatePrice; // quote's ₹/plate, if available
  const margin =
    benchmark != null && benchmark > 0
      ? Math.round(((benchmark - plan.perCoverCost) / benchmark) * 1000) / 10
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Cost summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Est. food cost"
            value={formatINR(plan.estFoodCost)}
            accent="emerald"
            icon={<IndianRupee className="size-4" />}
          />
          <StatTile
            label="Cost / cover"
            value={formatINR(plan.perCoverCost)}
            accent="violet"
            icon={<Users className="size-4" />}
          />
        </div>

        <div className="rounded-lg border p-3 text-sm">
          {benchmark != null ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Quote ₹/plate</span>
              <span className="flex items-center gap-2 tabular-nums font-medium">
                {formatINR(benchmark)}
                {margin != null && (
                  <StatusPill
                    label={`${margin >= 0 ? "+" : ""}${margin}% margin`}
                    hue={margin >= 0 ? "emerald" : "rose"}
                    size="xs"
                    noDot
                  />
                )}
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No quoted ₹/plate on the booking — showing computed cost only.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Actuals card — record post-event actual food cost + variance
// ------------------------------------------------------------
function ActualsCard({
  plan,
  canWrite,
  onChange,
}: {
  plan: KitchenPlanDTO;
  canWrite: boolean;
  onChange: () => void;
}) {
  const [actual, setActual] = React.useState(
    plan.actualFoodCost ? String(plan.actualFoodCost) : "",
  );
  const [notes, setNotes] = React.useState(plan.notes ?? "");
  const [busy, setBusy] = React.useState(false);

  const actualNum = Number(actual) || 0;
  const variance = Math.round((actualNum - plan.estFoodCost) * 100) / 100;
  const overBudget = variance > 0;

  async function save() {
    if (actualNum < 0) {
      toast.error("Actual food cost cannot be negative");
      return;
    }
    setBusy(true);
    const res = await updateKitchenPlan(plan.id, {
      actualFoodCost: actualNum,
      notes,
    });
    setBusy(false);
    if (res.success) {
      toast.success("Actuals saved");
      onChange();
    } else toast.error(res.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Post-event actuals</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="actual-food-cost">Actual food cost</Label>
          <Input
            id="actual-food-cost"
            type="number"
            min={0}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            placeholder="0"
            disabled={!canWrite}
          />
        </div>

        {actual !== "" && (
          <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span className="text-muted-foreground">Variance vs estimate</span>
            <StatusPill
              label={`${overBudget ? "+" : ""}${formatINR(variance)}`}
              hue={overBudget ? "rose" : "emerald"}
              size="sm"
              noDot
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kitchen-notes">Notes</Label>
          <Textarea
            id="kitchen-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Production / costing notes…"
            rows={3}
            disabled={!canWrite}
          />
        </div>

        {canWrite && (
          <Button onClick={save} disabled={busy} className="self-start">
            {busy ? "Saving…" : "Save actuals"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
