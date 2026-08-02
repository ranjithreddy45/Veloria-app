"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Users } from "lucide-react";

import { submitBookingInquiry, type StorefrontVenue } from "@/actions/storefront.actions";
import { getSocialProofAction } from "@/actions/public-social-proof.actions";
import { SocialProofStrip } from "@/components/public/social-proof-strip";
import { EMPTY_SOCIAL_PROOF, type SocialProofData } from "@/lib/public/social-proof-types";
import { formatINR } from "@/lib/utils";

// ============================================================
// White-label themed shell + public enquiry form.
// Applies primaryColor via a CSS var; reuses submitBookingInquiry so the lead
// flows into the same CRM pipeline, stamped with venueId.
// ============================================================

interface WhiteLabelShellProps {
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  venue: StorefrontVenue;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function WhiteLabelShell({
  brandName,
  logoUrl,
  primaryColor,
  venue,
}: WhiteLabelShellProps) {
  const accent = primaryColor && HEX.test(primaryColor) ? primaryColor : "#4f46e5";

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [eventDate, setEventDate] = React.useState("");
  const [guestCount, setGuestCount] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Social proof — venue-matched 5★ reviews + past-event photos. Best-effort:
  // fetched via the no-auth action (never throws); on failure the strip stays
  // empty and renders nothing, so it can never block the storefront.
  const [socialProof, setSocialProof] = React.useState<SocialProofData>(EMPTY_SOCIAL_PROOF);
  React.useEffect(() => {
    let active = true;
    getSocialProofAction({ venueId: venue.id })
      .then((res) => {
        if (active) setSocialProof(res);
      })
      .catch(() => {
        /* best-effort — keep empty */
      });
    return () => {
      active = false;
    };
  }, [venue.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitBookingInquiry({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        eventDate: eventDate || undefined,
        guestCount: guestCount ? Number(guestCount) : undefined,
        venueId: venue.id,
        venueName: brandName || venue.name,
        message: message.trim() || undefined,
      });
      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="space-y-8"
      style={{ ["--brand" as string]: accent } as React.CSSProperties}
    >
      {/* Brand header */}
      <div className="flex flex-col items-center text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={brandName || venue.name}
            className="mb-3 h-14 w-auto object-contain"
          />
        ) : (
          <div
            className="mb-3 flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-white"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {(brandName || venue.name).charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-foreground text-h1 sm:text-h1">
          {brandName || venue.name}
        </h1>
        {venue.description && (
          <p className="text-muted-foreground mt-3 max-w-md text-copy leading-relaxed">
            {venue.description}
          </p>
        )}
      </div>

      {/* Venue card */}
      <div className="bg-card shadow-card rounded-2xl border p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-editorial text-foreground text-lede font-semibold">
              {venue.name}
            </p>
            <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
              <Users className="size-3.5" /> Up to {venue.capacity} guests
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground/80 text-meta font-semibold uppercase tracking-[0.14em]">From</p>
            <p
              className="numeric mt-1 text-lede font-semibold"
              style={{ color: "var(--brand)" }}
            >
              {formatINR(venue.pricePerSlot)}
            </p>
          </div>
        </div>
        {venue.amenities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {venue.amenities.map((a) => (
              <span
                key={a}
                className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-meta"
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Social proof — venue gallery + matched 5★ reviews */}
      <SocialProofStrip
        variant="gallery"
        data={socialProof}
        heading="Recent celebrations here"
      />

      {/* Enquiry */}
      <div className="bg-card shadow-card rounded-2xl border p-5 sm:p-6">
        {submitted ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2
              className="mb-3 size-12"
              style={{ color: "var(--brand)" }}
            />
            <h2 className="font-editorial text-foreground text-title font-semibold">
              Thank you
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              We&apos;ve received your enquiry and will be in touch shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="font-editorial text-foreground text-title font-semibold">
              Enquire now
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LabeledInput
                label="Name *"
                value={name}
                onChange={setName}
                placeholder="Your name"
              />
              <LabeledInput
                label="Phone *"
                value={phone}
                onChange={setPhone}
                placeholder="Phone number"
                type="tel"
              />
              <LabeledInput
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@email.com"
                type="email"
              />
              <LabeledInput
                label="Event date"
                value={eventDate}
                onChange={setEventDate}
                type="date"
              />
              <LabeledInput
                label="Guest count"
                value={guestCount}
                onChange={setGuestCount}
                type="number"
                placeholder="e.g. 250"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-body font-medium">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Tell us about your event…"
                className="bg-card text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                style={{ ["--tw-ring-color" as string]: "var(--brand)" } as React.CSSProperties}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Send enquiry
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-muted-foreground text-body font-medium">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-card text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
        style={{ ["--tw-ring-color" as string]: "var(--brand)" } as React.CSSProperties}
      />
    </div>
  );
}
