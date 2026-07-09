"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  EyeIcon,
  MoreHorizontalIcon,
  BanIcon,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  requestPaymentCancellation,
  approvePaymentCancellation,
  rejectPaymentCancellation,
} from "@/actions/invoice-cancel.actions";

export interface PaymentRowActionsProps {
  paymentId: string;
  invoiceId: string;
  status: string;
  cancelPending: boolean;
  canCancel: boolean; // payments:update (maker)
  isManager: boolean; // payments:cancel (checker)
}

export function PaymentRowActions({
  paymentId,
  invoiceId,
  status,
  cancelPending,
  canCancel,
  isManager,
}: PaymentRowActionsProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const canRequest = canCancel && status === "COMPLETED" && !cancelPending;
  const canReview = isManager && cancelPending;

  function submitRequest() {
    if (!reason.trim()) {
      toast.error("Please enter a reason");
      return;
    }
    startTransition(async () => {
      const res = await requestPaymentCancellation(paymentId, reason.trim());
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(isManager ? "Payment cancelled" : "Cancellation requested — awaiting manager approval");
      setDialogOpen(false);
      setReason("");
      router.refresh();
    });
  }

  function review(kind: "approve" | "reject") {
    startTransition(async () => {
      const res =
        kind === "approve"
          ? await approvePaymentCancellation(paymentId)
          : await rejectPaymentCancellation(paymentId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(kind === "approve" ? "Payment cancelled" : "Cancellation rejected");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs">
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/invoices/${invoiceId}`}>
              <EyeIcon className="mr-2 size-4" />
              View Invoice
            </Link>
          </DropdownMenuItem>

          {canRequest && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-700"
                onSelect={(e) => {
                  e.preventDefault();
                  setDialogOpen(true);
                }}
              >
                <BanIcon className="mr-2 size-4" />
                {isManager ? "Cancel payment" : "Request cancellation"}
              </DropdownMenuItem>
            </>
          )}

          {canReview && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-700"
                onSelect={(e) => {
                  e.preventDefault();
                  review("approve");
                }}
              >
                <CheckCircle2 className="mr-2 size-4" />
                Approve cancellation
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  review("reject");
                }}
              >
                <XCircle className="mr-2 size-4" />
                Reject cancellation
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isManager ? "Cancel payment" : "Request cancellation"}</DialogTitle>
            <DialogDescription>
              {isManager
                ? "This cancels the payment, reverses its cash receipt in the ledger and restores the invoice balance."
                : "This sends a cancellation request to a manager for approval."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pay-cancel-reason">Reason *</Label>
            <Textarea
              id="pay-cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this payment being cancelled?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Close
            </Button>
            <Button onClick={submitRequest} disabled={isPending} className="bg-red-600 hover:bg-red-700">
              {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {isManager ? "Cancel payment" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
