"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Phone, Sparkles } from "lucide-react";
import { submitBookingInquiry } from "@/actions/storefront.actions";

const OCCASIONS = [
  "Wedding",
  "Reception",
  "Engagement",
  "Birthday Party",
  "Corporate Event",
  "Social Gathering",
  "Anniversary",
  "Other",
];

interface VenueOption {
  id: string;
  name: string;
}

export function BookingForm({ venues }: { venues: VenueOption[] }) {
  const params = useSearchParams();
  const prefillVenueId = params.get("venueId") ?? "";
  const prefillOccasion = params.get("occasion") ?? "";

  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    name: "",
    phone: "",
    email: "",
    eventType: prefillOccasion,
    eventDate: "",
    guestCount: "",
    venueId: prefillVenueId,
    message: "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const venueName = venues.find((v) => v.id === form.venueId)?.name;
    const res = await submitBookingInquiry({
      name: form.name,
      phone: form.phone,
      email: form.email || undefined,
      eventType: form.eventType || undefined,
      eventDate: form.eventDate || undefined,
      guestCount: form.guestCount ? Number(form.guestCount) : undefined,
      venueId: form.venueId || undefined,
      venueName,
      message: form.message || undefined,
    });
    setSubmitting(false);
    if (res.success) setDone(true);
    else setError(res.error ?? "Something went wrong.");
  }

  // ---- Success state ----
  if (done) {
    return (
      <div className="flex flex-col items-center px-6 pt-[calc(var(--sat)+4rem)] text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="size-9" />
        </span>
        <h1 className="mt-5 font-serif text-[24px] font-semibold tracking-tight text-foreground">
          Request received!
        </h1>
        <p className="mt-2 max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
          Thank you, {form.name.split(" ")[0] || "there"}. Our events team will
          reach out shortly to confirm availability and share a personalised
          quote.
        </p>
        <a
          href="tel:+919876543210"
          className="mt-6 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground"
        >
          <Phone className="size-4" /> Call us now
        </a>
        <Link
          href="/app"
          className="mt-3 text-[13px] font-medium text-primary"
        >
          Back to home
        </Link>
      </div>
    );
  }

  // ---- Form ----
  const inputClass =
    "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
  const labelClass = "mb-1.5 block text-[12.5px] font-medium text-foreground";

  return (
    <div className="px-5 pt-[calc(var(--sat)+1.25rem)]">
      <h1 className="font-serif text-[24px] font-semibold tracking-tight text-foreground">
        Check availability
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Tell us about your event — we&apos;ll confirm and send a quote. No
        payment now.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className={labelClass}>Your name *</label>
          <input
            className={inputClass}
            placeholder="e.g. Priya Sharma"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Phone number *</label>
          <input
            className={inputClass}
            type="tel"
            inputMode="tel"
            placeholder="e.g. +91 98765 43210"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Email (optional)</label>
          <input
            className={inputClass}
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Occasion</label>
          <select
            className={inputClass}
            value={form.eventType}
            onChange={(e) => update("eventType", e.target.value)}
          >
            <option value="">Select an occasion</option>
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Event date</label>
            <input
              className={inputClass}
              type="date"
              value={form.eventDate}
              onChange={(e) => update("eventDate", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Guests</label>
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="e.g. 200"
              value={form.guestCount}
              onChange={(e) => update("guestCount", e.target.value)}
            />
          </div>
        </div>

        {venues.length > 0 && (
          <div>
            <label className={labelClass}>Preferred hall (optional)</label>
            <select
              className={inputClass}
              value={form.venueId}
              onChange={(e) => update("venueId", e.target.value)}
            >
              <option value="">No preference</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>Anything else? (optional)</label>
          <textarea
            className={inputClass}
            rows={3}
            placeholder="Tell us about your vision, catering needs, etc."
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-[14px] font-semibold text-primary-foreground shadow-sm transition active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Request a callback
            </>
          )}
        </button>

        <p className="pb-2 text-center text-[11.5px] text-muted-foreground">
          By submitting, you agree to be contacted by Veloria Grand about your
          enquiry.
        </p>
      </form>
    </div>
  );
}
