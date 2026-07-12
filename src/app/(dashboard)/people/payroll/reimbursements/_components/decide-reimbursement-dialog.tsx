"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { decideReimbursement } from "@/actions/hr-reimbursement.actions";
import type { ReimbursementRow } from "./reimbursements-table";

const MONTHS = [
  { v: 1, label: "January" }, { v: 2, label: "February" }, { v: 3, label: "March" },
  { v: 4, label: "April" }, { v: 5, label: "May" }, { v: 6, label: "June" },
  { v: 7, label: "July" }, { v: 8, label: "August" }, { v: 9, label: "September" },
  { v: 10, label: "October" }, { v: 11, label: "November" }, { v: 12, label: "December" },
];

/** Indian FYs around now (FY starts April), newest first. */
function fyOptions(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const currentFyStart = m >= 4 ? y : y - 1;
  const out: string[] = [];
  for (let s = currentFyStart + 1; s >= currentFyStart - 2; s--) {
    out.push(`${s}-${String((s + 1) % 100).padStart(2, "0")}`);
  }
  return out;
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export function DecideReimbursementDialog({
  claim,
  mode,
  onClose,
}: {
  claim: ReimbursementRow | null;
  mode: "APPROVED" | "REJECTED" | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const now = new Date();
  const defaultFy = React.useMemo(() => {
    const m = now.getMonth() + 1;
    return m >= 4
      ? `${now.getFullYear()}-${String((now.getFullYear() + 1) % 100).padStart(2, "0")}`
      : `${now.getFullYear() - 1}-${String(now.getFullYear() % 100).padStart(2, "0")}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fys = React.useMemo(fyOptions, []);

  const [fy, setFy] = React.useState(defaultFy);
  const [month, setMonth] = React.useState(String(now.getMonth() + 1));
  const [taxable, setTaxable] = React.useState(false);
  const [note, setNote] = React.useState("");

  // Reset the form each time a fresh claim/mode is opened.
  React.useEffect(() => {
    if (claim && mode) {
      setFy(defaultFy);
      setMonth(String(new Date().getMonth() + 1));
      setTaxable(false);
      setNote("");
    }
  }, [claim, mode, defaultFy]);

  const open = claim !== null && mode !== null;
  const approving = mode === "APPROVED";

  async function submit() {
    if (!claim || !mode) return;
    setBusy(true);
    const res = await decideReimbursement(
      claim.id,
      approving
        ? { decision: "APPROVED", payFy: fy, payMonth: Number(month), taxable, note: note.trim() || undefined }
        : { decision: "REJECTED", note: note.trim() || undefined },
    );
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(approving ? "Reimbursement approved." : "Reimbursement rejected.");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{approving ? "Approve reimbursement" : "Reject reimbursement"}</DialogTitle>
        </DialogHeader>

        {claim && (
          <div className="rounded-lg border bg-muted/40 px-3.5 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium">{claim.title}</div>
                <div className="text-[12px] text-muted-foreground">
                  {claim.name} · {claim.empCode} · {claim.category}
                </div>
              </div>
              <div className="text-[14px] font-semibold tabular-nums">{inr(claim.amount)}</div>
            </div>
          </div>
        )}

        {approving ? (
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Pay run — FY</Label>
                <Select value={fy} onValueChange={setFy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fys.map((f) => (
                      <SelectItem key={f} value={f}>
                        FY {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.v} value={String(m.v)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5">
              <Checkbox
                checked={taxable}
                onCheckedChange={(v) => setTaxable(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[13px] font-medium">Taxable reimbursement</span>
                <span className="block text-[12px] text-muted-foreground">
                  Tax is deducted only if this reimbursement is taxable. Leave off for a standard
                  non-taxable expense claim.
                </span>
              </span>
            </label>

            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <p className="text-[13px] text-muted-foreground">
              Rejecting closes this claim without payment. The employee can see your note.
            </p>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Reason (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. missing bill / not reimbursable"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            variant={approving ? "default" : "destructive"}
            className="gap-1.5"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {approving ? "Approve & queue" : "Reject claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
