"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, Loader2Icon } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createVendorBill } from "@/actions/vendor-bill.actions";

// ============================================================
// Types
// ============================================================

export type BillableLine = {
  bookingVendorId: string;
  vendorId: string;
  vendorName: string;
  role: string | null;
  agreedRate: number;
  bookingId: string;
  bookingNumber: string;
  eventName: string;
  eventDate: string | Date | null;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const EXPENSE_OPTIONS: { value: string; label: string }[] = [
  { value: "5010", label: "Catering (5010)" },
  { value: "5020", label: "Décor (5020)" },
  { value: "5030", label: "Staffing (5030)" },
  { value: "5040", label: "AV (5040)" },
  { value: "5230", label: "Procurement (5230)" },
];

type Mode = "line" | "manual";

// ============================================================
// NewBillButton
// ============================================================

export function NewBillButton({ billable }: { billable: BillableLine[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("line");
  const [pending, startTransition] = React.useTransition();

  // Mode A — from an agreed vendor line
  const [bookingVendorId, setBookingVendorId] = React.useState("");

  // Mode B — manual
  const [vendorId, setVendorId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [expenseCode, setExpenseCode] = React.useState("5230");
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Distinct vendors derived from the billable lines (manual picker source).
  const vendorOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const l of billable) if (!map.has(l.vendorId)) map.set(l.vendorId, l.vendorName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [billable]);

  function reset() {
    setBookingVendorId("");
    setVendorId("");
    setAmount("");
    setExpenseCode("5230");
    setDescription("");
    setNotes("");
  }

  function submit() {
    if (mode === "line") {
      if (!bookingVendorId) {
        toast.error("Pick an agreed vendor line.");
        return;
      }
      startTransition(async () => {
        const res = await createVendorBill({ bookingVendorId });
        if (res.success) {
          toast.success("Vendor bill created");
          setOpen(false);
          reset();
          router.refresh();
        } else {
          toast.error(res.error);
        }
      });
      return;
    }

    // manual
    const amt = Number(amount);
    if (!vendorId) {
      toast.error("Pick a vendor.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    startTransition(async () => {
      const res = await createVendorBill({
        vendorId,
        amount: amt,
        expenseCode,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (res.success) {
        toast.success("Vendor bill created");
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="hover-lift">
          <PlusIcon className="mr-2 size-4" />
          New bill
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New vendor bill</DialogTitle>
          <DialogDescription>
            Accrue what a vendor is owed. Approving it posts to the general ledger.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { value: "line", label: "From agreed line" },
              { value: "manual", label: "Manual" },
            ] as { value: Mode; label: string }[]
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setMode(t.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === t.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === "line" ? (
          <div className="space-y-2">
            <Label>Agreed vendor line</Label>
            {billable.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                No un-billed agreed vendor lines. Add vendors to a booking first, or use the
                Manual tab.
              </p>
            ) : (
              <Select value={bookingVendorId} onValueChange={setBookingVendorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an agreed line" />
                </SelectTrigger>
                <SelectContent>
                  {billable.map((l) => (
                    <SelectItem key={l.bookingVendorId} value={l.bookingVendorId}>
                      {l.vendorName} — {l.eventName} ({inr.format(l.agreedRate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              The vendor and amount are derived from the agreed rate on the booking line.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendorOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No vendors available
                    </div>
                  ) : (
                    vendorOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Expense account</Label>
                <Select value={expenseCode} onValueChange={setExpenseCode}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="What is this bill for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes…"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Create bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
