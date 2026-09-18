"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CHECKOUT_CLOSE_FALLBACK_MS,
  CHECKOUT_TIMED_OUT_DETAIL,
  CHECKOUT_TIMED_OUT_TITLE,
  RAZORPAY_CHECKOUT_TIMEOUT_SECONDS,
  checkoutClosedByTimeout,
} from "@/lib/holds/checkout-timeout";

// ============================================================
// Types
// ============================================================

interface RazorpayCheckoutProps {
  invoiceId: string;
  invoiceNumber: string;
  amount: number; // in INR (not paise)
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  description?: string;
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

// ============================================================
// Load Razorpay Script
// ============================================================

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ============================================================
// Razorpay Checkout Component
// ============================================================

export function RazorpayCheckout({
  invoiceId,
  invoiceNumber,
  amount,
  customerName,
  customerEmail,
  customerPhone,
  description,
}: RazorpayCheckoutProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  // "timeout": the checkout closed on its time limit (src/lib/holds/checkout-timeout.ts).
  const [status, setStatus] = useState<"idle" | "success" | "error" | "timeout">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  // The page's own close, for a checkout Razorpay leaves open past its timeout.
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const timer = closeTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  const handlePayment = useCallback(async () => {
    setIsLoading(true);
    setStatus("idle");
    setErrorMessage("");
    window.clearTimeout(closeTimer.current);

    try {
      // 1. Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Failed to load payment gateway. Please try again.");
      }

      // 2. Create order
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          amount,
          receipt: invoiceNumber,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create payment order.");
      }

      const { orderId, amount: amountInPaise, currency, keyId } = orderData.data;

      // The checkout closes before the 15-minute protection a started checkout
      // gives a hold runs out (src/lib/holds/checkout-timeout.ts); a close on
      // that timeout says so instead of silently resetting the button.
      let openedAt = 0;
      let paid = false; // Razorpay handed back a payment: the verify call decides what shows
      let closed = false;
      const timedOut = () => {
        setStatus("timeout");
        setIsLoading(false);
      };

      // 3. Open Razorpay checkout
      const options = {
        key: keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: amountInPaise,
        currency: currency || "INR",
        name: "Veloria Grand",
        description: description || `Payment for ${invoiceNumber}`,
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone || "",
        },
        theme: {
          color: "#4f46e5",
        },
        timeout: RAZORPAY_CHECKOUT_TIMEOUT_SECONDS,
        handler: async (response: RazorpayResponse) => {
          paid = true;
          window.clearTimeout(closeTimer.current);
          try {
            // 4. Verify payment
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                invoiceId,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              setStatus("success");
              // Refresh page data after a short delay
              setTimeout(() => {
                router.refresh();
              }, 2000);
            } else {
              throw new Error(
                verifyData.error || "Payment verification failed."
              );
            }
          } catch (err) {
            setStatus("error");
            setErrorMessage(
              err instanceof Error
                ? err.message
                : "Payment verification failed. Please contact support."
            );
          }
        },
        modal: {
          ondismiss: (reason?: unknown) => {
            closed = true;
            window.clearTimeout(closeTimer.current);
            setIsLoading(false);
            if (!paid && checkoutClosedByTimeout(openedAt, Date.now(), reason)) timedOut();
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on(
        "payment.failed",
        (response: { error: { description: string } }) => {
          setStatus("error");
          setErrorMessage(
            response.error.description || "Payment failed. Please try again."
          );
          setIsLoading(false);
        }
      );

      openedAt = Date.now();
      razorpay.open();
      // If Razorpay hasn't closed the checkout by now, close it here, still
      // inside the hold's checkout protection.
      closeTimer.current = window.setTimeout(() => {
        if (paid || closed) return;
        closed = true;
        try {
          razorpay.close();
        } catch {
          // Already closed.
        }
        timedOut();
      }, CHECKOUT_CLOSE_FALLBACK_MS);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setIsLoading(false);
    }
  }, [
    invoiceId,
    invoiceNumber,
    amount,
    customerName,
    customerEmail,
    customerPhone,
    description,
    router,
  ]);

  // Success state
  if (status === "success") {
    return (
      <div className="rounded-xl border border-success/20 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h3 className="mt-3 text-base font-semibold text-success">
          Payment Successful!
        </h3>
        <p className="mt-1 text-sm text-success">
          Your payment has been processed. This page will refresh shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Message, or the checkout's time limit running out */}
      {(status === "error" || status === "timeout") && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
          <AlertCircle className="size-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {status === "timeout" ? CHECKOUT_TIMED_OUT_TITLE : "Payment Failed"}
            </p>
            <p className="mt-0.5 text-sm text-destructive">
              {status === "timeout" ? CHECKOUT_TIMED_OUT_DETAIL : errorMessage}
            </p>
          </div>
        </div>
      )}

      {/* Pay Button */}
      <Button
        onClick={handlePayment}
        disabled={isLoading}
        size="lg"
        className="w-full bg-primary text-white hover:bg-primary/90 disabled:opacity-50 text-base py-6 rounded-xl shadow-lg shadow-primary/20 transition-all duration-200"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 size-5" />
            Pay{" "}
            {new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(amount)}{" "}
            Now
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Secured by Razorpay. Your payment information is encrypted.
      </p>
    </div>
  );
}
