"use server";

// ============================================================
// HOST-SIDE guest management (client portal). Lets a logged-in event host build
// their OWN guest list, send invitations, and track RSVPs — strictly scoped to a
// booking that belongs to one of their verified contacts. These are deliberately
// SEPARATE from the staff guest.actions/invitation.actions (which gate on staff
// permissions the host doesn't hold): every action here authorizes via
// ownedBooking(), so a host can never read or write another host's guest data.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { getVerifiedContactIds } from "@/lib/portal-identity";
import { guestSchema, bulkImportSchema } from "@/schemas/guest.schema";
import { buildInvitationMessage, buildRsvpUrl } from "@/lib/invitation-message-builder";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { scheduleReminders } from "@/lib/reminder-engine";
import { nanoid } from "nanoid";
import { format } from "date-fns";

type Result<T> = { success: true; data: T } | { success: false; error: string };

type OwnedBooking = {
  id: string;
  eventName: string;
  date: Date;
  startTime: Date | null;
  venue: { name: string };
  contact: { firstName: string; lastName: string };
};

// The ONLY authorization gate: resolve the caller → their verified contacts → the
// booking, and return it only when the booking belongs to one of those contacts.
async function ownedBooking(bookingId: string): Promise<{ uid: string; booking: OwnedBooking } | null> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid || !bookingId) return null;
  const contactIds = await getVerifiedContactIds(uid);
  if (contactIds.length === 0) return null;
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, contactId: { in: contactIds } },
    select: {
      id: true, eventName: true, date: true, startTime: true,
      venue: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
  });
  return booking ? { uid, booking } : null;
}

async function recalcTotals(guestListId: string) {
  const guests = await prisma.guest.findMany({
    where: { guestListId },
    select: { plusOnes: true, rsvpStatus: true, isCheckedIn: true },
  });
  await prisma.guestList.update({
    where: { id: guestListId },
    data: {
      totalInvited: guests.reduce((s, g) => s + 1 + g.plusOnes, 0),
      totalRSVP: guests.filter((g) => g.rsvpStatus === "ACCEPTED").length,
      totalCheckedIn: guests.filter((g) => g.isCheckedIn).length,
    },
  });
}

async function ensureGuestList(bookingId: string): Promise<string> {
  const existing = await prisma.guestList.findUnique({ where: { bookingId }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.guestList.create({ data: { bookingId }, select: { id: true } });
  return created.id;
}

// Send ONE invitation (idempotent — a guest already invited returns false). Mirrors
// the staff sendGuestInvitation core, minus the staff permission gate.
async function sendInvitationCore(
  guest: { id: string; name: string; phone: string | null },
  booking: OwnedBooking,
): Promise<boolean> {
  if (!guest.phone) return false;
  const existing = await prisma.guestInvitation.findUnique({
    where: { guestId: guest.id },
    select: { invitationStatus: true },
  });
  if (existing && existing.invitationStatus !== "NOT_SENT") return false;

  const rsvpToken = nanoid(16);
  const rsvpUrl = buildRsvpUrl(rsvpToken);
  const eventDate = format(new Date(booking.date), "EEEE, MMMM d, yyyy");
  const eventTime = booking.startTime ? format(new Date(booking.startTime), "h:mm a") : undefined;
  const messageContent = buildInvitationMessage({
    guestName: guest.name,
    eventName: booking.eventName,
    eventDate,
    eventTime,
    venueName: booking.venue.name,
    hostName: `${booking.contact.firstName} ${booking.contact.lastName}`.trim(),
    rsvpLink: rsvpUrl,
  });

  sendWhatsApp({ to: guest.phone, template: "guest_invitation", message: messageContent }).catch((e) =>
    console.error("[PORTAL_INVITE_WA_ERR]", e),
  );
  await prisma.guestInvitation.upsert({
    where: { guestId: guest.id },
    create: { guestId: guest.id, bookingId: booking.id, rsvpToken, invitationStatus: "SENT", sentAt: new Date(), messageContent },
    update: { invitationStatus: "SENT", sentAt: new Date(), messageContent, rsvpToken },
  });
  scheduleReminders(guest.id, booking.id, booking.date).catch((e) => console.error("[PORTAL_INVITE_REMIND_ERR]", e));
  return true;
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------

/** The host's own bookings, with guest-list summary — the /portal/guests landing. */
export async function getPortalGuestBookings() {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return [];
  const contactIds = await getVerifiedContactIds(uid);
  if (contactIds.length === 0) return [];
  const bookings = await prisma.booking.findMany({
    where: { contactId: { in: contactIds }, status: { notIn: ["CANCELLED"] } },
    orderBy: { date: "asc" },
    select: {
      id: true, eventName: true, bookingNumber: true, date: true,
      venue: { select: { name: true } },
      guestList: { select: { totalInvited: true, totalRSVP: true, _count: { select: { guests: true } } } },
    },
  });
  return serialize(bookings);
}

/** Full guest list + RSVP stats for ONE of the host's bookings. */
export async function getPortalGuestList(bookingId: string) {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false as const, error: "Not found." };
  const guestList = await prisma.guestList.findUnique({
    where: { bookingId },
    include: {
      guests: {
        orderBy: { createdAt: "desc" },
        include: { invitation: { select: { invitationStatus: true, sentAt: true, rsvpRespondedAt: true } } },
      },
    },
  });
  const guests = guestList?.guests ?? [];
  const stats = {
    total: guests.length,
    invited: guests.reduce((s, g) => s + 1 + g.plusOnes, 0),
    accepted: guests.filter((g) => g.rsvpStatus === "ACCEPTED").length,
    declined: guests.filter((g) => g.rsvpStatus === "DECLINED").length,
    pending: guests.filter((g) => g.rsvpStatus === "PENDING").length,
    sent: guests.filter((g) => g.invitation && g.invitation.invitationStatus !== "NOT_SENT").length,
  };
  return {
    success: true as const,
    data: serialize({
      booking: { id: own.booking.id, eventName: own.booking.eventName, date: own.booking.date, venueName: own.booking.venue.name },
      guestListId: guestList?.id ?? null,
      guests,
      stats,
    }),
  };
}

// ------------------------------------------------------------
// Writes (all own-booking-scoped)
// ------------------------------------------------------------

export async function portalAddGuest(bookingId: string, data: unknown): Promise<Result<{ id: string }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  const parsed = guestSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid guest details." };
  const g = parsed.data;
  const guestListId = await ensureGuestList(bookingId);
  const guest = await prisma.guest.create({
    data: {
      guestListId, name: g.name, email: g.email || null, phone: g.phone || null,
      category: g.category, plusOnes: g.plusOnes ?? 0,
      dietaryRestrictions: g.dietaryRestrictions || null, notes: g.notes || null,
    },
    select: { id: true },
  });
  await recalcTotals(guestListId);
  revalidatePath(`/portal/guests/${bookingId}`);
  return { success: true, data: { id: guest.id } };
}

export async function portalBulkImportGuests(bookingId: string, data: unknown): Promise<Result<{ count: number }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  const parsed = bulkImportSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid import — check the rows." };
  const guestListId = await ensureGuestList(bookingId);
  const res = await prisma.guest.createMany({
    data: parsed.data.guests.map((g) => ({
      guestListId, name: g.name, email: g.email || null, phone: g.phone || null,
      category: g.category ?? "OTHER", plusOnes: g.plusOnes ?? 0,
    })),
  });
  await recalcTotals(guestListId);
  revalidatePath(`/portal/guests/${bookingId}`);
  return { success: true, data: { count: res.count } };
}

export async function portalRemoveGuest(bookingId: string, guestId: string): Promise<Result<{ id: string }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  // The guest must belong to THIS booking's list (never another host's).
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, guestList: { bookingId } },
    select: { id: true, guestListId: true },
  });
  if (!guest) return { success: false, error: "Guest not found." };
  await prisma.guest.delete({ where: { id: guest.id } });
  await recalcTotals(guest.guestListId);
  revalidatePath(`/portal/guests/${bookingId}`);
  return { success: true, data: { id: guestId } };
}

export async function portalSendInvitation(bookingId: string, guestId: string): Promise<Result<{ sent: boolean }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, guestList: { bookingId } },
    select: { id: true, name: true, phone: true },
  });
  if (!guest) return { success: false, error: "Guest not found." };
  if (!guest.phone) return { success: false, error: "Add a phone number for this guest first." };
  const sent = await sendInvitationCore(guest, own.booking);
  if (!sent) return { success: false, error: "This guest was already invited." };
  revalidatePath(`/portal/guests/${bookingId}`);
  return { success: true, data: { sent: true } };
}

export async function portalBulkSendInvitations(bookingId: string): Promise<Result<{ sent: number; skipped: number }>> {
  const own = await ownedBooking(bookingId);
  if (!own) return { success: false, error: "Not authorized." };
  const guests = await prisma.guest.findMany({
    where: { guestList: { bookingId } },
    select: { id: true, name: true, phone: true, invitation: { select: { invitationStatus: true } } },
  });
  let sent = 0;
  let skipped = 0;
  for (const g of guests) {
    if (!g.phone || (g.invitation && g.invitation.invitationStatus !== "NOT_SENT")) { skipped++; continue; }
    const ok = await sendInvitationCore(g, own.booking);
    ok ? sent++ : skipped++;
  }
  revalidatePath(`/portal/guests/${bookingId}`);
  return { success: true, data: { sent, skipped } };
}
