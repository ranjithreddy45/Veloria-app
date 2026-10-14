// ============================================================
// Booking numbers (VG-YYYY-NNNN) — plain server code, NOT a "use server"
// action file.
// ------------------------------------------------------------
// This used to be an exported function in booking.actions.ts, which made it
// a server action anyone could call by id — no session at all — to read the
// latest booking number (and so how many bookings exist this year). Every
// caller is trusted server code (createBooking, the public hold flow, the
// configurator settlement, one-tap quote finalize), so it lives here instead.
// ============================================================

import { prisma } from "@/lib/prisma";

/** The next free booking number for this year; a timestamp number if five tries collide. */
export async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VG-${year}-`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const lastBooking = await prisma.booking.findFirst({
      where: { bookingNumber: { startsWith: prefix } },
      orderBy: { bookingNumber: "desc" },
      select: { bookingNumber: true },
    });

    let nextNumber = 1;
    if (lastBooking) {
      const lastNum = parseInt(lastBooking.bookingNumber.split("-").pop() || "0", 10);
      nextNumber = lastNum + 1;
    }

    const number = `${prefix}${String(nextNumber + attempt).padStart(4, "0")}`;

    // Check uniqueness to avoid TOCTOU race condition
    const existing = await prisma.booking.findFirst({
      where: { bookingNumber: number },
    });

    if (!existing) return number;
  }

  // Fallback: use timestamp-based unique number
  return `VG-${Date.now()}`;
}
