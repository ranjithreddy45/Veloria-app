"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircleIcon,
  BanknoteIcon,
  XCircleIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import {
  approvePayout,
  markPayoutPaid,
  cancelPayout,
} from "@/actions/payout.actions";

// ============================================================
// Props
// ============================================================

interface PayoutActionsProps {
  payoutId: string;
  status: string;
}

// ============================================================
// PayoutActions Component
// ============================================================

export function PayoutActions({ payoutId, status }: PayoutActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState<string | null>(null);

  async function handleAction(
    action: "approve" | "markPaid" | "cancel"
  ) {
    setLoading(action);
    try {
      let result;
      switch (action) {
        case "approve":
          result = await approvePayout(payoutId);
          break;
        case "markPaid":
          result = await markPayoutPaid(payoutId);
          break;
        case "cancel":
          result = await cancelPayout(payoutId);
          break;
      }

      if (result.success) {
        toast.success(
          action === "approve"
            ? "Payout approved"
            : action === "markPaid"
              ? "Payout marked as paid"
              : "Payout cancelled"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Approve Button — only shown for PENDING payouts */}
      {status === "PENDING" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="default" disabled={!!loading}>
              {loading === "approve" ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="mr-2 size-4" />
              )}
              Approve
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve Payout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to approve this payout? This will move it
                to the approved status, ready for payment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleAction("approve")}>
                Approve
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Mark Paid Button — only shown for APPROVED payouts */}
      {status === "APPROVED" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="default" disabled={!!loading}>
              {loading === "markPaid" ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <BanknoteIcon className="mr-2 size-4" />
              )}
              Mark as Paid
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark Payout as Paid</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to mark this payout as paid? This will
                record the payment date and finalize the payout.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleAction("markPaid")}>
                Mark as Paid
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Cancel Button — shown for PENDING and APPROVED payouts */}
      {(status === "PENDING" || status === "APPROVED") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={!!loading}>
              {loading === "cancel" ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <XCircleIcon className="mr-2 size-4" />
              )}
              Cancel Payout
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Payout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this payout? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Payout</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction("cancel")}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Cancel Payout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
