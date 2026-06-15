"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarClockIcon,
  PlusIcon,
  Trash2Icon,
  CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";

import { createInstallmentPlan } from "@/actions/invoice.actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn, formatINR } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

// ============================================================
// Types
// ============================================================

interface InstallmentPlanDialogProps {
  invoiceId: string;
  totalAmount: number;
  /** ISO event date (from the linked booking) — anchors the standard schedule. */
  eventDate?: string | null;
}

type InstallmentRow = {
  label: string;
  amount: string;
  dueDate: Date | undefined;
};

// Veloria's standard 20 / 60 / 20 payment terms:
//   • Booking advance (20%) — on the day of booking, blocks the slot
//   • Part payment (60%)    — 15 days before the event
//   • Final balance (20%)   — 2 hours before the event
// The final installment is the remainder so the three sum to the total exactly.
function buildStandardSchedule(
  totalAmount: number,
  eventDate?: string | null
): InstallmentRow[] {
  const advance = Math.round(totalAmount * 0.2);
  const part = Math.round(totalAmount * 0.6);
  const balance = totalAmount - advance - part;

  const event = eventDate ? new Date(eventDate) : null;
  const partDue = event
    ? new Date(event.getTime() - 15 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const balanceDue = event
    ? new Date(event.getTime() - 2 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return [
    { label: "Booking advance (20%) — blocks the slot", amount: advance.toString(), dueDate: new Date() },
    { label: "Part payment (60%) — 15 days before event", amount: part.toString(), dueDate: partDue },
    { label: "Final balance (20%) — 2 hours before event", amount: balance.toString(), dueDate: balanceDue },
  ];
}

// ============================================================
// Installment Plan Dialog
// ============================================================

export function InstallmentPlanDialog({
  invoiceId,
  totalAmount,
  eventDate,
}: InstallmentPlanDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [installments, setInstallments] = useState<InstallmentRow[]>(
    buildStandardSchedule(totalAmount, eventDate)
  );

  const allocatedAmount = useMemo(
    () =>
      installments.reduce(
        (sum, inst) => sum + (parseFloat(inst.amount) || 0),
        0
      ),
    [installments]
  );

  const remaining = totalAmount - allocatedAmount;
  const progress = totalAmount > 0 ? (allocatedAmount / totalAmount) * 100 : 0;
  const isValid =
    Math.abs(remaining) < 0.01 &&
    installments.every(
      (inst) =>
        inst.label.trim() &&
        parseFloat(inst.amount) > 0 &&
        inst.dueDate
    );

  const addInstallment = () => {
    setInstallments([
      ...installments,
      {
        label: `Installment ${installments.length + 1}`,
        amount: Math.max(0, remaining).toFixed(2),
        dueDate: new Date(Date.now() + 30 * (installments.length + 1) * 24 * 60 * 60 * 1000),
      },
    ]);
  };

  const removeInstallment = (index: number) => {
    if (installments.length <= 1) return;
    setInstallments(installments.filter((_, i) => i !== index));
  };

  const updateInstallment = (
    index: number,
    field: keyof InstallmentRow,
    value: string | Date | undefined
  ) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    setInstallments(updated);
  };

  const handleSubmit = () => {
    if (!isValid) {
      if (Math.abs(remaining) >= 0.01) {
        toast.error(
          `Installments must sum to ${formatINR(totalAmount)}. Remaining: ${formatINR(remaining)}`
        );
      } else {
        toast.error("Please fill in all fields");
      }
      return;
    }

    startTransition(async () => {
      const result = await createInstallmentPlan(
        invoiceId,
        installments.map((inst) => ({
          label: inst.label,
          amount: parseFloat(inst.amount),
          dueDate: inst.dueDate!,
        }))
      );

      if (result.success) {
        toast.success("Installment plan created");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create installment plan");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarClockIcon className="mr-2 size-4" />
          Installment Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Installment Plan</DialogTitle>
          <DialogDescription>
            Total: <span className="font-bold">{formatINR(totalAmount)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>
                Allocated: <span className="font-medium">{formatINR(allocatedAmount)}</span>
              </span>
              <span
                className={cn(
                  "font-medium",
                  Math.abs(remaining) < 0.01
                    ? "text-green-600"
                    : remaining > 0
                      ? "text-amber-600"
                      : "text-red-600"
                )}
              >
                {Math.abs(remaining) < 0.01
                  ? "Fully allocated"
                  : remaining > 0
                    ? `Remaining: ${formatINR(remaining)}`
                    : `Over by: ${formatINR(Math.abs(remaining))}`}
              </span>
            </div>
            <Progress value={Math.min(progress, 100)} className="h-2" />
          </div>

          {/* Installment Rows */}
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {installments.map((inst, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-end rounded-md border p-3"
              >
                <div className="col-span-4">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={inst.label}
                    onChange={(e) =>
                      updateInstallment(index, "label", e.target.value)
                    }
                    placeholder="e.g. Advance"
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Amount (INR)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inst.amount}
                    onChange={(e) =>
                      updateInstallment(index, "amount", e.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-4">
                  <Label className="text-xs">Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-xs",
                          !inst.dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1 size-3" />
                        {inst.dueDate
                          ? format(inst.dueDate, "dd MMM yyyy")
                          : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={inst.dueDate}
                        onSelect={(date) =>
                          updateInstallment(index, "dueDate", date)
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-1 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeInstallment(index)}
                    disabled={installments.length <= 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInstallment}
          >
            <PlusIcon className="mr-1 size-4" />
            Add Installment
          </Button>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !isValid}>
            {isPending ? "Creating..." : "Create Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
