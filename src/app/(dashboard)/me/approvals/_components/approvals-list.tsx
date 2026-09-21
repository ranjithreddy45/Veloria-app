"use client";

import * as React from "react";
import { Check, X, MessageCircleQuestion, History, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/shared/status-pill";
import { ClaimDecisionDialog, type ClaimDecisionMode, type ClaimDecisionTarget } from "@/components/hr/claim-decision-dialog";
import { ClaimTrailDialog } from "@/components/hr/claim-trail-dialog";
import type { listMyApprovals } from "@/actions/hr-reimbursement.actions";

type Row = Awaited<ReturnType<typeof listMyApprovals>>[number];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function ApprovalsList({ rows }: { rows: Row[] }) {
  const [target, setTarget] = React.useState<ClaimDecisionTarget | null>(null);
  const [mode, setMode] = React.useState<ClaimDecisionMode | null>(null);
  const [trailId, setTrailId] = React.useState<string | null>(null);

  function decide(r: Row, m: ClaimDecisionMode) {
    setTarget({ id: r.id, title: r.title, amount: r.amount, name: r.name, empCode: r.empCode, category: r.category, level: r.level });
    setMode(m);
  }

  if (rows.length === 0) {
    return (
      <div className="surface-glass rounded-[22px]">
        <EmptyState
          icon={<Check className="size-5" />}
          title="Nothing waiting for you"
          description="Claims appear here the moment they're routed to you for approval. You'll also get a notification and an email."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden surface-glass rounded-[22px]">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-body font-semibold">Waiting for you</span>
        <span className="text-body text-muted-foreground">
          <span className="numeric font-medium text-foreground">{rows.length}</span> {rows.length === 1 ? "claim" : "claims"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Claim</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Bills</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:py-3">
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-detail text-muted-foreground">
                    {r.empCode}{r.department ? ` · ${r.department}` : ""}
                  </div>
                </TableCell>
                <TableCell className="max-w-[260px] whitespace-normal">
                  <div className="text-body">{r.title}</div>
                  <div className="text-detail text-muted-foreground">
                    {r.category} · {new Date(r.claimDate).toLocaleDateString("en-IN")}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(r.amount)}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setTrailId(r.id)}>
                    <Paperclip className="size-3.5" /> {r.attachmentCount} {r.attachmentCount === 1 ? "bill" : "bills"}
                  </Button>
                </TableCell>
                <TableCell>
                  <StatusPill label={r.level === 1 ? "1st-level" : "2nd-level"} hue={r.level === 1 ? "amber" : "violet"} size="xs" />
                  {r.level === 2 && r.level1At && (
                    <div className="mt-0.5 text-meta text-muted-foreground">
                      1st approved {new Date(r.level1At).toLocaleDateString("en-IN")}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button size="sm" className="h-8 gap-1" onClick={() => decide(r, "APPROVED")}>
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => decide(r, "NEEDS_INFO")}>
                      <MessageCircleQuestion className="size-4" /> Send back
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive" onClick={() => decide(r, "REJECTED")}>
                      <X className="size-4" /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={() => setTrailId(r.id)}>
                      <History className="size-4" /> History
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ClaimDecisionDialog claim={target} mode={mode} onClose={() => { setTarget(null); setMode(null); }} />
      <ClaimTrailDialog claimId={trailId} open={trailId !== null} onOpenChange={(o) => { if (!o) setTrailId(null); }} />
    </div>
  );
}
