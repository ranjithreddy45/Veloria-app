"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { checkAvailability, createBooking } from "@/actions/booking.actions";
import { maybeConfirmBookingOnPayment } from "@/lib/sales/confirm-booking";
import { updateLeadStatus } from "@/actions/lead.actions";
import { updateDeal } from "@/actions/pipeline.actions";
import { BOOKABLE_SLOTS, SLOT_LABEL, plannerSlotToEnum, type TimeSlotEnum } from "@/lib/sales/slot";

// Push quote economics into the linked lead's deal and advance the lead to
// PROPOSAL_SENT. Best-effort: a quote with no lead / no deal never fails the op.
async function syncLeadFromQuotation(
  leadId: string | null | undefined,
  grandTotal: unknown
): Promise<void> {
  if (!leadId) return;
  try {
    const value = Number(grandTotal ?? 0);
    const deal = await prisma.deal.findUnique({ where: { leadId }, select: { id: true } });
    if (deal && value > 0) await updateDeal(deal.id, { value });
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });
    const FUNNEL_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"];
    const cur = lead ? FUNNEL_ORDER.indexOf(lead.status) : -1;
    if (cur >= 0 && cur < FUNNEL_ORDER.indexOf("PROPOSAL_SENT")) {
      await updateLeadStatus(leadId, "PROPOSAL_SENT" as never);
    }
  } catch (e) {
    console.error("[QUOTE_LEAD_SYNC_ERROR]", e);
  }
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

// Parse a YYYY-MM-DD string into LOCAL midnight (matching how booking.actions
// normalizes @db.Date with setHours). `new Date("2026-09-01")` parses as UTC
// midnight and would shift the day on a non-UTC server — this avoids that.
function parseLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  // UTC midnight (not local) so the stored @db.Date day and the utcDayRange
  // conflict window agree on any server timezone (see utcDayRange).
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Date(iso);
}

export interface SlotAvailability {
  slot: TimeSlotEnum;
  label: string;
  available: boolean;
  reason: string | null;
}

/**
 * Per-slot availability for a venue on a given day — drives the
 * "slot taken → suggest alternates" UX. Reuses booking.checkAvailability
 * (bookings + blackouts + FULL_DAY conflict logic).
 */
export async function getDaySlotAvailability(
  venueId: string,
  dateISO: string
): Promise<Result<SlotAvailability[]>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "bookings:read"))
    return { success: false, error: "Unauthorized" };
  if (!venueId || !dateISO) return { success: false, error: "Venue and date are required." };

  const date = parseLocalDate(dateISO);
  if (Number.isNaN(date.getTime())) return { success: false, error: "Invalid date." };

  const out: SlotAvailability[] = [];
  for (const s of BOOKABLE_SLOTS) {
    const res = await checkAvailability(venueId, date, s.value);
    if (res.success && res.data) {
      out.push({ slot: s.value, label: s.label, available: res.data.available, reason: res.data.reason });
    } else {
      out.push({ slot: s.value, label: s.label, available: false, reason: "Could not check availability." });
    }
  }
  return { success: true, data: out };
}

/**
 * Block the venue+date+slot for an APPROVED/SENT quotation by creating a
 * HOLD booking (BookMyShow-style: the @@unique(venueId,date,timeSlot)
 * constraint guarantees no double-booking). Links the booking back to the
 * quotation. Resolves (or creates) a contact from the quotation.
 */
export async function blockSlotFromQuotation(
  quotationId: string,
  opts: { venueId: string; dateISO: string; timeSlot?: TimeSlotEnum }
): Promise<Result<{ bookingId: string }>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "bookings:create"))
    return { success: false, error: "You don't have permission to block slots." };

  const q = await prisma.salesQuotation.findUnique({
    where: { id: quotationId },
    include: { contact: { select: { id: true } } },
  });
  if (!q) return { success: false, error: "Quotation not found." };
  if (q.status !== "APPROVED" && q.status !== "SENT")
    return { success: false, error: "Only an approved quotation can block a slot." };
  if (q.bookingId) return { success: false, error: "This quotation already has a booked slot." };
  if (!opts.venueId) return { success: false, error: "Select a venue to block." };

  // Advance-payment gate: blocking a slot before the 20% booking advance has
  // been received is reserved for a Super Admin. Everyone else must collect the
  // advance first. The threshold mirrors the auto-confirm logic in
  // confirm-booking.ts (20% of the value, with a ₹1 rounding tolerance), and is
  // anchored on the invoice total (the number the 20% installment was computed
  // from) when an invoice exists, else on the quotation grand total.
  const gateGrandTotal = Number(q.grandTotal) || 0;
  let advanceMet = gateGrandTotal <= 0; // a ₹0 quote can't be advance-gated
  if (!advanceMet && q.invoiceId && q.invoiceId !== "__pending__") {
    const inv = await prisma.invoice.findUnique({
      where: { id: q.invoiceId },
      select: { paidAmount: true, totalAmount: true },
    });
    if (inv) advanceMet = Number(inv.paidAmount) >= Number(inv.totalAmount) * 0.2 - 1;
  }
  if (!advanceMet && user.role !== "SUPER_ADMIN") {
    return {
      success: false,
      error:
        "Advance payment is below 20%. Only a Super Admin can block this slot before the booking advance is received.",
    };
  }

  // Atomically claim the quotation before doing any booking work, so two
  // concurrent calls can't both pass the bookingId guard above and create two
  // HOLD bookings (orphaning the first when the second overwrites bookingId).
  // The conditional updateMany only succeeds for the first caller; the rest get
  // count === 0 and bail out cleanly.
  const claim = await prisma.salesQuotation.updateMany({
    where: { id: quotationId, bookingId: null, status: { in: ["APPROVED", "SENT"] } },
    data: { slotBlockedAt: new Date() },
  });
  if (claim.count === 0)
    return { success: false, error: "This quotation already has a booked slot." };
  // Any failure after this point must release the claim so a retry can proceed.
  const releaseClaim = () =>
    prisma.salesQuotation
      .updateMany({ where: { id: quotationId, bookingId: null }, data: { slotBlockedAt: null } })
      .catch(() => {});

  // A zero/blank grand total would mint a ₹0 (previously ₹1) booking that
  // pollutes revenue — refuse it outright.
  const grandTotal = Number(q.grandTotal) || 0;
  if (grandTotal <= 0)
    return { success: false, error: "This quotation has no grand total — recompute it before blocking a slot." };

  const dateStr = opts.dateISO || (q.eventDate ? q.eventDate.toISOString().slice(0, 10) : "");
  const date = parseLocalDate(dateStr);
  if (Number.isNaN(date.getTime())) {
    await releaseClaim();
    return { success: false, error: "Select a valid event date." };
  }
  const timeSlot = opts.timeSlot ?? plannerSlotToEnum(q.timeSlot);

  // Pre-check (createBooking re-checks atomically, but this gives a clean message).
  const avail = await checkAvailability(opts.venueId, date, timeSlot);
  if (avail.success && avail.data && !avail.data.available) {
    await releaseClaim();
    return { success: false, error: avail.data.reason || "That slot is already taken." };
  }

  // Resolve a contact: use the linked one, else mint a light contact from the
  // quote. Track whether we minted one so we can roll it back if the booking
  // then fails (otherwise an orphan contact would linger on the quotation).
  let contactId = q.contact?.id ?? null;
  let mintedContactId: string | null = null;
  if (!contactId) {
    // Reuse an existing non-deleted contact matching the quote's email/phone
    // before minting a new one, so we don't spawn duplicate/zombie contacts.
    const email = q.clientEmail?.trim() || null;
    const phone = q.clientPhone?.trim() || null;
    if (email || phone) {
      const existing = await prisma.contact.findFirst({
        where: {
          deletedAt: null,
          OR: [
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : []),
          ],
        },
        select: { id: true },
      });
      if (existing) {
        contactId = existing.id;
        await prisma.salesQuotation.update({ where: { id: quotationId }, data: { contactId } });
      }
    }
  }
  if (!contactId) {
    const name = (q.clientName || "Guest").trim();
    const [firstName, ...rest] = name.split(/\s+/);
    const created = await prisma.contact.create({
      data: {
        firstName: firstName || "Guest",
        lastName: rest.join(" ") || "",
        phone: q.clientPhone || null,
        email: q.clientEmail || null,
      },
      select: { id: true },
    });
    contactId = created.id;
    mintedContactId = created.id;
    await prisma.salesQuotation.update({ where: { id: quotationId }, data: { contactId } });
  }

  const res = await createBooking({
    eventName: q.occasion ? `${q.occasion} — ${q.clientName ?? "Guest"}` : `Booking for ${q.quoteNumber}`,
    eventType: q.occasion || "Event",
    venueId: opts.venueId,
    contactId,
    date,
    timeSlot,
    guestCount: Math.max(1, q.guestCount || 1),
    totalAmount: grandTotal,
    internalNotes: `Auto-created from quotation ${q.quoteNumber}.`,
  });

  if (!res.success || !res.data) {
    // Roll back a freshly-minted contact so it isn't orphaned on the quote.
    if (mintedContactId) {
      await prisma.salesQuotation.update({ where: { id: quotationId }, data: { contactId: null } }).catch(() => {});
      await prisma.contact.delete({ where: { id: mintedContactId } }).catch(() => {});
    }
    await releaseClaim();
    return { success: false, error: res.error || "Could not create the booking." };
  }
  const bookingId = res.data.id;

  // Link the booking to the quotation. If this fails the HOLD booking would be
  // orphaned (blocking the slot with nothing pointing at it), so cancel it and
  // surface the error rather than leaving a ghost hold.
  try {
    await prisma.salesQuotation.update({
      where: { id: quotationId },
      data: { bookingId, venueId: opts.venueId, slotBlockedAt: new Date() },
    });
    await prisma.salesQuotationTransition.create({
      data: {
        quotationId,
        fromStatus: q.status,
        toStatus: q.status,
        actorId: user.id,
        note: `Slot blocked — ${SLOT_LABEL[timeSlot]} on ${date.toLocaleDateString("en-IN")} (booking ${res.data.bookingNumber ?? bookingId})`,
      },
    });
  } catch (e) {
    await prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } }).catch(() => {});
    await releaseClaim();
    console.error("[BLOCK_SLOT_LINK_ERROR]", e);
    return { success: false, error: "Could not finalize the slot block — please try again." };
  }

  // Proforma-first flow: if the advance invoice was already raised (and likely
  // paid), attach it to this new booking and auto-confirm if the 20% advance has
  // cleared — so blocking the slot AFTER payment immediately confirms it (+ ops
  // handoff). Best-effort; the HOLD simply stays pending if the advance isn't paid.
  if (q.invoiceId && q.invoiceId !== "__pending__") {
    try {
      await prisma.invoice.update({ where: { id: q.invoiceId }, data: { bookingId } });
      await maybeConfirmBookingOnPayment(q.invoiceId);
    } catch (e) {
      console.error("[BLOCK_SLOT_INVOICE_LINK_ERROR]", e);
    }
  }

  notify({
    userId: user.id,
    type: "BOOKING_CREATED",
    title: "Slot blocked",
    message: `Slot held for ${q.clientName ?? "the customer"} — ${SLOT_LABEL[timeSlot]} on ${date.toLocaleDateString("en-IN")}.`,
    actionUrl: `/bookings/${bookingId}`,
  });

  // Flow quote economics into the pipeline + advance the lead (best-effort).
  await syncLeadFromQuotation(q.leadId, q.grandTotal);

  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/availability");
  if (q.leadId) revalidatePath(`/leads/${q.leadId}`);
  return { success: true, data: { bookingId } };
}
