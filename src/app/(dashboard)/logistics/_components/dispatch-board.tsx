"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Truck,
  Plus,
  PackageCheck,
  Undo2,
  Boxes,
  Trash2,
  MapPin,
} from "lucide-react";

import { createDispatch, type DispatchDTO } from "@/actions/logistics.actions";
import { formatDate } from "@/lib/utils";

import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { statusHue, statusLabel } from "./status";

type EventOption = { id: string; label: string; date: string | null };

export function DispatchBoard({
  dispatches,
  events,
  canWrite,
}: {
  dispatches: DispatchDTO[];
  events: EventOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const stats = React.useMemo(() => {
    const planned = dispatches.filter((d) => d.status === "PLANNED").length;
    const inTransit = dispatches.filter((d) => d.status === "DISPATCHED").length;
    // Delivered orders with at least one returnable item not yet fully back.
    const pendingReturns = dispatches.filter(
      (d) =>
        d.status === "DELIVERED" &&
        d.items.some((it) => it.returnable && it.returnedQty < it.quantity),
    ).length;
    return { planned, inTransit, pendingReturns };
  }, [dispatches]);

  function routeLabel(d: DispatchDTO) {
    if (d.eventName) return d.eventName;
    const from = d.fromLocation || "—";
    const to = d.toLocation || "—";
    return `${from} → ${to}`;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Planned"
          value={stats.planned}
          accent="indigo"
          icon={<Boxes className="size-4" />}
          sub="Awaiting dispatch"
        />
        <StatTile
          label="In transit"
          value={stats.inTransit}
          accent="blue"
          icon={<Truck className="size-4" />}
          sub="Dispatched, not delivered"
        />
        <StatTile
          label="Pending returns"
          value={stats.pendingReturns}
          accent="amber"
          icon={<Undo2 className="size-4" />}
          sub="Delivered, items still out"
        />
      </div>

      {canWrite && (
        <div className="flex justify-end">
          <NewDispatchDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            events={events}
            trigger={
              <Button size="sm">
                <Plus className="size-4" /> New dispatch
              </Button>
            }
          />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {dispatches.length === 0 ? (
          <EmptyState
            icon={<Truck className="size-5" />}
            title="No dispatch orders yet"
            description="Plan your first equipment dispatch to start tracking gear out to events and back."
            action={
              canWrite ? (
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="size-4" /> New dispatch
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>DSP #</TableHead>
                  <TableHead>Event / Route</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Driver / Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.map((d) => (
                  <TableRow
                    key={d.id}
                    className="card-hover-tint transition-premium cursor-pointer"
                    onClick={() => router.push(`/logistics/${d.id}`)}
                  >
                    <TableCell className="font-medium tabular-nums text-foreground">
                      {d.dispatchNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        <span className="truncate">{routeLabel(d)}</span>
                      </div>
                      {d.eventDate && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(d.eventDate)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {d.scheduledAt ? formatDate(d.scheduledAt) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.driverName || "—"}
                      {d.vehicleNo ? (
                        <span className="text-[11px]"> · {d.vehicleNo}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={statusLabel(d.status)}
                        hue={statusHue(d.status)}
                        size="xs"
                      />
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

// ============================================================
// New-dispatch dialog
// ============================================================
type DraftItem = { name: string; quantity: string; returnable: boolean };

function NewDispatchDialog({
  open,
  onOpenChange,
  events,
  trigger,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  events: EventOption[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const [bookingId, setBookingId] = React.useState("");
  const [fromLocation, setFromLocation] = React.useState("");
  const [toLocation, setToLocation] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [driverName, setDriverName] = React.useState("");
  const [vehicleNo, setVehicleNo] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<DraftItem[]>([
    { name: "", quantity: "1", returnable: true },
  ]);

  function reset() {
    setBookingId("");
    setFromLocation("");
    setToLocation("");
    setScheduledAt("");
    setDriverName("");
    setVehicleNo("");
    setNotes("");
    setItems([{ name: "", quantity: "1", returnable: true }]);
  }

  function setItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addRow() {
    setItems((prev) => [...prev, { name: "", quantity: "1", returnable: true }]);
  }
  function removeRow(idx: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = items
      .map((it) => ({
        name: it.name.trim(),
        quantity: Math.max(1, Number.parseInt(it.quantity, 10) || 1),
        returnable: it.returnable,
      }))
      .filter((it) => it.name.length > 0);
    if (cleaned.length === 0) {
      toast.error("Add at least one item to dispatch.");
      return;
    }

    setSubmitting(true);
    const res = await createDispatch({
      bookingId: bookingId || undefined,
      fromLocation: fromLocation.trim() || undefined,
      toLocation: toLocation.trim() || undefined,
      scheduledAt: scheduledAt || undefined,
      driverName: driverName.trim() || undefined,
      vehicleNo: vehicleNo.trim() || undefined,
      notes: notes.trim() || undefined,
      items: cleaned,
    });
    setSubmitting(false);
    if (res.success) {
      toast.success("Dispatch order created.");
      reset();
      onOpenChange(false);
      router.push(`/logistics/${res.data.id}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New dispatch</DialogTitle>
            <DialogDescription>
              Plan an equipment dispatch. Link a confirmed booking, or just set a
              from/to route. Add the gear going out below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-4 pr-1">
            <div className="grid gap-1.5">
              <Label>Booking (optional)</Label>
              <Select
                value={bookingId || "__none"}
                onValueChange={(v) => setBookingId(v === "__none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No linked booking" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No linked booking</SelectItem>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="fromLocation">From</Label>
                <Input
                  id="fromLocation"
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  placeholder="e.g. Central Warehouse"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="toLocation">To</Label>
                <Input
                  id="toLocation"
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  placeholder="e.g. Grand Ballroom"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="scheduledAt">Scheduled</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="driverName">Driver</Label>
                <Input
                  id="driverName"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vehicleNo">Vehicle</Label>
                <Input
                  id="vehicleNo"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="Reg. no."
                />
              </div>
            </div>

            {/* Items */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="size-3.5" /> Add item
                </Button>
              </div>
              <div className="grid gap-2">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2"
                  >
                    <Input
                      value={it.name}
                      onChange={(e) => setItem(idx, { name: e.target.value })}
                      placeholder="Item name"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => setItem(idx, { quantity: e.target.value })}
                      className="w-20"
                      aria-label="Quantity"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch
                        checked={it.returnable}
                        onCheckedChange={(v) => setItem(idx, { returnable: v })}
                      />
                      Returnable
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-rose-600"
                      onClick={() => removeRow(idx)}
                      disabled={items.length <= 1}
                      aria-label="Remove item"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Handling instructions, contact at site, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create dispatch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
