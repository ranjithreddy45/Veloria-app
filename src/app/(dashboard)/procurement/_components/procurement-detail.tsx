"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  X,
  Truck,
  PackageCheck,
  Building2,
  CalendarClock,
  Boxes,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR } from "@/lib/utils";
import {
  approvePR,
  rejectPR,
  markOrdered,
  markReceived,
  type PRDTO,
} from "@/actions/procurement.actions";
import { PR_STATUS_LABEL, prStatusHue, fmtDate } from "./pr-format";

export function ProcurementDetail({
  pr,
  canWrite,
  currentUserId,
}: {
  pr: PRDTO;
  canWrite: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const isOwnPR = pr.requestedById === currentUserId;

  async function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.success) {
      toast.success(ok);
      router.refresh();
    } else {
      toast.error(res.error ?? "Something went wrong");
    }
  }

  async function handleReject() {
    setBusy(true);
    const res = await rejectPR(pr.id, reason.trim() || undefined);
    setBusy(false);
    if (res.success) {
      toast.success("Requisition rejected");
      setRejectOpen(false);
      setReason("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/procurement"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to procurement
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">{pr.prNumber}</span>
            <StatusPill label={PR_STATUS_LABEL[pr.status]} hue={prStatusHue(pr.status)} size="sm" />
          </div>
          <h1 className="text-h2 font-medium leading-[1.15] tracking-[-0.01em]">{pr.title}</h1>
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {pr.status === "PENDING" && (
              <>
                <Button
                  size="sm"
                  onClick={() => run(() => approvePR(pr.id), "Requisition approved")}
                  disabled={busy || isOwnPR}
                  title={isOwnPR ? "You can't approve your own requisition" : undefined}
                >
                  <Check className="size-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={busy}>
                  <X className="size-4" /> Reject
                </Button>
              </>
            )}
            {pr.status === "APPROVED" && (
              <Button
                size="sm"
                onClick={() => run(() => markOrdered(pr.id), "Marked as ordered")}
                disabled={busy}
              >
                <Truck className="size-4" /> Mark ordered
              </Button>
            )}
            {pr.status === "ORDERED" && (
              <Button
                size="sm"
                onClick={() => run(() => markReceived(pr.id), "Marked as received")}
                disabled={busy}
              >
                <PackageCheck className="size-4" /> Mark received
              </Button>
            )}
          </div>
        )}
      </div>

      {canWrite && pr.status === "PENDING" && isOwnPR && (
        <p className="text-xs text-muted-foreground">
          This is your own requisition — approval must come from another authorized approver (maker-checker).
        </p>
      )}

      {/* Meta */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <Meta icon={<Building2 className="size-4" />} label="Vendor" value={pr.vendorName ?? "—"} />
          <Meta icon={<Boxes className="size-4" />} label="Department" value={pr.department ?? "—"} />
          <Meta icon={<CalendarClock className="size-4" />} label="Needed by" value={fmtDate(pr.neededBy)} />
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Line items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 font-medium">Unit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unit price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Line total</th>
                  {pr.status === "RECEIVED" && <th className="px-4 py-2.5 font-medium">Received</th>}
                </tr>
              </thead>
              <tbody>
                {pr.items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{it.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{it.quantity}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{it.unit ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(it.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatINR(it.lineTotal)}</td>
                    {pr.status === "RECEIVED" && (
                      <td className="px-4 py-2.5">
                        <StatusPill label={it.received ? "Received" : "Pending"} hue={it.received ? "emerald" : "amber"} size="xs" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td className="px-4 py-3 text-sm font-semibold" colSpan={4}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-base font-semibold">
                    {formatINR(pr.totalAmount)}
                  </td>
                  {pr.status === "RECEIVED" && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {pr.notes && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-1.5 text-sm font-semibold">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{pr.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject requisition</DialogTitle>
            <DialogDescription>
              {pr.prNumber} will be rejected. Add a reason for the requester (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection…"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={busy}>
              {busy ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-meta font-medium text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
