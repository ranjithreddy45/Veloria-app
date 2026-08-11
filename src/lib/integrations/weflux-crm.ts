// ============================================================
// Weflux CRM sync — outbound (CRM → Weflux)
// ------------------------------------------------------------
// Posts lead lifecycle events to Weflux's CRM integration webhook so every lead
// created here becomes a Weflux contact — which lets Weflux broadcast to it,
// run its automations (e.g. the "first message" template), and open an inbox
// thread. Fully per the Weflux integration spec:
//   POST  https://app.weflux.in/api/v1/integrations/crm/webhook/<token>
//   Auth  X-Weflux-Secret: <secret>   (or HMAC via X-Weflux-Signature)
//   Body  { event, event_id, lead:{id,name,phone,...}, occurred_at }
//
// Config comes from env so no secret is committed:
//   WEFLUX_CRM_WEBHOOK_URL   the full webhook URL (contains the connection token)
//   WEFLUX_CRM_SECRET        the signing secret (wfx_crm_…)
//
// Best-effort and non-blocking: a Weflux outage must never fail lead capture.
// ============================================================

import crypto from "crypto";

export type WefluxCrmEvent =
  | "lead.created"
  | "lead.updated"
  | "deal.stage_changed"
  | "contact.opted_out";

export interface WefluxLeadPayload {
  /** Our CRM lead id — Weflux stores it to correlate updates. */
  id: string;
  name: string;
  /** Any format; normalised to digits-with-country-code here. */
  phone: string;
  email?: string | null;
  company?: string | null;
  city?: string | null;
  source?: string | null;
  /** Pipeline stage / lead status. */
  stage?: string | null;
  value?: string | number | null;
  currency?: string | null;
}

/** Digits only, with an Indian country code when a bare 10-digit mobile is given
 *  (Weflux assumes +91 for country-code-less numbers, but being explicit avoids
 *  any ambiguity). */
function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/[^\d]/g, "");
  d = d.replace(/^0+/, "");
  if (/^[6-9]\d{9}$/.test(d)) d = "91" + d; // bare Indian mobile → +91
  return d;
}

function isConfigured(): boolean {
  return !!(process.env.WEFLUX_CRM_WEBHOOK_URL && process.env.WEFLUX_CRM_SECRET);
}

/**
 * Send one lead event to Weflux. Returns quietly on success/failure — callers
 * should not await-block lead capture on it (wrap in `after()` / fire-and-forget).
 */
export async function pushLeadToWeflux(
  event: WefluxCrmEvent,
  lead: WefluxLeadPayload,
  opts?: { eventId?: string }
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    if (!isConfigured()) return { ok: false, skipped: true };
    const url = process.env.WEFLUX_CRM_WEBHOOK_URL as string;
    const secret = process.env.WEFLUX_CRM_SECRET as string;

    const phone = normalizePhone(lead.phone);
    if (!phone) return { ok: false, skipped: true }; // phone is the join key

    // Stable event_id so Weflux dedupes retries instead of double-creating.
    const eventId = opts?.eventId || `${event}:${lead.id}`;

    const body = JSON.stringify({
      event,
      event_id: eventId,
      lead: {
        id: lead.id,
        name: lead.name || "Lead",
        phone,
        ...(lead.email ? { email: lead.email } : {}),
        ...(lead.company ? { company: lead.company } : {}),
        ...(lead.city ? { city: lead.city } : {}),
        ...(lead.source ? { source: lead.source } : {}),
        ...(lead.stage ? { stage: lead.stage } : {}),
        ...(lead.value != null ? { value: String(lead.value) } : {}),
        ...(lead.currency ? { currency: lead.currency } : {}),
      },
      occurred_at: new Date().toISOString(),
    });

    // Sign the exact bytes we send (stronger than the plain secret header) and
    // also send the plain header, so it works regardless of which Weflux checks.
    const signature = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Weflux-Secret": secret,
        "X-Weflux-Signature": signature,
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[Weflux CRM] push failed", res.status, text.slice(0, 300));
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[Weflux CRM] push error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
