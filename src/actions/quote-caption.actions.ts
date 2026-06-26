"use server";

// ============================================================
// Quote AI Caption — INTERNAL rep actions (preview / regenerate / send).
// ------------------------------------------------------------
//   - generateAndPreviewQuoteCaption(shareLinkId): RBAC quotes:send. Drafts an
//     AI (or template-fallback) WhatsApp caption and SNAPSHOTS it to
//     QuoteShareLink.aiCaption/aiCaptionAt. Does NOT send.
//   - regenerateQuoteCaption(shareLinkId): same, forces a fresh draft.
//   - sendQuoteCaptionWhatsApp(shareLinkId, {captionOverride?}): RBAC quotes:send
//     AND whatsapp:send. Resolves the phone, sends via sendWhatsApp, mirrors a
//     WhatsAppMessage(OUTBOUND) + Communication(WHATSAPP) so the timeline +
//     sentiment pipeline catch it, stops the speed-to-lead clock, and re-snapshots
//     the caption. Returns the provider error string on send failure (the caption
//     stays saved); never throws.
//
// MONEY/SAFETY: the ₹ figures come from QuoteShareLink.grandTotal (Decimal),
// formatted server-side by the generator — never from LLM free-text.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { stampLeadResponded } from "@/lib/lead-pipeline";
import { generateQuoteCaption } from "@/lib/sales/quote-caption";
import { computeAdvanceAmount } from "@/lib/sales/quote-onetap";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

function can(role: string | undefined, perm: string): boolean {
  return !!role && hasPermission(role, perm);
}

/** Load the share-link fields the caption generator needs. */
async function loadCaptionContext(shareLinkId: string) {
  return prisma.quoteShareLink.findUnique({
    where: { id: shareLinkId },
    select: {
      id: true,
      clientName: true,
      clientPhone: true,
      occasion: true,
      eventDate: true,
      timeSlot: true,
      grandTotal: true,
      payInvoiceId: true,
      paymentLinkUrl: true,
      contactId: true,
    },
  });
}

async function buildCaption(
  link: NonNullable<Awaited<ReturnType<typeof loadCaptionContext>>>,
  kind: "SHARE" | "NUDGE"
) {
  let advanceAmount: number | null = null;
  if (link.payInvoiceId && link.payInvoiceId !== "__pending__") {
    const a = await computeAdvanceAmount(link.payInvoiceId);
    if (a > 0) advanceAmount = a;
  }
  return generateQuoteCaption({
    kind,
    clientName: link.clientName,
    occasion: link.occasion,
    eventDate: link.eventDate,
    timeSlot: link.timeSlot,
    grandTotal: link.grandTotal,
    advanceAmount,
    payInvoiceId: link.payInvoiceId,
    paymentLinkUrl: link.paymentLinkUrl,
  });
}

// ============================================================
// generateAndPreviewQuoteCaption — draft + snapshot (no send).
// ============================================================
export async function generateAndPreviewQuoteCaption(
  shareLinkId: string
): Promise<Result<{ caption: string; method: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:send")) return { success: false, error: "Unauthorized" };
  try {
    const link = await loadCaptionContext(shareLinkId);
    if (!link) return { success: false, error: "Share link not found." };

    const out = await buildCaption(link, "SHARE");
    await prisma.quoteShareLink.update({
      where: { id: shareLinkId },
      data: { aiCaption: out.text, aiCaptionAt: new Date() },
    });
    return { success: true, data: { caption: out.text, method: out.method } };
  } catch (e) {
    console.error("[GENERATE_PREVIEW_QUOTE_CAPTION_ERROR]", e);
    return { success: false, error: "Could not generate a caption." };
  }
}

// ============================================================
// regenerateQuoteCaption — force a fresh draft for the rep to edit.
// ============================================================
export async function regenerateQuoteCaption(
  shareLinkId: string
): Promise<Result<{ caption: string; method: string }>> {
  // Same gate + behaviour; the generator is non-deterministic on the LLM path,
  // so simply re-running yields a fresh draft.
  return generateAndPreviewQuoteCaption(shareLinkId);
}

// ============================================================
// sendQuoteCaptionWhatsApp — send the caption + mirror timeline rows.
// ============================================================
export async function sendQuoteCaptionWhatsApp(
  shareLinkId: string,
  opts?: { captionOverride?: string }
): Promise<Result<{ messageId?: string; status: string }>> {
  const user = await requireUser();
  if (!user || !can(user.role, "quotes:send") || !can(user.role, "whatsapp:send"))
    return { success: false, error: "You don't have permission to send WhatsApp messages." };

  try {
    const link = await loadCaptionContext(shareLinkId);
    if (!link) return { success: false, error: "Share link not found." };

    // Resolve the recipient phone: link.clientPhone, else the linked contact's.
    let phone = (link.clientPhone ?? "").trim();
    let contactId = link.contactId;
    if (!phone && contactId) {
      const c = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { phone: true },
      });
      phone = (c?.phone ?? "").trim();
    }
    if (!contactId) {
      // Best-effort: resolve a contact by the link's phone so timeline rows attach.
      if (phone) {
        const c = await prisma.contact.findFirst({
          where: { deletedAt: null, phone },
          select: { id: true },
        });
        contactId = c?.id ?? null;
      }
    }
    if (!phone)
      return { success: false, error: "No customer phone on file to message." };

    // Caption: explicit override, else the saved snapshot, else generate now.
    let caption = (opts?.captionOverride ?? "").trim();
    let method = "OVERRIDE";
    if (!caption) {
      const out = await buildCaption(link, "SHARE");
      caption = out.text;
      method = out.method;
    }

    // SEND (must AWAIT before the function freezes — never fire-and-forget).
    const sent = await sendWhatsApp({ to: phone, message: caption });

    // Mirror a WhatsAppMessage + Communication so the timeline + sentiment
    // pipeline catch it (only when we have a contact to attach to).
    if (contactId) {
      await prisma.whatsAppMessage
        .create({
          data: {
            direction: "OUTBOUND",
            content: caption,
            status: sent.success ? "SENT" : "FAILED",
            whatsappId: sent.messageId ?? null,
            failureReason: sent.success ? null : sent.error ?? "Send failed",
            contactId,
          },
        })
        .catch((e) => console.error("[QUOTE_CAPTION_WAMSG_ERROR]", e));

      if (sent.success) {
        await prisma.communication
          .create({
            data: {
              type: "WHATSAPP",
              direction: "OUTBOUND",
              content: caption,
              subject: "Quote shared via WhatsApp",
              contactId,
              createdById: user.id,
            },
          })
          .catch((e) => console.error("[QUOTE_CAPTION_COMM_ERROR]", e));
        // Stop the speed-to-lead clock on the contact's open leads.
        await stampLeadResponded(contactId).catch(() => {});
      }
    }

    // Re-snapshot the sent caption regardless of send outcome (rep edited it).
    await prisma.quoteShareLink
      .update({ where: { id: shareLinkId }, data: { aiCaption: caption, aiCaptionAt: new Date() } })
      .catch(() => {});

    logActivity({
      userId: user.id,
      action: "QUOTE_CAPTION_WHATSAPP_SENT",
      entityType: "QuoteShareLink",
      entityId: shareLinkId,
      changes: { method, status: sent.success ? "SENT" : "FAILED" },
    });

    revalidatePath(`/quotations`);

    if (!sent.success) {
      // Caption stays saved; surface the provider error so the rep can retry.
      return { success: false, error: sent.error || "WhatsApp send failed." };
    }
    return { success: true, data: { messageId: sent.messageId, status: "SENT" } };
  } catch (e) {
    console.error("[SEND_QUOTE_CAPTION_WHATSAPP_ERROR]", e);
    return { success: false, error: "Could not send the WhatsApp message." };
  }
}
