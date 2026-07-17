// ============================================================
// Host-side portal guest management — integration test.
// Mocks auth / next-cache / whatsapp / reminders and drives the REAL
// portal-guest actions against the local DB. Proves BOTH the happy path
// (add / import / list / invite / RSVP stats) AND the security boundary:
// a host can only ever touch their OWN booking's guests, never another host's.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/reminder-engine", () => ({ scheduleReminders: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "@/lib/prisma";
import {
  getPortalGuestList, portalAddGuest, portalBulkImportGuests,
  portalSendInvitation, portalRemoveGuest,
} from "./portal-guest.actions";

const U = Date.now();
const ids: { users: string[]; contacts: string[]; bookings: string[]; venue?: string } = { users: [], contacts: [], bookings: [] };
let hostA = "", hostB = "", bookingA = "", bookingB = "";

async function makeHost(tag: string) {
  const email = `host-${tag}-${U}@t.local`;
  // emailVerified is REQUIRED for portal identity to resolve contacts (C9 takeover guard).
  const user = await prisma.user.create({ data: { name: `Host ${tag}`, email, role: "CLIENT", isActive: true, emailVerified: new Date() }, select: { id: true } });
  ids.users.push(user.id);
  // getVerifiedContactIds matches Contact.email === user.email.
  const contact = await prisma.contact.create({ data: { firstName: "Host", lastName: tag, email, phone: `+9193${String(U).slice(-7)}${tag === "A" ? 1 : 2}` }, select: { id: true } });
  ids.contacts.push(contact.id);
  const booking = await prisma.booking.create({
    data: {
      bookingNumber: `BKGUEST-${tag}-${U}`, eventName: `${tag} Wedding`, eventType: "WEDDING",
      date: new Date(Date.UTC(2030, 5, tag === "A" ? 20 : 21)), timeSlot: "EVENING", status: "CONFIRMED",
      guestCount: 100, totalAmount: "100000",
      contactId: contact.id, venueId: ids.venue!, createdById: user.id,
    },
    select: { id: true },
  });
  ids.bookings.push(booking.id);
  return { userId: user.id, bookingId: booking.id };
}

function actAs(userId: string) {
  authMock.mockResolvedValue({ user: { id: userId, role: "CLIENT", name: "Host" } });
}

beforeAll(async () => {
  const venue = await prisma.venue.create({ data: { name: `Guest Test Hall ${U}`, capacity: 500, pricePerSlot: "50000" }, select: { id: true } });
  ids.venue = venue.id;
  const a = await makeHost("A"); hostA = a.userId; bookingA = a.bookingId;
  const b = await makeHost("B"); hostB = b.userId; bookingB = b.bookingId;
});

afterAll(async () => {
  await prisma.guestInvitation.deleteMany({ where: { bookingId: { in: ids.bookings } } });
  const lists = await prisma.guestList.findMany({ where: { bookingId: { in: ids.bookings } }, select: { id: true } });
  await prisma.guest.deleteMany({ where: { guestListId: { in: lists.map((l) => l.id) } } });
  await prisma.guestList.deleteMany({ where: { bookingId: { in: ids.bookings } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids.bookings } } });
  await prisma.contact.deleteMany({ where: { id: { in: ids.contacts } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  if (ids.venue) await prisma.venue.deleteMany({ where: { id: ids.venue } });
});

describe("host portal guest management (real actions + DB)", () => {
  it("host adds a guest to their OWN booking, and it shows in their list + stats", async () => {
    actAs(hostA);
    const add = await portalAddGuest(bookingA, { name: "Aarav Sharma", phone: "9876543210", category: "FRIEND", plusOnes: 1 });
    expect(add.success).toBe(true);
    const list = await getPortalGuestList(bookingA);
    expect(list.success).toBe(true);
    if (list.success) {
      expect(list.data.guests).toHaveLength(1);
      expect(list.data.guests[0].name).toBe("Aarav Sharma");
      expect(list.data.stats.invited).toBe(2); // 1 guest + 1 plus-one
      expect(list.data.stats.pending).toBe(1);
    }
  });

  it("bulk import + send invitation flips the guest to SENT", async () => {
    actAs(hostA);
    const imp = await portalBulkImportGuests(bookingA, { guests: [{ name: "Priya Nair", phone: "9998887766" }, { name: "No Phone" }] });
    expect(imp.success && imp.data.count).toBe(2);
    const list = await getPortalGuestList(bookingA);
    const priya = list.success ? list.data.guests.find((g) => g.name === "Priya Nair")! : null;
    expect(priya).toBeTruthy();
    const send = await portalSendInvitation(bookingA, priya!.id);
    expect(send.success).toBe(true);
    const inv = await prisma.guestInvitation.findUnique({ where: { guestId: priya!.id }, select: { invitationStatus: true, rsvpToken: true } });
    expect(inv?.invitationStatus).toBe("SENT");
    expect(inv?.rsvpToken).toBeTruthy();
  });

  it("SECURITY: host A cannot read host B's guest list", async () => {
    actAs(hostA);
    const res = await getPortalGuestList(bookingB);
    expect(res.success).toBe(false);
  });

  it("SECURITY: host A cannot add a guest to host B's booking", async () => {
    actAs(hostA);
    const res = await portalAddGuest(bookingB, { name: "Intruder", category: "OTHER" });
    expect(res.success).toBe(false);
    // and B's list stays empty
    actAs(hostB);
    const bList = await getPortalGuestList(bookingB);
    expect(bList.success && bList.data.guests).toHaveLength(0);
  });

  it("SECURITY: host A cannot remove/invite a guest that belongs to B", async () => {
    actAs(hostB);
    await portalAddGuest(bookingB, { name: "B Guest", phone: "9000000000", category: "FAMILY" });
    const bList = await getPortalGuestList(bookingB);
    const bGuestId = bList.success ? bList.data.guests[0].id : "";
    actAs(hostA);
    // A references B's guest id but A's own booking → must not touch it.
    const rm = await portalRemoveGuest(bookingB, bGuestId);
    expect(rm.success).toBe(false); // A doesn't own bookingB
    const inv = await portalSendInvitation(bookingA, bGuestId); // A's booking, B's guest → guest not in A's list
    expect(inv.success).toBe(false);
  });
});
