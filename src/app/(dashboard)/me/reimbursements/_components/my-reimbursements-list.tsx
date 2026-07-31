"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, ReceiptText, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate, cn } from "@/lib/utils";
import { cancelMyReimbursement } from "@/actions/hr-reimbursement.actions";

export interface ReimbursementClaim {
  id: string;
  category: string;
  title: string;
  amount: number;
  taxable: boolean;
  claimDate: Date | string;
  hasBill: boolean;
  note: string | null;
  status: string;
  decisionNote: string | null;
  payFy: string | null;
  payMonth: number | null;
  paidAt: Date | string | null;
  createdAt: Date | string;
}

const CATEGORY_LABELS: Record<string, string> = {
  TRAVEL: "Travel",
  MEDICAL: "Medical",
  TELEPHONE: "Telephone",
  FUEL: "Fuel",
  BOOKS: "Books & periodicals",
  OTHER: "Other",
};

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

// Status → Badge variant + label. PENDING awaits HR, APPROVED is queued for a pay
// run, PAID has been disbursed, REJECTED (incl. employee-withdrawn) is closed.
const STATUS: Record<string, { variant: "warning" | "success" | "destructive" | "secondary"; label: string; className?: string }> = {
  PENDING: { variant: "warning", label: "Pending" },
  APPROVED: {
    variant: "secondary",
    label: "Approved",
    className: "bg-blue-500/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300",
  },
  PAID: { variant: "success", label: "Paid" },
  REJECTED: { variant: "destructive", label: "Rejected" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={s.variant} className={s.className}>{s.label}</Badge>;
}

export function MyReimbursementsList({ claims }: { claims: ReimbursementClaim[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-[13px] font-semibold">My claims</span>
        {claims.length > 0 && (
          <span className="text-[13px] text-muted-foreground">
            <span className="numeric font-medium text-foreground">{claims.length}</span>{" "}
            {claims.length === 1 ? "claim" : "claims"}
          </span>
        )}
      </div>
      {claims.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="size-5" />}
          title="No claims yet"
          description="Use “New claim” to submit your first expense. If your account isn’t linked to an employee record yet, ask HR to connect your profile."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:py-3.5">
            {claims.map((c) => {
              const label = STATUS[c.status]?.label ?? c.status;
              return (
                <TableRow key={c.id}>
                  {/* TableCell is whitespace-nowrap by default, so a long note or
                    * rejection reason used to stretch the row to its full text
                    * width and drag the whole table sideways. Cap the column and
                    * let the free-text lines wrap instead. */}
                  <TableCell className="max-w-[220px] whitespace-normal text-[13px]">
                    <div className="flex items-center gap-1.5 font-medium break-words">
                      {c.title}
                      {c.hasBill && (
                        <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Bill attached" />
                      )}
                    </div>
                    {c.note && <div className="text-[12px] break-words text-muted-foreground">{c.note}</div>}
                    {c.status === "REJECTED" && c.decisionNote && (
                      <div className="mt-0.5 text-[12px] break-words text-destructive">{c.decisionNote}</div>
                    )}
                    {c.status === "PAID" && c.paidAt && (
                      <div className="mt-0.5 text-[12px] text-success">
                        Paid {formatDate(c.paidAt)}
                      </div>
                    )}
                    {c.status === "APPROVED" && c.payFy && c.payMonth && (
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        Scheduled in {c.payFy} pay run (month {c.payMonth})
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {CATEGORY_LABELS[c.category] ?? c.category}
                    {c.taxable && (
                      <span className="ml-1 text-[11px] text-warning">· taxable</span>
                    )}
                  </TableCell>
                  <TableCell className="numeric text-[12.5px] text-muted-foreground whitespace-nowrap">{formatDate(c.claimDate)}</TableCell>
                  <TableCell className="numeric text-right text-[13px] font-medium">{INR.format(c.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>
                    {c.status === "PENDING" && <WithdrawButton id={c.id} label={label} />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function WithdrawButton({ id }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function withdraw() {
    setError(null);
    startTransition(async () => {
      const res = await cancelMyReimbursement(id);
      if (!res.success) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start">
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7 gap-1 text-muted-foreground hover:text-destructive")}
        disabled={pending}
        onClick={withdraw}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Withdraw
      </Button>
      {error && <span className="text-[11px] text-destructive">{error}</span>}
    </div>
  );
}
