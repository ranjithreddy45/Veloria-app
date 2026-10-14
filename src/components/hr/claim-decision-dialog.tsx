"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { decideReimbursement, requestClaimInfo } from "@/actions/hr-reimbursement.actions";

// ============================================================
// Approve / send back / reject — one dialog for every approval stage. The
// pay-run choice no longer lives here: approvers approve the CLAIM; Finance
// decides HOW it is paid once every approval is in.
// ============================================================

export type ClaimDecisionMode = "APPROVED" | "REJECTED" | "NEEDS_INFO";

export interface ClaimDecisionTarget {
  id: string;
  title: string;
  amount: number;
  name: string;
  empCode: string;
  category: string;
  /** The stage this decision is ("1st approval", "Final approval"). */
  stage?: string | null;
  /** Where approving sends it ("final approval with Amrutha"); null at the last stage. */
  nextStep?: string | null;
  /** The stage (0-based) and version this screen showed — sent back so a stale screen can't act. */
  expectedStage?: number | null;
  version?: string | null;
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function ClaimDecisionDialog({
  claim,
  mode,
  onClose,
}: {
  claim: ClaimDecisionTarget | null;
  mode: ClaimDecisionMode | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (claim && mode) setNote("");
  }, [claim, mode]);

  const open = claim !== null && mode !== null;
  const approving = mode === "APPROVED";
  const sendingBack = mode === "NEEDS_INFO";
  const stageWord = claim?.stage ? claim.stage.toLowerCase() : "approval";

  async function submit() {
    if (!claim || !mode) return;
    if (sendingBack && !note.trim()) {
      toast.error("Say what is missing — the employee has to know what to add.");
      return;
    }
    setBusy(true);
    const expected = { expectedStage: claim.expectedStage ?? null, version: claim.version ?? null };
    const res = sendingBack
      ? await requestClaimInfo(claim.id, note.trim(), expected)
      : await decideReimbursement(claim.id, { decision: mode, note: note.trim() || undefined, ...expected });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    if (sendingBack) toast.success("Sent back to the employee for more information.");
    else if (approving) {
      const d = res.data as { nextStage?: string | null; nextHolder?: string | null };
      toast.success(
        d.nextStage ? `Approved — sent to ${d.nextHolder ?? "the next approver"} for ${d.nextStage.toLowerCase()}.` :
        "Approved — with Finance for payment."
      );
    } else toast.success("Claim rejected.");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {sendingBack ? "Ask for more information" : approving ? (stageWord === "approval" ? "Approve claim" : `Give ${stageWord}`) : "Reject claim"}
          </DialogTitle>
          <DialogDescription>
            {sendingBack
              ? "The claim goes back to the employee with your note and starts again from the 1st approval once they update it."
              : approving
                ? claim?.nextStep
                  ? `After your approval the claim moves to ${claim.nextStep}.`
                  : "This is the last approval: the claim is then fully approved and goes to Finance for payment."
                : "Rejecting closes this claim without payment. The employee can see your reason."}
          </DialogDescription>
        </DialogHeader>

        {claim && (
          <div className="rounded-lg border bg-muted/40 px-3.5 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-body font-medium">{claim.title}</div>
                <div className="text-detail text-muted-foreground">
                  {claim.name} · {claim.empCode} · {claim.category}
                </div>
              </div>
              <div className="text-copy font-semibold tabular-nums">{inr(claim.amount)}</div>
            </div>
          </div>
        )}

        <div className="space-y-1.5 py-1">
          <Label className="text-detail">{sendingBack ? "What is missing?" : "Note (optional)"}</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={sendingBack ? "e.g. hotel invoice not attached" : approving ? "Anything for the next approver or Finance" : "e.g. not a reimbursable expense"}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={busy}
            variant={approving || sendingBack ? "default" : "destructive"}
            className="gap-1.5"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {sendingBack ? "Send back to employee" : approving ? "Approve" : "Reject claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
