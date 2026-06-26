"use server";

// ============================================================
// Quote Tiers — PUBLIC (no-auth) actions for the side-by-side /q/<token> page.
// ------------------------------------------------------------
// The token is the SOLE access control (mirrors getPublicInvoiceForPayment).
//   - getPublicQuoteShare(token): ACTIVE non-expired link + its QuoteTier rows,
//     each projected to customer-safe fields from its OWN frozen outputsJson.
//     Records a best-effort QuoteView (device/ipHash/referrer) and rolls the
//     view counters. Never leaks leadId / costs / internal notes / full PII.
//   - selectTier(token, quotationId): marks the chosen tier isSelected (clears
//     siblings), ensures a proforma invoice for that tier via the shared one-tap
//     helper, wires payInvoiceId + paymentLinkUrl, and returns the /pay redirect.
//     Idempotent on re-select; switching tiers before payment replaces cleanly.
// ============================================================

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { z } from "zod";
import { ensureProformaForShareLink, computeAdvanceAmount } from "@/lib/sales/quote-onetap";
import { parseDeviceFromUA, hashIp, isLikelyBot } from "@/lib/quote-radar/token";
import { SLOT_LABEL, plannerSlotToEnum } from "@/lib/sales/slot";
import {
  buildTierComparison,
  resolveTierLabel,
  type TierComparisonRow,
  type TierWithOutputs,
} from "@/lib/sales/quote-tiers";
import { type QuotationResult } from "@/lib/sales/quotation-calc";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
const idSchema = z.string().min(1).max(64);

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";
}

function toUTCDateISO(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ============================================================
// getPublicQuoteShare — render-safe tier comparison + best-effort view record.
// ============================================================
export interface PublicQuoteShareView {
  token: string;
  clientFirstName: string;
  occasion: string | null;
  eventDateISO: string | null;
  slotLabel: string | null;
  currency: string;
  showSocialProof: boolean;
  tiers: TierComparisonRow[];
  /** quotationId of the tier the customer already selected, if any. */
  selectedQuotationId: string | null;
}

export async function getPublicQuoteShare(token: string): Promise<Result<PublicQuoteShareView>> {
  try {
    if (!tokenSchema.safeParse(token).success)
      return { success: false, error: "This link is not valid." };

    const link = await prisma.quoteShareLink.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        status: true,
        clientName: true,
        occasion: true,
        eventDate: true,
        timeSlot: true,
        currency: true,
        showSocialProof: true,
        expiresAt: true,
        tiers: {
          orderBy: { order: "asc" },
          select: {
            quotationId: true,
            label: true,
            displayName: true,
            order: true,
            isRecommended: true,
            isSelected: true,
          },
        },
      },
    });
    if (!link) return { success: false, error: "This link is not valid." };
    const expired = !!link.expiresAt && link.expiresAt.getTime() < Date.now();
    if (link.status !== "ACTIVE" || expired)
      return { success: false, error: "This quote link has expired or is no longer available." };
    if (link.tiers.length === 0)
      return { success: false, error: "This quote is not ready yet. Please check back shortly." };

    // Load each tier's OWN frozen outputsJson (its independent price snapshot).
    const quotationIds = link.tiers.map((t) => t.quotationId);
    const quotes = await prisma.salesQuotation.findMany({
      where: { id: { in: quotationIds } },
      // ONLY the snapshot blob — never leadId / notes / cost / rep fields.
      select: { id: true, outputsJson: true },
    });
    const byId = new Map(quotes.map((q) => [q.id, q]));

    const tierInputs: TierWithOutputs[] = link.tiers.map((t) => {
      const q = byId.get(t.quotationId);
      // Read the tier's OWN frozen snapshot. selectTier invoices from this same
      // snapshot, so the customer always pays exactly what they see — never a
      // recompute (which could drift the displayed price).
      const outputs = (q?.outputsJson as unknown as QuotationResult) ?? null;
      return {
        quotationId: t.quotationId,
        label: resolveTierLabel(t.label),
        displayName: t.displayName,
        order: t.order,
        isRecommended: t.isRecommended,
        isSelected: t.isSelected,
        outputs,
      };
    });

    const tiers = buildTierComparison(tierInputs);
    const selected = link.tiers.find((t) => t.isSelected);

    // Best-effort QuoteView write (never blocks the render; device/ip server-side).
    void recordTierView(link.id, link.status).catch(() => {});

    const firstName = (link.clientName ?? "").trim().split(/\s+/)[0] || "there";
    const slotLabel = link.timeSlot ? SLOT_LABEL[plannerSlotToEnum(link.timeSlot)] : null;

    return {
      success: true,
      data: {
        token: link.token,
        clientFirstName: firstName,
        occasion: link.occasion,
        eventDateISO: toUTCDateISO(link.eventDate),
        slotLabel,
        currency: link.currency || "INR",
        showSocialProof: link.showSocialProof,
        tiers,
        selectedQuotationId: selected?.quotationId ?? null,
      },
    };
  } catch (e) {
    console.error("[GET_PUBLIC_QUOTE_SHARE_ERROR]", e);
    return { success: false, error: "We couldn't load this quote. Please try again." };
  }
}

/** Best-effort view tracking for a tiers page open. Never throws. */
async function recordTierView(shareLinkId: string, status: string): Promise<void> {
  try {
    if (status !== "ACTIVE") return;
    let ua: string | null = null;
    let ip: string | null = null;
    try {
      const h = await headers();
      ua = h.get("user-agent");
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    } catch {
      /* outside request scope */
    }
    const bot = isLikelyBot(ua);
    const now = new Date();
    await prisma.$transaction([
      prisma.quoteView.create({
        data: {
          shareLinkId,
          device: parseDeviceFromUA(ua),
          userAgent: ua ? ua.slice(0, 1000) : null,
          ipHash: hashIp(ip),
        },
      }),
      prisma.quoteShareLink.update({
        where: { id: shareLinkId },
        data: { viewCount: { increment: 1 }, ...(bot ? {} : { lastViewedAt: now }) },
      }),
    ]);
    if (!bot) {
      await prisma.quoteShareLink.updateMany({
        where: { id: shareLinkId, firstViewedAt: null },
        data: { firstViewedAt: now },
      });
    }
  } catch (e) {
    console.error("[RECORD_TIER_VIEW_ERROR]", e);
  }
}

// ============================================================
// selectTier — customer picks a tier → ensure proforma → /pay redirect.
// ============================================================
export interface SelectTierResult {
  payUrl: string;
  invoiceId: string;
  advanceAmount: number;
  quotationId: string;
}

export async function selectTier(
  token: string,
  quotationId: string
): Promise<Result<SelectTierResult>> {
  try {
    if (!tokenSchema.safeParse(token).success || !idSchema.safeParse(quotationId).success)
      return { success: false, error: "This link is not valid." };

    const link = await prisma.quoteShareLink.findUnique({
      where: { token },
      select: {
        id: true,
        status: true,
        primaryQuotationId: true,
        payInvoiceId: true,
        expiresAt: true,
        tiers: { select: { quotationId: true } },
      },
    });
    if (!link) return { success: false, error: "This link is not valid." };
    const expired = !!link.expiresAt && link.expiresAt.getTime() < Date.now();
    if (link.status !== "ACTIVE" || expired)
      return { success: false, error: "This quote link has expired or is no longer available." };

    // The chosen tier must belong to this link.
    if (!link.tiers.some((t) => t.quotationId === quotationId))
      return { success: false, error: "That option isn't available on this quote." };

    const isSwitch = link.primaryQuotationId !== quotationId;

    // Switching tiers before payment leaves the PREVIOUS tier's proforma minted
    // and orphaned (its SalesQuotation.invoiceId + the link's payInvoiceId both
    // point at a SENT invoice with full balanceDue). The daily GL reconciler
    // sweeps any SENT/UNPAID invoice into AR as phantom revenue, so we must
    // VOID/detach that old proforma — but only when it's safe: a real (non
    // '__pending__') invoice that the customer has NOT paid against.
    if (isSwitch && link.primaryQuotationId) {
      const oldQuotationId = link.primaryQuotationId;
      const oldQuote = await prisma.salesQuotation.findUnique({
        where: { id: oldQuotationId },
        select: { invoiceId: true },
      });
      const oldInvoiceId =
        oldQuote?.invoiceId && oldQuote.invoiceId !== "__pending__"
          ? oldQuote.invoiceId
          : link.payInvoiceId && link.payInvoiceId !== "__pending__"
            ? link.payInvoiceId
            : null;
      if (oldInvoiceId) {
        const oldInvoice = await prisma.invoice.findUnique({
          where: { id: oldInvoiceId },
          select: {
            status: true,
            paidAmount: true,
            payments: { where: { status: "COMPLETED" }, select: { id: true }, take: 1 },
          },
        });
        // Only void an unpaid, not-already-settled proforma. If the customer
        // paid (or it's PAID/PARTIALLY_PAID/CANCELLED/REFUNDED), leave it alone.
        if (
          oldInvoice &&
          oldInvoice.status === "SENT" &&
          oldInvoice.payments.length === 0 &&
          Number(oldInvoice.paidAmount) <= 0
        ) {
          await prisma.invoice
            .update({ where: { id: oldInvoiceId }, data: { status: "CANCELLED" } })
            .catch((e) => console.error("[SELECT_TIER_VOID_OLD_INVOICE_ERROR]", e));
          // Detach so re-selecting the old tier mints a fresh proforma rather
          // than reusing the cancelled one.
          await prisma.salesQuotation
            .updateMany({ where: { id: oldQuotationId, invoiceId: oldInvoiceId }, data: { invoiceId: null } })
            .catch((e) => console.error("[SELECT_TIER_DETACH_OLD_QUOTE_ERROR]", e));
        }
      }
    }

    // Mark the selected tier, clear the others (idempotent on re-select). Also
    // re-point the link's primaryQuotationId at the chosen tier so the proforma
    // + the one-tap helper invoice the right snapshot.
    const now = new Date();
    await prisma.$transaction([
      prisma.quoteTier.updateMany({
        where: { shareLinkId: link.id },
        data: { isSelected: false, selectedAt: null },
      }),
      prisma.quoteTier.updateMany({
        where: { shareLinkId: link.id, quotationId },
        data: { isSelected: true, selectedAt: now },
      }),
      prisma.quoteShareLink.update({
        where: { id: link.id },
        // Switching tiers before payment clears the old invoice ref so a fresh
        // proforma is minted for the newly-chosen snapshot.
        data: {
          primaryQuotationId: quotationId,
          ...(isSwitch ? { payInvoiceId: null, paymentLinkUrl: null } : {}),
        },
      }),
    ]);

    // Ensure a proforma exists for the chosen tier (system actor; reuses the
    // '__pending__' claim so a double-select can't mint two invoices).
    const proforma = await ensureProformaForShareLink(link.id);
    if (!proforma.success) return { success: false, error: proforma.error };

    const invoiceId = proforma.data.invoiceId;
    const advanceAmount =
      proforma.data.advanceAmount > 0 ? proforma.data.advanceAmount : await computeAdvanceAmount(invoiceId);

    // Default the public pay link to the 20% booking advance.
    const payUrl = `${appUrl()}/pay/${invoiceId}?amt=${Math.max(1, Math.round(advanceAmount))}`;
    await prisma.quoteShareLink
      .update({ where: { id: link.id }, data: { paymentLinkUrl: payUrl } })
      .catch(() => {});

    return { success: true, data: { payUrl, invoiceId, advanceAmount, quotationId } };
  } catch (e) {
    console.error("[SELECT_TIER_ERROR]", e);
    return { success: false, error: "Could not select that option. Please try again." };
  }
}
