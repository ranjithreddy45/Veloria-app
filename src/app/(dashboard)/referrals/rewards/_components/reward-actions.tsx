"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, CheckCircleIcon, BanknoteIcon } from "lucide-react";
import { toast } from "sonner";

import {
  approveReferralReward,
  payReferralReward,
} from "@/actions/referral-engine.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ============================================================
// Approve Reward Button
// ============================================================

export function ApproveRewardButton({ rewardId }: { rewardId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      const result = await approveReferralReward(rewardId);
      if (result.success) {
        toast.success("Reward approved successfully");
      } else {
        toast.error(result.error || "Failed to approve reward");
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleApprove}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2Icon className="mr-2 size-4 animate-spin" />
      ) : (
        <CheckCircleIcon className="mr-2 size-4" />
      )}
      Approve
    </Button>
  );
}

// ============================================================
// Mark Paid Button (with payment ref dialog)
// ============================================================

export function MarkPaidButton({ rewardId }: { rewardId: string }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");

  function handlePay() {
    if (!paymentRef.trim()) {
      toast.error("Payment reference is required");
      return;
    }

    startTransition(async () => {
      const result = await payReferralReward(rewardId, paymentRef.trim());
      if (result.success) {
        toast.success("Reward marked as paid");
        setOpen(false);
        setPaymentRef("");
      } else {
        toast.error(result.error || "Failed to mark as paid");
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <BanknoteIcon className="mr-2 size-4" />
        Mark Paid
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Reward as Paid</DialogTitle>
            <DialogDescription>
              Enter the payment reference number to mark this reward as paid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label
                htmlFor="paymentRef"
                className="text-sm font-medium leading-none"
              >
                Payment Reference
              </label>
              <Input
                id="paymentRef"
                placeholder="e.g. TXN-123456"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handlePay} disabled={isPending}>
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
