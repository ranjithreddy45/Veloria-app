import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Shared bookings and the team's EFFECTIVE permissions. The booking page's
// collaborator panel (names and phone numbers of the people a host invited)
// and its revoke action follow role overrides the way /bookings does, and so
// does the host's share screen in staff preview. Admins keep the bypass.
// Auth and Prisma are mocked; access rules and getHostScope are real.
// ============================================================

const { authMock, db } = vi.hoisted(() => ({
  authMock: vi.fn(),
  db: {
    bookingCollaborator: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    whatsAppConfig: { findFirst: vi.fn() },
  },
}));

vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/portal-identity", () => ({ getVerifiedContactIds: async () => [] }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => ({ success: true, remaining: 9, resetIn: 600 }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/(guest)/app/event/guests/_lib/host-phone", () => ({
  checkPhone: vi.fn(),
  collaboratorPhoneForStorage: vi.fn(),
  displayPhone: (phone: string) => `+${phone}`,
  samePhone: vi.fn(),
}));

import { getBookingCollaboratorsForTeam, getShareScreen, revokeCollaboratorAsTeam } from "./guest-collaborators.actions";

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

const ROW = {
  id: "col1",
  bookingId: "b1",
  name: "Meera",
  phone: "919845012345",
  role: "VIEWER",
  status: "ACTIVE",
  userId: "u9",
  invitedById: "u_host",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  acceptedAt: new Date("2026-09-02T00:00:00.000Z"),
  revokedAt: null,
};

function signIn(role: string, perms?: string[]) {
  authMock.mockResolvedValue({ user: { id: "u_staff", name: "Team member", role, ...(perms ? { perms } : {}) } });
}

beforeEach(() => {
  vi.clearAllMocks();
  // The booking's rows for the panel; none bound to the signed-in login (getHostScope's lookup).
  db.bookingCollaborator.findMany.mockImplementation(async (args: { where: { bookingId?: string } }) => (args.where.bookingId ? [ROW] : []));
  db.bookingCollaborator.findUnique.mockResolvedValue(ROW);
  db.bookingCollaborator.updateMany.mockResolvedValue({ count: 1 });
  db.booking.findMany.mockResolvedValue([]);
  db.booking.findFirst.mockResolvedValue(BOOKING);
  db.user.findMany.mockResolvedValue([]);
});

describe("the booking page's collaborator panel", () => {
  it("is refused to a team member whose bookings:read was revoked in role settings: no names or phones are read", async () => {
    signIn("SALES_EXEC", ["bookings:update", "leads:read"]);
    expect(await getBookingCollaboratorsForTeam("b1")).toBeNull();
    expect(db.bookingCollaborator.findMany).not.toHaveBeenCalled();
  });

  it("lists the rows with bookings:read, and offers revoke only with bookings:update in the session", async () => {
    signIn("SALES_EXEC", ["bookings:read"]);
    const data = await getBookingCollaboratorsForTeam("b1");
    expect(data).toMatchObject({ bookingId: "b1", canRevoke: false });
    expect(data?.rows.map((r) => r.id)).toEqual(["col1"]);
    signIn("MARKETING", ["bookings:read", "bookings:update"]);
    expect((await getBookingCollaboratorsForTeam("b1"))?.canRevoke).toBe(true);
  });

  it("refuses a team revoke once bookings:update is revoked in role settings", async () => {
    signIn("SALES_EXEC", ["bookings:read"]);
    expect(await revokeCollaboratorAsTeam("col1")).toEqual({ success: false, error: "You don't have permission to change this booking." });
    expect(db.bookingCollaborator.updateMany).not.toHaveBeenCalled();
  });

  it("keeps the admin bypass", async () => {
    signIn("ADMIN", []);
    expect(await revokeCollaboratorAsTeam("col1")).toEqual({ success: true, data: { id: "col1", status: "REVOKED" } });
    expect(db.bookingCollaborator.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("the share screen in staff preview", () => {
  it("shows nothing to a team member whose bookings:read was revoked", async () => {
    signIn("SALES_EXEC", ["bookings:update"]);
    expect(await getShareScreen("b1")).toBeNull();
    expect(db.booking.findFirst).not.toHaveBeenCalled();
  });
});
