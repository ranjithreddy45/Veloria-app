// ============================================================
// Settle a paid self-serve-configurator advance (C6).
// ------------------------------------------------------------
// The /configure flow takes a 20% advance and PROMISES to block the date
// instantly. Called from the shared payment-capture path (apply-capture.ts) when
// a configurator advance invoice is captured. It now HONOURS that promise: it
// atomically claims the draft (PAID), mints a HOLD booking under the same
// Serializable conflict-guard the internal/one-tap paths use, links the paid
// invoice to it, and lets maybeConfirmBookingOnPayment flip it HOLD→CONFIRMED
// (which also sends the customer their confirmation). A genuine slot-taken race
// (or missing slot info) still raises an urgent, actionable alert instead of a
// silent loss. Idempotent (atomic status claim) and never throws.
// ============================================================

import { Prisma, type TimeSlot, type PublicQuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reportSystemFailure } from "@/lib/ops-alert";
import { publicConfiguratorSlotFree } from "@/actions/public-hold.actions";
import { utcDayRange } from "@/lib/sales/slot-util";
import { plannerSlotToEnum } from "@/lib/sales/slot";
import { generateBookingNumber } from "@/actions/booking.actions";
import { maybeConfirmBookingOnPayment } from "@/lib/sales/confirm-booking";
import { getSystemUserId } from "@/lib/lead-capture";

const SETTLED: PublicQuoteStatus[] = ["PAID", "CONVERTED", "ABANDONED"];

function parseUTCDate(d: Date | null | undefined): Date | null {
  if (!d) return null;
  const iso = new Date(d).toISOString().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const out = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  return out && !Number.isNaN(out.getTime()) ? out : null;
}

export async function settleConfiguratorPayment(invoiceId: string): Promise<void> {
  try {
    const draft = await prisma.publicQuoteDraft.findFirst({
      where: { invoiceId, status: { notIn: SETTLED } },
      select: {
        id: true, customerName: true, customerPhone: true, customerEmail: true, occasion: true,
        venueId: true, eventDate: true, timeSlot: true, guestCount: true, grandTotal: true, advanceAmount: true,
      },
    });
    if (!draft) return; // not a configurator invoice, or already settled

    // Atomic claim so a webhook + browser double-fire (or two webhooks) can't both
    // proceed to mint a booking. Only the winner continues.
    const claim = await prisma.publicQuoteDraft.updateMany({
      where: { id: draft.id, status: { notIn: SETTLED } },
      data: { status: "PAID" },
    });
    if (claim.count === 0) return;

    const who = `${draft.customerName ?? "A customer"}${draft.customerPhone ? ` (${draft.customerPhone})` : ""}`;
    const when = draft.eventDate
      ? new Date(draft.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
      : "date TBC";
    const slotLabel = draft.timeSlot ?? "slot TBC";
    const adv = `₹${Math.round(Number(draft.advanceAmount || 0)).toLocaleString("en-IN")}`;

    const date = parseUTCDate(draft.eventDate);

    // Can't auto-block without a venue + date + slot — fall back to the manual alert.
    if (!draft.venueId || !date || !draft.timeSlot) {
      await reportSystemFailure({
        area: "Online booking",
        title: "Configurator advance PAID — reserve & confirm the date",
        detail: `${who} paid the ${adv} advance online for ${draft.occasion ?? "an event"} on ${when} (${slotLabel}). Create the booking, block the slot, and call them to confirm.`,
        actionUrl: "/leads",
      });
      return;
    }

    // Pre-check availability (cheap fast-fail before the txn).
    const slotFree = await publicConfiguratorSlotFree(draft.venueId, draft.eventDate!, draft.timeSlot);
    if (!slotFree) {
      await reportSystemFailure({
        area: "Online booking — ACTION NEEDED",
        title: "PAID but the slot is no longer free — refund or re-offer NOW",
        detail: `${who} paid ${adv} online for ${when} (${slotLabel}), but that slot is now taken. Contact them immediately to re-offer another date or refund.`,
        actionUrl: "/leads",
      });
      return;
    }

    const systemUserId = await getSystemUserId();
    if (!systemUserId) {
      await reportSystemFailure({
        area: "Online booking",
        title: "Configurator advance PAID — reserve & confirm the date",
        detail: `${who} paid the ${adv} advance online for ${when} (${slotLabel}), but the booking couldn't be auto-created. Create the booking, block the slot, and confirm.`,
        actionUrl: "/leads",
      });
      return;
    }

    // Resolve or mint the contact (by email/phone, else create).
    let contactId: string | null = null;
    const email = draft.customerEmail?.trim() || null;
    const phone = draft.customerPhone?.trim() || null;
    if (email || phone) {
      const existing = await prisma.contact.findFirst({
        where: { deletedAt: null, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
        select: { id: true },
      });
      if (existing) contactId = existing.id;
    }
    let mintedContactId: string | null = null;
    if (!contactId) {
      const name = (draft.customerName || "Guest").trim();
      const [firstName, ...rest] = name.split(/\s+/);
      const c = await prisma.contact.create({
        data: { firstName: firstName || "Guest", lastName: rest.join(" ") || "", phone, email },
        select: { id: true },
      });
      contactId = c.id;
      mintedContactId = c.id;
    }

    const reqSlot = plannerSlotToEnum(draft.timeSlot) as unknown as TimeSlot;
    const { gte, lt, utcDay } = utcDayRange(date);
    const conflictOr =
      reqSlot === "FULL_DAY"
        ? [{ timeSlot: "FULL_DAY" as TimeSlot }, { timeSlot: "MORNING" as TimeSlot }, { timeSlot: "AFTERNOON" as TimeSlot }, { timeSlot: "EVENING" as TimeSlot }]
        : [{ timeSlot: reqSlot }, { timeSlot: "FULL_DAY" as TimeSlot }];
    const bookingNumber = await generateBookingNumber();
    const grandTotal = Number(draft.grandTotal) || 0;

    let bookingId: string;
    try {
      const booking = await prisma.$transaction(
        async (tx) => {
          const clashes = await tx.booking.findMany({
            where: { venueId: draft.venueId!, date: { gte, lt }, status: { notIn: ["CANCELLED"] }, OR: conflictOr },
            select: { date: true },
          });
          if (clashes.some((c) => new Date(c.date).getUTCDate() === utcDay)) throw new Error("SLOT_TAKEN");
          return tx.booking.create({
            data: {
              bookingNumber,
              eventName: draft.occasion ? `${draft.occasion} — ${draft.customerName ?? "Guest"}` : "Online booking",
              eventType: draft.occasion || "Event",
              date,
              timeSlot: reqSlot,
              guestCount: Math.max(1, draft.guestCount || 1),
              totalAmount: new Prisma.Decimal(grandTotal),
              internalNotes: "Auto-created from the online configurator advance.",
              venueId: draft.venueId!,
              contactId: contactId as string,
              createdById: systemUserId,
              status: "HOLD",
            },
            select: { id: true },
          });
        },
        { isolationLevel: "Serializable" },
      );
      bookingId = booking.id;
    } catch (e) {
      if (mintedContactId) await prisma.contact.delete({ where: { id: mintedContactId } }).catch(() => {});
      const code = (e as { code?: string }).code;
      const taken = (e instanceof Error && e.message === "SLOT_TAKEN") || code === "P2002" || code === "P2034";
      await reportSystemFailure({
        area: "Online booking — ACTION NEEDED",
        title: taken ? "PAID but the slot was just taken — refund or re-offer NOW" : "Configurator advance PAID — booking failed to auto-create",
        detail: `${who} paid ${adv} online for ${when} (${slotLabel}). ${taken ? "The slot was claimed concurrently." : "Auto-creation errored."} Contact them to re-offer/refund or block manually.`,
        actionUrl: "/leads",
      });
      return;
    }

    // Link the paid advance invoice to the HOLD booking, then let the shared
    // confirm-on-payment path flip it to CONFIRMED and notify the customer.
    await prisma.invoice.update({ where: { id: invoiceId }, data: { bookingId } }).catch(() => {});
    await maybeConfirmBookingOnPayment(invoiceId).catch((e) => console.error("[SETTLE_CONFIGURATOR_CONFIRM_ERROR]", e));
  } catch (e) {
    console.error("[SETTLE_CONFIGURATOR_ERROR]", e);
  }
}
