"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCardIcon } from "lucide-react";
import { toast } from "sonner";

import { recordPayment } from "@/actions/payment.actions";
import type { PaymentMethod } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface RecordPaymentDialogProps {
  invoiceId: string;
  balanceDue: number;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "UPI", label: "UPI" },
];

// ============================================================
// Record Payment Dialog
// ============================================================

export function RecordPaymentDialog({
  invoiceId,
  balanceDue,
}: RecordPaymentDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(balanceDue.toString());
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (parsedAmount > balanceDue + 0.01) {
      toast.error(`Amount cannot exceed balance due (${formatINR(balanceDue)})`);
      return;
    }

    startTransition(async () => {
      const result = await recordPayment({
        invoiceId,
        amount: parsedAmount,
        method,
        transactionId: transactionId || undefined,
        notes: notes || undefined,
      });

      if (result.success) {
        toast.success("Payment recorded successfully");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to record payment");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CreditCardIcon className="mr-2 size-4" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Balance due: <span className="font-bold">{formatINR(balanceDue)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (INR) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={balanceDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <RadioGroup
              value={method}
              onValueChange={(val) => setMethod(val as PaymentMethod)}
              className="grid grid-cols-2 gap-2"
            >
              {PAYMENT_METHODS.map((pm) => (
                <div key={pm.value} className="flex items-center gap-2">
                  <RadioGroupItem value={pm.value} id={pm.value} />
                  <Label htmlFor={pm.value} className="cursor-pointer font-normal">
                    {pm.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Transaction ID */}
          <div className="space-y-2">
            <Label htmlFor="transactionId">Transaction ID (optional)</Label>
            <Input
              id="transactionId"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g. UTR number, cheque number"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment notes..."
              rows={2}
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
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
