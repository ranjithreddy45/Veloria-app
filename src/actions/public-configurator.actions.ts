"use server";

// ============================================================
// Public self-serve configurator actions — PUBLIC (no auth).
// ------------------------------------------------------------
// Mirrors storefront.actions.ts: these are intentionally unauthenticated. A
// customer at /configure builds a quote, the page prices it live via the SAME
// computeQuotation() engine, and on "Proceed to pay advance" we:
//   1. re-validate + RE-PRICE server-side (never trust the client total),
//   2. freeze the QuotationResult into the PublicQuoteDraft,
//   3. mint/upsert a Contact + a SENT advance Invoice (20% booking advance),
//   4. build the existing /pay/<invoiceId>?amt=<advance> link, store it,
//   5. fire captureLeadFromExternal() best-effort for CRM follow-up,
// then return the pay URL so the client redirects to the existing Razorpay
// checkout. Capture runs unchanged through verifyPublicRazorpayPayment.
//
// Access to a draft is scoped by an unguessable crypto token.
// ============================================================

import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeQuotation,
  validateQuotationInput,
  type QuotationInput,
} from "@/lib/sales/quotation-calc";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { mintAdvanceInvoice } from "@/lib/public/mint-advance-invoice";
import { publicConfiguratorSlotFree } from "@/actions/public-hold.actions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// Customer + event context captured alongside the calculator inputs.
interface ConfiguratorMeta {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  occasion?: string;
  eventDate?: string | null;
  timeSlot?: string;
  venueId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

// discountPct is NOT customer-editable — strip it from any public input so a
// customer can never self-discount. Internal staff set discounts elsewhere.
function sanitizePublicInput(input: QuotationInput): QuotationInput {
  const { discountPct: _discard, ...rest } = input ?? ({} as QuotationInput);
  void _discard;
  return { ...rest, discountPct: 0 };
}

// Headline figures derived from the engine (re-priced, never client-supplied).
function buildHeadline(input: QuotationInput, meta: ConfiguratorMeta) {
  const out = computeQuotation(input);
  return {
    customerName: meta.customerName?.trim() || null,
    customerPhone: meta.customerPhone?.trim() || null,
    customerEmail: meta.customerEmail?.trim() || null,
    occasion: meta.occasion?.trim() || null,
    eventDate: meta.eventDate ? new Date(meta.eventDate) : null,
    timeSlot: meta.timeSlot?.trim() || null,
    guestCount: Math.max(0, Math.floor(input.guestCount || 0)),
    grandTotal: new Prisma.Decimal(out.grandTotal),
    utmSource: meta.utmSource?.trim() || null,
    utmMedium: meta.utmMedium?.trim() || null,
    utmCampaign: meta.utmCampaign?.trim() || null,
  };
}

// ------------------------------------------------------------
// (1) Create a DRAFT public quote draft.
// ------------------------------------------------------------
export async function createPublicQuoteDraft(
  input: QuotationInput,
  meta: ConfiguratorMeta = {}
): Promise<Result<{ token: string }>> {
  try {
    const clean = sanitizePublicInput(input);
    const errs = validateQuotationInput(clean);
    if (errs.length) return { success: false, error: errs.join(" ") };

    const token = newToken();
    await prisma.publicQuoteDraft.create({
      data: {
        token,
        status: "DRAFT",
        inputsJson: clean as unknown as Prisma.InputJsonValue,
        venueId: meta.venueId || null,
        ...buildHeadline(clean, meta),
      },
    });
    return { success: true, data: { token } };
  } catch (error) {
    console.error("[CREATE_PUBLIC_QUOTE_DRAFT_ERROR]", error);
    return { success: false, error: "Couldn't save your quote. Please try again." };
  }
}

// ------------------------------------------------------------
// (2) Update a DRAFT public quote draft (re-validate + re-store).
// ------------------------------------------------------------
export async function updatePublicQuoteDraft(
  token: string,
  input: QuotationInput,
  meta: ConfiguratorMeta = {}
): Promise<Result<{ token: string }>> {
  try {
    if (!token) return { success: false, error: "Missing draft token." };
    const row = await prisma.publicQuoteDraft.findUnique({
      where: { token },
      select: { id: true, status: true },
    });
    if (!row) return { success: false, error: "Quote not found." };
    if (row.status !== "DRAFT") {
      return { success: false, error: "This quote can no longer be edited." };
    }

    const clean = sanitizePublicInput(input);
    const errs = validateQuotationInput(clean);
    if (errs.length) return { success: false, error: errs.join(" ") };

    await prisma.publicQuoteDraft.update({
      where: { token },
      data: {
        inputsJson: clean as unknown as Prisma.InputJsonValue,
        venueId: meta.venueId !== undefined ? meta.venueId || null : undefined,
        ...buildHeadline(clean, meta),
      },
    });
    return { success: true, data: { token } };
  } catch (error) {
    console.error("[UPDATE_PUBLIC_QUOTE_DRAFT_ERROR]", error);
    return { success: false, error: "Couldn't update your quote. Please try again." };
  }
}

// ------------------------------------------------------------
// (3) Resume a session — PUBLIC-SAFE fields only.
// ------------------------------------------------------------
export interface PublicQuoteDraftView {
  token: string;
  status: string;
  inputs: QuotationInput;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  occasion: string | null;
  eventDate: string | null;
  timeSlot: string | null;
  guestCount: number;
  grandTotal: number;
  advanceAmount: number;
  venueId: string | null;
  paymentLinkUrl: string | null;
}

export async function getPublicQuoteDraft(
  token: string
): Promise<Result<PublicQuoteDraftView>> {
  try {
    if (!token) return { success: false, error: "Missing draft token." };
    const row = await prisma.publicQuoteDraft.findUnique({
      where: { token },
      select: {
        token: true,
        status: true,
        inputsJson: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        occasion: true,
        eventDate: true,
        timeSlot: true,
        guestCount: true,
        grandTotal: true,
        advanceAmount: true,
        venueId: true,
        paymentLinkUrl: true,
        // Deliberately NOT selected: invoiceId, leadId, salesQuotationId
        // (internal record ids must not leak to the public page).
      },
    });
    if (!row) return { success: false, error: "Quote not found." };

    return {
      success: true,
      data: {
        token: row.token,
        status: row.status,
        inputs: row.inputsJson as unknown as QuotationInput,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        customerEmail: row.customerEmail,
        occasion: row.occasion,
        eventDate: row.eventDate ? row.eventDate.toISOString() : null,
        timeSlot: row.timeSlot,
        guestCount: row.guestCount,
        grandTotal: Number(row.grandTotal),
        advanceAmount: Number(row.advanceAmount),
        venueId: row.venueId,
        paymentLinkUrl: row.paymentLinkUrl,
      },
    };
  } catch (error) {
    console.error("[GET_PUBLIC_QUOTE_DRAFT_ERROR]", error);
    return { success: false, error: "Couldn't load your quote." };
  }
}

// ------------------------------------------------------------
// (4) Conversion: re-price, freeze, mint Contact + advance Invoice, build link.
// ------------------------------------------------------------
export interface ProceedCustomer {
  name: string;
  phone: string;
  email?: string;
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

export async function priceAndCreateAdvanceLink(
  token: string,
  customer: ProceedCustomer
): Promise<Result<{ payUrl: string; advanceAmount: number; grandTotal: number }>> {
  try {
    if (!token) return { success: false, error: "Missing draft token." };

    // Lightweight public-endpoint validation (mirrors submitBookingInquiry).
    const name = customer?.name?.trim();
    const phone = customer?.phone?.trim();
    const email = customer?.email?.trim() || undefined;
    if (!name || name.length < 2) return { success: false, error: "Please enter your name." };
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      return { success: false, error: "Please enter a valid phone number." };
    }

    const row = await prisma.publicQuoteDraft.findUnique({ where: { token } });
    if (!row) return { success: false, error: "Quote not found." };

    // Never take an advance for a date in the past.
    if (row.eventDate) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      if (new Date(row.eventDate) < todayStart) {
        return { success: false, error: "That event date has passed. Please pick an upcoming date." };
      }
    }

    // C6: never take an advance for a date we can't deliver. If this draft has a
    // venue + date + slot, refuse the pay link when that slot is already booked.
    if (row.venueId && row.eventDate && row.timeSlot) {
      const free = await publicConfiguratorSlotFree(row.venueId, row.eventDate, row.timeSlot);
      if (!free) {
        return {
          success: false,
          error: "That date & time has just been taken. Please pick another slot — your selections are saved, and our team can help on WhatsApp.",
        };
      }
    }

    // If an advance link already exists, return it (idempotent re-submit).
    if (row.paymentLinkUrl && row.invoiceId && (row.status === "LINK_SENT" || row.status === "PAID")) {
      return {
        success: true,
        data: {
          payUrl: row.paymentLinkUrl,
          advanceAmount: Number(row.advanceAmount),
          grandTotal: Number(row.grandTotal),
        },
      };
    }

    // ATOMIC CLAIM before minting: guard on invoiceId still being null so two
    // concurrent submits for the same token can't both pass the read-then-write
    // idempotency check and mint two SENT advance invoices + two CRM leads.
    // Mirrors the '__pending__' claim in quote-onetap.ts. The loser gets
    // count===0, re-reads the draft, and returns the winner's link (or a
    // try-again if the winner hasn't finished minting yet).
    const claim = await prisma.publicQuoteDraft.updateMany({
      where: { token, invoiceId: null },
      data: { status: "PRICED" },
    });
    if (claim.count === 0) {
      const fresh = await prisma.publicQuoteDraft.findUnique({
        where: { token },
        select: {
          paymentLinkUrl: true,
          invoiceId: true,
          advanceAmount: true,
          grandTotal: true,
        },
      });
      if (fresh?.paymentLinkUrl && fresh.invoiceId) {
        return {
          success: true,
          data: {
            payUrl: fresh.paymentLinkUrl,
            advanceAmount: Number(fresh.advanceAmount),
            grandTotal: Number(fresh.grandTotal),
          },
        };
      }
      return { success: false, error: "We're preparing your payment link. Please try again in a moment." };
    }

    // NEVER trust the client total: re-validate and RE-PRICE from stored inputs.
    const input = sanitizePublicInput(row.inputsJson as unknown as QuotationInput);
    const errs = validateQuotationInput(input);
    if (errs.length) return { success: false, error: errs.join(" ") };

    const result = computeQuotation(input);
    const advance = result.paymentSchedule[0]?.amount ?? 0; // 20% booking advance
    if (!(advance >= 1)) {
      return { success: false, error: "This quote is too small to take an advance online." };
    }

    // Upsert/mint a Contact (find by email then phone, else create) — same
    // dedup pattern used by lead-capture.ts.
    const nameParts = name.split(/\s+/);
    const firstName = nameParts[0] || "Guest";
    const lastName = nameParts.slice(1).join(" ") || "";

    let contact = null;
    if (email) {
      contact = await prisma.contact.findFirst({ where: { email } });
    }
    if (!contact) {
      contact = await prisma.contact.findFirst({ where: { phone } });
    }
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email: email || null,
          phone,
          tags: ["configurator"],
          enquirySource: "LEAD_FORM", // public configurator is a form we host
        },
      });
    }

    const fallbackEventName = input.foodMode === "HALL_ONLY" ? "Hall booking" : "Event booking";
    const eventName = row.occasion || fallbackEventName;

    // Mint a SENT advance invoice (server-only helper — createInvoice is gated
    // and creates DRAFT, which the /pay page rejects).
    const minted = await mintAdvanceInvoice({
      contactId: contact.id,
      amount: advance,
      eventName,
      description: `Booking advance (20%)${row.occasion ? ` — ${row.occasion}` : ""}`,
    });

    const payUrl = `${appBaseUrl()}/pay/${minted.invoiceId}?amt=${advance}`;

    // Best-effort CRM lead for follow-up — same path/source the storefront uses.
    let leadId: string | null = null;
    try {
      const lead = await captureLeadFromExternal({
        name,
        email,
        phone,
        source: "website",
        eventType: row.occasion || undefined,
        eventDate: row.eventDate ? row.eventDate.toISOString() : undefined,
        guestCount: row.guestCount || undefined,
        estimatedValue: result.grandTotal,
        venueId: row.venueId || undefined,
        message: `Self-serve configurator quote · ${result.grandTotal} grand total · ${advance} advance link`,
      });
      if (lead?.success && lead.leadId) leadId = lead.leadId;
    } catch (e) {
      console.error("[CONFIGURATOR_LEAD_CAPTURE_ERROR]", e);
    }

    // Freeze outputs + denormalised figures + the link onto the draft.
    await prisma.publicQuoteDraft.update({
      where: { token },
      data: {
        status: "LINK_SENT",
        outputsJson: result as unknown as Prisma.InputJsonValue,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || null,
        guestCount: Math.max(0, Math.floor(input.guestCount || 0)),
        grandTotal: new Prisma.Decimal(result.grandTotal),
        advanceAmount: new Prisma.Decimal(advance),
        invoiceId: minted.invoiceId,
        paymentLinkUrl: payUrl,
        leadId,
      },
    });

    return {
      success: true,
      data: { payUrl, advanceAmount: advance, grandTotal: result.grandTotal },
    };
  } catch (error) {
    console.error("[PRICE_AND_CREATE_ADVANCE_LINK_ERROR]", error);
    return { success: false, error: "Couldn't create your payment link. Please try again." };
  }
}
