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

/** Origins allowed to post (the marketing site + the app itself). */
const ALLOWED_ORIGINS = new Set([
  "https://veloriagrand.com",
  "https://www.veloriagrand.com",
  "https://app.theveloriagrand.com",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  // Echo only known origins; fall back to the primary site rather than "*" so
  // this endpoint isn't a free lead-injection surface for any website.
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://veloriagrand.com";
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
  const phoneRaw = String(body.phone ?? "").replace(/\D/g, "");
  // Accept 10-digit Indian mobiles, tolerating a 91/0 prefix from autofill.
  const phone = phoneRaw.length > 10 ? phoneRaw.slice(-10) : phoneRaw;
  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 422, headers: cors });
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "A valid 10-digit mobile number is required." }, { status: 422, headers: cors });
  }

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
