"use client";

// ============================================================
// SplitPaymentsPanel — one "amount due" (an invoice) with its split links:
// outstanding / reserved-in-links / available, the "Split this amount"
// dialog, and the list of splits (payer, amount, status, paid at) with
// Copy / WhatsApp / Cancel on pending ones. Shared by the host portal and the
// staff booking page; `canCreate` is decided server-side by the caller.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Clock, Copy, MessageCircle, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cancelPaymentSplit } from "@/actions/payment-split.actions";
import { SplitPaymentDialog } from "@/components/payments/split-payment-dialog";
import {
  formatPaise,
  splitWhatsAppText,
  whatsAppShareHref,
  type SplitRow,
  type SplitTarget,
} from "@/lib/payments/split-format";

interface Props {
  target: SplitTarget;
  canCreate: boolean;
  requesterName: string;
  /** "portal" (host) or "staff" — only affects wording. */
  variant?: "portal" | "staff";
  className?: string;
}

const STATUS_STYLE: Record<SplitRow["status"], string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  EXPIRED: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<SplitRow["status"], string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function SplitPaymentsPanel({ target, canCreate, requesterName, variant = "portal", className }: Props) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const paidPaise = target.splits.filter((s) => s.status === "PAID").reduce((a, s) => a + s.amountPaise, 0);
  const live = target.splits.filter((s) => s.status === "PENDING" || s.status === "PAID");
  const inactive = target.splits.filter((s) => s.status === "CANCELLED" || s.status === "EXPIRED");

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success("Link copied");
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  async function cancel(s: SplitRow) {
    if (!window.confirm(`Cancel ${s.payerName}'s link for ${formatPaise(s.amountPaise)}? They won't be able to pay with it.`)) return;
    setBusyId(s.id);
    try {
      const res = await cancelPaymentSplit(s.id);
      if (res.success) {
        toast.success("Link cancelled");
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setBusyId(null);
    }
  }

  function share(s: SplitRow) {
    const text = splitWhatsAppText({
      payerName: s.payerName,
      requesterName,
      amountPaise: s.amountPaise,
      eventName: target.eventName,
      invoiceNumber: target.invoiceNumber,
      url: s.url,
    });
    window.open(whatsAppShareHref(s.payerPhone, text), "_blank", "noopener");
  }

  return (
    <div className={cn("rounded-2xl border bg-card", className)}>
      {/* ---- Header: what's due + the action ---- */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-primary" />
            {target.eventName ?? "Amount due"}
            <span className="numeric text-xs font-normal text-muted-foreground">{target.invoiceNumber}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {variant === "portal"
              ? "Let family or friends pay their part — each gets a secure link, and the balance updates as they pay."
              : "Hand parts of this balance to several payers; each gets its own link and records a normal payment."}
          </p>
        </div>
        {canCreate && <SplitPaymentDialog target={target} requesterName={requesterName} />}
      </div>

      {/* ---- Money strip ---- */}
      <div className="grid grid-cols-3 divide-x border-b text-center">
        <div className="p-3">
          <p className="text-meta font-medium uppercase tracking-[0.08em] text-muted-foreground">Still due</p>
          <p className="numeric mt-1 text-sm font-semibold text-foreground">{formatPaise(target.outstandingPaise)}</p>
        </div>
        <div className="p-3">
          <p className="text-meta font-medium uppercase tracking-[0.08em] text-muted-foreground">In pending links</p>
          <p className="numeric mt-1 text-sm font-semibold text-amber-700 dark:text-amber-400">{formatPaise(target.reservedPaise)}</p>
        </div>
        <div className="p-3">
          <p className="text-meta font-medium uppercase tracking-[0.08em] text-muted-foreground">Paid via splits</p>
          <p className="numeric mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">{formatPaise(paidPaise)}</p>
        </div>
      </div>

      {/* Pending links can outgrow the balance when someone pays directly on
          the invoice; those links refuse to start a checkout, so say so. */}
      {target.reservedPaise > target.outstandingPaise && (
        <p className="border-b bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 sm:px-5">
          Pending links add up to more than what&apos;s still due — cancel or reissue some so each share fits the balance.
        </p>
      )}

      {/* ---- Splits list ---- */}
      {target.splits.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground sm:p-5">
          No split links yet.{canCreate ? " Tap “Split this amount” to share this balance between several people." : ""}
        </p>
      ) : (
        <ul className="divide-y">
          {[...live, ...inactive].map((s) => (
            <li key={s.id} className={cn("flex flex-wrap items-center gap-3 p-3 sm:px-5", s.status !== "PENDING" && s.status !== "PAID" && "opacity-60")}>
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  s.status === "PAID" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                )}
              >
                {s.status === "PAID" ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{s.payerName}</p>
                  <span className={cn("rounded-full border px-2 py-0.5 text-meta font-medium", STATUS_STYLE[s.status])}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {s.status === "PAID" && s.paidAt
                    ? `Paid ${shortDate(s.paidAt)}`
                    : s.status === "PENDING" && s.expiresAt
                      ? `Link valid until ${shortDate(s.expiresAt)}`
                      : s.payerPhone || s.payerEmail || "—"}
                  {s.status === "PAID" && (s.payerPhone || s.payerEmail) ? ` · ${s.payerPhone || s.payerEmail}` : ""}
                </p>
              </div>
              <span className="numeric shrink-0 text-sm font-semibold text-foreground">{formatPaise(s.amountPaise)}</span>
              {s.status === "PENDING" && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => copy(s.url, s.id)} aria-label="Copy link">
                    {copiedId === s.id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-emerald-700 dark:text-emerald-400"
                    onClick={() => share(s)}
                    aria-label="Share on WhatsApp"
                  >
                    <MessageCircle className="size-3.5" />
                  </Button>
                  {canCreate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => cancel(s)}
                      disabled={busyId === s.id}
                      aria-label="Cancel link"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
