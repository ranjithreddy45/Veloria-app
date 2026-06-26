import type { Metadata } from "next";
import { CheckCircle2, Clock, CalendarDays, MapPin, Users } from "lucide-react";
import { getPublicHold } from "@/actions/public-hold.actions";
import { getSocialProof } from "@/lib/public/social-proof";
import { SocialProofStrip } from "@/components/public/social-proof-strip";
import { PublicPay } from "@/app/pay/[token]/_components/public-pay";
import { HoldCountdown, ReleaseLink } from "../_components/availability-calendar";

// ============================================================
// PUBLIC (no auth) — hold confirmation + token Razorpay payment.
// Tokenized access only; the token is the unguessable PublicHold.token.
// Reuses the EXISTING PublicPay client (createPublicRazorpayOrder /
// verifyPublicRazorpayPayment) pointed at the hold's token Invoice.
// ============================================================

export const metadata: Metadata = {
  title: "Your date hold — Veloria Grand",
  robots: { index: false, follow: false }, // tokenized page; keep out of search
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default async function HoldConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await getPublicHold(token);

  if (!res.success) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          We couldn&apos;t find this hold
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          The link may have expired. Please check availability again.
        </p>
        <a
          href="/hold"
          className="mt-4 inline-block rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Check availability
        </a>
      </div>
    );
  }

  const h = res.data;
  const dateLabel = new Date(h.dateISO + "T00:00:00.000Z").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const paid = h.paid;
  const expired = h.status === "EXPIRED";
  const released = h.status === "RELEASED";

  // Social proof — best-effort (getSocialProof never throws; returns empty on
  // failure). A proof-query failure must never block the hold/pay surface.
  const socialProof = await getSocialProof({
    eventType: h.eventType ?? undefined,
    venueId: h.venueId,
  }).catch(() => null);

  return (
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {paid ? "Your date is secured" : "Your date is on hold"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Hi {h.customerFirstName} 👋</p>
      </header>

      {/* Summary card */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Row icon={<MapPin className="size-4 text-violet-600" />} label="Venue" value={h.venueName} />
        <Row icon={<CalendarDays className="size-4 text-violet-600" />} label="Date" value={dateLabel} />
        <Row icon={<Clock className="size-4 text-violet-600" />} label="Slot" value={h.slotLabel} />
        <Row icon={<Users className="size-4 text-violet-600" />} label="Guests" value={String(h.guestCount)} />
      </div>

      {paid ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
            Token received — your date is secured
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Thank you! Our team will reach out shortly to plan the details.
          </p>
        </div>
      ) : expired || released ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {released ? "This hold was released" : "This hold has expired"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            The date is open again. You can check availability and hold it once more.
          </p>
          <a
            href="/hold"
            className="mt-4 inline-block rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Check availability
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Countdown */}
          {h.expiresAt && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              <HoldCountdown expiresAt={h.expiresAt} />
            </div>
          )}

          {/* Social proof — matched 5★ reviews + past-event photos */}
          {socialProof && (
            <SocialProofStrip variant="banner" data={socialProof} />
          )}

          {/* Pay token */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Pay a token of{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{inr(h.tokenAmount)}</span>{" "}
              to confirm and secure this date.
            </p>
            <div className="mt-4">
              {h.invoiceId ? (
                <PublicPay
                  invoiceId={h.invoiceId}
                  invoiceNumber="date hold"
                  amount={h.tokenAmount}
                  customerName={h.customerFirstName}
                  customerEmail=""
                />
              ) : (
                <p className="text-sm text-red-600">
                  Payment isn&apos;t available for this hold. Please contact us.
                </p>
              )}
            </div>
          </div>

          {/* Release link */}
          <ReleaseLink token={h.token} />
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-zinc-500">
        {icon}
        {label}
      </span>
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}
