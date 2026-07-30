import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { parseAttributionFromRequest } from "@/lib/attribution";
import { prisma } from "@/lib/prisma";

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

    // Google's "Send test data" ping — validate + acknowledge, don't create a
    // fake lead in the CRM.
    if (body.is_test === true) {
      return NextResponse.json({ success: true, test: true }, { status: 200 });
    }

    const leadId = (body.lead_id as string) || (body.leadId as string) || "";
    const userColumnData = (body.user_column_data || body.userColumnData || []) as Array<
      Record<string, string>
    >;

    let name = "";
    let firstName = "";
    let lastName = "";
    let email = "";
    let phone = "";

    for (const col of Array.isArray(userColumnData) ? userColumnData : []) {
      const columnId = String(col.column_id ?? col.columnId ?? "").toUpperCase();
      const value = String(col.string_value ?? col.stringValue ?? "").trim();
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
    if (typeof body.name === "string" && body.name) name = body.name;
    if (typeof body.email === "string" && body.email) email = body.email;
    if (typeof body.phone === "string" && body.phone) phone = body.phone;

    if (!name) name = "Google Ads Lead";

    // Google sends the click id as gcl_id — feed it into attribution so the
    // lead can be matched back to the ad click (and offline-conversion import).
    const gclid =
      (typeof body.gcl_id === "string" && body.gcl_id) ||
      (typeof body.gclid === "string" && body.gclid) ||
      undefined;

    const attribution = await parseAttributionFromRequest(request, body);

    await captureLeadFromExternal({
      name,
      email: email || undefined,
      phone: phone || undefined,
      source: "google_ads",
      message: `Google Ads lead form${body.form_id ? ` (form ${String(body.form_id)})` : ""}${
        leadId ? ` · lead ${leadId}` : ""
      }`,
      // Idempotency: Google retries on any non-2xx, so the same lead_id must
      // never create a second Lead row.
      externalId: leadId ? `gads:${leadId}` : undefined,
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

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[GoogleAds] Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
