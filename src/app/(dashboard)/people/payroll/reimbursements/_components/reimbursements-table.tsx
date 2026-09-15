"use client";

import * as React from "react";
import { Check, X, MessageCircleQuestion, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClaimDecisionDialog, type ClaimDecisionMode, type ClaimDecisionTarget } from "@/components/hr/claim-decision-dialog";
import { ClaimTrailDialog } from "@/components/hr/claim-trail-dialog";
import { CLAIM_STATUS_HUE, CLAIM_STATUS_LABEL, awaitingLevel } from "@/lib/hr/claim-labels";
import type { listReimbursements } from "@/actions/hr-reimbursement.actions";

/** Row shape returned by listReimbursements(). */
export type ReimbursementRow = Awaited<ReturnType<typeof listReimbursements>>[number];

const MONTH_LABEL = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FILTERS = [
  { v: "ALL", label: "All" },
  { v: "PENDING", label: "Awaiting 1st approval" },
  { v: "PENDING_L2", label: "Awaiting 2nd approval" },
  { v: "NEEDS_INFO", label: "Sent back" },
  { v: "APPROVED", label: "With Finance" },
  { v: "REJECTED", label: "Rejected" },
  { v: "PAID", label: "Paid" },
];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const payRunLabel = (r: ReimbursementRow) =>
  r.payFy && r.payMonth ? `${MONTH_LABEL[r.payMonth] ?? r.payMonth} · FY ${r.payFy}` : "—";

export function ReimbursementsTable({ rows }: { rows: ReimbursementRow[] }) {
  const [filter, setFilter] = React.useState("ALL");
  const [target, setTarget] = React.useState<ClaimDecisionTarget | null>(null);
  const [mode, setMode] = React.useState<ClaimDecisionMode | null>(null);
  const [trailId, setTrailId] = React.useState<string | null>(null);

  const visible = React.useMemo(
    () => (filter === "ALL" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  function decide(r: ReimbursementRow, m: ClaimDecisionMode) {
    setTarget({ id: r.id, title: r.title, amount: r.amount, name: r.name, empCode: r.empCode, category: r.category, level: awaitingLevel(r.status) });
    setMode(m);
  }
  function close() {
    setTarget(null);
    setMode(null);
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <div>
          <h3 className="text-copy font-semibold">Claims</h3>
          <p className="text-detail text-muted-foreground">
            Every claim and where it stands. Approvals are taken by the configured first- and second-level approvers; Finance pays once both are in.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]" size="sm">
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
                <TableHead>Claim</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Claim date</TableHead>
                <TableHead>Waiting on</TableHead>
                <TableHead>Pay run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const awaiting = awaitingLevel(r.status);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-detail text-muted-foreground">{r.empCode}</div>
                    </TableCell>
                    <TableCell className="max-w-[240px] whitespace-normal">
                      <div className="text-body">{r.title}</div>
                      <div className="text-detail text-muted-foreground">{r.category}</div>
                      {r.taxable && <div className="text-meta font-medium text-warning">Taxable</div>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{inr(r.amount)}</TableCell>
                    <TableCell className="text-detail text-muted-foreground">
                      {new Date(r.claimDate).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-detail">
                      {awaiting ? (
                        <>
                          <div>{r.awaitingName ?? "—"}</div>
                          <div className="text-meta text-muted-foreground">{awaiting === 1 ? "1st-level" : "2nd-level"}</div>
                        </>
                      ) : r.status === "NEEDS_INFO" ? (
                        <span className="text-muted-foreground">Employee</span>
                      ) : r.status === "APPROVED" ? (
                        <span className="text-muted-foreground">Finance</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-detail text-muted-foreground">{payRunLabel(r)}</TableCell>
                    <TableCell>
                      <StatusPill label={CLAIM_STATUS_LABEL[r.status] ?? r.status} hue={CLAIM_STATUS_HUE[r.status] ?? "slate"} size="xs" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {awaiting && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => decide(r, "APPROVED")}>
                              <Check className="size-4" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => decide(r, "NEEDS_INFO")}>
                              <MessageCircleQuestion className="size-4" /> Send back
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive" onClick={() => decide(r, "REJECTED")}>
                              <X className="size-4" /> Reject
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={() => setTrailId(r.id)}>
                          <History className="size-4" /> History
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ClaimDecisionDialog claim={target} mode={mode} onClose={close} />
      <ClaimTrailDialog claimId={trailId} open={trailId !== null} onOpenChange={(o) => { if (!o) setTrailId(null); }} />
    </div>
  );
}
