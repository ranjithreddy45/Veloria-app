"use server";

// ============================================================
// Reconciling the two guest numbers on a booking.
//
// A booking carries a CONTRACTED count (Booking.guestCount, agreed at enquiry —
// what the customer is billed against) and, once invitations go out, a
// CONFIRMED count (heads that actually replied yes). The Function Sheet and the
// kitchen plan are stamped with the contracted number when they are created, at
// confirmation, which is always before a single RSVP exists.
//
// This module only ever REPORTS the difference, and writes `covers` solely when
// a person with kitchen/BEO write access asks for it. Nothing here runs on a
// schedule or fires from an RSVP: catering to a contract you no longer believe
// wastes food, and quietly re-cutting the contracted figure changes what someone
// owes. Both numbers stay on screen, labelled, and a human decides.
//
// Invoicing is deliberately untouched. The contracted count governs the money.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { summariseHeadcount, COVERS_SOURCE, type Headcount } from "@/lib/guests/headcount";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

export interface BookingCovers {
  bookingId: string;
  headcount: Headcount;
  /** True when nobody has been invited yet — the screens say so rather than showing 0 of 0. */
  noGuestList: boolean;
  beo: { id: string; covers: number | null; coversSource: string | null } | null;
  kitchenPlan: { id: string; covers: number; coversSource: string | null } | null;
}

/**
 * Both numbers for one booking, plus what each sheet is currently cooking to.
 * Read-only; needs either BEO or kitchen read access.
 */
export async function getBookingCovers(bookingId: string): Promise<Result<BookingCovers>> {
  const user = await requireUser();
  const role = user?.role ?? "";
  if (!user || !(hasPermission(role, "beo:read") || hasPermission(role, "kitchen:read"))) {
    return { success: false, error: "Unauthorized" };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      guestCount: true,
      guestList: {
        select: {
          guests: {
            select: {
              rsvpStatus: true,
              plusOnes: true,
              mealVeg: true,
              mealNonVeg: true,
              mealJain: true,
            },
          },
        },
      },
    },
  });
  if (!booking) return { success: false, error: "Booking not found" };

  const guests = booking.guestList?.guests ?? [];
  const [beo, kitchenPlan] = await Promise.all([
    prisma.beo.findFirst({
      where: { bookingId },
      select: { id: true, covers: true, coversSource: true },
    }),
    prisma.kitchenPlan.findFirst({
      where: { bookingId },
      select: { id: true, covers: true, coversSource: true },
    }),
  ]);

  return {
    success: true,
    data: {
      bookingId,
      headcount: summariseHeadcount(guests, booking.guestCount),
      noGuestList: guests.length === 0,
      beo,
      kitchenPlan,
    },
  };
}

/** Recount from the guest rows at the moment of the write, never from a number passed in. */
async function confirmedHeadsFor(bookingId: string): Promise<number | null> {
  const list = await prisma.guestList.findUnique({
    where: { bookingId },
    select: {
      guests: {
        select: { rsvpStatus: true, plusOnes: true, mealVeg: true, mealNonVeg: true, mealJain: true },
      },
    },
  });
  if (!list) return null;
  return summariseHeadcount(list.guests, null).confirmedHeads;
}

/**
 * Set the Function Sheet's covers to the confirmed head count.
 *
 * The figure is recomputed here rather than accepted from the caller, so a
 * stale screen can't write a number that was true five minutes ago.
 */
export async function setBeoCoversFromRsvp(beoId: string): Promise<Result<{ covers: number }>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "beo:write")) {
    return { success: false, error: "Unauthorized" };
  }

  const beo = await prisma.beo.findUnique({
    where: { id: beoId },
    select: { id: true, bookingId: true, status: true, covers: true },
  });
  if (!beo) return { success: false, error: "Function Sheet not found" };
  if (beo.status === "LOCKED") {
    return { success: false, error: "This Function Sheet is locked. Unlock it before changing covers." };
  }

  const confirmed = await confirmedHeadsFor(beo.bookingId);
  if (confirmed == null) {
    return { success: false, error: "This booking has no guest list yet, so there are no RSVPs to count." };
  }
  if (confirmed === 0) {
    // Zero is a real answer, but writing it onto a sheet would tell the kitchen
    // to cook nothing. Refuse and let a person type it if they truly mean it.
    return { success: false, error: "No guest has accepted yet. Set covers by hand if you mean to cook for none." };
  }

  await prisma.beo.update({
    where: { id: beoId },
    data: {
      covers: confirmed,
      coversSource: COVERS_SOURCE.RSVP_CONFIRMED,
      coversUpdatedAt: new Date(),
    },
  });

  await logActivity({
    userId: user.id,
    action: "updated",
    entityType: "Beo",
    entityId: beoId,
    changes: { covers: { from: beo.covers, to: confirmed }, coversSource: COVERS_SOURCE.RSVP_CONFIRMED },
  });

  revalidatePath(`/beo/${beoId}`);
  revalidatePath(`/bookings/${beo.bookingId}`);
  return { success: true, data: { covers: confirmed } };
}

/** The same, for the kitchen plan. */
export async function setKitchenCoversFromRsvp(planId: string): Promise<Result<{ covers: number }>> {
  const user = await requireUser();
  if (!user || !hasPermission(user.role ?? "", "kitchen:write")) {
    return { success: false, error: "Unauthorized" };
  }

  const plan = await prisma.kitchenPlan.findUnique({
    where: { id: planId },
    select: { id: true, bookingId: true, status: true, covers: true },
  });
  if (!plan) return { success: false, error: "Kitchen plan not found" };
  if (plan.status === "COMPLETED") {
    return { success: false, error: "This kitchen plan is completed. Covers can't be changed." };
  }

  const confirmed = await confirmedHeadsFor(plan.bookingId);
  if (confirmed == null) {
    return { success: false, error: "This booking has no guest list yet, so there are no RSVPs to count." };
  }
  if (confirmed === 0) {
    return { success: false, error: "No guest has accepted yet. Set covers by hand if you mean to cook for none." };
  }

  await prisma.kitchenPlan.update({
    where: { id: planId },
    data: {
      covers: confirmed,
      coversSource: COVERS_SOURCE.RSVP_CONFIRMED,
      coversUpdatedAt: new Date(),
    },
  });

  await logActivity({
    userId: user.id,
    action: "updated",
    entityType: "KitchenPlan",
    entityId: planId,
    changes: { covers: { from: plan.covers, to: confirmed }, coversSource: COVERS_SOURCE.RSVP_CONFIRMED },
  });

  revalidatePath(`/kitchen/${planId}`);
  revalidatePath(`/bookings/${plan.bookingId}`);
  return { success: true, data: { covers: confirmed } };
}
