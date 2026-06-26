"use server";

// ============================================================
// Quote Share Link — CANONICAL rep-side (INTERNAL, RBAC-gated) actions.
// ------------------------------------------------------------
// The single create/manage surface for the shareable, view-tracked public quote
// link at /q/<token>. Owned here; the radar / one-tap / tiers / caption features
// all build on these. A link mints an unguessable crypto token, denormalises the
// customer-safe headline from the APPROVED/SENT SalesQuotation, eagerly ensures
// the booking-advance proforma (so the public one-tap button has an invoice),
// and stamps SalesQuotation.shareLinkToken.
//
// SECURITY: createQuoteShareLink / revokeQuoteShareLink gate on quotes:send (or
// publicquotes:manage); getters gate on quotes:read / publicquotes:read.
// Decimals are serialized at the boundary. The token alone is the public access
// control — these actions never expose it to anyone without quote permissions.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { generateShareToken } from "@/lib/quote-radar/token";
import { ensureProformaForShareLink } from "@/lib/sales/quote-onetap";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

function canAny(role: string | undefined, perms: string[]): boolean {
  return !!role && perms.some((p) => hasPermission(role, p));
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com";
}

// ============================================================
// createQuoteShareLink — mint (or reuse) an ACTIVE link for a quotation.
// ============================================================
export async function createQuoteShareLink(
  quotationId: string,
  opts?: { ensureProforma?: boolean }
): Promise<Result<{ id: string; token: string; url: string; payInvoiceId: string | null }>> {
  const user = await requireUser();
  // Sharing a quote IS the "send" action; publicquotes:manage also grants it.
  if (!user || !canAny(user.role, ["quotes:send", "publicquotes:manage", "quotes:create"]))
    return { success: false, error: "You don't have permission to share quotations." };

  const q = await prisma.salesQuotation.findUnique({
    where: { id: quotationId },
    select: {
      id: true,
      status: true,
      quoteGroupId: true,
      clientName: true,
      clientPhone: true,
      occasion: true,
      eventDate: true,
      timeSlot: true,
      grandTotal: true,
      leadId: true,
      contactId: true,
      venueId: true,
      shareLinkToken: true,
    },
  });
  if (!q) return { success: false, error: "Quotation not found." };
  if (q.status !== "APPROVED" && q.status !== "SENT")
    return { success: false, error: "Approve the quotation before sharing a tracked link." };

  try {
    // Reuse an existing ACTIVE link for this quotation (idempotent share).
    let link = await prisma.quoteShareLink.findFirst({
      where: { primaryQuotationId: quotationId, status: "ACTIVE" },
      select: { id: true, token: true, payInvoiceId: true },
      orderBy: { createdAt: "desc" },
    });

    if (!link) {
      const token = generateShareToken();
      const created = await prisma.quoteShareLink.create({
        data: {
          token,
          status: "ACTIVE",
          quoteGroupId: q.quoteGroupId || null,
          primaryQuotationId: quotationId,
          leadId: q.leadId || null,
          contactId: q.contactId || null,
          venueId: q.venueId || null,
          clientName: q.clientName || null,
          clientPhone: q.clientPhone || null,
          occasion: q.occasion || null,
          eventDate: q.eventDate || null,
          timeSlot: q.timeSlot || null,
          grandTotal: q.grandTotal ?? new Prisma.Decimal(0),
          createdById: user.id,
        },
        select: { id: true, token: true, payInvoiceId: true },
      });
      link = created;
      // Stamp the quotation so the rep UI can show "shared".
      await prisma.salesQuotation.update({
        where: { id: quotationId },
        data: { shareLinkToken: token },
      });
    } else if (q.shareLinkToken !== link.token) {
      await prisma.salesQuotation.update({
        where: { id: quotationId },
        data: { shareLinkToken: link.token },
      });
    }

    // Eagerly raise the booking-advance proforma so the public "Pay 20%" button
    // has an invoice ready (run as the rep so invoice authorship is correct).
    // Best-effort: a proforma failure must not block sharing the link.
    let payInvoiceId = link.payInvoiceId;
    if (opts?.ensureProforma !== false) {
      const proforma = await ensureProformaForShareLink(link.id, { actorId: user.id });
      if (proforma.success) payInvoiceId = proforma.data.invoiceId;
    }

    after(() =>
      logActivity({
        userId: user.id,
        action: "QUOTE_SHARE_LINK_CREATED",
        entityType: "QuoteShareLink",
        entityId: link!.id,
        changes: { quotationId, token: link!.token },
      })
    );

    revalidatePath(`/quotations/${quotationId}`);
    return {
      success: true,
      data: {
        id: link.id,
        token: link.token,
        url: `${appUrl()}/q/${link.token}`,
        payInvoiceId,
      },
    };
  } catch (e) {
    console.error("[CREATE_QUOTE_SHARE_LINK_ERROR]", e);
    return { success: false, error: "Could not create the share link. Please try again." };
  }
}

// ============================================================
// getQuoteShareLink / getQuoteShareLinkForQuotation — radar readout for the rep.
// (Two names: one per sibling feature; both resolve the same panel data.)
// ============================================================
export interface QuoteRadarSignals {
  id: string;
  token: string;
  url: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  quotationId: string | null;
  opened: boolean;
  viewCount: number;
  uniqueViewers: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  silentNudgeFiredAt: string | null;
  /** opened but no view in 24h+ and not yet paid → amber recovery flag. */
  openedButSilent: boolean;
  payInvoiceId: string | null;
  paymentLinkUrl: string | null;
  aiCaption: string | null;
  deviceMix: { device: string; count: number }[];
  recentViews: { device: string; viewedAt: string; referrer: string | null }[];
}

export async function getQuoteShareLink(
  quotationId: string
): Promise<Result<QuoteRadarSignals | null>> {
  const user = await requireUser();
  if (!user || !canAny(user.role, ["quotes:read", "publicquotes:read"]))
    return { success: false, error: "Unauthorized" };

  try {
    const link = await prisma.quoteShareLink.findFirst({
      where: { primaryQuotationId: quotationId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        token: true,
        status: true,
        primaryQuotationId: true,
        viewCount: true,
        firstViewedAt: true,
        lastViewedAt: true,
        silentNudgeFiredAt: true,
        payInvoiceId: true,
        paymentLinkUrl: true,
        aiCaption: true,
        expiresAt: true,
      },
    });
    if (!link) return { success: true, data: null };

    // Pull a bounded slice of view rows for the device mix + unique-viewer count.
    const views = await prisma.quoteView.findMany({
      where: { shareLinkId: link.id },
      orderBy: { viewedAt: "desc" },
      take: 200,
      select: { device: true, viewedAt: true, referrer: true, ipHash: true },
    });

    const deviceCounts = new Map<string, number>();
    const uniqueHashes = new Set<string>();
    for (const v of views) {
      deviceCounts.set(v.device, (deviceCounts.get(v.device) ?? 0) + 1);
      if (v.ipHash) uniqueHashes.add(v.ipHash);
    }
    const deviceMix = [...deviceCounts.entries()].map(([device, count]) => ({ device, count }));

    const opened = !!link.firstViewedAt;
    const paid = await isLinkPaid(link.payInvoiceId);
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const openedButSilent =
      opened &&
      !paid &&
      !!link.lastViewedAt &&
      link.lastViewedAt.getTime() < dayAgo;

    // unique viewers: distinct ipHash where present, else fall back to viewCount.
    const uniqueViewers = uniqueHashes.size > 0 ? uniqueHashes.size : (opened ? Math.max(1, views.length) : 0);

    const data: QuoteRadarSignals = {
      id: link.id,
      token: link.token,
      url: `${appUrl()}/q/${link.token}`,
      status: link.status,
      quotationId: link.primaryQuotationId,
      opened,
      viewCount: link.viewCount,
      uniqueViewers,
      firstViewedAt: link.firstViewedAt ? link.firstViewedAt.toISOString() : null,
      lastViewedAt: link.lastViewedAt ? link.lastViewedAt.toISOString() : null,
      silentNudgeFiredAt: link.silentNudgeFiredAt ? link.silentNudgeFiredAt.toISOString() : null,
      openedButSilent,
      payInvoiceId: link.payInvoiceId,
      paymentLinkUrl: link.paymentLinkUrl,
      aiCaption: link.aiCaption,
      deviceMix,
      recentViews: views.slice(0, 12).map((v) => ({
        device: v.device,
        viewedAt: v.viewedAt.toISOString(),
        referrer: v.referrer,
      })),
    };
    return { success: true, data };
  } catch (e) {
    console.error("[GET_QUOTE_SHARE_LINK_ERROR]", e);
    return { success: false, error: "Could not load the radar." };
  }
}

/** Alias used by the one-tap-pay sibling (same payload). */
export async function getQuoteShareLinkForQuotation(
  quotationId: string
): Promise<Result<QuoteRadarSignals | null>> {
  return getQuoteShareLink(quotationId);
}

// ============================================================
// revokeQuoteShareLink — set status=REVOKED (link 404s publicly thereafter).
// ============================================================
export async function revokeQuoteShareLink(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !canAny(user.role, ["quotes:send", "publicquotes:manage"]))
    return { success: false, error: "You don't have permission to revoke share links." };

  try {
    const link = await prisma.quoteShareLink.findUnique({
      where: { id },
      select: { id: true, status: true, primaryQuotationId: true, token: true },
    });
    if (!link) return { success: false, error: "Share link not found." };
    if (link.status === "REVOKED") return { success: true, data: { id } };

    await prisma.quoteShareLink.update({ where: { id }, data: { status: "REVOKED" } });
    // Clear the quotation's stamp if it pointed at this token.
    if (link.primaryQuotationId) {
      await prisma.salesQuotation
        .updateMany({
          where: { id: link.primaryQuotationId, shareLinkToken: link.token },
          data: { shareLinkToken: null },
        })
        .catch(() => {});
    }

    after(() =>
      logActivity({
        userId: user.id,
        action: "QUOTE_SHARE_LINK_REVOKED",
        entityType: "QuoteShareLink",
        entityId: id,
        changes: { token: link.token },
      })
    );

    if (link.primaryQuotationId) revalidatePath(`/quotations/${link.primaryQuotationId}`);
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[REVOKE_QUOTE_SHARE_LINK_ERROR]", e);
    return { success: false, error: "Could not revoke the share link." };
  }
}

// ------------------------------------------------------------
// Internal: is the link's backing invoice paid (so we stop nudging)?
// ------------------------------------------------------------
async function isLinkPaid(payInvoiceId: string | null): Promise<boolean> {
  if (!payInvoiceId || payInvoiceId === "__pending__") return false;
  try {
    const inv = await prisma.invoice.findUnique({
      where: { id: payInvoiceId },
      select: { status: true, balanceDue: true },
    });
    return !!inv && (inv.status === "PAID" || Number(inv.balanceDue) <= 0);
  } catch {
    return false;
  }
}
