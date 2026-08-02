"use client";

import { useState, useCallback } from "react";
import { CreditCard, Loader2, CheckCircle2, AlertCircle, Lock, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpChip } from "@/components/public/help-chip";
import {
  createPublicRazorpayOrder,
  verifyPublicRazorpayPayment,
} from "@/actions/payment.actions";

interface PublicPayProps {
  invoiceId: string;
  invoiceNumber: string;
  amount: number; // INR
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  /**
   * Called after a verified, successful payment. Used by the /hold page to
   * router.refresh() so the countdown + release link disappear and the server
   * re-renders the secured state (C4). Optional — /pay works standalone.
   */
  onSuccess?: () => void;
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

export function PublicPay({
  invoiceId,
  invoiceNumber,
  amount,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
}: PublicPayProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const pay = useCallback(async () => {
    setLoading(true);
    setStatus("idle");
    setError("");
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Couldn't load the payment gateway. Please try again.");

      const orderRes = await createPublicRazorpayOrder(invoiceId, amount);
      if (!orderRes.success) throw new Error(orderRes.error || "Couldn't start the payment.");
      const { orderId, amount: paise, currency, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount: paise,
        currency: currency || "INR",
        name: "Veloria Grand",
        description: `Payment for ${invoiceNumber}`,
        order_id: orderId,
        prefill: { name: customerName, email: customerEmail, contact: customerPhone || "" },
        theme: { color: "#7c3aed" },
        handler: async (resp: RazorpayResponse) => {
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
            } else throw new Error(v.error || "Payment could not be confirmed.");
          } catch (e) {
            setStatus("error");
            setError(e instanceof Error ? e.message : "Payment could not be confirmed.");
            // C3: release the button so the customer can retry.
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
  }, [invoiceId, amount, invoiceNumber, customerName, customerEmail, customerPhone, onSuccess]);

  if (status === "success") {
    return (
      <div className="animate-rise-in space-y-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
          <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">Payment received</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Payment of {inr(amount)} received · Ref {invoiceNumber}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-detail font-medium text-emerald-800 dark:text-emerald-300">
            <PhoneCall className="size-3.5" /> Your coordinator will call you within 24 hours.
          </p>
        </div>
        <HelpChip variant="banner" message={`Payment for ${invoiceNumber}`} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={pay}
        disabled={loading}
        className="button-sheen sheen-sweep relative h-[3.25rem] w-full overflow-hidden rounded-2xl py-3.5 text-base font-semibold"
      >
        {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <CreditCard className="mr-2 size-5" />}
        {loading ? "Opening secure checkout…" : `Pay ${inr(amount)} now`}
      </Button>
      {status === "error" && (
        <div className="space-y-2">
          <p className="flex items-center justify-center gap-1.5 text-center text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </p>
          <HelpChip message={`Payment for ${invoiceNumber}`} />
        </div>
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
