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
        "bg-card shadow-card relative flex flex-col overflow-hidden rounded-2xl border",
        tier.isRecommended ? "border-primary/40 ring-primary/15 ring-2" : "",
      ].join(" ")}
    >
      {tier.isRecommended && (
        <div className="bg-primary text-primary-foreground flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
          <Star className="size-3 fill-current" /> Recommended
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        {!isOnly && (
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.16em]">
            {tier.displayName}
          </p>
        )}

        {/* Headline price */}
        <div className="mt-3">
          <span className="numeric text-foreground text-[30px] font-semibold leading-none">
            {inr(tier.grandTotal)}
          </span>
          <span className="text-muted-foreground ml-2 text-[12px]">
            all inclusive
          </span>
        </div>

        {/* Inclusions */}
        <ul className="mt-6 space-y-2.5 text-[13px]">
          {tier.lines.map((l) => (
            <li key={l.sl} className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                <span>
                  <span className="text-foreground font-medium">
                    {l.particulars}
                  </span>
                  {l.plan ? (
                    <span className="text-muted-foreground/80 block text-[11.5px]">
                      {l.plan}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="numeric text-muted-foreground shrink-0">
                {inr(l.amount)}
              </span>
            </li>
          ))}
        </ul>

        {/* Totals */}
        <div className="bg-muted/50 mt-6 space-y-1.5 rounded-xl p-4 text-[12.5px]">
          <Row label="Subtotal" value={inr(tier.subtotal)} />
          {tier.discountAmount > 0 && (
            <Row
              label="Discount"
              value={`− ${inr(tier.discountAmount)}`}
              accent="text-success"
            />
          )}
          <Row label="Taxes" value={inr(tier.tax)} />
          <div className="divider-fade my-2" />
          <Row label="Grand total" value={inr(tier.grandTotal)} bold />
        </div>

        {/* Payment schedule */}
        {tier.paymentSchedule.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.16em]">
              Payment plan
            </p>
            {tier.paymentSchedule.map((p, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between gap-3 text-[12px]"
              >
                <span className="text-muted-foreground">
                  {p.label}{" "}
                  <span className="numeric text-muted-foreground/70">
                    ({p.pct}%)
                  </span>
                  <span className="text-muted-foreground/70 block text-[10.5px]">
                    {p.dueHint}
                  </span>
                </span>
                <span className="numeric text-foreground shrink-0 font-medium">
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
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={bold ? "text-foreground font-semibold" : "text-muted-foreground"}
      >
        {label}
      </span>
      <span
        className={[
          "numeric",
          bold
            ? "text-foreground font-semibold"
            : accent || "text-foreground/80",
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
    <div className="space-y-7">
      {/* Greeting */}
      <header className="text-center">
        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.18em]">
          Prepared for {view.clientFirstName}
        </p>
        <h1 className="text-foreground mt-3 text-[30px] sm:text-[36px]">
          {view.paid || view.blocked
            ? "Your date is secured"
            : "Your personalised quote"}
        </h1>
        {view.occasion && (
          <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
            Everything we&apos;ve planned for your {view.occasion}, laid out
            clearly.
          </p>
        )}
      </header>

      {/* Event facts */}
      {(eventDateLabel || view.slotLabel || view.venueName || view.guestCount) && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-[12.5px]">
          {view.venueName && (
            <span className="bg-card text-foreground/85 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-medium">
              <MapPin className="text-muted-foreground/60 size-3.5" />{" "}
              {view.venueName}
            </span>
          )}
          {eventDateLabel && (
            <span className="bg-card text-foreground/85 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-medium">
              <CalendarDays className="text-muted-foreground/60 size-3.5" />{" "}
              {eventDateLabel}
            </span>
          )}
          {view.slotLabel && (
            <span className="bg-card text-foreground/85 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-medium">
              <Clock className="text-muted-foreground/60 size-3.5" />{" "}
              {view.slotLabel}
            </span>
          )}
          {view.guestCount ? (
            <span className="bg-card text-foreground/85 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-medium">
              <Users className="text-muted-foreground/60 size-3.5" />{" "}
              <span className="numeric">{view.guestCount}</span> guests
            </span>
          ) : null}
        </div>
      )}

      {/* Live scarcity */}
      {scarcity && !view.paid && !view.blocked && <SlotScarcity token={view.token} initial={scarcity} />}

      {/* Anchor hint for multi-tier */}
      {isMultiTier && (
        <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-[12.5px]">
          <Sparkles className="size-3.5 text-warning" />
          Choose the experience that fits you best — pay 20% to block your date instantly.
        </p>
      )}

      {/* Tiers */}
      <div
        className={isMultiTier ? "grid gap-5 sm:grid-cols-2" : "mx-auto max-w-md"}
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

      {/* Notes / details from the rep */}
      {view.notes && view.notes.trim() && (
        <div className="bg-card shadow-card mx-auto max-w-md rounded-2xl border p-5 text-[13px]">
          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.16em]">
            Notes &amp; details
          </p>
          <p className="text-foreground/85 mt-2 whitespace-pre-wrap leading-relaxed">
            {view.notes}
          </p>
        </div>
      )}

      {/* Social proof */}
      {view.showSocialProof && socialProof && (
        <SocialProofStrip data={socialProof} variant="banner" heading="Why couples & companies pick us" />
      )}
    </div>
  );
}
