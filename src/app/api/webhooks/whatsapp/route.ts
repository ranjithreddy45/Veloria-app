import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { handleInboundReply } from "@/lib/lead-pipeline";

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

    // FAIL CLOSED: we can't trust an inbound webhook we can't verify. Reject if
    // no secret is configured, and require a valid signature otherwise.
    if (!appSecret) {
      console.error("[WhatsApp Webhook] No app secret configured — rejecting unverifiable inbound.");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
    }
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    const expectedSignature =
      "sha256=" + crypto.createHmac("sha256", appSecret).update(body).digest("hex");
    // Timing-safe compare.
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn("[WhatsApp Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
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
            // Interactive replies (button/list taps) carry the chosen option in
            // a dedicated envelope — surface the tapped title as the message text
            // so the inbox stores what the customer actually picked.
            const br = message.interactive?.button_reply;
            const lr = message.interactive?.list_reply;
            const text =
              br?.title || lr?.title || message.text?.body || "[Media message]";

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
                const created = await prisma.whatsAppMessage.create({
                  data: {
                    direction: "INBOUND",
                    content: text,
                    status: "DELIVERED",
                    whatsappId: waId || null,
                    contactId: contact.id,
                  },
                });

                // Prospect engaged → stop any running cadences for them.
                await handleInboundReply(contact.id);

                // Known-contact ack + smart re-route + lead re-wake. Inside the
                // !existing guard so Meta redeliveries never re-ack/re-route.
                // Never throws, but a defensive try/catch keeps us always-200.
                try {
                  const { handleKnownContactAck } = await import(
                    "@/lib/inbound/known-contact-ack"
                  );
                  await handleKnownContactAck(contact.id, {
                    inboundText: text,
                    inboundMessageId: waId,
                  });
                } catch (e) {
                  console.error("[WhatsApp Webhook] known-contact-ack error:", e);
                }

                // Fire-and-forget message-intent classification (boost + ping on
                // READY_TO_BUY signals). Must not await-block or throw.
                import("@/lib/ai/intent-stamp")
                  .then((m) =>
                    m.stampMessageIntent({
                      text,
                      whatsappMessageId: created.id,
                      contactId: contact.id,
                    })
                  )
                  .catch(() => {});

                // Advance any in-flight catalog funnel when the customer tapped a
                // button/list option. Best-effort; engine is idempotent on phone+stage.
                if (message.interactive) {
                  try {
                    const { advanceCatalogSession } = await import(
                      "@/lib/whatsapp/catalog-engine"
                    );
                    await advanceCatalogSession({
                      phone: from,
                      contactId: contact.id,
                      buttonReplyId: br?.id,
                      listReplyId: lr?.id,
                      inboundText: text,
                    });
                  } catch (e) {
                    console.error("[WhatsApp Webhook] catalog advance error:", e);
                  }
                }

                console.log(
                  `[WhatsApp Webhook] Inbound message from ${from} → contact ${contact.id}`
                );
              }
            } else {
              // Unknown number → a brand-new inbound lead (WhatsApp is the #1
              // inbound channel in India; never drop it). Capture creates the
              // contact + lead, scores, assigns, SLA-stamps, and auto-replies.
              const capture = await captureLeadFromExternal({
                name: from,
                phone: from.startsWith("+") ? from : `+${from}`,
                source: "whatsapp",
                message: text,
              });
              console.log(
                `[WhatsApp Webhook] Captured new lead from unknown number: ${from}`
              );

              // Kick off the WhatsApp catalog funnel for the first-touch lead.
              // Best-effort; engine is idempotent on phone+stage (Meta redelivery safe).
              if (capture?.success) {
                try {
                  const { runCatalogFirstInbound } = await import(
                    "@/lib/whatsapp/catalog-engine"
                  );
                  await runCatalogFirstInbound({
                    phone: from,
                    contactId: capture.contactId,
                    leadId: capture.leadId,
                    messageId: waId,
                    inboundText: text,
                  });
                } catch (e) {
                  console.error("[WhatsApp Webhook] catalog first-inbound error:", e);
                }
              }
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
