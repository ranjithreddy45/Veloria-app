"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Loader2, Sparkles } from "lucide-react";
import { submitBookingInquiry } from "@/actions/storefront.actions";
import { HelpChip } from "@/components/public/help-chip";

// Values here are sent verbatim as the enquiry's eventType, so each label must
// carry through as picked (no "Sangeet" → "Social Gathering" style remaps).
const OCCASIONS = [
  "Wedding",
  "Reception",
  "Engagement",
  "Sangeet",
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
      <div className="bg-aura bg-grid-faint animate-rise-in flex min-h-screen flex-col items-center px-6 pt-[calc(var(--sat)+4rem)] text-center">
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
        <p className="mt-3 inline-flex max-w-xs items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Clock className="size-3.5" /> Our team will call you within 2 hours
          (10am–8pm).
        </p>
        <HelpChip
          variant="banner"
          className="mt-6 w-full max-w-xs"
          message={`Hi, I just submitted an enquiry${
            form.name ? ` (${form.name})` : ""
          } and would like to talk to the events team.`}
        />
        <Link
          href="/app"
          className="mt-4 text-[13px] font-bold text-violet-600"
        >
          Back to home
        </Link>
      </div>
    );
  }

  // ---- Form ----
  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20";
  const labelClass = "mb-1.5 block text-[12.5px] font-bold text-zinc-700";

  return (
    <div className="bg-aura bg-grid-faint min-h-screen bg-zinc-50 px-5 pt-[calc(var(--sat)+1.25rem)]">
      <h1 className="large-title text-ink-gradient text-[26px]">
        Request a callback
      </h1>
      <p className="mt-1 text-[13px] text-zinc-500">
        Tell us about your event — our team will confirm availability and send a
        personalised quote. No payment now.
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
              min={new Date().toISOString().slice(0, 10)}
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
          className="sheen-sweep relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-[15px] font-extrabold text-white shadow-md shadow-violet-600/25 transition active:scale-[0.99] disabled:opacity-60"
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
