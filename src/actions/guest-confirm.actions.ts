"use server";

// ============================================================
// Guest service confirmation + declaration (public token flow, no auth — the
// unguessable guestConfirmationToken is the only credential). The guest reviews
// their event services (menu/décor/etc from the BEO) and accepts the booking
// Terms & Conditions; acceptance stamps the booking (name + version + IP). Tied
// to the 48h guest-confirmation TAT set at booking confirmation.
// ============================================================

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { serialize } from "@/lib/utils";
import { BOOKING_TERMS, BOOKING_TERMS_VERSION } from "@/lib/legal/booking-terms";

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

export async function getGuestConfirmationByToken(token: string) {
  if (!token || token.length < 8) return null;
  const booking = await prisma.booking.findFirst({
    where: { guestConfirmationToken: token },
    select: {
      id: true, bookingNumber: true, eventName: true, eventType: true, date: true, timeSlot: true,
      guestCount: true, guestConfirmedAt: true, guestConfirmedName: true, guestConfirmationDueAt: true, status: true,
      venue: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
  });
  if (!booking) return null;

  // Service details from the BEO (menu / décor / AV / floor / special) + any frozen
  // vendor-package snapshots, if a BEO exists for this booking.
  const beo = await prisma.beo.findFirst({
    where: { bookingId: booking.id },
    select: { menuNotes: true, decorNotes: true, avNotes: true, floorPlanNotes: true, staffingNotes: true, specialInstructions: true, packageSnapshotJson: true },
    orderBy: { createdAt: "desc" },
  });

  return serialize({
    ...booking,
    services: beo ?? null,
    // Normalise to { heading, points } for the public page.
    terms: BOOKING_TERMS.map((s) => ({ heading: s.title, points: s.items })),
    termsVersion: BOOKING_TERMS_VERSION,
  });
}

export async function submitGuestConfirmation(
  token: string,
  input: { name: string; accepted: boolean },
): Promise<{ success: true; data: { confirmed: boolean; already?: boolean } } | { success: false; error: string }> {
  if (!token) return { success: false, error: "Invalid link." };
  const booking = await prisma.booking.findFirst({
    where: { guestConfirmationToken: token },
    select: { id: true, guestConfirmedAt: true },
  });
  if (!booking) return { success: false, error: "This confirmation link is invalid or has expired." };
  if (booking.guestConfirmedAt) return { success: true, data: { confirmed: true, already: true } };
  if (!input.accepted) return { success: false, error: "Please accept the terms & conditions to confirm." };
  if (!input.name?.trim()) return { success: false, error: "Please type your name to accept on the declaration." };

  const ip = await clientIp();
  const claimed = await prisma.booking.updateMany({
    where: { id: booking.id, guestConfirmedAt: null },
    data: {
      guestConfirmedAt: new Date(),
      guestConfirmedName: input.name.trim().slice(0, 120),
      guestTermsVersion: BOOKING_TERMS_VERSION,
      guestConfirmedIp: ip,
    },
  });
  if (claimed.count === 0) return { success: true, data: { confirmed: true, already: true } };
  return { success: true, data: { confirmed: true } };
}
