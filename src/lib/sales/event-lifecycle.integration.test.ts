// End-to-end test of the event-lifecycle sweep against the real local DB.
// Verifies: (1) CONFIRMED→IN_PROGRESS on the event day; (2) a clean past event
// (balance cleared + BEO published + guest count) auto-COMPLETES; (3) a past
// event with a balance owed is NOT completed (it gets nudged instead).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { sweepEventLifecycle } from "./event-lifecycle";

const U = Date.now();
const dayMs = 86_400_000;
const now = new Date();
const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const yesterdayUTC = new Date(todayUTC.getTime() - dayMs);

let adminId: string;
let contactId: string;
let venueId: string;
const ids: { clean?: string; owing?: string; today?: string } = {};

async function makeBooking(
  suffix: string,
  date: Date,
  timeSlot: "MORNING" | "AFTERNOON" | "EVENING"
): Promise<string> {
  const b = await prisma.booking.create({
    data: {
      bookingNumber: `EVL-${U}-${suffix}`,
      eventName: `EVL Test ${suffix}`,
      eventType: "Reception",
      status: "CONFIRMED",
      date,
      timeSlot,
      guestCount: 100,
      totalAmount: "100000",
      venueId,
      contactId,
      createdById: adminId,
    },
    select: { id: true },
  });
  return b.id;
}

async function makeInvoice(bookingId: string, balanceDue: number): Promise<void> {
  await prisma.invoice.create({
    data: {
      invoiceNumber: `EVLINV-${U}-${bookingId.slice(-6)}`,
      status: balanceDue <= 0 ? "PAID" : "SENT",
      dueDate: yesterdayUTC,
      subtotal: "100000",
      totalAmount: "100000",
      paidAmount: balanceDue <= 0 ? "100000" : "0",
      balanceDue: String(balanceDue),
      contactId,
      bookingId,
      createdById: adminId,
    },
  });
}

async function publishBeo(bookingId: string): Promise<void> {
  await prisma.beo.create({
    data: {
      beoNumber: `EVLBEO-${U}-${bookingId.slice(-6)}`,
      bookingId,
      status: "PUBLISHED",
      covers: 100,
      createdById: adminId,
    },
  });
}

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: { name: "EVL Admin", email: `evl-admin-${U}@t.local`, role: "ADMIN", isActive: true },
    select: { id: true },
  });
  adminId = admin.id;
  const contact = await prisma.contact.create({
    data: { firstName: "Evl", lastName: "Tester", phone: `+9197${String(U).slice(-8)}` },
    select: { id: true },
  });
  contactId = contact.id;
  const venue = await prisma.venue.create({
    data: { name: `EVL Hall ${U}`, capacity: 300, pricePerSlot: 50000, amenities: [], isActive: true },
    select: { id: true },
  });
  venueId = venue.id;

  // (A) clean past event → should auto-complete
  ids.clean = await makeBooking("clean", yesterdayUTC, "EVENING");
  await makeInvoice(ids.clean, 0);
  await publishBeo(ids.clean);

  // (B) past event with balance owed → should NOT complete
  ids.owing = await makeBooking("owing", yesterdayUTC, "MORNING");
  await makeInvoice(ids.owing, 50000);
  await publishBeo(ids.owing);

  // (C) event happening today → should flip to IN_PROGRESS
  ids.today = await makeBooking("today", todayUTC, "EVENING");
});

afterAll(async () => {
  const bookingIds = [ids.clean, ids.owing, ids.today].filter(Boolean) as string[];
  await prisma.beo.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.invoice.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.notification.deleteMany({ where: { userId: adminId } });
  await prisma.contact.deleteMany({ where: { id: contactId } });
  await prisma.venue.deleteMany({ where: { id: venueId } });
  await prisma.user.deleteMany({ where: { id: adminId } });
});

describe("event-lifecycle sweep", () => {
  it("auto-completes clean past events, leaves owing ones, starts today's", async () => {
    const res = await sweepEventLifecycle();
    expect(res.startedToday).toBeGreaterThanOrEqual(1);
    expect(res.autoCompleted).toBeGreaterThanOrEqual(1);
    expect(res.nudged).toBeGreaterThanOrEqual(1);

    const clean = await prisma.booking.findUnique({ where: { id: ids.clean }, select: { status: true } });
    const owing = await prisma.booking.findUnique({ where: { id: ids.owing }, select: { status: true } });
    const today = await prisma.booking.findUnique({ where: { id: ids.today }, select: { status: true } });

    expect(clean!.status).toBe("COMPLETED"); // clean → auto-completed
    expect(owing!.status).toBe("CONFIRMED"); // balance owed → not completed
    expect(today!.status).toBe("IN_PROGRESS"); // event day → started
  });

  it("is idempotent on a second run (no throw, statuses stable)", async () => {
    await sweepEventLifecycle();
    const clean = await prisma.booking.findUnique({ where: { id: ids.clean }, select: { status: true } });
    expect(clean!.status).toBe("COMPLETED");
  });
});
