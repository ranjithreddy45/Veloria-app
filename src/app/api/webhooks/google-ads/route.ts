import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { parseAttributionFromRequest } from "@/lib/attribution";
import { prisma } from "@/lib/prisma";
import { fieldValue, LEAD_VALUE_KEYS } from "@/lib/webhook-field";

/**
 * POST /api/webhooks/google-ads — Google Ads **lead form extension** webhook.
 *
 * IMPORTANT (this was previously wrong): Google Ads does NOT send an
 * `Authorization: Bearer …` header. It posts JSON and puts the key you typed in
 * the "Key" field into the BODY as `google_key`. Requiring a bearer header made
 * every delivery 401, which Google surfaces as
 * "Your data management system didn't respond correctly."
 *
 * Real payload (api_version 1.0):
 * {
 *   "lead_id": "...", "api_version": "1.0", "form_id": 123,
 *   "campaign_id": 456, "gcl_id": "...", "adgroup_id": .., "creative_id": ..,
 *   "google_key": "<your key>", "is_test": true,
 *   "user_column_data": [{ "column_id": "FULL_NAME", "string_value": "…" }, …]
 * }
 *
 * Google requires a 2xx within its timeout, otherwise the lead is retried and
 * eventually dropped. We therefore answer 200 for the validation ping and for
 * any lead we have already captured.
 */

/** Constant-time compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Google Ads drops a lead entirely if we do not answer inside its timeout, so
// this must never be killed mid-write. The slow side effects of capture are
// no longer awaited (see lead-capture.ts); this is the backstop.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Resolve the expected key: DB config first, then env var.
    let expectedToken: string | undefined = process.env.GOOGLE_ADS_WEBHOOK_TOKEN || undefined;
    let configId: string | null = null;
    try {
      const config = await prisma.leadCaptureConfig.findFirst({
        where: { platform: "GOOGLE", isActive: true },
      });
      if (config) {
        configId = config.id;
        const creds = config.credentials as Record<string, string>;
        if (creds.webhookToken) expectedToken = creds.webhookToken;
      }
    } catch {
      // Fall back to env var
    }

    if (!expectedToken) {
      // Fail closed — never accept unauthenticated leads.
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Key comes in the BODY (google_key). Accept a bearer header too, so any
    // other caller/integration configured the old way keeps working.
    const bodyKey = typeof body.google_key === "string" ? body.google_key : "";
    const authHeader = request.headers.get("authorization") || "";
    const authorized =
      (bodyKey && safeEqual(bodyKey, expectedToken)) ||
      (authHeader && safeEqual(authHeader, `Bearer ${expectedToken}`));

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Google's "Send test data" ping (is_test:true). We DO create a lead so you
    // can verify the integration end-to-end — but clearly tagged "[TEST]" and
    // deduped on a test-scoped id, so repeated test clicks never create more
    // than one, and it's trivial to spot and delete. Real leads carry no
    // is_test flag and are untagged.
    const isTest = body.is_test === true;

    const leadId = (body.lead_id as string) || (body.leadId as string) || "";
    // NOT Record<string, string>: that cast was a lie about untrusted input, and
    // it is what let a boolean through. Google sent `string_value: false` for an
    // unfilled column; `??` only skips null/undefined so `false` survived into
    // String(false) === "false", which is truthy — and "false" was saved as the
    // customer's phone number.
    const userColumnData = (body.user_column_data || body.userColumnData || []) as Array<
      Record<string, unknown>
    >;

    let name = "";
    let firstName = "";
    let lastName = "";
    let email = "";
    let phone = "";

    for (const col of Array.isArray(userColumnData) ? userColumnData : []) {
      const columnId = String(col.column_id ?? col.columnId ?? "").toUpperCase();
      // fieldValue takes strings AND unquoted numbers, rejects booleans, and
      // tries every key spelling rather than stopping at the first one that
      // merely EXISTS. Both halves matter here:
      //   - `string_value: false` (unfilled column) must not become "false";
      //   - a phone delivered as a JSON number (9611360491, no quotes) must
      //     still be read. An earlier string-only guard dropped exactly that,
      //     turning a wrong phone number into a missing one.
      const value = fieldValue(col, LEAD_VALUE_KEYS);
      if (!value) continue;
      // Google's documented column ids: FULL_NAME, FIRST_NAME, LAST_NAME,
      // EMAIL, PHONE_NUMBER, POSTAL_CODE, CITY, COMPANY_NAME, JOB_TITLE…
      if (columnId === "FULL_NAME") name = value;
      else if (columnId === "FIRST_NAME") firstName = value;
      else if (columnId === "LAST_NAME") lastName = value;
      else if (columnId.includes("EMAIL")) email = value;
      else if (columnId.includes("PHONE")) phone = value;
    }

    if (!name) name = [firstName, lastName].filter(Boolean).join(" ").trim();

    // Top-level overrides (defensive; some integrations flatten the payload).
    // Same coercion rules — a flattened numeric phone is just as real.
    const topName = fieldValue(body, ["name", "full_name", "fullName"]);
    const topEmail = fieldValue(body, ["email", "email_address", "emailAddress"]);
    const topPhone = fieldValue(body, ["phone", "phone_number", "phoneNumber"]);
    if (topName) name = topName;
    if (topEmail) email = topEmail;
    if (topPhone) phone = topPhone;

    if (!name) name = "Google Ads Lead";
    // Make a test lead unmistakable in the pipeline.
    if (isTest) name = `[TEST] ${name}`;

    // Google sends the click id as gcl_id — feed it into attribution so the
    // lead can be matched back to the ad click (and offline-conversion import).
    const gclid =
      (typeof body.gcl_id === "string" && body.gcl_id) ||
      (typeof body.gclid === "string" && body.gclid) ||
      undefined;

    const attribution = await parseAttributionFromRequest(request, body);

    const capture = await captureLeadFromExternal({
      name,
      email: email || undefined,
      phone: phone || undefined,
      source: "google_ads",
      message: isTest
        ? `Google Ads TEST lead (Send test data) — safe to delete.${body.form_id ? ` Form ${String(body.form_id)}.` : ""}`
        : `Google Ads lead form${body.form_id ? ` (form ${String(body.form_id)})` : ""}${
            leadId ? ` · lead ${leadId}` : ""
          }`,
      // Idempotency: Google retries on any non-2xx, so the same lead_id must
      // never create a second Lead row. Test pings share a fixed id, so
      // repeated "Send test data" clicks all collapse onto ONE test lead.
      externalId: leadId ? `${isTest ? "gads:test:" : "gads:"}${leadId}` : undefined,
      attribution: {
        ...attribution,
        source: attribution.source || "google_ads",
        medium: attribution.medium || "cpc",
        gclid: gclid ?? attribution.gclid,
        campaign:
          attribution.campaign ||
          (body.campaign_id ? `gads-campaign-${String(body.campaign_id)}` : undefined),
      },
    });

    // captureLeadFromExternal swallows its own errors and returns
    // { success:false }. Previously we ignored this and always returned 200 —
    // so a failed capture looked like success, the lead was dropped, and Google
    // never retried. Surface a 5xx so the failure is visible and retried.
    if (!capture || capture.success === false) {
      console.error("[GoogleAds] Lead capture failed", { leadId, isTest });
      return NextResponse.json({ error: "Lead capture failed" }, { status: 502 });
    }

    if (configId) {
      try {
        await prisma.leadCaptureConfig.update({
          where: { id: configId },
          data: { lastSyncAt: new Date() },
        });
      } catch {
        // Non-critical
      }
    }

    return NextResponse.json({ success: true, leadId: capture.leadId }, { status: 200 });
  } catch (error) {
    console.error("[GoogleAds] Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
