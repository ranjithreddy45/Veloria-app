"use client";

import * as React from "react";
import { toast } from "sonner";
import { Calculator, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { calculateCommission } from "@/actions/commission.actions";
import { formatINR } from "@/lib/utils";

// ============================================================
// Calculate Commission dialog — wires the calculateCommission()
// server action to the UI. The action derives the invoice base
// from the chosen booking server-side, so the user only picks a
// rule, a beneficiary, and a booking.
// ============================================================

export type RuleOption = {
  id: string;
  name: string;
  percentage: number;
  isActive: boolean;
};

export type UserOption = {
  id: string;
  name: string | null;
  email: string | null;
};

export type BookingOption = {
  id: string;
  bookingNumber: string | null;
  eventName: string | null;
  totalAmount: number;
};

interface CommissionCalcDialogProps {
  rules: RuleOption[];
  users: UserOption[];
  bookings: BookingOption[];
}

export function CommissionCalcDialog({
  rules,
  users,
  bookings,
}: CommissionCalcDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const [ruleId, setRuleId] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [bookingId, setBookingId] = React.useState("");

  // Only active rules can produce an entry (the action rejects inactive ones).
  const activeRules = React.useMemo(
    () => rules.filter((r) => r.isActive),
    [rules],
  );

  const reset = () => {
    setRuleId("");
    setUserId("");
    setBookingId("");
  };

  const handleCalculate = () => {
    if (!ruleId || !userId || !bookingId) {
      toast.error("Select a rule, beneficiary, and booking.");
      return;
    }

    const booking = bookings.find((b) => b.id === bookingId);
    // The action derives the commission base from the booking server-side and
    // never trusts a client-supplied amount, so we don't send one. We still
    // guard the UI against picking a booking with no positive total.
    const invoiceAmount = booking ? Number(booking.totalAmount) : 0;
    if (!(invoiceAmount > 0)) {
      toast.error("Selected booking has no positive total amount.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await calculateCommission({
          ruleId,
          userId,
          bookingId,
        });

        if (result.success) {
          toast.success(
            `Commission of ${formatINR(result.data.commissionAmount)} created.`,
          );
          reset();
          setOpen(false);
        } else {
          toast.error(result.error ?? "Failed to calculate commission.");
        }
      } catch (err) {
        console.error("[CALCULATE_COMMISSION_UI_ERROR]", err);
        toast.error("Something went wrong while calculating the commission.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700">
          <Calculator className="size-4" />
          Calculate Commission
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Calculate Commission</DialogTitle>
          <DialogDescription>
            Create a commission entry for a booking. The payout is derived from
            the selected rule and the booking total.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calc-rule">Commission Rule *</Label>
            <Select value={ruleId} onValueChange={setRuleId}>
              <SelectTrigger id="calc-rule">
                <SelectValue placeholder="Select an active rule" />
              </SelectTrigger>
              <SelectContent>
                {activeRules.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No active rules
                  </div>
                ) : (
                  activeRules.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.percentage}%)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calc-user">Beneficiary *</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="calc-user">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.email ?? u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calc-booking">Booking *</Label>
            <Select value={bookingId} onValueChange={setBookingId}>
              <SelectTrigger id="calc-booking">
                <SelectValue placeholder="Select a booking" />
              </SelectTrigger>
              <SelectContent>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {(b.bookingNumber ?? b.eventName ?? b.id.slice(0, 8)) +
                      ` — ${formatINR(Number(b.totalAmount))}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCalculate}
            disabled={isPending}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Calculating...
              </>
            ) : (
              "Create Entry"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
