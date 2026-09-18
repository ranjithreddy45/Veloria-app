import Link from "next/link";
import { CalendarX2, Check, Clock } from "lucide-react";
import { getPublicHold, type PublicHoldView } from "@/actions/public-hold.actions";
import { ContactChip } from "../../../../_components/contact-chip";
import { PrimaryButton, GhostButton, KeyValue, EmptyNote, Pill, type Tone } from "../../../../_components/ui";
import { inr, slotShortText } from "../../../../_components/format";
import { HeldCountdown } from "./_components/held-countdown";
import { HoldPolicyLinks } from "./_components/hold-policy-links";

// ============================================================
// Hold status in the customer app. Everything shown is read from the team's
// Booking (via getPublicHold → holdPhase), so the customer and the team always
// describe the same record: a placed hold really blocks the date until it
// lapses; after payment the booking status is the team's own status, in the
// customer wording from status-labels.
// ============================================================

export const metadata = { title: "Your date hold — Veloria Grand" };
export const dynamic = "force-dynamic";

const IST = "Asia/Kolkata";

function eventDateLabel(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function momentLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
  const day = d.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
  return `${time} on ${day}`;
}

function statusTone(bookingStatus: string | null): Tone {
  if (bookingStatus === "HOLD") return "gold";
  if (bookingStatus === "CANCELLED" || !bookingStatus) return "grey";
  return "green";
}

function copyFor(h: PublicHoldView, dateLabel: string, until: string | null): { title: string; lede: string } {
  const label = h.bookingStatusLabel ?? "Date on hold";
  switch (h.phase) {
    case "HELD":
      return {
        title: "Your date is held",
        lede: until
          ? `We're holding ${h.venueName} on ${dateLabel} for you until ${until}. Pay the ${inr(h.tokenAmount)} token before then to keep it. If it isn't paid in time, the hold lapses and the date opens to other customers.`
          : `We're holding ${h.venueName} on ${dateLabel} for you. Pay the ${inr(h.tokenAmount)} token to keep it.`,
      };
    case "PAYMENT_PENDING":
      return {
        title: "Checking your payment",
        lede: "Your hold time has passed, but a payment for this hold is still being processed or verified, so the date stays held for now. Refresh in a few minutes, or contact us if nothing changes.",
      };
    case "PAYMENT_RECEIVED":
      return {
        title: h.paid ? "Token received" : "Payment received",
        lede: `${h.paid ? `We've received your ${inr(h.tokenAmount)} token.` : "We've received a payment towards this hold."} Your booking shows "${label}" until our team confirms it.`,
      };
    case "BOOKED":
      return {
        title: `Your booking is ${label.toLowerCase()}`,
        lede: `${h.paid ? `We've received your ${inr(h.tokenAmount)} token. ` : ""}Open your event to see your checklist, guests, payments and documents. If it doesn't appear, sign in with the details you used for this hold.`,
      };
    case "LAPSED":
      return {
        title: "This hold has lapsed",
        lede: `The token wasn't paid by ${until ?? "the end of the hold time"}, so ${h.venueName} on ${dateLabel} is no longer held for you and may be booked by someone else. It may still be free: start again to check and hold it afresh.`,
      };
    case "RELEASED":
      return {
        title: "You released this hold",
        lede: `${h.venueName} on ${dateLabel} is no longer held for you.`,
      };
    case "CANCELLED":
    default:
      return {
        title: "This hold was cancelled",
        lede: "It is no longer active. If you weren't expecting this, please contact us.",
      };
  }
}

export default async function HeldPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await getPublicHold(token);

  if (!res.success) {
    return (
      <div className="flex flex-col gap-4 px-6 pt-[calc(var(--sat)+4rem)]">
        <EmptyNote>{res.error}</EmptyNote>
        <PrimaryButton href="/app/book">Start again</PrimaryButton>
        <ContactChip context="Hi, I need help with a date hold." />
      </div>
    );
  }

  const h = res.data;
  const dateLabel = eventDateLabel(h.dateISO);
  const until = momentLabel(h.expiresAt);
  const { title, lede } = copyFor(h, dateLabel, until);
  const ended = h.phase === "LAPSED" || h.phase === "RELEASED" || h.phase === "CANCELLED";
  const moneyIn = h.phase === "PAYMENT_RECEIVED" || h.phase === "BOOKED";

  const startAgain = `/app/book?${new URLSearchParams({
    venueId: h.venueId,
    date: h.dateISO,
    ...(h.eventType ? { occasion: h.eventType } : {}),
  }).toString()}`;
  const siteVisit = `/visit?${new URLSearchParams({
    venueId: h.venueId,
    kind: "SITE_VISIT",
    guests: String(h.guestCount),
    eventDate: h.dateISO,
    ...(h.eventType ? { eventType: h.eventType } : {}),
  }).toString()}`;

  return (
    <div className="vg-rise-slow flex flex-col items-center gap-[18px] px-6 pb-8 pt-[calc(var(--sat)+3.5rem)] text-center">
      <span
        className={`flex size-[76px] items-center justify-center rounded-full ${
          ended ? "bg-[#e9e9ec]" : "bg-gradient-to-br from-[#f3d489] to-[#b88513] shadow-[0_12px_24px_-12px_rgba(184,133,19,.6)]"
        }`}
      >
        {ended ? (
          <CalendarX2 className="size-9 text-[#636368]" strokeWidth={2.2} />
        ) : moneyIn ? (
          <Check className="size-9 text-white" strokeWidth={3} />
        ) : (
          <Clock className="size-9 text-white" strokeWidth={2.4} />
        )}
      </span>

      <h1 className="font-editorial text-[30px] font-semibold leading-[1.1] tracking-[-.018em]">{title}</h1>
      {h.bookingStatusLabel && <Pill tone={statusTone(h.bookingStatus)}>Booking status: {h.bookingStatusLabel}</Pill>}
      <p className="max-w-[320px] text-body leading-[1.6] text-[#6e6e73]">{lede}</p>

      <div className="w-full text-left">
        <KeyValue
          rows={[
            { k: "Hall", v: h.venueName },
            { k: "Date", v: dateLabel },
            { k: "Slot", v: slotShortText(h.timeSlot) ?? h.slotLabel },
            { k: "Guests", v: h.guestCount.toLocaleString("en-IN") },
            ...(h.eventType ? [{ k: "Occasion", v: h.eventType }] : []),
          ]}
          total={ended ? undefined : { k: h.paid ? "Token paid" : "Token", v: inr(h.tokenAmount) }}
        />
      </div>

      {h.phase === "HELD" && (
        <>
          {h.expiresAt && <HeldCountdown expiresAt={h.expiresAt} />}
          {h.invoiceId ? (
            <PrimaryButton href={`/pay/${h.invoiceId}`}>Pay {inr(h.tokenAmount)} now</PrimaryButton>
          ) : (
            <EmptyNote className="w-full">Payment isn&apos;t available for this hold. Please contact us.</EmptyNote>
          )}
        </>
      )}

      {h.phase === "PAYMENT_PENDING" && (
        <GhostButton href={`/app/book/held/${h.token}`} className="w-full">
          Refresh
        </GhostButton>
      )}

      {moneyIn && <PrimaryButton href="/app/event">Open your event</PrimaryButton>}

      {ended && <PrimaryButton href={startAgain}>Start again</PrimaryButton>}

      {(h.phase === "HELD" || ended) && (
        <Link href={siteVisit} className="py-1 text-body font-semibold text-[#6d1b52]">
          Not ready? Book a site visit
        </Link>
      )}

      <div className="w-full text-left text-detail font-semibold">Our policies</div>
      <HoldPolicyLinks />

      <ContactChip className="w-full" context={`Hi, about my date hold at ${h.venueName} on ${dateLabel}.`} />

      <Link href="/app" className="py-1.5 text-body font-semibold text-[#6d1b52]">
        Back to home
      </Link>
    </div>
  );
}
