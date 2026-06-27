"use server";

// ============================================================
// Quote One-Tap Pay — PUBLIC (no-auth) actions for /q/<token>.
// ------------------------------------------------------------
// Mirrors the security posture of public-hold.actions.ts: the unguessable
// QuoteShareLink.token is the only access control; every action returns ONLY
// payer-safe fields and is IP-rate-limited to blunt slot-squatting / order-spam.
//
// Flow the OneTapPay client drives:
//   1. getPublicQuoteForPay(token)  → payer-safe summary
//   2. getPublicSlotScarcity(token) → live FREE/BUSY + scarcity copy
//   3. startOneTapAdvance(token)    → ensures the proforma, returns {invoiceId, amount}
//   4. (client) createPublicRazorpayOrder → Razorpay checkout → verifyPublicRazorpayPayment
//   5. confirmOneTapAndBlock(token) → blocks the slot + auto-confirms
//
// The heavy lifting (proforma + slot block + auto-confirm) lives in the shared
// helper src/lib/sales/quote-onetap.ts so the gated internal actions are never
// invoked from this public context.
// ============================================================

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { z } from "zod";
import {
  ensureProformaForShareLink,
  finalizeOneTapBlock,
  computeAdvanceAmount,
  publicSlotScarcity,
} from "@/lib/sales/quote-onetap";
import { SLOT_LABEL, plannerSlotToEnum } from "@/lib/sales/slot";
import {
  resolveQuotationResult,
  type PrimaryQuotationForView,
} from "@/lib/quote-radar/build-public-view";
import type { QuotationResult } from "@/lib/sales/quotation-calc";
// The single typed contract between this public action and the /q page + its
// components. Returning these exact shapes keeps the page render in lockstep.
import type {
  PublicQuoteView,
  PublicSlotScarcity,
} from "@/app/(public)/q/[token]/_components/public-quote-types";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

// ------------------------------------------------------------
// Per-instance IP rate limiter (mirrors public-hold.actions.ts). Best-effort.
// ------------------------------------------------------------
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

/** Format a @db.Date (UTC-midnight) to YYYY-MM-DD without TZ drift. */
function toUTCDateISO(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function isInvoicePaid(invoiceId: string | null): Promise<boolean> {
  if (!invoiceId || invoiceId === "__pending__") return false;
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, balanceDue: true },
  });
  return !!inv && (inv.status === "PAID" || Number(inv.balanceDue) <= 0);
}

// ============================================================
// getPublicQuoteForPay — payer-safe summary (no internal data).
// ============================================================
export interface PublicQuoteForPay {
  token: string;
  clientFirstName: string;
  occasion: string | null;
  eventDateISO: string | null;
  slotLabel: string | null;
  guestCount: number | null;
  grandTotal: number;
  advanceAmount: number | null;
  payInvoiceId: string | null;
  venueId: string | null;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  paid: boolean;
  blocked: boolean;
  showSocialProof: boolean;
  currency: string;
}

export async function getPublicQuoteForPay(token: string): Promise<Result<PublicQuoteView>> {
  try {
    if (!tokenSchema.safeParse(token).success)
      return { success: false, error: "This link is not valid." };

    const link = await prisma.quoteShareLink.findUnique({
      where: { token },
      select: {
        token: true,
        status: true,
        clientName: true,
        occasion: true,
        eventDate: true,
        timeSlot: true,
        grandTotal: true,
        currency: true,
        venueId: true,
        payInvoiceId: true,
        showSocialProof: true,
        expiresAt: true,
        primaryQuotationId: true,
      },
    });
    if (!link) return { success: false, error: "This link is not valid." };

    const expired = !!link.expiresAt && link.expiresAt.getTime() < Date.now();
    if (link.status !== "ACTIVE" || expired)
      return { success: false, error: "This quote link has expired or is no longer available." };

    // Guest count + advance + booked-state from the frozen snapshot (price is
    // never recomputed). One read covers all three.
    let advanceAmount: number | null = null;
    let blocked = false;
    let result: QuotationResult | null = null;
    if (link.primaryQuotationId) {
      const q = await prisma.salesQuotation.findUnique({
        where: { id: link.primaryQuotationId },
        select: { guestCount: true, inputsJson: true, outputsJson: true, bookingId: true },
      });
      if (q) {
        result = resolveQuotationResult(q as PrimaryQuotationForView);
        advanceAmount = result?.paymentSchedule?.[0]?.amount ?? null;
        // "blocked" = the quotation already has a HOLD/CONFIRMED booking.
        blocked = !!q.bookingId;
      }
    }
    // Prefer the actual first installment amount when an invoice already exists.
    if (link.payInvoiceId && link.payInvoiceId !== "__pending__") {
      const fromInvoice = await computeAdvanceAmount(link.payInvoiceId);
      if (fromInvoice > 0) advanceAmount = fromInvoice;
    }

    const paid = await isInvoicePaid(link.payInvoiceId);

    const firstName = (link.clientName ?? "").trim().split(/\s+/)[0] || "there";
    const slotLabel = link.timeSlot ? SLOT_LABEL[plannerSlotToEnum(link.timeSlot)] : null;

    // Single-tier link: project the frozen result into ONE Good-Better-Best tier
    // (multi-tier links are served by the tiers feature; this public payload
    // always carries at least one). Price comes ONLY from the frozen snapshot.
    const headlineTotal = result ? result.grandTotal : Number(link.grandTotal);
    const tier: PublicQuoteView["tiers"][number] = {
      id: link.primaryQuotationId ?? link.token,
      quotationId: link.primaryQuotationId ?? "",
      displayName: link.occasion ? `${link.occasion} package` : "Your package",
      order: 0,
      grandTotal: headlineTotal,
      advanceAmount: advanceAmount ?? Math.round(headlineTotal * 0.2),
      isRecommended: true,
      isSelected: false,
      lines: result
        ? result.lines.map((l) => ({ sl: l.sl, particulars: l.particulars, plan: l.plan, amount: l.amount }))
        : [],
      subtotal: result ? result.subtotal : headlineTotal,
      discountAmount: result ? result.discountAmount : 0,
      tax: result ? result.tax : 0,
      paymentSchedule: result
        ? result.paymentSchedule.map((p) => ({ label: p.label, pct: p.pct, amount: p.amount, dueHint: p.dueHint }))
        : [],
    };

    return {
      success: true,
      data: {
        token: link.token,
        clientFirstName: firstName,
        occasion: link.occasion,
        eventDate: toUTCDateISO(link.eventDate),
        slotLabel,
        currency: link.currency || "INR",
        grandTotal: headlineTotal,
        tiers: [tier],
        showSocialProof: link.showSocialProof,
        paid,
        blocked,
        eventType: link.occasion,
        venueId: link.venueId,
      },
    };
  } catch (e) {
    console.error("[GET_PUBLIC_QUOTE_FOR_PAY_ERROR]", e);
    return { success: false, error: "We couldn't load this quote. Please try again." };
  }
}

// ============================================================
// getPublicSlotScarcity — live FREE/BUSY + scarcity copy (zero identities).
// ============================================================
export async function getPublicSlotScarcity(token: string): Promise<Result<PublicSlotScarcity>> {
  try {
    if (!tokenSchema.safeParse(token).success)
      return { success: false, error: "This link is not valid." };

    const link = await prisma.quoteShareLink.findUnique({
      where: { token },
      select: { status: true, venueId: true, eventDate: true, timeSlot: true, expiresAt: true },
    });
    if (!link) return { success: false, error: "This link is not valid." };
    const expired = !!link.expiresAt && link.expiresAt.getTime() < Date.now();
    if (link.status !== "ACTIVE" || expired)
      return { success: false, error: "This quote link is no longer available." };
    if (!link.venueId || !link.eventDate)
      return { success: true, data: { chips: [], message: null, selectedSlotFree: false } };

    const cells = await publicSlotScarcity(link.venueId, link.eventDate);
    // Partial slots only (FULL_DAY is a different sell unit) drive scarcity copy.
    const partials = cells.filter((c) => c.slot !== "FULL_DAY");
    const freePartials = partials.filter((c) => c.free);

    let scarcityMessage: string | null = null;
    if (freePartials.length === 1) {
      scarcityMessage = `Only ${freePartials[0].label} left for this date — book now`;
    } else if (freePartials.length === 0) {
      scarcityMessage = "This date is almost fully booked — talk to us about alternatives";
    } else if (freePartials.length === 2) {
      scarcityMessage = "Filling up — only a couple of slots left for this date";
    }

    // Is the quote's OWN slot still free? Drives the "your date is still open"
    // reassurance vs the urgency banner. FULL_DAY links fall back to "any partial".
    const ownSlot = link.timeSlot ? plannerSlotToEnum(link.timeSlot) : null;
    const selectedSlotFree = ownSlot
      ? (cells.find((c) => c.slot === ownSlot)?.free ?? false)
      : freePartials.length > 0;

    return {
      success: true,
      data: {
        chips: cells.map((c) => ({ slot: c.slot, slotLabel: c.label, free: c.free })),
        message: scarcityMessage,
        selectedSlotFree,
      },
    };
  } catch (e) {
    console.error("[GET_PUBLIC_SLOT_SCARCITY_ERROR]", e);
    return { success: false, error: "Could not load availability." };
  }
}

// ============================================================
// startOneTapAdvance — ensure the proforma, return {invoiceId, amount}.
// ============================================================
export async function startOneTapAdvance(
  token: string
): Promise<Result<{ invoiceId: string; amount: number }>> {
  try {
    if (!tokenSchema.safeParse(token).success)
      return { success: false, error: "This link is not valid." };

    const ip = await clientIp();
    if (rateLimited(ip))
      return { success: false, error: "Too many requests. Please try again in a little while." };

    const link = await prisma.quoteShareLink.findUnique({
      where: { token },
      select: { id: true, status: true, payInvoiceId: true, expiresAt: true },
    });
    if (!link) return { success: false, error: "This link is not valid." };
    const expired = !!link.expiresAt && link.expiresAt.getTime() < Date.now();
    if (link.status !== "ACTIVE" || expired)
      return { success: false, error: "This quote link has expired or is no longer available." };

    // Already paid → nothing to start.
    if (await isInvoicePaid(link.payInvoiceId))
      return { success: false, error: "This date is already secured." };

    // Idempotent: reuse an existing invoice, else mint the proforma (system actor).
    const proforma = await ensureProformaForShareLink(link.id);
    if (!proforma.success) return { success: false, error: proforma.error };

    const amount = proforma.data.advanceAmount > 0
      ? proforma.data.advanceAmount
      : await computeAdvanceAmount(proforma.data.invoiceId);
    if (!(amount >= 1))
      return { success: false, error: "Could not work out the booking advance. Please contact us." };

    return { success: true, data: { invoiceId: proforma.data.invoiceId, amount } };
  } catch (e) {
    console.error("[START_ONE_TAP_ADVANCE_ERROR]", e);
    return { success: false, error: "Could not start your payment. Please try again." };
  }
}

// ============================================================
// confirmOneTapAndBlock — after capture, block the slot + auto-confirm.
// Razorpay may fire both the client handler AND a webhook; the underlying
// applyCapture + maybeConfirm + slot block are all idempotent, so a double call
// is safe and returns the same booking.
// ============================================================
export async function confirmOneTapAndBlock(
  token: string
): Promise<Result<{ bookingId: string; secured: boolean; slotTaken?: boolean }>> {
  try {
    if (!tokenSchema.safeParse(token).success)
      return { success: false, error: "This link is not valid." };

    // Rate-limit this mutating endpoint (parity with startOneTapAdvance): it
    // creates a HOLD booking + mints a contact via finalizeOneTapBlock, so an
    // unthrottled caller could spam slot-block attempts / contact creation.
    const ip = await clientIp();
    if (rateLimited(ip))
      return { success: false, error: "Too many requests. Please try again in a little while." };

    const link = await prisma.quoteShareLink.findUnique({
      where: { token },
      select: { id: true, status: true, payInvoiceId: true },
    });
    if (!link) return { success: false, error: "This link is not valid." };
    // A REVOKED/EXPIRED link must not be finalizable, but if the customer
    // already paid we should still try to secure the slot (don't strand a payer).
    const paid = await isInvoicePaid(link.payInvoiceId);
    if (link.status !== "ACTIVE" && !paid)
      return { success: false, error: "This quote link is no longer available." };

    const res = await finalizeOneTapBlock(link.id);
    if (!res.success) {
      // The "pay-then-lose" race: the advance is already captured but the slot
      // was just grabbed. Surface a graceful message; ops will reconcile.
      if (res.error === "SLOT_TAKEN") {
        return {
          success: true,
          data: {
            bookingId: "",
            secured: false,
            slotTaken: true,
          },
        };
      }
      return { success: false, error: res.error };
    }
    return { success: true, data: { bookingId: res.data.bookingId, secured: true } };
  } catch (e) {
    console.error("[CONFIRM_ONE_TAP_AND_BLOCK_ERROR]", e);
    return { success: false, error: "Payment received — we'll confirm your date shortly." };
  }
}
