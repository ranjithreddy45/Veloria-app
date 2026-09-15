"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { CreditCard, Loader2, CheckCircle2, AlertCircle, Lock, CalendarPlus, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpChip } from "@/components/public/help-chip";
import { ContactLinks } from "@/app/(guest)/_components/contact-links";
import {
  createPublicRazorpayOrder,
  verifyPublicRazorpayPayment,
} from "@/actions/payment.actions";
import {
  CHECKOUT_TIMED_OUT_DETAIL,
  CHECKOUT_TIMED_OUT_TITLE,
  checkoutCloseFallbackMs,
  checkoutClosedByTimeout,
  checkoutTimeoutForOrder,
} from "@/lib/holds/checkout-timeout";
import { getPublicPaymentOutcome, type PaymentOutcome } from "../outcome.actions";
import { CANCELLED_BOOKING_TITLE, cancelledBookingNotice } from "../outcome-state";

/** Shape every order-creation action returns (public invoice link + split links). */
export type PublicOrderResult =
  | {
      success: true;
      data: {
        orderId: string;
        amount: number;
        currency: string;
        keyId: string | undefined;
        /**
         * Set when the action reopened an order the customer already started:
         * how long its checkout may stay open, in seconds, because its
         * protection counts from when that order was created
         * (src/lib/holds/checkout-reopen.ts). Absent for a new order, which
         * gets RAZORPAY_CHECKOUT_TIMEOUT_SECONDS.
         */
        checkoutTimeoutSeconds?: number;
      };
    }
  | { success: false; error: string };

/** Published contact channels: load with getPublicContact() on the server and pass down. */
export type PayContact = NonNullable<React.ComponentProps<typeof ContactLinks>["contact"]>;

interface PublicPayProps {
  invoiceId: string;
  invoiceNumber: string;
  amount: number; // INR
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  /**
   * Override how the Razorpay order is minted. Default: the invoice link's
   * createPublicRazorpayOrder(invoiceId, amount). /pay/split/<token> passes a
   * token-bound action so one checkout component serves both link types.
   */
  createOrder?: () => Promise<PublicOrderResult>;
  /** Razorpay checkout description (defaults to "Payment for <invoice>"). */
  description?: string;
  /**
   * Called after a verified, successful payment. Used by the /hold page to
   * router.refresh() so the countdown + release link disappear and the server
   * re-renders the secured state (C4). Optional — /pay works standalone.
   */
  onSuccess?: () => void;
  /** Contact options for the result and error states. Without it the env-configured HelpChip shows. */
  contact?: PayContact | null;
  /**
   * After payment, offer "Open your event in the app" and "Add to calendar".
   * Off for someone paying a share of another person's event (/pay/split).
   */
  eventLinks?: boolean;
  /**
   * Called with what actually happened once it has been read back after a
   * verified payment (null when it couldn't be read), so a host that shows its
   * own confirmation (the /hold page) says what the records say. Called even if
   * the host has already replaced this component's view.
   */
  onOutcome?: (outcome: PaymentOutcome | null) => void;
}

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

/** Contact options: the business's published channels, or the env-configured HelpChip when none were passed. */
export function ContactOptions({ contact, context, banner }: { contact?: PayContact | null; context: string; banner?: boolean }) {
  if (!contact) return <HelpChip variant={banner ? "banner" : "inline"} message={context} />;
  const reachable = !!(contact.phone || contact.whatsapp);
  return (
    <div className="space-y-2">
      <ContactLinks contact={contact} context={context} />
      {reachable && contact.supportHours && (
        <p className="text-center text-meta text-muted-foreground">Support hours: {contact.supportHours}</p>
      )}
    </div>
  );
}

function OutcomeRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 text-right font-medium tabular-nums text-foreground">{v}</dd>
    </div>
  );
}

export function PublicPay({
  invoiceId,
  invoiceNumber,
  amount,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  createOrder,
  description,
  contact,
  eventLinks = true,
  onOutcome,
}: PublicPayProps) {
  const [loading, setLoading] = useState(false);
  // "timeout": the checkout closed on its time limit (src/lib/holds/checkout-timeout.ts).
  const [status, setStatus] = useState<"idle" | "success" | "error" | "timeout">("idle");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null);
  const [outcomeState, setOutcomeState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  // The page's own close, for a checkout Razorpay leaves open past its timeout.
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const timer = closeTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  const pay = useCallback(async () => {
    setLoading(true);
    setStatus("idle");
    setError("");
    window.clearTimeout(closeTimer.current);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Couldn't load the payment gateway. Please try again.");

      const orderRes: PublicOrderResult = createOrder
        ? await createOrder()
        : await createPublicRazorpayOrder(invoiceId, amount);
      if (!orderRes.success) throw new Error(orderRes.error || "Couldn't start the payment.");
      const { orderId, amount: paise, currency, keyId, checkoutTimeoutSeconds } = orderRes.data;

      // The checkout closes before the 15-minute protection a started checkout
      // gives a hold runs out, so nobody pays onto a hold that may already have
      // been released (src/lib/holds/checkout-timeout.ts). A reopened order has
      // less of that protection left, so the order action says how long its
      // checkout may stay open (src/lib/holds/checkout-reopen.ts). A close on
      // that timeout says so: never a silent reset, never a success.
      const timeout = checkoutTimeoutForOrder(checkoutTimeoutSeconds);
      let openedAt = 0;
      let paid = false; // Razorpay handed back a payment: the verify call decides what shows
      let closed = false;
      const timedOut = () => {
        setError("");
        setStatus("timeout");
        setLoading(false);
      };

      const options = {
        key: keyId,
        amount: paise,
        currency: currency || "INR",
        name: "Veloria Grand",
        description: description || `Payment for ${invoiceNumber}`,
        order_id: orderId,
        prefill: { name: customerName, email: customerEmail, contact: customerPhone || "" },
        theme: { color: "#7c3aed" },
        timeout,
        handler: async (resp: RazorpayResponse) => {
          paid = true;
          window.clearTimeout(closeTimer.current);
          try {
            const v = await verifyPublicRazorpayPayment({
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_signature: resp.razorpay_signature,
            });
            if (v.success) {
              setStatus("success");
              // C4: let the host (e.g. /hold) refresh so its stale UI clears.
              onSuccess?.();
              // Read back what actually happened: receipt number, balance, booking status.
              setOutcomeState("loading");
              getPublicPaymentOutcome({
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
              })
                .catch(() => null)
                .then((r) => {
                  const read = r && r.success ? r.data : null;
                  setOutcome(read);
                  setOutcomeState(read ? "ready" : "error");
                  onOutcome?.(read);
                });
            } else throw new Error(v.error || "Payment could not be confirmed.");
          } catch (e) {
            setStatus("error");
            setError(e instanceof Error ? e.message : "Payment could not be confirmed.");
            // C3: release the button so the customer can retry.
            setLoading(false);
          }
        },
        modal: {
          ondismiss: (reason?: unknown) => {
            closed = true;
            window.clearTimeout(closeTimer.current);
            setLoading(false);
            if (!paid && checkoutClosedByTimeout(openedAt, Date.now(), reason, timeout)) timedOut();
          },
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (r: { error: { description: string } }) => {
        setStatus("error");
        setError(r.error?.description || "Payment failed. Please try again.");
        setLoading(false);
      });
      openedAt = Date.now();
      rzp.open();
      // If Razorpay hasn't closed the checkout by now, close it here, still
      // inside the hold's checkout protection.
      closeTimer.current = window.setTimeout(() => {
        if (paid || closed) return;
        closed = true;
        try {
          rzp.close();
        } catch {
          // Already closed.
        }
        timedOut();
      }, checkoutCloseFallbackMs(timeout));
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }, [invoiceId, amount, invoiceNumber, customerName, customerEmail, customerPhone, onSuccess, onOutcome, createOrder, description]);

  if (status === "success") {
    const o = outcome;
    const reference = o?.invoiceNumber ?? invoiceNumber;
    const context = `Payment for ${reference}${o?.receiptNumber ? ` (receipt ${o.receiptNumber})` : ""}`;
    return (
      <div className="animate-rise-in space-y-3" aria-live="polite">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
          <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">Payment received</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {inr(o?.amountPaid ?? amount)} paid · Invoice {reference}
          </p>
        </div>

        {outcomeState === "loading" && (
          <p className="flex items-center justify-center gap-1.5 text-detail text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading your receipt…
          </p>
        )}

        {o && (
          <dl className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card text-sm">
            <OutcomeRow k="Receipt number" v={o.receiptNumber ?? "—"} />
            <OutcomeRow k="Amount paid" v={inr(o.amountPaid)} />
            <OutcomeRow k="Balance due on this invoice" v={o.balanceDue > 0 ? inr(o.balanceDue) : "Fully paid"} />
            {o.booking && <OutcomeRow k="Event" v={`${o.booking.eventName} · ${o.booking.dateLabel}`} />}
            {o.booking && <OutcomeRow k="Booking status" v={o.booking.statusLabel} />}
          </dl>
        )}

        {outcomeState === "error" && (
          <p className="text-center text-detail text-muted-foreground">
            Your payment is recorded against invoice {invoiceNumber}. We couldn&apos;t load the receipt details here
            just now.
          </p>
        )}

        {/* A payment on a cancelled booking is recorded and the team alerted
            (src/lib/holds/paid-without-slot.ts): say the booking isn't active
            rather than pointing to an event that isn't happening. */}
        {o?.booking?.state === "CANCELLED" && (
          <div
            role="status"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900 dark:bg-amber-950/40"
          >
            <p className="font-semibold text-amber-800 dark:text-amber-300">{CANCELLED_BOOKING_TITLE}</p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              {cancelledBookingNotice(o.booking.teamAlerted)}
            </p>
          </div>
        )}

        {/* The app and calendar links only for a booking that is on (outcome-state.ts). */}
        {eventLinks && o?.booking?.state === "LIVE" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild className="h-12 rounded-2xl text-body font-semibold">
              <Link href="/app/event">
                Open your event in the app <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            {o.booking.calendarUrl && (
              <Button asChild variant="outline" className="h-12 rounded-2xl text-body font-semibold">
                <a href={o.booking.calendarUrl}>
                  <CalendarPlus className="mr-1.5 size-4" /> Add to calendar
                </a>
              </Button>
            )}
          </div>
        )}

        <ContactOptions contact={contact} context={context} banner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {status === "timeout" && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900 dark:bg-amber-950/40"
        >
          <p className="flex items-center justify-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
            <Clock className="size-4 shrink-0" /> {CHECKOUT_TIMED_OUT_TITLE}
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{CHECKOUT_TIMED_OUT_DETAIL}</p>
        </div>
      )}
      <Button
        onClick={pay}
        disabled={loading}
        className="button-sheen sheen-sweep relative h-[3.25rem] w-full overflow-hidden rounded-2xl py-3.5 text-base font-semibold"
      >
        {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <CreditCard className="mr-2 size-5" />}
        {loading
          ? "Opening secure checkout…"
          : status === "timeout"
            ? `Try again · Pay ${inr(amount)}`
            : `Pay ${inr(amount)} now`}
      </Button>
      {status === "error" && (
        <div className="space-y-2">
          <p className="flex items-center justify-center gap-1.5 text-center text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </p>
          <ContactOptions contact={contact} context={`Payment for ${invoiceNumber}`} />
        </div>
      )}
      {status === "timeout" && (
        <ContactOptions contact={contact} context={`Checkout timed out: payment for ${invoiceNumber}`} />
      )}
      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-meta font-medium text-muted-foreground">
          <Lock className="size-3" /> Secured by Razorpay
        </span>
      </div>
      <p className="text-center text-detail text-muted-foreground">
        Pay securely by UPI, card, or net banking.
      </p>
    </div>
  );
}
