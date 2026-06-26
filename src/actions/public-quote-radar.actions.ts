"use server";

// ============================================================
// Public Quote Radar — PUBLIC (no-auth) actions for /q/<token>.
// ------------------------------------------------------------
// The token is the SOLE access control (same posture as /pay/[invoiceId] and
// /hold/[token]). These actions:
//   - getPublicQuoteByToken: resolve the ACTIVE, non-expired link, load the
//     primary SalesQuotation snapshot, and return ONLY customer-safe fields via
//     the single chokepoint mapper (buildPublicQuoteView) — never leaks leadId,
//     rep identity, costs, internal notes, or other quotations.
//   - recordQuoteView: best-effort analytics write fired from a client beacon;
//     inserts a QuoteView row and atomically rolls counters onto the link. NEVER
//     throws and NEVER blocks the public render (concurrency-safe increments).
// ============================================================

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import {
  buildPublicQuoteView,
  type PublicQuoteView,
  type ShareLinkForView,
} from "@/lib/quote-radar/build-public-view";
import {
  parseDeviceFromUA,
  hashIp,
  isLikelyBot,
  looksLikeShareToken,
} from "@/lib/quote-radar/token";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ============================================================
// getPublicQuoteByToken — customer-safe quote projection (no internal data).
// ============================================================
export async function getPublicQuoteByToken(
  token: string
): Promise<Result<PublicQuoteView>> {
  try {
    if (!looksLikeShareToken(token)) return { success: false, error: "This link is not valid." };

    const link = await prisma.quoteShareLink.findUnique({
      where: { token },
      select: {
        token: true,
        status: true,
        clientName: true,
        occasion: true,
        eventDate: true,
        timeSlot: true,
        currency: true,
        showSocialProof: true,
        payInvoiceId: true,
        paymentLinkUrl: true,
        expiresAt: true,
        primaryQuotationId: true,
      },
    });
    if (!link) return { success: false, error: "This link is not valid." };

    // Enforce ACTIVE + not-expired BEFORE loading the snapshot, so REVOKED /
    // EXPIRED links render the friendly invalid card with no data leak.
    const expired = !!link.expiresAt && link.expiresAt.getTime() < Date.now();
    if (link.status !== "ACTIVE" || expired) {
      return { success: false, error: "This quote link has expired or is no longer available." };
    }

    let primary: { inputsJson: unknown; outputsJson: unknown } | null = null;
    if (link.primaryQuotationId) {
      primary = await prisma.salesQuotation.findUnique({
        where: { id: link.primaryQuotationId },
        // ONLY the snapshot blobs — never leadId / notes / cost / rep fields.
        select: { inputsJson: true, outputsJson: true },
      });
    }

    const view: ShareLinkForView = {
      token: link.token,
      status: link.status,
      clientName: link.clientName,
      occasion: link.occasion,
      eventDate: link.eventDate,
      timeSlot: link.timeSlot,
      currency: link.currency,
      showSocialProof: link.showSocialProof,
      payInvoiceId: link.payInvoiceId,
      paymentLinkUrl: link.paymentLinkUrl,
      expiresAt: link.expiresAt,
    };

    return { success: true, data: buildPublicQuoteView(view, primary) };
  } catch (e) {
    console.error("[GET_PUBLIC_QUOTE_BY_TOKEN_ERROR]", e);
    return { success: false, error: "We couldn't load this quote. Please try again." };
  }
}

// ============================================================
// recordQuoteView — best-effort view analytics. NEVER throws / blocks render.
// ============================================================
export interface RecordQuoteViewInput {
  token: string;
  referrer?: string | null;
  /** dwell time measured client-side (visibilitychange/beforeunload). */
  durationMs?: number | null;
  /** which tier the viewer focused on (plain ref → SalesQuotation.id). */
  viewedQuotationId?: string | null;
}

export async function recordQuoteView(
  input: RecordQuoteViewInput
): Promise<{ recorded: boolean }> {
  try {
    if (!looksLikeShareToken(input.token)) return { recorded: false };

    // Device + ipHash are derived SERVER-side from headers — never trusted from
    // the client. The referrer/dwell come from the beacon (untrusted but harmless).
    let ua: string | null = null;
    let ip: string | null = null;
    try {
      const h = await headers();
      ua = h.get("user-agent");
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    } catch {
      // headers() can throw outside a request scope — degrade gracefully.
    }

    const link = await prisma.quoteShareLink.findUnique({
      where: { token: input.token },
      select: { id: true, status: true, expiresAt: true },
    });
    if (!link || link.status !== "ACTIVE") return { recorded: false };
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return { recorded: false };

    const device = parseDeviceFromUA(ua);
    const ipHash = hashIp(ip);
    const referrer = (input.referrer ?? "").toString().slice(0, 500) || null;
    const durationMs =
      typeof input.durationMs === "number" && Number.isFinite(input.durationMs) && input.durationMs >= 0
        ? Math.min(Math.round(input.durationMs), 6 * 60 * 60 * 1000)
        : null;
    const viewedQuotationId = input.viewedQuotationId
      ? String(input.viewedQuotationId).slice(0, 64)
      : null;

    // Bot/unfurl crawlers (WhatsApp/Slack preview) STILL get a QuoteView row for
    // accurate analytics, but must NOT set firstViewedAt — otherwise the 24h
    // recovery trigger fires on a preview crawl, not a real human open.
    const bot = isLikelyBot(ua);
    const now = new Date();

    // Insert the detail row + roll the counters atomically. The increment +
    // conditional firstViewedAt are done as one transaction so concurrent opens
    // can't drift the count (no read-modify-write).
    await prisma.$transaction([
      prisma.quoteView.create({
        data: {
          shareLinkId: link.id,
          device,
          userAgent: ua ? ua.slice(0, 1000) : null,
          ipHash,
          referrer,
          viewedQuotationId,
          durationMs,
        },
      }),
      prisma.quoteShareLink.update({
        where: { id: link.id },
        data: {
          viewCount: { increment: 1 },
          // lastViewedAt advances on every human open; bot opens leave it alone.
          ...(bot ? {} : { lastViewedAt: now }),
        },
      }),
    ]);

    // firstViewedAt must be set ONLY when currently null (first HUMAN open).
    // Prisma can't express "set if null" inline, so a guarded conditional
    // updateMany does it atomically (no read-modify-write, concurrency-safe).
    if (!bot) {
      await prisma.quoteShareLink.updateMany({
        where: { id: link.id, firstViewedAt: null },
        data: { firstViewedAt: now },
      });
    }

    return { recorded: true };
  } catch (e) {
    // Best-effort analytics: swallow everything so the public page never breaks.
    console.error("[RECORD_QUOTE_VIEW_ERROR]", e);
    return { recorded: false };
  }
}
