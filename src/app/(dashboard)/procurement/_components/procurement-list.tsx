"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart, ClipboardList, IndianRupee, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { formatINR } from "@/lib/utils";
import {
  getVendorOptions,
  createPurchaseRequisition,
  type PRDTO,
} from "@/actions/procurement.actions";
import { PR_STATUS_LABEL, prStatusHue, fmtDate } from "./pr-format";

const NO_VENDOR = "__none__";

export function ProcurementList({
  requisitions,
  canWrite,
  presetBooking,
}: {
  requisitions: PRDTO[];
  canWrite: boolean;
  presetBooking?: { id: string; label: string } | null;
}) {
  const open = requisitions.filter((r) => r.status !== "RECEIVED" && r.status !== "REJECTED").length;
  const pending = requisitions.filter((r) => r.status === "PENDING").length;

  const now = new Date();
  const valueThisMonth = requisitions
    .filter((r) => {
      const d = new Date(r.createdAt);
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    })
    .reduce((a, r) => a + r.totalAmount, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Open requisitions" value={open} accent="indigo" icon={<ClipboardList className="size-4" />} />
        <StatTile label="Pending approval" value={pending} accent="amber" icon={<Clock className="size-4" />} />
        <StatTile
          label="Value this month"
          value={formatINR(valueThisMonth)}
          accent="emerald"
          icon={<IndianRupee className="size-4" />}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">All requisitions</h2>
            {canWrite && <NewRequisitionDialog presetBooking={presetBooking ?? null} />}
          </div>

          {requisitions.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<ShoppingCart className="size-6" />}
                title="No requisitions yet"
                description={
                  canWrite
                    ? "Raise your first purchase requisition to get started."
                    : "No purchase requisitions have been raised yet."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">PR #</th>
                    <th className="px-4 py-2.5 font-medium">Title</th>
                    <th className="px-4 py-2.5 font-medium">Vendor</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                    <th className="px-4 py-2.5 font-medium">Needed by</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((r) => (
                    <tr key={r.id} className="group border-b last:border-0 transition-colors hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/procurement/${r.id}`} className="font-medium tabular-nums hover:underline">
                          {r.prNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/procurement/${r.id}`} className="hover:underline">
                          {r.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.vendorName ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill label={PR_STATUS_LABEL[r.status]} hue={prStatusHue(r.status)} size="xs" />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatINR(r.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.neededBy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type DraftItem = { name: string; quantity: string; unit: string; unitPrice: string };

function emptyItem(): DraftItem {
  return { name: "", quantity: "1", unit: "", unitPrice: "0" };
}

function NewRequisitionDialog({ presetBooking }: { presetBooking?: { id: string; label: string } | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [vendors, setVendors] = React.useState<{ id: string; name: string }[]>([]);
  const [loadingVendors, setLoadingVendors] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [title, setTitle] = React.useState(presetBooking ? `Procurement — ${presetBooking.label}` : "");
  const [vendorId, setVendorId] = React.useState(NO_VENDOR);
  const [department, setDepartment] = React.useState("");
  const [neededBy, setNeededBy] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<DraftItem[]>([emptyItem()]);

  // Auto-open + prefill when arriving from a booking ("Raise Procurement").
  React.useEffect(() => {
    if (presetBooking) setOpen(true);
  }, [presetBooking]);

  React.useEffect(() => {
    if (!open || vendors.length > 0) return;
    setLoadingVendors(true);
    getVendorOptions()
      .then((res) => {
        if (res.success) setVendors(res.data);
        else toast.error(res.error);
      })
      .finally(() => setLoadingVendors(false));
  }, [open, vendors.length]);

  const liveTotal = items.reduce((a, it) => {
    const q = Number(it.quantity);
    const p = Number(it.unitPrice);
    return a + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
  }, 0);

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }
  function removeItem(idx: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function reset() {
    setTitle("");
    setVendorId(NO_VENDOR);
    setDepartment("");
    setNeededBy("");
    setNotes("");
    setItems([emptyItem()]);
  }

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const cleaned = items.filter((it) => it.name.trim());
    if (cleaned.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    for (const it of cleaned) {
      if (!(Number(it.quantity) > 0)) {
        toast.error(`Quantity must be > 0 for "${it.name}"`);
        return;
      }
      if (Number(it.unitPrice) < 0) {
        toast.error(`Unit price can't be negative for "${it.name}"`);
        return;
      }
    }

    setSubmitting(true);
    const res = await createPurchaseRequisition({
      title: title.trim(),
      bookingId: presetBooking?.id ?? null,
      vendorId: vendorId === NO_VENDOR ? null : vendorId,
      department: department.trim() || null,
      neededBy: neededBy || null,
      notes: notes.trim() || null,
      items: cleaned.map((it) => ({
        name: it.name.trim(),
        quantity: Number(it.quantity),
        unit: it.unit.trim() || null,
        unitPrice: Number(it.unitPrice),
      })),
    });
    setSubmitting(false);

    if (res.success) {
      toast.success("Requisition raised");
      setOpen(false);
      reset();
      router.push(`/procurement/${res.data.id}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New requisition
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New purchase requisition</DialogTitle>
          <DialogDescription>
            Capture what you need, an optional vendor, and the line items. It will route for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-1 pr-1">
          {presetBooking && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
              Linked to event <span className="font-medium">{presetBooking.label}</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pr-title">Title</Label>
            <Input
              id="pr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 décor consumables"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId} disabled={loadingVendors}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingVendors ? "Loading…" : "Select vendor (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VENDOR}>No vendor</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pr-dept">Department</Label>
              <Input
                id="pr-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Operations"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pr-needed">Needed by</Label>
            <Input
              id="pr-needed"
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
              className="sm:w-1/2"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="size-3.5" /> Add item
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 items-end gap-2 rounded-lg border bg-muted/30 p-2">
                  <div className="col-span-12 sm:col-span-5">
                    <Label className="text-meta text-muted-foreground">Name</Label>
                    <Input
                      value={it.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      placeholder="Item"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Label className="text-meta text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Label className="text-meta text-muted-foreground">Unit</Label>
                    <Input
                      value={it.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      placeholder="pcs"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-meta text-muted-foreground">Unit price</Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      aria-label="Remove item"
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="tabular-nums font-semibold">{formatINR(liveTotal)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pr-notes">Notes</Label>
            <Textarea
              id="pr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the approver should know…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? "Raising…" : "Raise requisition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
