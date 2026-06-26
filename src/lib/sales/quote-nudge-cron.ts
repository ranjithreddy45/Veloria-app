// ============================================================
// Quote AI Nudge — "viewed-but-unpaid 24h" auto-nudge sweep (cron worker).
// ------------------------------------------------------------
// Plain lib (no auth, never throws). The AI-caption half (B) of quote-ai-caption:
// finds ACTIVE QuoteShareLinks opened ~24h ago and still unpaid, generates a
// second AI nudge caption (LLM-first, deterministic fallback), sends it via
// WhatsApp, mirrors a WhatsAppMessage(OUTBOUND)+Communication(WHATSAPP), upserts
// a WinbackTarget(kind=ABANDONED_QUOTE) for reporting + idempotency, and stamps
// QuoteShareLink.silentNudgeFiredAt.
//
// IDEMPOTENCY: silentNudgeFiredAt is stamped FIRST via a conditional updateMany
// (count===1 wins) so overlapping cron runs can't double-send (mirrors the
// slaEscalatedAt one-shot). NOTE: this shares the silentNudgeFiredAt one-shot
// with the quote-radar silent-nudge sweep — only ONE of the two should be wired
// into a cron lane (central decision); whichever fires first wins the row.
//
// PAID-STATE RACE: re-read the backing Invoice INSIDE the loop right before
// sending and skip if PAID — never nudge someone who just booked.
//
// MONEY: ₹ figures come from QuoteShareLink.grandTotal (Decimal), formatted
// server-side by the caption generator — never from LLM free-text.
// ============================================================

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { generateQuoteCaption } from "@/lib/sales/quote-caption";
import { computeAdvanceAmount } from "@/lib/sales/quote-onetap";
import { enrollEntity } from "@/actions/cadence.actions";

export interface QuoteNudgeSummary {
  scanned: number;
  nudged: number;
  skipped: number;
  errors: number;
}

const BATCH = 200;
const VIEWED_AGO_MS = 24 * 60 * 60 * 1000;
const PENDING = "__pending__";

/** Re-read the backing invoice; true if paid / no balance due. */
async function invoicePaid(payInvoiceId: string | null): Promise<boolean> {
  if (!payInvoiceId || payInvoiceId === PENDING) return false;
  const inv = await prisma.invoice.findUnique({
    where: { id: payInvoiceId },
    select: { status: true, balanceDue: true },
  });
  return !!inv && (inv.status === "PAID" || Number(inv.balanceDue) <= 0);
}

/** Resolve the recovery cadence id if configured (optional enroll path). */
function recoveryCadenceId(): string | null {
  return (process.env.QUOTE_RECOVERY_CADENCE_ID ?? "").trim() || null;
}

export async function nudgeViewedUnpaidQuotes(): Promise<QuoteNudgeSummary> {
  const summary: QuoteNudgeSummary = { scanned: 0, nudged: 0, skipped: 0, errors: 0 };

  const now = new Date();
  const viewedCutoff = new Date(now.getTime() - VIEWED_AGO_MS);
  const cadenceId = recoveryCadenceId();

  let candidates: Array<{
    id: string;
    leadId: string | null;
    contactId: string | null;
    clientName: string | null;
    clientPhone: string | null;
    occasion: string | null;
    eventDate: Date | null;
    timeSlot: string | null;
    grandTotal: Prisma.Decimal;
    payInvoiceId: string | null;
    paymentLinkUrl: string | null;
    primaryQuotationId: string | null;
  }>;
  try {
    candidates = await prisma.quoteShareLink.findMany({
      where: {
        status: "ACTIVE",
        firstViewedAt: { not: null, lte: viewedCutoff },
        silentNudgeFiredAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { firstViewedAt: "asc" },
      take: BATCH,
      select: {
        id: true,
        leadId: true,
        contactId: true,
        clientName: true,
        clientPhone: true,
        occasion: true,
        eventDate: true,
        timeSlot: true,
        grandTotal: true,
        payInvoiceId: true,
        paymentLinkUrl: true,
        primaryQuotationId: true,
      },
    });
  } catch (e) {
    console.error("[QUOTE_NUDGE_QUERY_ERROR]", e);
    summary.errors++;
    return summary;
  }

  summary.scanned = candidates.length;

  for (const link of candidates) {
    try {
      // PAID-STATE RACE: re-read the invoice right before acting; also treat a
      // booked quotation as converted. Skip either way.
      let payInvoiceId = link.payInvoiceId;
      if (link.primaryQuotationId) {
        const q = await prisma.salesQuotation.findUnique({
          where: { id: link.primaryQuotationId },
          select: { bookingId: true, invoiceId: true },
        });
        if (q?.bookingId) {
          summary.skipped++;
          continue;
        }
        if (!payInvoiceId && q?.invoiceId && q.invoiceId !== PENDING) payInvoiceId = q.invoiceId;
      }
      if (await invoicePaid(payInvoiceId)) {
        summary.skipped++;
        continue;
      }

      // One-shot guard: stamp silentNudgeFiredAt FIRST (count===1 wins).
      const claimed = await prisma.quoteShareLink.updateMany({
        where: { id: link.id, silentNudgeFiredAt: null, status: "ACTIVE" },
        data: { silentNudgeFiredAt: now },
      });
      if (claimed.count !== 1) {
        summary.skipped++;
        continue;
      }

      // Resolve recipient phone (link.clientPhone, else the linked contact's).
      let phone = (link.clientPhone ?? "").trim();
      let contactId = link.contactId;
      if (!phone && contactId) {
        const c = await prisma.contact.findUnique({
          where: { id: contactId },
          select: { phone: true },
        });
        phone = (c?.phone ?? "").trim();
      }

      // Build the nudge caption (best-effort AI; deterministic fallback).
      let advanceAmount: number | null = null;
      if (payInvoiceId && payInvoiceId !== PENDING) {
        const a = await computeAdvanceAmount(payInvoiceId);
        if (a > 0) advanceAmount = a;
      }
      const caption = await generateQuoteCaption({
        kind: "NUDGE",
        clientName: link.clientName,
        occasion: link.occasion,
        eventDate: link.eventDate,
        timeSlot: link.timeSlot,
        grandTotal: link.grandTotal,
        advanceAmount,
        payInvoiceId,
        paymentLinkUrl: link.paymentLinkUrl,
      });

      // Optional: if a recovery cadence is configured, prefer enrolling the lead
      // over a one-shot send (config-driven). enrollEntity is session-gated, so
      // in the cron context it returns Unauthorized — we then fall through to the
      // direct WhatsApp send below.
      let enrolledViaCadence = false;
      let enrollmentId: string | null = null;
      if (cadenceId && link.leadId) {
        try {
          const res = await enrollEntity(cadenceId, link.leadId);
          if (res.success) {
            enrolledViaCadence = true;
            enrollmentId = (res.data as { id?: string })?.id ?? null;
          }
        } catch {
          /* fall through to direct send */
        }
      }

      let whatsappMessageId: string | null = null;
      let sentStatus = "SKIPPED";
      if (!enrolledViaCadence && phone) {
        // SEND must AWAIT before serverless freeze (never fire-and-forget).
        const sent = await sendWhatsApp({ to: phone, message: caption.text });
        sentStatus = sent.success ? "SENT" : "FAILED";

        if (contactId) {
          const wa = await prisma.whatsAppMessage
            .create({
              data: {
                direction: "OUTBOUND",
                content: caption.text,
                status: sent.success ? "SENT" : "FAILED",
                whatsappId: sent.messageId ?? null,
                failureReason: sent.success ? null : sent.error ?? "Send failed",
                contactId,
              },
              select: { id: true },
            })
            .catch((e) => {
              console.error("[QUOTE_NUDGE_WAMSG_ERROR]", e);
              return null;
            });
          whatsappMessageId = wa?.id ?? null;

          if (sent.success) {
            await prisma.communication
              .create({
                data: {
                  type: "WHATSAPP",
                  direction: "OUTBOUND",
                  content: caption.text,
                  subject: "Abandoned-quote nudge (auto)",
                  contactId,
                  // System-authored: use the first admin as createdById.
                  createdById: await systemActorId(),
                },
              })
              .catch((e) => console.error("[QUOTE_NUDGE_COMM_ERROR]", e));
          }
        }
      } else if (enrolledViaCadence) {
        sentStatus = "ENROLLED";
      }

      // Record the WinbackTarget for reporting + idempotency (one per link).
      // The silentNudgeFiredAt one-shot above already guarantees this row runs
      // at most once per link, so a find-then-create/update is safe and clearer
      // than a synthetic-id upsert (no @@unique on shareLinkId in the schema).
      try {
        const existing = await prisma.winbackTarget.findFirst({
          where: { kind: "ABANDONED_QUOTE", shareLinkId: link.id },
          select: { id: true },
        });
        if (existing) {
          await prisma.winbackTarget.update({
            where: { id: existing.id },
            data: {
              status: enrolledViaCadence ? "ENROLLED" : "CONTACTED",
              whatsappMessageId,
              enrollmentId,
              attempts: { increment: 1 },
              lastAttemptAt: now,
            },
          });
        } else {
          await prisma.winbackTarget.create({
            data: {
              kind: "ABANDONED_QUOTE",
              status: enrolledViaCadence ? "ENROLLED" : "CONTACTED",
              leadId: link.leadId,
              contactId,
              shareLinkId: link.id,
              cadenceId: enrolledViaCadence ? cadenceId : null,
              enrollmentId,
              whatsappMessageId,
              attempts: 1,
              lastAttemptAt: now,
            },
          });
        }
      } catch (e) {
        console.error("[QUOTE_NUDGE_WINBACK_ERROR]", e);
      }

      if (sentStatus === "SENT" || sentStatus === "ENROLLED") summary.nudged++;
      else summary.skipped++;
    } catch (e) {
      console.error("[QUOTE_NUDGE_ROW_ERROR]", e);
      summary.errors++;
    }
  }

  return summary;
}

/** First active admin id for system-authored Communication rows. */
async function systemActorId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });
  return admin?.id ?? "";
}
