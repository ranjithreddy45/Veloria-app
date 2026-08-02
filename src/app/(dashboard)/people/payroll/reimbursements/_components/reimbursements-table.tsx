"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DecideReimbursementDialog } from "./decide-reimbursement-dialog";

/** Row shape returned by listReimbursements(). */
export interface ReimbursementRow {
  id: string;
  employeeId: string;
  category: string;
  title: string;
  amount: number;
  taxable: boolean;
  claimDate: string | Date;
  hasBill: boolean;
  note: string | null;
  status: string;
  decisionNote: string | null;
  payFy: string | null;
  payMonth: number | null;
  runId: string | null;
  paidAt: string | Date | null;
  createdAt: string | Date;
  empCode: string;
  name: string;
}

const MONTH_LABEL = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_HUE: Record<string, Hue> = {
  PENDING: "amber",
  APPROVED: "indigo",
  REJECTED: "rose",
  PAID: "emerald",
};

const FILTERS = [
  { v: "ALL", label: "All" },
  { v: "PENDING", label: "Pending" },
  { v: "APPROVED", label: "Approved" },
  { v: "REJECTED", label: "Rejected" },
  { v: "PAID", label: "Paid" },
];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const payRunLabel = (r: ReimbursementRow) =>
  r.payFy && r.payMonth ? `${MONTH_LABEL[r.payMonth] ?? r.payMonth} · FY ${r.payFy}` : "—";

export function ReimbursementsTable({ rows }: { rows: ReimbursementRow[] }) {
  const [filter, setFilter] = React.useState("ALL");
  const [target, setTarget] = React.useState<ReimbursementRow | null>(null);
  const [mode, setMode] = React.useState<"APPROVED" | "REJECTED" | null>(null);

  const visible = React.useMemo(
    () => (filter === "ALL" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  function decide(r: ReimbursementRow, m: "APPROVED" | "REJECTED") {
    setTarget(r);
    setMode(m);
  }
  function close() {
    setTarget(null);
    setMode(null);
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div>
          <h3 className="text-copy font-semibold">Claims</h3>
          <p className="text-detail text-muted-foreground">
            Approve a pending claim onto a pay run, or reject it with a note.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[150px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.v} value={f.v}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No reimbursement claims yet. Employees submit these from self-service."
            : "No claims match this filter."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Claim date</TableHead>
                <TableHead>Pay run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-detail text-muted-foreground">{r.empCode}</div>
                  </TableCell>
                  <TableCell className="text-detail">{r.category}</TableCell>
                  <TableCell>
                    <div className="text-body">{r.title}</div>
                    {r.taxable && (
                      <div className="text-meta font-medium text-warning">
                        Taxable
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{inr(r.amount)}</TableCell>
                  <TableCell className="text-detail text-muted-foreground">
                    {new Date(r.claimDate).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell className="text-detail text-muted-foreground">{payRunLabel(r)}</TableCell>
                  <TableCell>
                    <StatusPill label={r.status} hue={STATUS_HUE[r.status] ?? "slate"} size="xs" />
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "PENDING" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1"
                          onClick={() => decide(r, "APPROVED")}
                        >
                          <Check className="size-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-destructive hover:text-destructive"
                          onClick={() => decide(r, "REJECTED")}
                        >
                          <X className="size-4" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-detail text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DecideReimbursementDialog claim={target} mode={mode} onClose={close} />
    </div>
  );
}
