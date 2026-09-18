"use client";

// ============================================================
// HoldPayPanel — the interactive "pay to secure this hold" block (C4).
// ------------------------------------------------------------
// The /hold page is a server component; before this panel, a successful
// PublicPay left the amber countdown ticking to "expired" and the "Release
// this hold" link live — a page that contradicted itself right after the
// customer paid. This client boundary fixes that: on a verified payment it
//   1. flips to a payment confirmation locally (instant), and
//   2. router.refresh()es so the server re-renders the paid state on reload.
// The countdown + release link only render while unpaid.
//
// The confirmation says what the records say, from the /pay result's outcome
// state (src/app/pay/[token]/outcome-state.ts, read back by PublicPay):
// "your date is secured" only for a live booking; a payment that landed on a
// cancelled booking is told the booking isn't active, with contact buttons.
// Until the outcome is read back it claims nothing beyond the payment.
// HoldPaymentResult is also what the server page renders once paid, so the
// two can't disagree.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ContactOptions, PublicPay, type PayContact } from "@/app/pay/[token]/_components/public-pay";
import type { PaymentOutcome } from "@/app/pay/[token]/outcome.actions";
import { HelpChip } from "@/components/public/help-chip";
import { cn } from "@/lib/utils";
import { HoldCountdown, ReleaseLink } from "../../_components/availability-calendar";
import { holdPaymentCopy, type HoldPaymentState } from "../hold-payment-result";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const TONE = {
  success: { box: "border-success/20 bg-success/10", icon: "text-success", title: "text-success", text: "text-success" },
  warn: { box: "border-warning/25 bg-warning/10", icon: "text-warning", title: "text-warning", text: "text-foreground/80" },
  neutral: { box: "border-border bg-card", icon: "text-muted-foreground", title: "text-foreground", text: "text-muted-foreground" },
} as const;

/**
 * A paid hold: what the customer is told (hold-payment-result.ts) and how to
 * reach the team. Rendered by HoldPayPanel right after a payment, and by the
 * /hold page once the payment is on record.
 */
export function HoldPaymentResult({
  state,
  teamAlerted,
  amount,
  contact,
  reference,
  animate = false,
}: {
  state: HoldPaymentState;
  /** CANCELLED only: the team's alert about the payment is on record. */
  teamAlerted: boolean;
  /** Rupees received. */
  amount: number;
  /** The business's published contact channels. */
  contact?: PayContact | null;
  /** Prefilled into the WhatsApp message. */
  reference: string;
  /** Rise in (the local flip). Off on the server page, which must show on first paint. */
  animate?: boolean;
}) {
  const copy = holdPaymentCopy(state, { amount: inr(amount), teamAlerted });
  const tone = TONE[copy.tone];
  const Icon = state === "CHECKING" ? Loader2 : copy.tone === "warn" ? AlertTriangle : CheckCircle2;

  return (
    <div className={cn("space-y-3", animate && "animate-rise-in")} aria-live="polite">
      <div role="status" className={cn("flex flex-col items-center gap-2 rounded-2xl border p-6 text-center", tone.box)}>
        <Icon className={cn("size-10", tone.icon, state === "CHECKING" && "animate-spin")} aria-hidden />
        <p className={cn("text-lg font-semibold", tone.title)}>{copy.title}</p>
        {copy.lines.map((line, i) => (
          <p key={line} className={cn(i === 0 ? "text-sm" : "mt-1 text-detail font-medium", tone.text)}>
            {line}
          </p>
        ))}
      </div>
      {copy.contactFirst ? (
        <ContactOptions contact={contact} context={reference} banner />
      ) : (
        <HelpChip variant="banner" contact={contact} message={reference} />
      )}
    </div>
  );
}

export function HoldPayPanel({
  token,
  invoiceId,
  tokenAmount,
  customerFirstName,
  expiresAt,
  socialProof,
  contact,
}: {
  token: string;
  invoiceId: string | null;
  tokenAmount: number;
  customerFirstName: string;
  expiresAt: string | null;
  socialProof: React.ReactNode;
  /** The business's published contact channels, loaded on the server with getPublicContact(). */
  contact?: PayContact | null;
}) {
  const router = useRouter();
  const [paid, setPaid] = useState(false);
  // undefined while the payment's outcome is being read back; null when it couldn't be read.
  const [outcome, setOutcome] = useState<PaymentOutcome | null | undefined>(undefined);

  if (paid) {
    // No countdown, no release link, and "secured" only once the records say the booking is live.
    const state: HoldPaymentState = outcome === undefined ? "CHECKING" : outcome?.booking ? outcome.booking.state : "UNKNOWN";
    const reference = outcome
      ? `Payment for my date hold: invoice ${outcome.invoiceNumber}${outcome.receiptNumber ? `, receipt ${outcome.receiptNumber}` : ""}`
      : "Payment for my date hold";
    return (
      <HoldPaymentResult
        animate
        state={state}
        teamAlerted={outcome?.booking?.teamAlerted ?? false}
        amount={outcome?.amountPaid ?? tokenAmount}
        contact={contact}
        reference={reference}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Countdown */}
      {expiresAt && (
        <div className="rounded-xl border border-warning/20 bg-warning/10 p-3 text-center text-sm text-warning">
          <HoldCountdown expiresAt={expiresAt} />
        </div>
      )}

      {/* Social proof — matched 5★ reviews + past-event photos */}
      {socialProof}

      {/* Pay token */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Pay a token of{" "}
          <span className="font-semibold text-foreground">{inr(tokenAmount)}</span>{" "}
          to confirm and secure this date.
        </p>
        <div className="mt-4">
          {invoiceId ? (
            <PublicPay
              invoiceId={invoiceId}
              invoiceNumber="date hold"
              amount={tokenAmount}
              customerName={customerFirstName}
              customerEmail=""
              contact={contact}
              onSuccess={() => {
                setPaid(true);
                router.refresh();
              }}
              onOutcome={setOutcome}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                Payment isn&apos;t available for this hold. Please contact us.
              </p>
              <HelpChip contact={contact} />
            </div>
          )}
        </div>
      </div>

      {/* Release link */}
      <ReleaseLink token={token} />
    </div>
  );
}
