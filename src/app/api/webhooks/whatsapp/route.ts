import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// ============================================================
// WhatsApp Webhook — Meta Cloud API Webhook Handler
// ============================================================
// GET: Verify webhook subscription (Meta requires this)
// POST: Receive incoming messages + delivery status updates

export const runtime = "nodejs";

// ============================================================
// Helper: Get active WhatsApp config from DB
// ============================================================

async function getActiveConfig() {
  try {
    return await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: {
        appSecret: true,
        verifyToken: true,
      },
    });
  } catch {
    return null;
  }
}

// ============================================================
// GET — Webhook Verification
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Read verify token from DB config, fallback to env var
  const config = await getActiveConfig();
  const verifyToken =
    config?.verifyToken ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    "veloria_whatsapp_verify";

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp Webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[WhatsApp Webhook] Verification failed — invalid token");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ============================================================
// POST — Receive Messages & Status Updates
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Read app secret from DB config, fallback to env var
    const config = await getActiveConfig();
    const appSecret = config?.appSecret || process.env.WHATSAPP_APP_SECRET;

    // Verify HMAC signature if app secret is configured
    const signature = request.headers.get("x-hub-signature-256");

    if (appSecret && signature) {
      const expectedSignature =
        "sha256=" +
        crypto.createHmac("sha256", appSecret).update(body).digest("hex");

      if (expectedSignature !== signature) {
        console.warn("[WhatsApp Webhook] Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 403 }
        );
      }
    }

    const payload = JSON.parse(body);

    // Parse Meta webhook payload structure:
    // { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages, statuses } }] }] }
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        // Handle incoming messages
        if (value?.messages) {
          for (const message of value.messages) {
            const from = message.from; // phone number (e.g., "919876543210")
            const waId = message.id;
            const text = message.text?.body || "[Media message]";

            // Find contact by phone number (try multiple formats)
            const contact = await prisma.contact.findFirst({
              where: {
                OR: [
                  { phone: from },
                  { phone: `+${from}` },
                  { phone: `+91${from}` },
                  { alternatePhone: from },
                  { alternatePhone: `+${from}` },
                ],
              },
              select: { id: true },
            });

            if (contact) {
              // Check for duplicate (same whatsappId)
              const existing = waId
                ? await prisma.whatsAppMessage.findFirst({
                    where: { whatsappId: waId },
                  })
                : null;

              if (!existing) {
                await prisma.whatsAppMessage.create({
                  data: {
                    direction: "INBOUND",
                    content: text,
                    status: "DELIVERED",
                    whatsappId: waId || null,
                    contactId: contact.id,
                  },
                });

                console.log(
                  `[WhatsApp Webhook] Inbound message from ${from} → contact ${contact.id}`
                );
              }
            } else {
              console.log(
                `[WhatsApp Webhook] Inbound from unknown number: ${from}`
              );
            }
          }
        }

        // Handle status updates (sent → delivered → read → failed)
        if (value?.statuses) {
          for (const status of value.statuses) {
            const waId = status.id;
            const newStatus = status.status; // "sent" | "delivered" | "read" | "failed"

            const statusMap: Record<string, string> = {
              sent: "SENT",
              delivered: "DELIVERED",
              read: "READ",
              failed: "FAILED",
            };

            const mappedStatus = statusMap[newStatus];
            if (waId && mappedStatus) {
              await prisma.whatsAppMessage.updateMany({
                where: { whatsappId: waId },
                data: {
                  status: mappedStatus as
                    | "SENT"
                    | "DELIVERED"
                    | "READ"
                    | "FAILED",
                },
              });
            }
          }
        }
      }
    }

    // Always return 200 to prevent Meta from retrying
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WhatsApp Webhook Error]", error);
    // Return 200 even on error to prevent retries
    return NextResponse.json({ success: true });
  }
}
