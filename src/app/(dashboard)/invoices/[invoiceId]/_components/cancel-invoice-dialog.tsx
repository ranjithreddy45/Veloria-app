"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BanIcon, Loader2, CheckCircle2, XCircle } from "lucide-react";

import {
  requestInvoiceCancellation,
  approveInvoiceCancellation,
  rejectInvoiceCancellation,
} from "@/actions/invoice-cancel.actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ============================================================
// Request / one-step cancel dialog (header action)
// ============================================================

export function CancelInvoiceDialog({
  invoiceId,
  isManager,
}: {
  invoiceId: string;
  isManager: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const label = isManager ? "Cancel invoice" : "Request cancellation";

  function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Please enter a reason");
      return;
    }
    startTransition(async () => {
      const res = await requestInvoiceCancellation(invoiceId, reason.trim());
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(isManager ? "Invoice cancelled" : "Cancellation requested — awaiting manager approval");
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <BanIcon className="mr-2 size-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {isManager
              ? "This cancels the invoice and reverses its revenue in the ledger. This cannot be undone."
              : "This sends a cancellation request to a manager for approval."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Reason *</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this invoice being cancelled?"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Close
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-destructive text-white hover:brightness-105"
          >
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {isManager ? "Cancel invoice" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Pending-cancellation banner (Approve / Reject for managers)
// ============================================================

export function InvoiceCancellationBanner({
  invoiceId,
  isManager,
  reason,
  requestedByName,
}: {
  invoiceId: string;
  isManager: boolean;
  reason: string | null;
  requestedByName: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function act(kind: "approve" | "reject") {
    startTransition(async () => {
      const res =
        kind === "approve"
          ? await approveInvoiceCancellation(invoiceId)
          : await rejectInvoiceCancellation(invoiceId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(kind === "approve" ? "Invoice cancelled" : "Cancellation rejected");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm">
          <p className="font-semibold text-warning">Cancellation pending approval</p>
          {reason && <p className="mt-1 text-warning">Reason: {reason}</p>}
          {requestedByName && (
            <p className="mt-0.5 text-xs text-warning">Requested by {requestedByName}</p>
          )}
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => act("approve")} disabled={isPending} className="bg-destructive text-white hover:brightness-105">
              {isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <CheckCircle2 className="mr-1 size-4" />}
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => act("reject")} disabled={isPending}>
              <XCircle className="mr-1 size-4" />
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
