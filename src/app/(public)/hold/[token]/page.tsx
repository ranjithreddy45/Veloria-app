import type { Metadata } from "next";
import { CheckCircle2, Clock, CalendarDays, MapPin, Users, PhoneCall } from "lucide-react";
import { getPublicHold } from "@/actions/public-hold.actions";
import { getSocialProof } from "@/lib/public/social-proof";
import { SocialProofStrip } from "@/components/public/social-proof-strip";
import { HelpChip } from "@/components/public/help-chip";
import { HoldPayPanel } from "./_components/hold-pay-panel";

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
      <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
        <h1 className="text-foreground text-[24px]">
          We couldn&apos;t find this hold
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          The link may have expired. Your date could still be open — have
          another look.
        </p>
        <a
          href="/hold"
          className="bg-primary text-primary-foreground mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Check availability
        </a>
        <HelpChip variant="banner" className="mt-6" />
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
    <div className="space-y-6">
      <header className="pb-1 text-center">
        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.18em]">
          For {h.customerFirstName}
        </p>
        <h1 className="text-foreground mt-3 text-[30px] sm:text-[36px]">
          {paid ? "Your date is secured" : "Your date is on hold"}
        </h1>
      </header>

      {/* Summary card */}
      <div className="bg-card shadow-card space-y-3.5 rounded-2xl border p-6">
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
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/25 bg-success/[0.07] p-8 text-center">
            <CheckCircle2 className="size-9 text-success" />
            <p className="font-editorial mt-1 text-[22px] font-semibold text-success">
              Your date is secured
            </p>
            <p className="text-sm text-success/85">
              <span className="numeric">{inr(h.tokenAmount)}</span> received ·{" "}
              {dateLabel} · {h.slotLabel}
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-success">
              <PhoneCall className="size-3.5" /> Your coordinator will call you
              within 24 hours.
            </p>
          </div>
          <HelpChip variant="banner" />
        </div>
      ) : expired || released ? (
        <div className="bg-card shadow-card rounded-2xl border p-8 text-center">
          <p className="font-editorial text-foreground text-[22px] font-semibold">
            {released ? "This hold was released" : "This hold has expired"}
          </p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
            The date is open again — you&apos;re welcome to hold it once more.
          </p>
          <a
            href="/hold"
            className="bg-primary text-primary-foreground mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Check availability
          </a>
          <HelpChip variant="banner" className="mt-6" />
        </div>
      ) : (
        <HoldPayPanel
          token={h.token}
          invoiceId={h.invoiceId}
          tokenAmount={h.tokenAmount}
          customerFirstName={h.customerFirstName}
          expiresAt={h.expiresAt}
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
