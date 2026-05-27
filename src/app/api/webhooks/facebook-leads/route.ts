import { NextRequest, NextResponse } from "next/server";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/webhooks/facebook-leads
 * Hub verification for Facebook webhook subscription
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Try reading verify token from DB config first, then fall back to env var
  let verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "veloria_fb_verify";
  try {
    const config = await prisma.leadCaptureConfig.findFirst({
      where: { platform: "FACEBOOK", isActive: true },
    });
    if (config) {
      const creds = config.credentials as Record<string, string>;
      if (creds.verifyToken) verifyToken = creds.verifyToken;
    }
  } catch {
    // Fall back to env var
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[FacebookLeads] Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * POST /api/webhooks/facebook-leads
 * Receive Facebook Lead Ads webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify it's a page event with leadgen changes
    if (body.object !== "page") {
      return NextResponse.json({ error: "Not a page event" }, { status: 400 });
    }

    // Get page access token from DB config or env var
    let pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "";
    let configId: string | null = null;
    try {
      const config = await prisma.leadCaptureConfig.findFirst({
        where: { platform: "FACEBOOK", isActive: true },
      });
      if (config) {
        configId = config.id;
        const creds = config.credentials as Record<string, string>;
        if (creds.accessToken) pageAccessToken = creds.accessToken;
      }
    } catch {
      // Fall back to env var
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field === "leadgen") {
          const leadgenId = change.value?.leadgen_id;

          if (leadgenId) {
            let leadData = {
              name: "Facebook Lead",
              email: "",
              phone: "",
            };

            if (pageAccessToken) {
              try {
                const fbRes = await fetch(
                  `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${pageAccessToken}`
                );
                if (fbRes.ok) {
                  const fbData = await fbRes.json();
                  const fieldData = fbData.field_data || [];

                  for (const field of fieldData) {
                    if (field.name === "full_name" || field.name === "name") {
                      leadData.name = field.values?.[0] || leadData.name;
                    }
                    if (field.name === "email") {
                      leadData.email = field.values?.[0] || "";
                    }
                    if (field.name === "phone_number" || field.name === "phone") {
                      leadData.phone = field.values?.[0] || "";
                    }
                  }
                }
              } catch (err) {
                console.error("[FacebookLeads] Failed to fetch lead from FB:", err);
              }
            }

            await captureLeadFromExternal({
              name: leadData.name,
              email: leadData.email || undefined,
              phone: leadData.phone || undefined,
              source: "facebook_ads",
              message: `Facebook Lead Ad (ID: ${leadgenId})`,
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
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[FacebookLeads] Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
