"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, History, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { getClaimAttachment, getClaimDetail, getClaimLegacyBill } from "@/actions/hr-reimbursement.actions";
import { CLAIM_EVENT_LABEL, CLAIM_STATUS_HUE, CLAIM_STATUS_LABEL } from "@/lib/hr/claim-labels";

// ============================================================
// One claim, fully explained: the supporting bills (open in a new tab) and
// the complete approval trail with who/when/why for every step. Shared by the
// employee's list, the approver queues, the HR overview and Finance.
// ============================================================

type Detail = NonNullable<Extract<Awaited<ReturnType<typeof getClaimDetail>>, { success: true }>["data"]>;

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const when = (d: string | Date) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

function openDataUrl(dataUrl: string, fileName: string) {
  try {
    const [head, b64] = dataUrl.split(",");
    const mime = /data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    const w = window.open(url, "_blank", "noopener");
    if (!w) {
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    toast.error("Couldn't open that file.");
  }
}

export function ClaimTrailDialog({
  claimId,
  open,
  onOpenChange,
}: {
  claimId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [opening, setOpening] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !claimId) return;
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    getClaimDetail(claimId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.success) { toast.error(res.error); onOpenChange(false); return; }
      setDetail(res.data);
    });
    return () => { cancelled = true; };
  }, [open, claimId, onOpenChange]);

  async function openAttachment(id: string) {
    setOpening(id);
    try {
      const res = await getClaimAttachment(id);
      if (!res.success) { toast.error(res.error); return; }
      openDataUrl(res.data.data, res.data.fileName);
    } finally { setOpening(null); }
  }
  async function openLegacy() {
    if (!claimId) return;
    setOpening("legacy");
    try {
      const res = await getClaimLegacyBill(claimId);
      if (!res.success) { toast.error(res.error); return; }
      openDataUrl(res.data.data, "bill");
    } finally { setOpening(null); }
  }

  // Every stage of the claim's route, then payment — each with who, when and
  // any note, and the stage it is waiting at marked.
  const steps: { label: string; who: string; state: string; note: string | null }[] = detail
    ? [
        ...detail.stages.map((st) => ({
          label: st.label,
          who:
            st.state === "done" ? `${st.by ?? st.holder} · ${when(st.at!)}` :
            st.state === "rejected" ? `Rejected by ${st.by ?? st.holder}${st.at ? ` · ${when(st.at)}` : ""}` :
            st.state === "returned" ? `Sent back to the employee${st.by ? ` by ${st.by}` : ""}` :
            st.state === "current" ? `Waiting: ${st.holder}${st.role ? ` (${st.role})` : ""}` :
            `${st.holder}${st.role ? ` (${st.role})` : ""}`,
          state: st.state,
          note: st.note,
        })),
        {
          label: "Payment",
          who: detail.paidAt
            ? `Paid · ${when(detail.paidAt)}`
            : detail.status === "APPROVED"
              ? detail.runId ? `Waiting: paid when the ${detail.payMonth}/${detail.payFy} payroll is paid`
              : detail.payFy ? `Waiting: Finance · pay run ${detail.payMonth}/${detail.payFy}` : "Waiting: Finance"
              : "Finance",
          state: detail.paidAt ? "done" : detail.status === "APPROVED" ? "current" : "waiting",
          note: detail.paymentRef ? `Ref ${detail.paymentRef}` : null,
        },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Claim details &amp; approval trail
          </DialogTitle>
          {detail && (
            <DialogDescription>
              {detail.employeeName} · {detail.empCode} · {detail.category}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex items-center gap-2 py-6 text-detail text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-body font-medium">{detail.title}</div>
                  <div className="text-detail text-muted-foreground">
                    Claim date {new Date(detail.claimDate).toLocaleDateString("en-IN")}
                    {detail.note ? ` · ${detail.note}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-copy font-semibold tabular-nums">{inr(detail.amount)}</div>
                  <StatusPill label={detail.statusLabel ?? CLAIM_STATUS_LABEL[detail.status] ?? detail.status} hue={CLAIM_STATUS_HUE[detail.status] ?? "slate"} size="xs" />
                </div>
              </div>
            </div>

            {/* Where it stands — every stage of its route at a glance */}
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {steps.map((s, i) => (
                <li
                  key={`${s.label}-${i}`}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    s.state === "done" && "border-emerald-500/30 bg-emerald-500/5",
                    s.state === "current" && "border-amber-500/40 bg-amber-500/5",
                    s.state === "rejected" && "border-rose-500/30 bg-rose-500/5",
                    s.state === "returned" && "border-orange-500/30 bg-orange-500/5",
                  )}
                >
                  <div className="text-meta font-medium uppercase tracking-wide text-muted-foreground">Step {i + 1}</div>
                  <div className="text-detail font-medium">{s.label}</div>
                  <div className="text-meta text-muted-foreground">{s.who}</div>
                  {s.note && <div className="mt-0.5 text-meta text-foreground/80">{s.note}</div>}
                </li>
              ))}
            </ol>
            {detail.route && <p className="text-meta text-muted-foreground">Route: {detail.route} → Payment</p>}

            {/* Bills */}
            <div className="space-y-1.5">
              <div className="text-meta font-medium uppercase tracking-wide text-muted-foreground">Supporting bills</div>
              {detail.attachments.length === 0 && !detail.hasLegacyBill ? (
                <p className="text-detail text-muted-foreground">No bills attached.</p>
              ) : (
                <ul className="space-y-1">
                  {detail.hasLegacyBill && (
                    <li>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={openLegacy} disabled={opening !== null}>
                        {opening === "legacy" ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
                        Bill <ExternalLink className="size-3 text-muted-foreground" />
                      </Button>
                    </li>
                  )}
                  {detail.attachments.map((a) => (
                    <li key={a.id}>
                      <Button variant="outline" size="sm" className="h-8 max-w-full gap-1.5" onClick={() => openAttachment(a.id)} disabled={opening !== null}>
                        {opening === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
                        <span className="truncate">{a.fileName}</span>
                        <span className="text-meta text-muted-foreground">{Math.max(1, Math.round(a.sizeBytes / 1024))} KB</span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Full trail */}
            <div className="space-y-1.5">
              <div className="text-meta font-medium uppercase tracking-wide text-muted-foreground">History</div>
              {detail.events.length === 0 ? (
                <p className="text-detail text-muted-foreground">No history recorded.</p>
              ) : (
                <ol className="space-y-2 border-l border-border pl-3">
                  {detail.events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[17px] top-1.5 size-2 rounded-full bg-primary" />
                      <div className="text-detail font-medium">{CLAIM_EVENT_LABEL[e.action] ?? e.action.replaceAll("_", " ")}</div>
                      <div className="text-meta text-muted-foreground">
                        {e.actorName ?? "System"} · {when(e.createdAt)}
                      </div>
                      {e.note && <div className="text-meta text-foreground/80">{e.note}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
