"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2Icon, XCircleIcon, Loader2Icon, ReceiptTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { approveVendorBill, cancelVendorBill } from "@/actions/vendor-bill.actions";

// ============================================================
// Types
// ============================================================

export type BillRow = {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  bookingId: string | null;
  description: string | null;
  amount: number;
  expenseCode: string;
  status: string;
  effectiveStatus: "DRAFT" | "APPROVED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  paid: number;
  outstanding: number;
  accrued: boolean;
  notes: string | null;
  approvedAt: string | Date | null;
  createdAt: string | Date;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// ============================================================
// Presentation maps
// ============================================================

const STATUS_HUE: Record<BillRow["effectiveStatus"], Hue> = {
  DRAFT: "slate",
  APPROVED: "blue",
  PARTIALLY_PAID: "amber",
  PAID: "emerald",
  CANCELLED: "rose",
};

const STATUS_LABEL: Record<BillRow["effectiveStatus"], string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const EXPENSE_LABEL: Record<string, string> = {
  "5010": "Catering",
  "5020": "Décor",
  "5030": "Staffing",
  "5040": "AV",
  "5230": "Procurement",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ============================================================
// Row action buttons (DRAFT only)
// ============================================================

function DraftActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [action, setAction] = React.useState<"approve" | "cancel" | null>(null);

  function onApprove() {
    setAction("approve");
    startTransition(async () => {
      const res = await approveVendorBill(id);
      if (res.success) {
        toast.success(`Bill accrued to the GL · entry ${res.data.entryNo}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
      setAction(null);
    });
  }

  function onCancel() {
    setAction("cancel");
    startTransition(async () => {
      const res = await cancelVendorBill(id);
      if (res.success) {
        toast.success("Bill cancelled");
        router.refresh();
      } else {
        toast.error(res.error);
      }
      setAction(null);
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900 dark:text-emerald-300"
        disabled={pending}
        onClick={onApprove}
      >
        {pending && action === "approve" ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <CheckCircle2Icon className="size-3.5" />
        )}
        Approve
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1.5 text-muted-foreground hover:text-rose-600"
        disabled={pending}
        onClick={onCancel}
      >
        {pending && action === "cancel" ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <XCircleIcon className="size-3.5" />
        )}
        Cancel
      </Button>
    </div>
  );
}

// ============================================================
// BillsTable
// ============================================================

export function BillsTable({ data }: { data: BillRow[] }) {
  const [status, setStatus] = React.useState("ALL");

  const rows = React.useMemo(
    () => (status === "ALL" ? data : data.filter((b) => b.effectiveStatus === status)),
    [data, status]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {rows.length} bill{rows.length === 1 ? "" : "s"}
        </p>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptTextIcon className="size-5" />}
            title={status === "ALL" ? "No vendor bills yet" : "No bills match this filter"}
            description={
              status === "ALL"
                ? "Create a bill from an agreed vendor line to accrue what a vendor is owed."
                : "Try a different status filter above."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expense a/c</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs font-medium">{b.billNumber}</TableCell>
                  <TableCell className="max-w-[200px]">
                    <span className="block truncate font-medium">{b.vendorName}</span>
                    {b.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {b.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {inr.format(b.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {inr.format(b.paid)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {b.outstanding > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">
                        {inr.format(b.outstanding)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{inr.format(0)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={STATUS_LABEL[b.effectiveStatus]}
                      hue={STATUS_HUE[b.effectiveStatus]}
                      size="xs"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {EXPENSE_LABEL[b.expenseCode] ?? b.expenseCode}
                      <span className="ml-1 font-mono opacity-60">{b.expenseCode}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(b.createdAt), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    {b.effectiveStatus === "DRAFT" ? (
                      <DraftActions id={b.id} />
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
