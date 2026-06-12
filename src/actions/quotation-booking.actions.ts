"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { checkAvailability, createBooking } from "@/actions/booking.actions";
import { BOOKABLE_SLOTS, SLOT_LABEL, plannerSlotToEnum, type TimeSlotEnum } from "@/lib/sales/slot";

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
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
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

  const dateStr = opts.dateISO || (q.eventDate ? q.eventDate.toISOString().slice(0, 10) : "");
  const date = parseLocalDate(dateStr);
  if (Number.isNaN(date.getTime())) return { success: false, error: "Select a valid event date." };
  const timeSlot = opts.timeSlot ?? plannerSlotToEnum(q.timeSlot);

  // Pre-check (createBooking re-checks atomically, but this gives a clean message).
  const avail = await checkAvailability(opts.venueId, date, timeSlot);
  if (avail.success && avail.data && !avail.data.available) {
    return { success: false, error: avail.data.reason || "That slot is already taken." };
  }

  // Resolve a contact: use the linked one, else mint a light contact from the
  // quote. Track whether we minted one so we can roll it back if the booking
  // then fails (otherwise an orphan contact would linger on the quotation).
  let contactId = q.contact?.id ?? null;
  let mintedContactId: string | null = null;
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
    totalAmount: Number(q.grandTotal) || 1,
    internalNotes: `Auto-created from quotation ${q.quoteNumber}.`,
  });

  if (!res.success || !res.data) {
    // Roll back a freshly-minted contact so it isn't orphaned on the quote.
    if (mintedContactId) {
      await prisma.salesQuotation.update({ where: { id: quotationId }, data: { contactId: null } }).catch(() => {});
      await prisma.contact.delete({ where: { id: mintedContactId } }).catch(() => {});
    }
    return { success: false, error: res.error || "Could not create the booking." };
  }
  const bookingId = res.data.id;

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

  notify({
    userId: user.id,
    type: "BOOKING_CREATED",
    title: "Slot blocked",
    message: `Slot held for ${q.clientName ?? "the customer"} — ${SLOT_LABEL[timeSlot]} on ${date.toLocaleDateString("en-IN")}.`,
    actionUrl: `/bookings/${bookingId}`,
  });

  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/availability");
  return { success: true, data: { bookingId } };
}
