"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Truck,
  PackageCheck,
  Undo2,
  XCircle,
  User,
  Car,
  CalendarClock,
  MapPin,
} from "lucide-react";

import {
  markDispatched,
  markDelivered,
  recordReturn,
  cancelDispatch,
  type DispatchDTO,
} from "@/actions/logistics.actions";
import { formatDate, formatDateTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/shared/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { statusHue, statusLabel } from "./status";

export function DispatchDetail({
  dispatch,
  canWrite,
}: {
  dispatch: DispatchDTO;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const d = dispatch;
  const route =
    d.fromLocation || d.toLocation
      ? `${d.fromLocation || "—"} → ${d.toLocation || "—"}`
      : "No route set";

  async function run<T>(fn: () => Promise<{ success: boolean; error?: string } & T>, ok: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.success) {
      toast.success(ok);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link href="/logistics">
          <ArrowLeft className="size-4" /> Back to logistics
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight tabular-nums">
              {d.dispatchNumber}
            </h1>
            <StatusPill label={statusLabel(d.status)} hue={statusHue(d.status)} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            {d.eventName ? (
              <>
                <span className="font-medium text-foreground">{d.eventName}</span>
                {d.eventDate ? <span>· {formatDate(d.eventDate)}</span> : null}
              </>
            ) : (
              route
            )}
          </p>
        </div>

        {/* Lifecycle buttons */}
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {d.status === "PLANNED" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => markDispatched(d.id), "Marked as dispatched.")}
              >
                <Truck className="size-4" /> Mark dispatched
              </Button>
            )}
            {d.status === "DISPATCHED" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(() => markDelivered(d.id), "Marked as delivered.")}
              >
                <PackageCheck className="size-4" /> Mark delivered
              </Button>
            )}
            {(d.status === "PLANNED" || d.status === "DISPATCHED") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={busy}>
                    <XCircle className="size-4" /> Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this dispatch?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {d.dispatchNumber} will be marked cancelled. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => run(() => cancelDispatch(d.id), "Dispatch cancelled.")}
                    >
                      Cancel dispatch
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>

      {/* Gate card */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <GateCell icon={<User className="size-4" />} label="Driver" value={d.driverName || "—"} />
        <GateCell icon={<Car className="size-4" />} label="Vehicle" value={d.vehicleNo || "—"} />
        <GateCell
          icon={<CalendarClock className="size-4" />}
          label="Scheduled"
          value={d.scheduledAt ? formatDateTime(d.scheduledAt) : "—"}
        />
      </div>

      {/* Lifecycle timeline */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 text-sm shadow-card sm:grid-cols-4">
        <Stamp label="Dispatched" value={d.dispatchedAt} />
        <Stamp label="Delivered" value={d.deliveredAt} />
        <Stamp label="Returned" value={d.returnedAt} />
        <Stamp label="Created" value={d.createdAt} />
      </div>

      {/* Items */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-center">Returnable</TableHead>
                <TableHead className="text-right">Returned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium text-foreground">{it.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                  <TableCell className="text-center">
                    {it.returnable ? (
                      <StatusPill label="Yes" hue="emerald" size="xs" noDot />
                    ) : (
                      <StatusPill label="No" hue="slate" size="xs" noDot />
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {it.returnable ? (
                      <span
                        className={
                          it.returnedQty >= it.quantity
                            ? "text-emerald-600"
                            : it.returnedQty > 0
                              ? "text-amber-600"
                              : "text-muted-foreground"
                        }
                      >
                        {it.returnedQty} / {it.quantity}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Record returns — only after delivery, while there's still gear out */}
      {canWrite &&
        (d.status === "DELIVERED" || d.status === "RETURNED") &&
        d.items.some((it) => it.returnable) && (
          <RecordReturns dispatch={d} disabled={busy || d.status === "RETURNED"} />
        )}

      {d.notes && (
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <h2 className="text-sm font-semibold">Notes</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{d.notes}</p>
        </div>
      )}
    </div>
  );
}

function GateCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function Stamp({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 tabular-nums">{value ? formatDateTime(value) : "—"}</div>
    </div>
  );
}

// ============================================================
// Record-returns control
// ============================================================
function RecordReturns({
  dispatch,
  disabled,
}: {
  dispatch: DispatchDTO;
  disabled: boolean;
}) {
  const router = useRouter();
  const returnable = dispatch.items.filter((it) => it.returnable);
  const [qty, setQty] = React.useState<Record<string, string>>(
    () => Object.fromEntries(returnable.map((it) => [it.id, String(it.returnedQty)])),
  );
  const [saving, setSaving] = React.useState(false);

  function clamp(itemId: string, max: number, raw: string) {
    const n = Math.max(0, Math.min(max, Number.parseInt(raw, 10) || 0));
    setQty((p) => ({ ...p, [itemId]: String(n) }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await recordReturn(
      dispatch.id,
      returnable.map((it) => ({
        itemId: it.id,
        returnedQty: Number.parseInt(qty[it.id] ?? "0", 10) || 0,
      })),
    );
    setSaving(false);
    if (res.success) {
      toast.success(
        res.data.status === "RETURNED"
          ? "All items returned — dispatch closed."
          : "Returns recorded.",
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Undo2 className="size-4 text-amber-600" />
        <h2 className="text-sm font-semibold">Record returns</h2>
      </div>
      <div className="space-y-2 p-4">
        {returnable.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <span className="flex-1 truncate text-sm">{it.name}</span>
            <span className="text-xs text-muted-foreground">of {it.quantity}</span>
            <Input
              type="number"
              min={0}
              max={it.quantity}
              value={qty[it.id] ?? "0"}
              onChange={(e) => clamp(it.id, it.quantity, e.target.value)}
              className="w-24"
              disabled={disabled || saving}
              aria-label={`Returned quantity for ${it.name}`}
            />
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSave} disabled={disabled || saving}>
            {saving ? "Saving…" : "Save returns"}
          </Button>
        </div>
      </div>
    </div>
  );
}
