"use client";

// ============================================================
// HoldPayPanel — the interactive "pay to secure this hold" block (C4).
// ------------------------------------------------------------
// The /hold page is a server component; before this panel, a successful
// PublicPay left the amber countdown ticking to "expired" and the "Release
// this hold" link live — a page that contradicted itself right after the
// customer paid. This client boundary fixes that: on a verified payment it
//   1. flips to a clean "Payment received" confirmation locally (instant), and
//   2. router.refresh()es so the server re-renders the secured state on reload.
// The countdown + release link only render while unpaid.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PhoneCall } from "lucide-react";
import { PublicPay } from "@/app/pay/[token]/_components/public-pay";
import { HelpChip } from "@/components/public/help-chip";
import { HoldCountdown, ReleaseLink } from "../../_components/availability-calendar";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function HoldPayPanel({
  token,
  invoiceId,
  tokenAmount,
  customerFirstName,
  expiresAt,
  socialProof,
}: {
  token: string;
  invoiceId: string | null;
  tokenAmount: number;
  customerFirstName: string;
  expiresAt: string | null;
  socialProof: React.ReactNode;
}) {
  const router = useRouter();
  const [paid, setPaid] = useState(false);

  if (paid) {
    // Clean confirmation — no countdown, no release link, no contradiction.
    return (
      <div className="animate-rise-in space-y-3">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
            Payment received — your date is secured
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Payment of {inr(tokenAmount)} received — this date is now blocked for you.
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-emerald-800 dark:text-emerald-300">
            <PhoneCall className="size-3.5" /> Your coordinator will call you within 24 hours.
          </p>
        </div>
        <HelpChip variant="banner" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Countdown */}
      {expiresAt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <HoldCountdown expiresAt={expiresAt} />
        </div>
      )}

      {/* Social proof — matched 5★ reviews + past-event photos */}
      {socialProof}

      {/* Pay token */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Pay a token of{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{inr(tokenAmount)}</span>{" "}
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
              onSuccess={() => {
                setPaid(true);
                router.refresh();
              }}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-600">
                Payment isn&apos;t available for this hold. Please contact us.
              </p>
              <HelpChip />
            </div>
          )}
        </div>
      </div>

      {/* Release link */}
      <ReleaseLink token={token} />
    </div>
  );
}
