// Verifies the slot-release-on-cancel fix against the real local DB:
// a CANCELLED booking must NOT hold its (venue,date,slot) slot, so the slot can
// be re-booked — while two ACTIVE bookings on the same slot are still rejected.
// Enforced by the partial unique index "Booking_active_slot_key" (WHERE status <> CANCELLED).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

const U = Date.now();
const DATE = new Date(Date.UTC(2027, 0, 15)); // fixed future UTC day
let adminId: string;
let contactId: string;
let venueId: string;
const created: string[] = [];

async function book(suffix: string): Promise<string> {
  const b = await prisma.booking.create({
    data: {
      bookingNumber: `SLOT-${U}-${suffix}`,
      eventName: `Slot Test ${suffix}`,
      eventType: "Reception",
      status: "CONFIRMED",
      date: DATE,
      timeSlot: "EVENING",
      guestCount: 100,
      totalAmount: "100000",
      venueId,
      contactId,
      createdById: adminId,
    },
    select: { id: true },
  });
  created.push(b.id);
  return b.id;
}

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: { name: "Slot Admin", email: `slot-admin-${U}@t.local`, role: "ADMIN", isActive: true },
    select: { id: true },
  });
  adminId = admin.id;
  const contact = await prisma.contact.create({
    data: { firstName: "Slot", lastName: "Tester", phone: `+9195${String(U).slice(-8)}` },
    select: { id: true },
  });
  contactId = contact.id;
  const venue = await prisma.venue.create({
    data: { name: `Slot Hall ${U}`, capacity: 300, pricePerSlot: 50000, amenities: [], isActive: true },
    select: { id: true },
  });
  venueId = venue.id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: { in: created } } });
  await prisma.contact.deleteMany({ where: { id: contactId } });
  await prisma.venue.deleteMany({ where: { id: venueId } });
  await prisma.user.deleteMany({ where: { id: adminId } });
});

describe("slot release on cancel (partial unique index)", () => {
  it("rejects a second ACTIVE booking on the same slot", async () => {
    await book("a");
    await expect(book("b")).rejects.toBeTruthy(); // P2002 on the active-slot index
  });

  it("releases the slot once the holder is CANCELLED, allowing a re-book", async () => {
    // Cancel the active holder (SLOT-a).
    await prisma.booking.updateMany({
      where: { bookingNumber: `SLOT-${U}-a` },
      data: { status: "CANCELLED" },
    });
    // The slot is now free — a new booking on the SAME slot must succeed.
    const reId = await book("c");
    expect(reId).toBeTruthy();

    // ...and the slot is locked again by the new active booking.
    await expect(book("d")).rejects.toBeTruthy();
  });
});
