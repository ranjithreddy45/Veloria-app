"use client";

import * as React from "react";
import { CalendarHeart, MapPin, FileText, MessageCircle } from "lucide-react";

import { submitBookingInquiry } from "@/actions/storefront.actions";

// ============================================================
// Brochure CTA bar (sticky on mobile) — public, no auth.
// ------------------------------------------------------------
// Each enabled CTA deep-links into an existing public flow:
//  HOLD_DATE  → /hold?venueId=<id>            (createPublicHold flow)
//  BOOK_VISIT → /visit?venueId=<id>&kind=...  (SiteVisitBooking flow);
//               graceful fallback to submitBookingInquiry if /visit 404s.
//  GET_QUOTE  → /configure?venueId=<id>
//  WHATSAPP   → wa.me/<number> prefilled with the brochure title.
// venueId is null unless the pinned venue is active, in which case the
// venue-scoped CTAs are hidden (we never offer holds on an unbookable venue).
// ============================================================

type Cta = "HOLD_DATE" | "BOOK_VISIT" | "GET_QUOTE" | "WHATSAPP";

interface BrochureCtasProps {
  ctas: string[];
  venueId: string | null;
  whatsappNumber: string | null;
  title: string;
  accent: string;
}

function whatsappHref(number: string, title: string): string {
  const digits = number.replace(/[^\d]/g, "");
  const text = encodeURIComponent(`Hi! I'm interested in ${title}. Could you share more details?`);
  return `https://wa.me/${digits}?text=${text}`;
}

export function BrochureCtas({
  ctas,
  venueId,
  whatsappNumber,
  title,
  accent,
}: BrochureCtasProps) {
  const [visitFallbackOpen, setVisitFallbackOpen] = React.useState(false);

  // Venue-scoped CTAs require an active venue; WhatsApp/quote can stand alone.
  const list = (ctas as Cta[]).filter((c) => {
    if (c === "WHATSAPP") return !!whatsappNumber;
    if (c === "HOLD_DATE" || c === "BOOK_VISIT") return !!venueId;
    if (c === "GET_QUOTE") return !!venueId;
    return false;
  });

  if (list.length === 0) return null;

  function navigate(href: string) {
    window.location.href = href;
  }

  async function handleBookVisit() {
    if (!venueId) return;
    // Probe the sibling /visit flow; if it isn't live yet, fall back to enquiry.
    try {
      const res = await fetch(`/visit?venueId=${encodeURIComponent(venueId)}&kind=SITE_VISIT`, {
        method: "HEAD",
      });
      if (res.ok) {
        navigate(`/visit?venueId=${encodeURIComponent(venueId)}&kind=SITE_VISIT`);
        return;
      }
    } catch {
      /* fall through to enquiry fallback */
    }
    setVisitFallbackOpen(true);
  }

  return (
    <div
      className="sticky bottom-0 z-20 -mx-4 border-t border-border/70 bg-card/90 px-4 py-3 backdrop-blur"
      style={{ ["--brand" as string]: accent } as React.CSSProperties}
    >
      <div className="mx-auto flex max-w-2xl flex-wrap gap-2">
        {list.map((cta) => {
          if (cta === "HOLD_DATE") {
            return (
              <button
                key={cta}
                onClick={() => navigate(`/hold?venueId=${encodeURIComponent(venueId as string)}`)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--brand)" }}
              >
                <CalendarHeart className="size-4" /> Hold this date
              </button>
            );
          }
          if (cta === "BOOK_VISIT") {
            return (
              <button
                key={cta}
                onClick={handleBookVisit}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
              >
                <MapPin className="size-4" /> Book a visit
              </button>
            );
          }
          if (cta === "GET_QUOTE") {
            return (
              <button
                key={cta}
                onClick={() =>
                  navigate(`/configure?venueId=${encodeURIComponent(venueId as string)}`)
                }
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
              >
                <FileText className="size-4" /> Get a quote
              </button>
            );
          }
          // WHATSAPP
          return (
            <a
              key={cta}
              href={whatsappHref(whatsappNumber as string, title)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle className="size-4" /> WhatsApp us
            </a>
          );
        })}
      </div>

      {visitFallbackOpen && venueId && (
        <VisitEnquiryFallback
          venueId={venueId}
          title={title}
          accent={accent}
          onClose={() => setVisitFallbackOpen(false)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Minimal enquiry fallback when /visit isn't live — reuses
// submitBookingInquiry so the lead lands in the same CRM pipeline.
// ------------------------------------------------------------
function VisitEnquiryFallback({
  venueId,
  title,
  accent,
  onClose,
}: {
  venueId: string;
  title: string;
  accent: string;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [date, setDate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (phone.replace(/\D/g, "").length < 7) return setError("Please enter a valid phone number.");
    setSubmitting(true);
    try {
      const res = await submitBookingInquiry({
        name: name.trim(),
        phone: phone.trim(),
        eventDate: date || undefined,
        venueId,
        venueName: title,
        message: `Site-visit request from brochure: ${title}`,
      });
      if (res.success) setDone(true);
      else setError(res.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
        {done ? (
          <div className="py-6 text-center">
            <h3 className="text-lg font-semibold text-foreground">Thank you!</h3>
            <p className="mt-1 text-sm text-muted-foreground">We&apos;ll be in touch to schedule your visit.</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">
              Book a visit
            </h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              type="tel"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
            />
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              type="date"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {submitting ? "Sending…" : "Request visit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
