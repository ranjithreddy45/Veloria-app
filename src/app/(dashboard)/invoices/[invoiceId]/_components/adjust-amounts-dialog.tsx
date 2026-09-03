"use client";

// Finance correction dialog — edit the invoice total and/or paid amount on a
// non-draft invoice, with a mandatory reason. The action logs before/after and
// appends the audit line to the invoice notes.

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, SlidersHorizontal } from "lucide-react";

import { adjustInvoiceAmounts } from "@/actions/invoice.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function AdjustAmountsDialog({
  invoiceId,
  totalAmount,
  paidAmount,
}: {
  invoiceId: string;
  totalAmount: number;
  paidAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [total, setTotal] = React.useState(String(totalAmount));
  const [paid, setPaid] = React.useState(String(paidAmount));
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    const t = Number(total);
    const p = Number(paid);
    if (!Number.isFinite(t) || t < 0) return toast.error("Enter a valid invoice total.");
    if (!Number.isFinite(p) || p < 0) return toast.error("Enter a valid paid amount.");
    if (!reason.trim()) return toast.error("A reason for the correction is required.");
    startTransition(async () => {
      const res = await adjustInvoiceAmounts(invoiceId, {
        totalAmount: t,
        paidAmount: p,
        reason,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Amounts updated — balance due is now ₹${res.data.balanceDue.toLocaleString("en-IN")}.`
      );
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="mr-2 size-4" />
          Adjust amounts
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust invoice amounts</DialogTitle>
          <DialogDescription>
            A correction mechanism for the total and the amount received. Line
            items and GST rows are not changed — the reason is recorded on the
            invoice and in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adj-total">Invoice total (₹)</Label>
              <Input
                id="adj-total"
                type="number"
                min={0}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-paid">Amount paid (₹)</Label>
              <Input
                id="adj-paid"
                type="number"
                min={0}
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">Reason (required)</Label>
            <Textarea
              id="adj-reason"
              rows={2}
              placeholder="e.g. Negotiated waiver of ₹5,000 on decor; cash received not yet recorded"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
