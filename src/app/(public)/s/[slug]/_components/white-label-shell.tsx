"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Users } from "lucide-react";

import { submitBookingInquiry, type StorefrontVenue } from "@/actions/storefront.actions";
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {brandName || venue.name}
        </h1>
        {venue.description && (
          <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            {venue.description}
          </p>
        )}
      </div>

      {/* Venue card */}
      <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {venue.name}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
              <Users className="size-3.5" /> Up to {venue.capacity} guests
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">From</p>
            <p
              className="text-lg font-bold tabular-nums"
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
                className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Enquiry */}
      <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {submitted ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2
              className="mb-3 size-12"
              style={{ color: "var(--brand)" }}
            />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Thank you!
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              We&apos;ve received your enquiry and will be in touch shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
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
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Tell us about your event…"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
                style={{ ["--tw-ring-color" as string]: "var(--brand)" } as React.CSSProperties}
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
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
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
        style={{ ["--tw-ring-color" as string]: "var(--brand)" } as React.CSSProperties}
      />
    </div>
  );
}
