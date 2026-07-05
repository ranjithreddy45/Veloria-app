import { CalendarDays, Clock, Sparkles, Check, Star, Users, MapPin } from "lucide-react";
import { SocialProofStrip } from "@/components/public/social-proof-strip";
import type { SocialProofData } from "@/lib/public/social-proof-types";
import { OneTapPay } from "./one-tap-pay";
import { SlotScarcity } from "./slot-scarcity";
import type { PublicQuoteTier, PublicQuoteView, PublicSlotScarcity } from "./public-quote-types";

// ============================================================
// PublicQuoteView — customer-facing quote presentation (PUBLIC).
// ------------------------------------------------------------
// Pure props in. Renders the frozen, projected quote: Good-Better-Best tiers
// side-by-side (each from its own outputsJson snapshot), the live slot
// scarcity, the one-tap "Pay 20% to block your date" CTA, and an optional
// read-only social-proof strip. Carries NO internal data (the projection is
// the only contract — see public-quote-types.ts).
// ============================================================

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function TierCard({
  tier,
  view,
  isOnly,
  slotBusy,
  eventDateLabel,
}: {
  tier: PublicQuoteTier;
  view: PublicQuoteView;
  isOnly: boolean;
  slotBusy: boolean;
  eventDateLabel: string | null;
}) {
  const secured = view.paid || view.blocked || tier.isSelected;
  return (
    <div
      className={[
        "relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-zinc-900",
        tier.isRecommended
          ? "border-violet-300 ring-2 ring-violet-200 dark:border-violet-700 dark:ring-violet-900/50"
          : "border-zinc-200 dark:border-zinc-800",
      ].join(" ")}
    >
      {tier.isRecommended && (
        <div className="flex items-center justify-center gap-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-white">
          <Star className="size-3 fill-white" /> Recommended
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {!isOnly && (
          <p className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {tier.displayName}
          </p>
        )}

        {/* Headline price */}
        <div className="mt-2">
          <span className="large-title text-2xl tabular-nums text-ink-gradient">
            {inr(tier.grandTotal)}
          </span>
          <span className="ml-1 text-[12px] text-zinc-400">all inclusive</span>
        </div>

        {/* Inclusions */}
        <ul className="mt-4 space-y-2 text-[13px]">
          {tier.lines.map((l) => (
            <li key={l.sl} className="flex items-start justify-between gap-3">
              <span className="flex items-start gap-1.5 text-zinc-600 dark:text-zinc-300">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{l.particulars}</span>
                  {l.plan ? <span className="block text-[11.5px] text-zinc-400">{l.plan}</span> : null}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-zinc-500">{inr(l.amount)}</span>
            </li>
          ))}
        </ul>

        {/* Totals */}
        <div className="mt-4 space-y-1.5 rounded-xl bg-zinc-50/70 p-3.5 text-[12.5px] dark:bg-zinc-800/40">
          <Row label="Subtotal" value={inr(tier.subtotal)} />
          {tier.discountAmount > 0 && (
            <Row label="Discount" value={`− ${inr(tier.discountAmount)}`} accent="text-emerald-600" />
          )}
          <Row label="Taxes" value={inr(tier.tax)} />
          <div className="divider-fade my-2" />
          <Row label="Grand total" value={inr(tier.grandTotal)} bold />
        </div>

        {/* Payment schedule */}
        {tier.paymentSchedule.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-zinc-400">
              Payment plan
            </p>
            {tier.paymentSchedule.map((p, i) => (
              <div key={i} className="flex items-baseline justify-between text-[12px]">
                <span className="text-zinc-500">
                  {p.label} <span className="text-zinc-400">({p.pct}%)</span>
                  <span className="block text-[10.5px] text-zinc-400">{p.dueHint}</span>
                </span>
                <span className="shrink-0 tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
                  {inr(p.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pay CTA */}
        <div className="mt-5">
          <OneTapPay
            token={view.token}
            advanceAmount={tier.advanceAmount}
            customerName={view.clientFirstName}
            slotBusy={!secured && slotBusy}
            alreadySecured={secured}
            tierQuotationId={view.tiers.length > 1 ? tier.quotationId : undefined}
            eventDateLabel={eventDateLabel}
            slotLabel={view.slotLabel}
          />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={bold ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}>
        {label}
      </span>
      <span
        className={[
          "tabular-nums",
          bold ? "font-semibold text-zinc-900 dark:text-zinc-100" : accent || "text-zinc-600 dark:text-zinc-300",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

export function PublicQuoteView({
  view,
  scarcity,
  socialProof,
}: {
  view: PublicQuoteView;
  scarcity: PublicSlotScarcity | null;
  socialProof: SocialProofData | null;
}) {
  const eventDateLabel = view.eventDate
    ? new Date(view.eventDate).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;

  const tiers = [...view.tiers].sort((a, b) => a.order - b.order);
  const isMultiTier = tiers.length > 1;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <header className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {view.paid || view.blocked ? "Your date is secured" : "Your personalised quote"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Hi {view.clientFirstName} 👋{view.occasion ? ` — here's your plan for the ${view.occasion}.` : ""}
        </p>
      </header>

      {/* Event facts */}
      {(eventDateLabel || view.slotLabel || view.venueName || view.guestCount) && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-[12.5px]">
          {view.venueName && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <MapPin className="size-3.5 text-violet-600" /> {view.venueName}
            </span>
          )}
          {eventDateLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <CalendarDays className="size-3.5 text-violet-600" /> {eventDateLabel}
            </span>
          )}
          {view.slotLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <Clock className="size-3.5 text-violet-600" /> {view.slotLabel}
            </span>
          )}
          {view.guestCount ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <Users className="size-3.5 text-violet-600" /> {view.guestCount} guests
            </span>
          ) : null}
        </div>
      )}

      {/* Live scarcity */}
      {scarcity && !view.paid && !view.blocked && <SlotScarcity token={view.token} initial={scarcity} />}

      {/* Anchor hint for multi-tier */}
      {isMultiTier && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[12.5px] text-zinc-500">
          <Sparkles className="size-3.5 text-amber-500" />
          Choose the experience that fits you best — pay 20% to block your date instantly.
        </p>
      )}

      {/* Tiers */}
      <div
        className={
          isMultiTier
            ? "grid gap-4 sm:grid-cols-2"
            : "mx-auto max-w-md"
        }
      >
        {tiers.map((t) => (
          <TierCard
            key={t.id}
            tier={t}
            view={view}
            isOnly={!isMultiTier}
            slotBusy={scarcity ? !scarcity.selectedSlotFree : false}
            eventDateLabel={eventDateLabel}
          />
        ))}
      </div>

      {/* Social proof */}
      {view.showSocialProof && socialProof && (
        <SocialProofStrip data={socialProof} variant="banner" heading="Why couples & companies pick us" />
      )}
    </div>
  );
}
