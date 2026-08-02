// ============================================================
// /api/landing-lead  (POST, PUBLIC)
// ------------------------------------------------------------
// Drop-in endpoint for the veloriagrand.com landing page.
//
// The landing page's existing submitLead() already POSTs this exact FLAT
// payload to a `LEAD_ENDPOINT` variable — which shipped as the placeholder
// "/cgi-bin/lead.cgi" (a 404 whose error was swallowed by .catch), so every
// enquiry was silently discarded. Pointing LEAD_ENDPOINT here is a ONE-LINE
// change on the site; this route accepts the payload as-is so no other markup
// or JS has to change.
//
// Payload (from the live page):
//   { name, phone, eventType, guests, date, page, submittedAt,
//     utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid }
// ============================================================

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { clientIpFromHeaders } from "@/lib/hr/geo";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Origins allowed to post.
 *
 * BOTH spellings of the brand are live sites: veloriagrand.com AND
 * theveloriagrand.com. Only the first was listed, so a form on
 * theveloriagrand.com received `Access-Control-Allow-Origin: veloriagrand.com`,
 * the browser refused the response, and the enquiry was silently lost — the
 * failure is invisible on the page, which is the worst kind.
 *
 * Add more without a deploy via LANDING_LEAD_ORIGINS (comma-separated), e.g. a
 * new campaign microsite or a page builder's preview domain.
 */
const ALLOWED_ORIGINS = new Set(
  [
    "https://veloriagrand.com",
    "https://www.veloriagrand.com",
    "https://theveloriagrand.com",
    "https://www.theveloriagrand.com",
    "https://app.theveloriagrand.com",
    ...(process.env.LANDING_LEAD_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean),
  ].map((o) => o.toLowerCase())
);

function corsHeaders(origin: string | null): Record<string, string> {
  // Echo only known origins; fall back to the primary site rather than "*" so
  // this endpoint isn't a free lead-injection surface for any website.
  const normalized = origin?.trim().toLowerCase().replace(/\/$/, "") ?? "";
  // In development, echo any localhost origin — otherwise the embeddable form
  // can never be tested from a locally-served page, which is exactly how it will
  // be integrated. Production is unaffected: the allowlist still governs there.
  const isLocalDev =
    process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
  const allow =
    normalized && (ALLOWED_ORIGINS.has(normalized) || isLocalDev) ? origin! : "https://veloriagrand.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** "50–100" / "100-180" / "Not sure yet" → a usable number (midpoint), or undefined. */
function parseGuests(v: unknown): number | undefined {
  const s = String(v ?? "").replace(/[–—]/g, "-"); // en/em dash → hyphen
  const nums = s.match(/\d+/g);
  if (!nums || nums.length === 0) return undefined;
  if (nums.length === 1) return Number(nums[0]);
  const lo = Number(nums[0]);
  const hi = Number(nums[1]);
  return Math.round((lo + hi) / 2);
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const h = await headers();
  const ip = clientIpFromHeaders(h.get("x-forwarded-for"), h.get("x-real-ip")) || "unknown";

  // Generous: a landing page behind one NAT/office IP can legitimately send
  // several enquiries an hour. Blocks only obvious flooding.
  const rl = checkRateLimit(`landing-lead:${ip}`, { maxRequests: 20, windowSeconds: 3600 });
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: cors });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400, headers: cors });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 422, headers: cors });

  // Phone. This previously required /^[6-9]\d{9}$/ AND did `slice(-10)`, which
  // BOTH rejected every overseas enquiry outright and destroyed the country code
  // of anyone who typed one. Veloria takes destination-wedding and NRI business,
  // so a UK or UAE number must be accepted, not 422'd.
  //
  // We keep a leading "+" (or a 00 prefix) so captureLeadFromExternal can
  // canonicalise it properly; a bare 10-digit Indian mobile still works exactly
  // as before. Validation is now "plausibly a phone" (E.164 allows 7-15 digits).
  const rawPhone = String(body.phone ?? "").trim();
  const digits = rawPhone.replace(/\D/g, "");
  const hasCountryCode = rawPhone.startsWith("+") || digits.startsWith("00");
  const phone = hasCountryCode
    ? `+${digits.replace(/^00/, "")}`
    : digits.replace(/^0+/, "");

  if (digits.length < 7 || digits.length > 15) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid phone number (include your country code if you're outside India)." },
      { status: 422, headers: cors }
    );
  }
  // A bare number with no country code must still look like an Indian mobile —
  // that is the only case where we can safely infer +91 downstream.
  if (!hasCountryCode && !/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json(
      { ok: false, error: "Enter a 10-digit Indian mobile, or include your country code (e.g. +44…)." },
      { status: 422, headers: cors }
    );
  }

  // Email. This endpoint previously did not read `body.email` AT ALL — the
  // site could send one and it was dropped on the floor, so every website
  // enquiry reached the CRM with a phone and no email address.
  //
  // Deliberately NOT mandatory here: the landing page's own form may not ask
  // for one, and refusing a lead that arrived with a real phone number would
  // lose business to enforce a field the visitor was never shown. A malformed
  // value is dropped rather than 422'd, for the same reason — the lead is
  // still worth having.
  const rawEmail = [body.email, body.email_address, body.emailAddress]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .find(Boolean);
  // Loose on purpose: rejects nonsense, does not police RFC 5322.
  const email =
    rawEmail && /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(rawEmail) ? rawEmail : undefined;

  const eventType = String(body.eventType ?? "").trim() || undefined;
  const eventDate = String(body.date ?? "").trim() || undefined;
  const guestCount = parseGuests(body.guests);
  const str = (k: string) => {
    const v = body[k];
    const s = typeof v === "string" ? v.trim() : "";
    return s || undefined;
  };

  try {
    const res = await captureLeadFromExternal({
      name,
      phone,
      email,
      source: "WEBSITE",
      eventType,
      eventDate,
      guestCount,
      message: [
        eventType ? `Event: ${eventType}` : null,
        body.guests ? `Guests: ${String(body.guests)}` : null,
        eventDate ? `Preferred date: ${eventDate}` : null,
        body.page ? `Page: ${String(body.page)}` : null,
      ].filter(Boolean).join(" · ") || undefined,
      attribution: {
        source: str("utm_source") ?? "website",
        medium: str("utm_medium"),
        campaign: str("utm_campaign"),
        term: str("utm_term"),
        content: str("utm_content"),
        utmSource: str("utm_source"),
        utmMedium: str("utm_medium"),
        utmCampaign: str("utm_campaign"),
        gclid: str("gclid"),
        gbraid: str("gbraid"),
        wbraid: str("wbraid"),
        fbclid: str("fbclid"),
        landingUrl: str("landing_url") ?? str("page"),
        referrerUrl: str("referrer") ?? h.get("referer") ?? undefined,
      },
    });

    if (!res?.success) {
      console.error("[LANDING_LEAD_CAPTURE_FAILED]", res);
      return NextResponse.json({ ok: false, error: "Could not save the enquiry." }, { status: 500, headers: cors });
    }
    return NextResponse.json({ ok: true, leadId: res.leadId }, { status: 201, headers: cors });
  } catch (e) {
    console.error("[LANDING_LEAD_ERROR]", e);
    return NextResponse.json({ ok: false, error: "Could not save the enquiry." }, { status: 500, headers: cors });
  }
}
