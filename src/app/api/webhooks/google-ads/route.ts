import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/webhooks/google-ads
 * Receive Google Ads lead form extension webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook token from DB config or env var
    let expectedToken = process.env.GOOGLE_ADS_WEBHOOK_TOKEN || "veloria_google_verify";
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

    // Verify webhook token (timing-safe comparison)
    const authHeader = request.headers.get("authorization") || "";
    const expected = `Bearer ${expectedToken}`;
    if (
      !authHeader ||
      authHeader.length !== expected.length ||
      !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Google Ads lead form data
    const leadId = body.lead_id || body.leadId;
    const userColumnData = body.user_column_data || [];

    let name = "Google Ads Lead";
    let email = "";
    let phone = "";

    // Parse user column data
    for (const col of userColumnData) {
      const columnId = (col.column_id || col.columnId || "").toLowerCase();
      const value = col.string_value || col.stringValue || "";

      if (columnId.includes("name") || columnId.includes("full_name")) {
        name = value || name;
      }
      if (columnId.includes("email")) {
        email = value;
      }
      if (columnId.includes("phone") || columnId.includes("mobile")) {
        phone = value;
      }
    }

    // Also check top-level fields
    if (body.name) name = body.name;
    if (body.email) email = body.email;
    if (body.phone) phone = body.phone;

    await captureLeadFromExternal({
      name,
      email: email || undefined,
      phone: phone || undefined,
      source: "google_ads",
      message: `Google Ads Lead (ID: ${leadId || "unknown"})`,
    });

    // Update lastSyncAt
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
