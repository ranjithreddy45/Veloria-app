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
// Approve / send back / reject — one dialog for both approval levels. The
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
  /** 1 or 2 — which approval this decision is. */
  level?: number | null;
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
  const levelWord = claim?.level === 3 ? "Finance" : claim?.level === 2 ? "second-level" : claim?.level === 1 ? "first-level" : "";

  async function submit() {
    if (!claim || !mode) return;
    if (sendingBack && !note.trim()) {
      toast.error("Say what is missing — the employee has to know what to add.");
      return;
    }
    setBusy(true);
    const res = sendingBack
      ? await requestClaimInfo(claim.id, note.trim())
      : await decideReimbursement(claim.id, { decision: mode, note: note.trim() || undefined });
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    if (sendingBack) toast.success("Sent back to the employee for more information.");
    else if (approving) {
      const next = "data" in res && res.data && "status" in res.data ? res.data.status : "";
      toast.success(
        next === "PENDING_L2" ? "Approved — sent for second-level approval." :
        next === "PENDING_L3" ? "Approved — sent to Finance for final approval." :
        "Approved — ready for payment scheduling."
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
            {sendingBack ? "Ask for more information" : approving ? `Give ${levelWord} approval` : "Reject claim"}
          </DialogTitle>
          <DialogDescription>
            {sendingBack
              ? "The claim goes back to the employee with your note and returns to first-level approval once they update it."
              : approving
                ? claim?.level === 1
                  ? "After your approval the claim goes to the second-level approver for the employee's team (or straight to Finance if none is set)."
                  : claim?.level === 2
                    ? "After your approval the claim goes to Finance for final approval."
                    : "After your approval the claim is fully approved and can be scheduled for payment."
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
