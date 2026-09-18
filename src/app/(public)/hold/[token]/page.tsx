import type { Metadata } from "next";
import Link from "next/link";
import { Clock, CalendarDays, MapPin, Users } from "lucide-react";
import { getPublicHold } from "@/actions/public-hold.actions";
import { getSocialProof } from "@/lib/public/social-proof";
import { SocialProofStrip } from "@/components/public/social-proof-strip";
import { HelpChip } from "@/components/public/help-chip";
import { getPublicContact } from "@/lib/public/business-contact";
import { HoldPayPanel, HoldPaymentResult } from "./_components/hold-pay-panel";
import { getHoldPaymentOutcome } from "./hold-payment-outcome";
import { holdPaymentCopy, type HoldPaymentState } from "./hold-payment-result";

// ============================================================
// PUBLIC (no auth) — hold confirmation + token Razorpay payment.
// Tokenized access only; the token is the unguessable PublicHold.token.
// Reuses the EXISTING PublicPay client (createPublicRazorpayOrder /
// verifyPublicRazorpayPayment) pointed at the hold's token Invoice.
//
// Once paid, the page says what the /pay result would say about the booking
// (outcome-state.ts): "Your date is secured" only for a live booking, and a
// payment on a cancelled booking is told the booking isn't active.
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
  // The help buttons use the numbers the team keeps in Settings → Business contact.
  const [res, contact] = await Promise.all([getPublicHold(token), getPublicContact()]);

  if (!res.success) {
    return (
      <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
        <h1 className="text-foreground text-h2">
          We couldn&apos;t find this hold
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          The link may have expired. Your date could still be open — have
          another look.
        </p>
        <Link
          href="/hold"
          className="bg-primary text-primary-foreground mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Check availability
        </Link>
        <HelpChip variant="banner" className="mt-6" contact={contact} />
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
  // Once paid, the booking's outcome, read the way the /pay result reads it.
  const [socialProof, payment] = await Promise.all([
    getSocialProof({
      eventType: h.eventType ?? undefined,
      venueId: h.venueId,
    }).catch(() => null),
    paid ? getHoldPaymentOutcome(h.token) : Promise.resolve(null),
  ]);
  const paidState: HoldPaymentState = payment?.state ?? "UNKNOWN";
  const teamAlerted = payment?.teamAlerted ?? false;

  return (
    <div className="space-y-6">
      <header className="pb-1 text-center">
        <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.18em]">
          For {h.customerFirstName}
        </p>
        <h1 className="text-foreground mt-3 text-h1 sm:text-h1">
          {paid
            ? holdPaymentCopy(paidState, { amount: inr(h.tokenAmount), teamAlerted }).heading
            : expired || released
              ? "Your date hold"
              : "Your date is on hold"}
        </h1>
      </header>

      {/* Summary card */}
      <div className="bg-card shadow-card space-y-3.5 rounded-2xl border p-5 sm:p-6">
        <Row
          icon={<MapPin className="text-muted-foreground/60 size-4" />}
          label="Venue"
          value={h.venueName}
        />
        <Row
          icon={<CalendarDays className="text-muted-foreground/60 size-4" />}
          label="Date"
          value={dateLabel}
        />
        <Row
          icon={<Clock className="text-muted-foreground/60 size-4" />}
          label="Slot"
          value={h.slotLabel}
        />
        <Row
          icon={<Users className="text-muted-foreground/60 size-4" />}
          label="Guests"
          value={String(h.guestCount)}
        />
      </div>

      {paid ? (
        <HoldPaymentResult
          state={paidState}
          teamAlerted={teamAlerted}
          amount={h.tokenAmount}
          contact={contact}
          reference={`My date hold: ${h.venueName}, ${dateLabel}, ${h.slotLabel}`}
        />
      ) : expired || released ? (
        <div className="bg-card shadow-card rounded-2xl border p-8 text-center">
          <p className="font-editorial text-foreground text-title font-semibold">
            {released ? "This hold was released" : "This hold has expired"}
          </p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
            The date is open again — you&apos;re welcome to hold it once more.
          </p>
          <Link
            href="/hold"
            className="bg-primary text-primary-foreground mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Check availability
          </Link>
          <HelpChip variant="banner" className="mt-6" contact={contact} />
        </div>
      ) : (
        <HoldPayPanel
          token={h.token}
          invoiceId={h.invoiceId}
          tokenAmount={h.tokenAmount}
          customerFirstName={h.customerFirstName}
          expiresAt={h.expiresAt}
          contact={contact}
          socialProof={
            socialProof ? <SocialProofStrip variant="banner" data={socialProof} /> : null
          }
        />
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
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-foreground text-right font-medium">{value}</span>
    </div>
  );
}
