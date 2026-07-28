"use client";

import { useCallback, useState } from "react";
import { CalendarCheck, Loader2, CheckCircle2, AlertCircle, Lock, ShieldCheck, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpChip } from "@/components/public/help-chip";
import {
  createPublicRazorpayOrder,
  verifyPublicRazorpayPayment,
} from "@/actions/payment.actions";
// Backend (quote-onetap agent) PUBLIC actions — ensure proforma, then block slot.
import { startOneTapAdvance, confirmOneTapAndBlock } from "@/actions/quote-onetap.actions";
// Good-Better-Best: pick a specific tier (re-points the link + mints its proforma).
import { selectTier } from "@/actions/quote-share-public.actions";

// ============================================================
// OneTapPay — "Pay {advance} to block your date" (PUBLIC, client).
// ------------------------------------------------------------
// Collapses quote-view → paid slot hold into a single tap. Adapted from the
// existing PublicPay Razorpay client (same loadRazorpayScript + checkout
// options shape). The hard part vs /pay/[token]: the slot must be locked at/
// after payment so a confirmed pay actually secures the date.
//
// Flow on click:
//   1. startOneTapAdvance(token) → { invoiceId, amount }  (idempotent proforma)
//   2. createPublicRazorpayOrder(invoiceId, amount) → order (clamps ≤ balance)
//   3. Razorpay checkout → handler success
//   4. verifyPublicRazorpayPayment(resp)  (HMAC-verified capture → credit)
//   5. confirmOneTapAndBlock(token)  (block slot under Serializable txn + auto-confirm)
//   6. "Your date is secured" state
//
// All money math is server-side (advance from the actual first installment);
// NEVER recompute 20% client-side. The button disables when the slot is BUSY.
// ============================================================

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function OneTapPay({
  token,
  advanceAmount,
  customerName,
  slotBusy = false,
  alreadySecured = false,
  tierQuotationId,
  eventDateLabel,
  slotLabel,
}: {
  token: string;
  /** Server-computed 20% booking-advance amount (paise-exact, INR). */
  advanceAmount: number;
  customerName: string;
  /** True when the chosen slot is no longer free — disables the button. */
  slotBusy?: boolean;
  /** True when the date is already secured (paid/blocked) — show success. */
  alreadySecured?: boolean;
  /**
   * Multi-tier links only: the quotation id this card pays for. When set, the
   * pay flow first re-points the link to this tier (selectTier) so the proforma
   * + slot block invoice the chosen snapshot. Omitted for single-tier links.
   */
  tierQuotationId?: string;
  /** Optional event facts echoed on the success/slot-taken cards. */
  eventDateLabel?: string | null;
  slotLabel?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  // "slotTaken": money captured but the slot was grabbed first (pay-then-lose
  // race) — a distinct amber state, NOT the green "secured" card.
  const [status, setStatus] = useState<"idle" | "securing" | "success" | "slotTaken" | "error">(
    alreadySecured ? "success" : "idle",
  );
  const [error, setError] = useState("");
  // Amount actually captured (server-clamped) — echoed on the success card.
  const [paidAmount, setPaidAmount] = useState<number | null>(null);

  const pay = useCallback(async () => {
    setLoading(true);
    setStatus("idle");
    setError("");
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Couldn't load the payment gateway. Please try again.");

      // 1. Ensure the proforma invoice exists; get the exact advance + invoiceId.
      //    Multi-tier link: re-point to THIS tier first (selectTier mints its
      //    proforma); single-tier: the plain one-tap proforma. Both return the
      //    server-computed advance + invoiceId — never recompute money here.
      let invoiceId: string;
      let amount: number;
      if (tierQuotationId) {
        const sel = await selectTier(token, tierQuotationId);
        if (!sel.success) throw new Error(sel.error || "Couldn't select this option.");
        invoiceId = sel.data.invoiceId;
        amount = sel.data.advanceAmount;
      } else {
        const startRes = await startOneTapAdvance(token);
        if (!startRes.success) throw new Error(startRes.error || "Couldn't start the payment.");
        invoiceId = startRes.data.invoiceId;
        amount = startRes.data.amount;
      }

      // 2. Create the Razorpay order against that invoice (clamps ≤ balanceDue).
      const orderRes = await createPublicRazorpayOrder(invoiceId, amount);
      if (!orderRes.success) throw new Error(orderRes.error || "Couldn't start the payment.");
      const { orderId, amount: paise, currency, keyId } = orderRes.data;
      // Server-clamped amount actually being charged (paise → INR) for the receipt line.
      const chargedInr = Math.round(paise / 100);

      const options = {
        key: keyId,
        amount: paise,
        currency: currency || "INR",
        name: "Veloria Grand",
        description: "Booking advance — block your date",
        order_id: orderId,
        prefill: { name: customerName, email: "", contact: "" },
        theme: { color: "#7c3aed" },
        handler: async (resp: RazorpayResponse) => {
          try {
            setStatus("securing");
            // 3. Verify + credit the invoice (idempotent capture).
            const v = await verifyPublicRazorpayPayment({
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_signature: resp.razorpay_signature,
            });
            if (!v.success) throw new Error(v.error || "Payment could not be confirmed.");

            setPaidAmount(chargedInr);

            // 4. Block the slot + auto-confirm (Serializable; idempotent).
            const blockRes = await confirmOneTapAndBlock(token);
            if (!blockRes.success) {
              // The confirm itself errored (not the race) — money is captured,
              // so treat this as "received, we'll sort it out", never a dead-end.
              setStatus("slotTaken");
              setError(
                blockRes.error ||
                  "Payment received — we'll confirm your date shortly.",
              );
              setLoading(false);
              return;
            }
            // C1: confirm can succeed with secured=false / slotTaken=true — the
            // pay-then-lose race. Money is captured but the slot was grabbed
            // first. Show the distinct amber "received but slot taken" state,
            // NOT the green secured card.
            if (blockRes.data.slotTaken || blockRes.data.secured === false) {
              setStatus("slotTaken");
              setLoading(false);
              return;
            }
            setStatus("success");
            setLoading(false);
          } catch (e) {
            // C3: capture may already have gone through here — never a dead-end,
            // and always release the button so the customer can retry.
            setStatus("error");
            setError(e instanceof Error ? e.message : "Payment could not be confirmed.");
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (r: { error: { description: string } }) => {
        setStatus("error");
        setError(r.error?.description || "Payment failed. Please try again.");
        setLoading(false);
      });
      rzp.open();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }, [token, customerName, tierQuotationId]);

  const eventFacts = [eventDateLabel, slotLabel].filter(Boolean).join(" · ");

  if (status === "success") {
    return (
      <div className="animate-rise-in space-y-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/20 bg-success/10 p-6 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <p className="text-lg font-semibold text-success">
            Your date is secured
          </p>
          {eventFacts && (
            <p className="text-[12.5px] font-medium text-success">
              {eventFacts}
            </p>
          )}
          <p className="text-sm text-success">
            {paidAmount != null
              ? `Payment of ${inr(paidAmount)} received — your date is now blocked for you.`
              : "Your booking advance is received and the date is now blocked for you."}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-success">
            <PhoneCall className="size-3.5" /> Your coordinator will call you within 24 hours.
          </p>
        </div>
        <HelpChip variant="banner" />
      </div>
    );
  }

  // C1: distinct amber state — money captured, but the slot was just taken.
  if (status === "slotTaken") {
    return (
      <div className="animate-rise-in space-y-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-warning/20 bg-warning/10 p-6 text-center">
          <AlertCircle className="size-10 text-warning" />
          <p className="text-lg font-semibold text-warning">
            Payment received
          </p>
          <p className="text-sm text-warning">
            {paidAmount != null ? `Your payment of ${inr(paidAmount)} came through` : "Your payment came through"}
            {" "}— but this slot was just taken. Our team will call you to sort it out or refund you in full.
          </p>
          {error && (
            <p className="text-[12px] text-warning/80">{error}</p>
          )}
        </div>
        <HelpChip variant="banner" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={pay}
        disabled={loading || slotBusy}
        className="button-sheen sheen-sweep relative h-[3.5rem] w-full overflow-hidden rounded-2xl py-3.5 text-base font-semibold"
      >
        {loading || status === "securing" ? (
          <Loader2 className="mr-2 size-5 animate-spin" />
        ) : (
          <CalendarCheck className="mr-2 size-5" />
        )}
        {status === "securing"
          ? "Securing your date…"
          : loading
            ? "Opening secure checkout…"
            : slotBusy
              ? "This slot was just taken"
              : `Pay ${inr(advanceAmount)} to block your date`}
      </Button>

      {!slotBusy && status !== "securing" && (
        <p className="text-center text-[12.5px] text-muted-foreground">
          Just the 20% booking advance now — it instantly blocks your date.
        </p>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <p className="flex items-center justify-center gap-1.5 text-center text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </p>
          <HelpChip />
        </div>
      )}

      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-[11.5px] font-medium text-muted-foreground">
          <Lock className="size-3" /> Secured by Razorpay
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-[11.5px] font-medium text-muted-foreground">
          <ShieldCheck className="size-3 text-success" /> UPI · Card · Net banking
        </span>
      </div>
    </div>
  );
}
