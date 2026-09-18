import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Staff preview follows the team's EFFECTIVE permissions: role defaults ± the
// overrides edited in Settings → Roles (baked into the session by auth.ts),
// with admins always allowed. Auth, Prisma and portal identity are mocked, so
// this runs without a database. Pinned: a permission revoked in role settings
// refuses the preview (nothing is loaded, not even a booking asked for by
// id), a permission granted there opens it, and the admin bypass stays.
// ============================================================

const { authMock, db, verifiedContacts } = vi.hoisted(() => ({
  authMock: vi.fn(),
  verifiedContacts: vi.fn(),
  db: {
    bookingCollaborator: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/portal-identity", () => ({ getVerifiedContactIds: (userId: string) => verifiedContacts(userId) }));

import { canSeeBooking, getHostScope, getHostUser, isStaffUser, isTeamRole, staffCan } from "./host-scope";

const BOOKING = {
  id: "b1",
  bookingNumber: "VG-0001",
  eventName: "Reception",
  eventType: "WEDDING",
  date: new Date("2027-01-10T00:00:00.000Z"),
  timeSlot: "EVENING",
  status: "CONFIRMED",
  guestCount: 300,
  venueId: "v1",
  createdById: "s1",
  contactId: "c_host",
};

function signIn(user: { role: string; perms?: unknown } | null) {
  authMock.mockResolvedValue(user ? { user: { id: "u1", name: "Asha Rao", ...user } } : null);
}

beforeEach(() => {
  vi.clearAllMocks();
  verifiedContacts.mockResolvedValue([]);
  db.bookingCollaborator.findMany.mockResolvedValue([]);
  db.booking.findMany.mockResolvedValue([]);
  db.booking.findFirst.mockResolvedValue(BOOKING);
});

describe("staffCan: the team's effective permissions", () => {
  it("never treats a customer or vendor login as staff, whatever its session carries", () => {
    expect(staffCan({ role: "CLIENT", perms: ["*"] }, "bookings:read")).toBe(false);
    expect(staffCan({ role: "VENDOR", perms: ["bookings:read"] }, "bookings:read")).toBe(false);
    expect(staffCan({ role: null, perms: ["*"] }, "bookings:read")).toBe(false);
    expect(staffCan(null, "bookings:read")).toBe(false);
  });

  it("keeps the admin bypass, even for a session without permissions", () => {
    expect(staffCan({ role: "ADMIN", perms: [] }, "invoices:read")).toBe(true);
    expect(staffCan({ role: "SUPER_ADMIN", perms: null }, "loyalty:read")).toBe(true);
  });

  it("refuses a permission revoked in role settings that the role's defaults grant", () => {
    expect(staffCan({ role: "SALES_EXEC", perms: null }, "bookings:read")).toBe(true);
    expect(staffCan({ role: "SALES_EXEC", perms: ["leads:read", "invoices:read"] }, "bookings:read")).toBe(false);
  });

  it("allows a permission granted in role settings that the role's defaults lack", () => {
    expect(staffCan({ role: "MARKETING", perms: null }, "bookings:read")).toBe(false);
    expect(staffCan({ role: "MARKETING", perms: ["bookings:read"] }, "bookings:read")).toBe(true);
    expect(staffCan({ role: "MARKETING", perms: ["*"] }, "invoices:read")).toBe(true);
  });

  it("a team role is any login but a customer's or a vendor's, and says nothing about access", () => {
    expect(isTeamRole("MARKETING")).toBe(true);
    expect(isTeamRole("CLIENT")).toBe(false);
    expect(isTeamRole("VENDOR")).toBe(false);
    expect(isTeamRole(null)).toBe(false);
    expect(isStaffUser({ role: "MARKETING", perms: [] })).toBe(false);
  });
});

describe("getHostUser", () => {
  it("carries the session's effective permissions", async () => {
    signIn({ role: "SALES_EXEC", perms: ["bookings:read", 42, "loyalty:read"] });
    expect(await getHostUser()).toEqual({ id: "u1", name: "Asha Rao", role: "SALES_EXEC", perms: ["bookings:read", "loyalty:read"] });
  });

  it("reports no permissions when the session carries none, so the role's defaults apply", async () => {
    signIn({ role: "SALES_EXEC" });
    expect((await getHostUser())?.perms).toBeNull();
  });

  it("is null when nobody is signed in", async () => {
    signIn(null);
    expect(await getHostUser()).toBeNull();
  });
});

describe("staff preview", () => {
  it("is refused when bookings:read was revoked in role settings: nothing is loaded, not even a booking asked for by id", async () => {
    signIn({ role: "SALES_EXEC", perms: ["leads:read", "invoices:read", "loyalty:read"] });
    expect(await getHostScope("b1")).toMatchObject({ preview: false, contactIds: [], bookings: [], booking: null });
    expect(await canSeeBooking("b1")).toBe(false);
    expect(db.booking.findMany).not.toHaveBeenCalled();
    expect(db.booking.findFirst).not.toHaveBeenCalled();
  });

  it("opens with bookings:read in the session, narrowed to the previewed booking's host", async () => {
    signIn({ role: "SALES_EXEC", perms: ["bookings:read"] });
    expect(await getHostScope("b1")).toMatchObject({ preview: true, booking: { id: "b1" }, contactIds: ["c_host"] });
    expect(db.booking.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "b1" } }));
  });

  it("opens for a role granted bookings:read in role settings", async () => {
    signIn({ role: "MARKETING", perms: ["tasks:read", "bookings:read"] });
    expect((await getHostScope("b1"))?.preview).toBe(true);
  });

  it("keeps the admin bypass", async () => {
    signIn({ role: "ADMIN", perms: [] });
    expect(await getHostScope("b1")).toMatchObject({ preview: true, booking: { id: "b1" } });
    signIn({ role: "SUPER_ADMIN", perms: ["*"] });
    expect(await canSeeBooking("b1")).toBe(true);
  });

  it("falls back to the role's defaults only when the session carries no permissions", async () => {
    signIn({ role: "SALES_EXEC" });
    expect((await getHostScope("b1"))?.preview).toBe(true);
    signIn({ role: "MARKETING" });
    expect((await getHostScope("b1"))?.preview).toBe(false);
  });

  it("is never a customer's, whatever the session carries", async () => {
    signIn({ role: "CLIENT", perms: ["*"] });
    expect(await getHostScope("b1")).toMatchObject({ preview: false, booking: null });
    expect(db.booking.findFirst).not.toHaveBeenCalled();
  });
});
