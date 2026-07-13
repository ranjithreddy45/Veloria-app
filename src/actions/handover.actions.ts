"use server";

// ============================================================
// Sales→Ops/Event handover meeting (24h post-sale SLA). One per booking, created
// PENDING on booking confirmation (see booking-confirmation-artifacts). Sales
// schedules it physical or virtual (with a meeting link); attendees are notified.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { serialize } from "@/lib/utils";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function gate(perm: string) {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id || !hasPermission(u.role ?? "", perm)) return null;
  return { id: u.id, role: u.role ?? "" };
}

export async function getHandoverMeeting(bookingId: string) {
  const u = await gate("bookings:read");
  if (!u) return null;
  const m = await prisma.handoverMeeting.findUnique({ where: { bookingId } });
  return m ? serialize(m) : null;
}

export interface ScheduleHandoverInput {
  bookingId: string;
  scheduledAt: string; // ISO
  mode: "PHYSICAL" | "VIRTUAL";
  meetingUrl?: string;
  location?: string;
  agenda?: string;
  teamOperations?: boolean;
  teamEvents?: boolean;
  attendeeIds?: string[];
}

export async function scheduleHandoverMeeting(input: ScheduleHandoverInput): Promise<Result<{ id: string }>> {
  const u = await gate("bookings:update");
  if (!u) return { success: false, error: "Not authorized." };

  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) return { success: false, error: "Pick a valid date & time." };
  if (input.mode === "VIRTUAL" && !input.meetingUrl?.trim()) return { success: false, error: "A meeting link is required for a virtual meeting." };
  if (input.mode === "PHYSICAL" && !input.location?.trim()) return { success: false, error: "A location is required for a physical meeting." };

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, bookingNumber: true, eventName: true, createdById: true },
  });
  if (!booking) return { success: false, error: "Booking not found." };

  const attendeeIds = Array.from(new Set([...(input.attendeeIds ?? []), u.id, ...(booking.createdById ? [booking.createdById] : [])]));

  const m = await prisma.handoverMeeting.upsert({
    where: { bookingId: input.bookingId },
    create: {
      bookingId: input.bookingId, scheduledAt: when, mode: input.mode,
      meetingUrl: input.meetingUrl?.trim() || null, location: input.location?.trim() || null,
      agenda: input.agenda?.trim() || null, status: "SCHEDULED", teamOperations: input.teamOperations ?? true,
      teamEvents: input.teamEvents ?? false, attendeeIds, scheduledById: u.id,
    },
    update: {
      scheduledAt: when, mode: input.mode, meetingUrl: input.meetingUrl?.trim() || null,
      location: input.location?.trim() || null, agenda: input.agenda?.trim() || null,
      status: "SCHEDULED", teamOperations: input.teamOperations ?? true, teamEvents: input.teamEvents ?? false,
      attendeeIds, scheduledById: u.id,
    },
    select: { id: true },
  });

  const whenStr = when.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  const where = input.mode === "VIRTUAL" ? "online" : input.location?.trim() || "on-site";
  for (const uid of attendeeIds) {
    if (uid === u.id) continue;
    notify({
      userId: uid, type: "SYSTEM", title: "Handover meeting scheduled",
      message: `Guest handover for ${booking.bookingNumber} (${booking.eventName}) — ${whenStr}, ${where}.`,
      actionUrl: `/bookings/${input.bookingId}`,
    });
  }
  await logActivity({ userId: u.id, action: "scheduled", entityType: "HandoverMeeting", entityId: m.id });
  revalidatePath(`/bookings/${input.bookingId}`);
  return { success: true, data: { id: m.id } };
}

export async function completeHandoverMeeting(bookingId: string): Promise<Result<{ id: string }>> {
  const u = await gate("bookings:update");
  if (!u) return { success: false, error: "Not authorized." };
  const m = await prisma.handoverMeeting.findUnique({ where: { bookingId }, select: { id: true, status: true } });
  if (!m) return { success: false, error: "No handover meeting for this booking." };
  if (m.status === "CANCELLED") return { success: false, error: "This handover was cancelled." };
  await prisma.handoverMeeting.update({ where: { bookingId }, data: { status: "COMPLETED", completedAt: new Date() } });
  await logActivity({ userId: u.id, action: "completed", entityType: "HandoverMeeting", entityId: m.id });
  revalidatePath(`/bookings/${bookingId}`);
  return { success: true, data: { id: m.id } };
}

export async function cancelHandoverMeeting(bookingId: string): Promise<Result<{ id: string }>> {
  const u = await gate("bookings:update");
  if (!u) return { success: false, error: "Not authorized." };
  const m = await prisma.handoverMeeting.findUnique({ where: { bookingId }, select: { id: true } });
  if (!m) return { success: false, error: "No handover meeting for this booking." };
  await prisma.handoverMeeting.update({ where: { bookingId }, data: { status: "CANCELLED" } });
  revalidatePath(`/bookings/${bookingId}`);
  return { success: true, data: { id: m.id } };
}

/** Set (or clear) a booking's precise event start time — drives exact reminder timing. */
export async function setEventStartAt(bookingId: string, iso: string | null): Promise<Result<{ id: string }>> {
  const u = await gate("bookings:update");
  if (!u) return { success: false, error: "Not authorized." };
  let when: Date | null = null;
  if (iso) {
    when = new Date(iso);
    if (Number.isNaN(when.getTime())) return { success: false, error: "Pick a valid date & time." };
  }
  await prisma.booking.update({ where: { id: bookingId }, data: { eventStartAt: when } });
  revalidatePath(`/bookings/${bookingId}`);
  return { success: true, data: { id: bookingId } };
}
