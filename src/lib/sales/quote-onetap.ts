// ============================================================
// Quote One-Tap Pay — shared server orchestration (NOT "use server").
// ------------------------------------------------------------
// Owns the proforma-first one-tap flow so BOTH the public no-auth action
// (quote-onetap.actions.ts) and the rep-side share-link action
// (quote-share.actions.ts) can reuse it without circular "use server" imports.
//
// WHY a plain lib (not the gated createBookingInvoiceFromQuotation action):
// createBookingInvoiceFromQuotation / createInvoice / blockSlotFromQuotation are
// all auth+RBAC gated and cannot run in the PUBLIC one-tap context. This module
// REPLICATES the exact same proforma-first ordering (invoice → 20/60/20 plan →
// pay → block → auto-confirm), reusing the '__pending__' sentinel CLAIM and the
// Serializable createBooking guard the internal path uses, but parametrized by
// an explicit actor id (system user for public, rep for share-time pre-gen).
//
// MONEY: the advance equals the booking-advance (20%) installment computed off
// the INVOICE total (not the quotation grandTotal — they differ by GST paise).
// All splits are integer-rupee. Never recompute 20% client-side.
//
// NEVER throws — every export returns Result<T>.
// ============================================================

import { Prisma, type TimeSlot } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeQuotation,
  type QuotationInput,
  type QuotationResult,
} from "@/lib/sales/quotation-calc";
import { SLOT_LABEL, plannerSlotToEnum, type TimeSlotEnum } from "@/lib/sales/slot";
import { utcDayRange } from "@/lib/sales/slot-util";
import { reportSystemFailure } from "@/lib/ops-alert";
import { generateBookingNumber } from "@/actions/booking.actions";
import { maybeConfirmBookingOnPayment } from "@/lib/sales/confirm-booking";
import { getSystemUserId } from "@/lib/lead-capture";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const PENDING = "__pending__";

/** Slot-enum helper for the scarcity/block path. */
function resolveSlot(timeSlot?: string | null): TimeSlotEnum {
  return plannerSlotToEnum(timeSlot);
}

/** Parse YYYY-MM-DD → UTC midnight, matching the @db.Date + utcDayRange convention. */
function parseUTCDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m
    ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ------------------------------------------------------------
// Invoice / installment number allocation (replicates the internal
// generators, which are private + auth-gated, with a P2002-safe retry).
// ------------------------------------------------------------
async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });
    let next = 1;
    if (last) next = parseInt(last.invoiceNumber.split("-").pop() || "0", 10) + 1;
    const number = `${prefix}${String(next + attempt).padStart(4, "0")}`;
    const exists = await prisma.invoice.findFirst({
      where: { invoiceNumber: number },
      select: { id: true },
    });
    if (!exists) return number;
  }
  return `INV-${Date.now()}`;
}

// ============================================================
// ensureProformaForShareLink — idempotently raise the booking-advance proforma
// for the link's underlying quotation, then write payInvoiceId + advanceAmount
// onto the QuoteShareLink. Reuses the quotation's '__pending__' CLAIM so a
// double-tap can't mint two invoices.
// ============================================================
export async function ensureProformaForShareLink(
  shareLinkId: string,
  opts?: { actorId?: string }
): Promise<Result<{ invoiceId: string; advanceAmount: number }>> {
  try {
    const link = await prisma.quoteShareLink.findUnique({
      where: { id: shareLinkId },
      select: {
        id: true,
        status: true,
        primaryQuotationId: true,
        payInvoiceId: true,
        contactId: true,
      },
    });
    if (!link) return { success: false, error: "Share link not found." };
    if (link.status !== "ACTIVE")
      return { success: false, error: "This link is no longer active." };
    if (!link.primaryQuotationId)
      return { success: false, error: "This link has no quotation to invoice." };

    // Already wired → reuse (idempotent). Re-read the advance from the plan.
    if (link.payInvoiceId && link.payInvoiceId !== PENDING) {
      const advance = await firstInstallmentAmount(link.payInvoiceId);
      return { success: true, data: { invoiceId: link.payInvoiceId, advanceAmount: advance } };
    }

    const quotationId = link.primaryQuotationId;
    const q = await prisma.salesQuotation.findUnique({ where: { id: quotationId } });
    if (!q) return { success: false, error: "Quotation not found." };
    if (q.status !== "APPROVED" && q.status !== "SENT")
      return { success: false, error: "Approve the quotation before invoicing." };
    const contactId = q.contactId || link.contactId;
    if (!contactId)
      return { success: false, error: "Link a customer to the quotation first." };

    // Reuse an already-built invoice on the quotation if present (the rep may
    // have invoiced it via the internal flow).
    if (q.invoiceId && q.invoiceId !== PENDING) {
      const advance = await firstInstallmentAmount(q.invoiceId);
      await prisma.quoteShareLink.update({
        where: { id: shareLinkId },
        data: { payInvoiceId: q.invoiceId },
      });
      return { success: true, data: { invoiceId: q.invoiceId, advanceAmount: advance } };
    }

    // Atomic CLAIM (same sentinel the internal action uses) so concurrent taps
    // can't mint two proformas. Reclaim a stale (>5 min) sentinel from a crash.
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const claim = await prisma.salesQuotation.updateMany({
      where: {
        id: quotationId,
        OR: [{ invoiceId: null }, { invoiceId: PENDING, updatedAt: { lt: staleBefore } }],
      },
      data: { invoiceId: PENDING },
    });
    if (claim.count === 0) {
      // Someone else is creating it — re-read shortly (best-effort).
      const fresh = await prisma.salesQuotation.findUnique({
        where: { id: quotationId },
        select: { invoiceId: true },
      });
      if (fresh?.invoiceId && fresh.invoiceId !== PENDING) {
        const advance = await firstInstallmentAmount(fresh.invoiceId);
        await prisma.quoteShareLink.update({
          where: { id: shareLinkId },
          data: { payInvoiceId: fresh.invoiceId },
        });
        return { success: true, data: { invoiceId: fresh.invoiceId, advanceAmount: advance } };
      }
      return { success: false, error: "An invoice is already being created for this quotation." };
    }

    const release = () =>
      prisma.salesQuotation
        .updateMany({ where: { id: quotationId, invoiceId: PENDING }, data: { invoiceId: null } })
        .catch(() => {});

    try {
      const actorId = opts?.actorId || (await getSystemUserId());
      if (!actorId) {
        await release();
        return { success: false, error: "We can't process payment right now. Please contact us." };
      }

      const input = q.inputsJson as unknown as QuotationInput;
      const result: QuotationResult =
        (q.outputsJson as unknown as QuotationResult) || computeQuotation(input);
      const guests = Math.max(1, q.guestCount || input?.guestCount || 1);
      const round2 = (n: number) => Math.round(n * 100) / 100;

      // Per-plate line items, mirroring createBookingInvoiceFromQuotation so the
      // invoice subtotal/tax/total reconstruct the quoted grand total exactly.
      const lineItems = result.lines
        .filter((l) => l.amount > 0)
        .flatMap((l) => {
          if (l.particulars === "Food Plan") {
            const totalPaise = Math.round(l.amount * 100);
            const unitPaise = Math.floor(totalPaise / guests);
            const remainderPaise = totalPaise - unitPaise * guests;
            const unit = round2(unitPaise / 100);
            const lines = [
              { description: `${l.particulars} — ${l.plan}`, quantity: guests, unitPrice: unit, amount: round2(unit * guests), order: 0 },
            ];
            if (remainderPaise > 0) {
              lines.push({
                description: `${l.particulars} — ${l.plan} (rounding adjustment)`,
                quantity: 1,
                unitPrice: round2(remainderPaise / 100),
                amount: round2(remainderPaise / 100),
                order: 0,
              });
            }
            return lines;
          }
          return [{ description: `${l.particulars} — ${l.plan}`, quantity: 1, unitPrice: l.amount, amount: l.amount, order: 0 }];
        });
      if (lineItems.length === 0) {
        await release();
        return { success: false, error: "Quotation has no line items to invoice." };
      }

      // Planner's 5% tax (CGST 2.5% + SGST 2.5%) on (subtotal − discount), exactly
      // like createInvoice. Compute the invoice totals here so installments split
      // off the INVOICE total (paise-exact).
      const subtotal = round2(lineItems.reduce((s, li) => s + li.amount, 0));
      const discountPct = Number(q.discountPct) || result.discountPct || 0;
      const discountAmount = round2((subtotal * discountPct) / 100);
      const taxable = round2(subtotal - discountAmount);
      const cgst = round2(taxable * 0.025);
      const sgst = round2(taxable * 0.025);
      const grand = round2(taxable + cgst + sgst);

      const dueNow = new Date();
      dueNow.setDate(dueNow.getDate() + 1);

      const event = q.eventDate ? new Date(q.eventDate) : null;
      const midDue = event ? new Date(event) : new Date(Date.now() + 15 * 86400000);
      if (event) midDue.setDate(midDue.getDate() - 15);
      const balanceDueDate = event
        ? new Date(event.getTime() - 2 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 86400000);

      // 20 / 60 / 20 split off the invoice total (remainder carries to the last).
      const block = Math.round(grand * 0.2);
      const mid = Math.round(grand * 0.6);
      const balance = round2(grand - block - mid);

      const invoiceNumber = await nextInvoiceNumber();
      const invoiceId = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            invoiceNumber,
            status: "SENT", // payable immediately (recordPayment rejects DRAFT)
            issueDate: new Date(),
            dueDate: dueNow,
            subtotal: new Prisma.Decimal(subtotal),
            discountPercent: new Prisma.Decimal(discountPct),
            discountAmount: new Prisma.Decimal(discountAmount),
            cgstRate: new Prisma.Decimal(2.5),
            sgstRate: new Prisma.Decimal(2.5),
            igstRate: new Prisma.Decimal(0),
            cgstAmount: new Prisma.Decimal(cgst),
            sgstAmount: new Prisma.Decimal(sgst),
            igstAmount: new Prisma.Decimal(0),
            totalAmount: new Prisma.Decimal(grand),
            paidAmount: new Prisma.Decimal(0),
            balanceDue: new Prisma.Decimal(grand),
            notes: `Booking-advance proforma from quotation ${q.quoteNumber} (one-tap share link).`,
            terms:
              "Payment terms: 20% to block the slot, 60% fifteen days before the event, balance two hours before the event.",
            contactId,
            bookingId: q.bookingId ?? undefined,
            createdById: actorId,
            lineItems: {
              create: lineItems.map((li, i) => ({
                description: li.description,
                quantity: new Prisma.Decimal(li.quantity),
                unitPrice: new Prisma.Decimal(li.unitPrice),
                amount: new Prisma.Decimal(li.amount),
                order: i,
              })),
            },
            installments: {
              create: [
                { label: "Booking advance (20%) — blocks the slot", amount: new Prisma.Decimal(block), dueDate: new Date(), order: 0 },
                { label: "Part payment (60%) — 15 days before event", amount: new Prisma.Decimal(mid), dueDate: midDue, order: 1 },
                { label: "Final balance (20%) — 2 hours before event", amount: new Prisma.Decimal(balance), dueDate: balanceDueDate, order: 2 },
              ],
            },
          },
          select: { id: true },
        });
        return inv.id;
      });

      // Replace the sentinel with the real invoice id + wire the link.
      await prisma.salesQuotation.update({ where: { id: quotationId }, data: { invoiceId } });
      await prisma.quoteShareLink.update({
        where: { id: shareLinkId },
        data: { payInvoiceId: invoiceId },
      });

      return { success: true, data: { invoiceId, advanceAmount: block } };
    } catch (e) {
      await release();
      console.error("[ENSURE_PROFORMA_ERROR]", e);
      return { success: false, error: "Could not prepare your booking. Please try again." };
    }
  } catch (e) {
    console.error("[ENSURE_PROFORMA_OUTER_ERROR]", e);
    return { success: false, error: "Could not prepare your booking. Please try again." };
  }
}

/** First (booking-advance) installment amount in rupees; falls back to 20% of total. */
async function firstInstallmentAmount(invoiceId: string): Promise<number> {
  try {
    const first = await prisma.installment.findFirst({
      where: { invoiceId },
      orderBy: { order: "asc" },
      select: { amount: true },
    });
    if (first) return Math.round(Number(first.amount));
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { totalAmount: true },
    });
    return inv ? Math.round(Number(inv.totalAmount) * 0.2) : 0;
  } catch {
    return 0;
  }
}

/**
 * The booking-advance (20%) figure for the Pay button label — reads the actual
 * first installment off the invoice (paise-exact), never recomputed client-side.
 */
export async function computeAdvanceAmount(invoiceId: string): Promise<number> {
  return firstInstallmentAmount(invoiceId);
}

// ============================================================
// finalizeOneTapBlock — after a captured payment, block the slot for the link's
// venue/date/slot (Serializable createBooking guard) and auto-confirm via the
// linked invoice. Idempotent: no-ops if the quotation already has a booking.
// Replicates blockSlotFromQuotation (which is auth-gated) under the system actor.
// ============================================================
export async function finalizeOneTapBlock(
  shareLinkId: string
): Promise<Result<{ bookingId: string; alreadyBlocked?: boolean }>> {
  try {
    const link = await prisma.quoteShareLink.findUnique({
      where: { id: shareLinkId },
      select: {
        id: true,
        primaryQuotationId: true,
        venueId: true,
        eventDate: true,
        timeSlot: true,
        payInvoiceId: true,
      },
    });
    if (!link?.primaryQuotationId)
      return { success: false, error: "This link cannot be finalized." };

    const quotationId = link.primaryQuotationId;
    const q = await prisma.salesQuotation.findUnique({
      where: { id: quotationId },
      select: {
        id: true,
        status: true,
        bookingId: true,
        venueId: true,
        eventDate: true,
        timeSlot: true,
        guestCount: true,
        grandTotal: true,
        quoteNumber: true,
        occasion: true,
        clientName: true,
        clientPhone: true,
        clientEmail: true,
        contactId: true,
        invoiceId: true,
      },
    });
    if (!q) return { success: false, error: "Quotation not found." };

    // Idempotent: already booked → confirm (best-effort) and return it.
    if (q.bookingId) {
      const invId = q.invoiceId && q.invoiceId !== PENDING ? q.invoiceId : link.payInvoiceId;
      if (invId) await maybeConfirmBookingOnPayment(invId).catch(() => {});
      return { success: true, data: { bookingId: q.bookingId, alreadyBlocked: true } };
    }
    if (q.status !== "APPROVED" && q.status !== "SENT")
      return { success: false, error: "Only an approved quotation can block a slot." };

    const venueId = link.venueId || q.venueId;
    if (!venueId) return { success: false, error: "No venue to block." };

    const date =
      parseUTCDate(
        link.eventDate?.toISOString().slice(0, 10) ||
          q.eventDate?.toISOString().slice(0, 10) ||
          null
      );
    if (!date) return { success: false, error: "No event date to block." };
    const slot = resolveSlot(link.timeSlot || q.timeSlot);

    const grandTotal = Number(q.grandTotal) || 0;
    if (grandTotal <= 0) return { success: false, error: "Quotation has no grand total." };

    // Atomic claim so two concurrent finalizes can't both create a HOLD.
    const claim = await prisma.salesQuotation.updateMany({
      where: { id: quotationId, bookingId: null, status: { in: ["APPROVED", "SENT"] } },
      data: { slotBlockedAt: new Date() },
    });
    if (claim.count === 0) {
      const fresh = await prisma.salesQuotation.findUnique({
        where: { id: quotationId },
        select: { bookingId: true },
      });
      if (fresh?.bookingId) return { success: true, data: { bookingId: fresh.bookingId, alreadyBlocked: true } };
      return { success: false, error: "This quotation already has a booked slot." };
    }
    const releaseClaim = () =>
      prisma.salesQuotation
        .updateMany({ where: { id: quotationId, bookingId: null }, data: { slotBlockedAt: null } })
        .catch(() => {});

    // Resolve/mint a contact (reuse linked, else by email/phone, else mint).
    let contactId = q.contactId;
    let mintedContactId: string | null = null;
    if (!contactId) {
      const email = q.clientEmail?.trim() || null;
      const phone = q.clientPhone?.trim() || null;
      if (email || phone) {
        const existing = await prisma.contact.findFirst({
          where: { deletedAt: null, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
          select: { id: true },
        });
        if (existing) contactId = existing.id;
      }
    }
    if (!contactId) {
      const name = (q.clientName || "Guest").trim();
      const [firstName, ...rest] = name.split(/\s+/);
      const created = await prisma.contact.create({
        data: { firstName: firstName || "Guest", lastName: rest.join(" ") || "", phone: q.clientPhone || null, email: q.clientEmail || null },
        select: { id: true },
      });
      contactId = created.id;
      mintedContactId = created.id;
    }
    await prisma.salesQuotation.update({ where: { id: quotationId }, data: { contactId } });

    const systemUserId = await getSystemUserId();
    if (!systemUserId) {
      await releaseClaim();
      return { success: false, error: "We can't finalize the booking right now. Please contact us." };
    }

    // Create the HOLD Booking inside a Serializable txn — same conflictOr +
    // utcDayRange bucket the internal createBooking + public-hold use. The
    // @@unique(venueId,date,timeSlot) guard means the loser (post-payment race)
    // gets a clean "slot taken" instead of a double-book.
    const bookingNumber = await generateBookingNumber();
    const { gte, lt, utcDay } = utcDayRange(date);
    const reqSlot = slot as unknown as TimeSlot;
    const conflictOr =
      reqSlot === "FULL_DAY"
        ? [
            { timeSlot: "FULL_DAY" as TimeSlot },
            { timeSlot: "MORNING" as TimeSlot },
            { timeSlot: "AFTERNOON" as TimeSlot },
            { timeSlot: "EVENING" as TimeSlot },
          ]
        : [{ timeSlot: reqSlot }, { timeSlot: "FULL_DAY" as TimeSlot }];

    let bookingId: string;
    try {
      const booking = await prisma.$transaction(
        async (tx) => {
          const clashes = await tx.booking.findMany({
            where: { venueId, date: { gte, lt }, status: { notIn: ["CANCELLED"] }, OR: conflictOr },
            select: { id: true, date: true },
          });
          if (clashes.some((c) => new Date(c.date).getUTCDate() === utcDay)) {
            throw new Error("SLOT_TAKEN");
          }
          return tx.booking.create({
            data: {
              bookingNumber,
              eventName: q.occasion ? `${q.occasion} — ${q.clientName ?? "Guest"}` : `Booking for ${q.quoteNumber}`,
              eventType: q.occasion || "Event",
              date,
              timeSlot: reqSlot,
              guestCount: Math.max(1, q.guestCount || 1),
              totalAmount: new Prisma.Decimal(grandTotal),
              internalNotes: `Auto-created from one-tap quote ${q.quoteNumber}.`,
              venueId,
              contactId: contactId as string,
              createdById: systemUserId,
              status: "HOLD",
            },
            select: { id: true },
          });
        },
        { isolationLevel: "Serializable" }
      );
      bookingId = booking.id;
    } catch (e) {
      if (mintedContactId) {
        await prisma.contact.delete({ where: { id: mintedContactId } }).catch(() => {});
        await prisma.salesQuotation.update({ where: { id: quotationId }, data: { contactId: null } }).catch(() => {});
      }
      await releaseClaim();
      const code = (e as { code?: string }).code;
      if ((e instanceof Error && e.message === "SLOT_TAKEN") || code === "P2002" || code === "P2034") {
        return { success: false, error: "SLOT_TAKEN" };
      }
      console.error("[FINALIZE_ONETAP_BLOCK_ERROR]", e);
      return { success: false, error: "Could not block the slot. Please contact us." };
    }

    // Link booking → quotation. If this fails, cancel the HOLD so it doesn't
    // orphan-block the slot.
    try {
      await prisma.salesQuotation.update({
        where: { id: quotationId },
        data: { bookingId, venueId, slotBlockedAt: new Date() },
      });
      await prisma.salesQuotationTransition.create({
        data: {
          quotationId,
          fromStatus: q.status,
          toStatus: q.status,
          actorId: systemUserId,
          note: `Slot blocked via one-tap — ${SLOT_LABEL[slot]} (booking ${bookingNumber})`,
        },
      });
    } catch (e) {
      await prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } }).catch(() => {});
      await releaseClaim();
      console.error("[FINALIZE_ONETAP_LINK_ERROR]", e);
      return { success: false, error: "Could not finalize the slot block." };
    }

    // Attach the advance invoice + auto-confirm if the 20% has cleared.
    const invId = q.invoiceId && q.invoiceId !== PENDING ? q.invoiceId : link.payInvoiceId;
    if (invId) {
      try {
        await prisma.invoice.update({ where: { id: invId }, data: { bookingId } });
        await maybeConfirmBookingOnPayment(invId);
      } catch (e) {
        // The advance is already captured and the HOLD booking exists, but
        // linking/confirming failed — the customer paid yet the slot isn't
        // confirmed. Don't fail silently: alert ops to confirm manually. (The
        // payment webhook re-invokes finalizeOneTapBlock, which hits the
        // idempotent "already booked → confirm" branch and retries the confirm.)
        console.error("[FINALIZE_ONETAP_CONFIRM_ERROR]", e);
        void reportSystemFailure({
          area: "One-tap booking",
          title: "Paid one-tap booking stuck in HOLD",
          detail: `Booking ${bookingId} (invoice ${invId}) was created + paid but auto-confirm failed: ${e instanceof Error ? e.message : "unknown"}. Confirm it manually.`,
          actionUrl: `/bookings/${bookingId}`,
        });
      }
    }

    return { success: true, data: { bookingId } };
  } catch (e) {
    console.error("[FINALIZE_ONETAP_OUTER_ERROR]", e);
    return { success: false, error: "Could not finalize the booking." };
  }
}

/**
 * Public-safe per-slot availability for the link's venue+date. Replicates the
 * conflict logic of checkAvailability (bookings + blackouts + FULL_DAY) WITHOUT
 * auth and WITHOUT leaking any booking identity — returns FREE/BUSY only.
 */
export async function publicSlotScarcity(
  venueId: string,
  date: Date
): Promise<Array<{ slot: TimeSlotEnum; label: string; free: boolean }>> {
  const slots: TimeSlotEnum[] = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"];
  const { gte, lt, utcDay } = utcDayRange(date);
  const [bookings, blackouts] = await Promise.all([
    prisma.booking.findMany({
      where: { venueId, date: { gte, lt }, status: { notIn: ["CANCELLED"] } },
      select: { date: true, timeSlot: true },
    }),
    prisma.blackoutDate.findMany({
      where: { venueId, date: { gte, lt } },
      select: { date: true, timeSlot: true },
    }),
  ]);
  const dayBookings = bookings.filter((b) => new Date(b.date).getUTCDate() === utcDay);
  const dayBlackouts = blackouts.filter((b) => new Date(b.date).getUTCDate() === utcDay);
  const fullDayBooking = dayBookings.some((b) => b.timeSlot === "FULL_DAY");
  const fullDayBlackout = dayBlackouts.some((b) => b.timeSlot === null);
  const anyPartialBooking = dayBookings.some((b) => b.timeSlot !== "FULL_DAY");
  const anyPartialBlackout = dayBlackouts.some((b) => b.timeSlot !== null);

  return slots.map((slot) => {
    let busy: boolean;
    if (slot === "FULL_DAY") {
      busy = fullDayBlackout || fullDayBooking || anyPartialBooking || anyPartialBlackout;
    } else {
      busy =
        fullDayBlackout ||
        fullDayBooking ||
        dayBookings.some((b) => b.timeSlot === slot) ||
        dayBlackouts.some((b) => b.timeSlot === slot);
    }
    return { slot, label: SLOT_LABEL[slot], free: !busy };
  });
}
