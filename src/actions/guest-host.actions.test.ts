import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// The event screens in staff preview follow the team's EFFECTIVE permissions
// (role overrides included, admins always), and the host's package requests
// stay the host's: never counted for the people they invited, and in preview
// only with the team access their contents need. Auth, Prisma and operations
// readiness are mocked; getHostScope and the event rules are real.
// ============================================================

const { authMock, db, readiness, verifiedContacts } = vi.hoisted(() => ({
  authMock: vi.fn(),
  readiness: vi.fn(),
  verifiedContacts: vi.fn(),
  db: {
    bookingCollaborator: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    eventOperation: { findUnique: vi.fn() },
    executionPlan: { findUnique: vi.fn() },
    guest: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    signatureRequest: { count: vi.fn() },
    task: { count: vi.fn(), findMany: vi.fn() },
    eventTimeline: { findUnique: vi.fn() },
    beo: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/portal-identity", () => ({ getVerifiedContactIds: (userId: string) => verifiedContacts(userId) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/ops/state-machine", () => ({ computeOperationReadiness: readiness }));

import { getGuestChecklist, getGuestEvent } from "./guest-host.actions";

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

function signIn(user: { id: string; role: string; perms?: string[] }) {
  authMock.mockResolvedValue({ user: { name: "Signed-in user", ...user } });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifiedContacts.mockResolvedValue([]);
  db.bookingCollaborator.findMany.mockResolvedValue([]);
  db.booking.findMany.mockResolvedValue([]);
  db.booking.findFirst.mockResolvedValue(BOOKING);
  db.booking.findUnique.mockResolvedValue({ ...BOOKING, hallBooked: null, venue: { name: "Grand Hall" }, contact: { firstName: "Priya", lastName: "Sharma" } });
  db.eventOperation.findUnique.mockResolvedValue(null);
  db.executionPlan.findUnique.mockResolvedValue(null);
  db.guest.findMany.mockResolvedValue([]);
  db.invoice.findMany.mockResolvedValue([]);
  db.signatureRequest.count.mockResolvedValue(0);
  db.task.count.mockResolvedValue(2);
  db.task.findMany.mockResolvedValue([]);
  db.eventTimeline.findUnique.mockResolvedValue(null);
  db.beo.findFirst.mockResolvedValue(null);
  db.user.findUnique.mockResolvedValue({ id: "s1", name: "Arjun Mehta", isActive: true });
});

describe("the event hub's package requests", () => {
  it("are not counted for a staff preview without packages:read and tasks:read", async () => {
    signIn({ id: "u_staff", role: "SALES_EXEC", perms: ["bookings:read", "tasks:read"] });
    expect(await getGuestEvent("b1")).toMatchObject({ preview: true, requests: 0 });
    expect(db.task.count).not.toHaveBeenCalled();
  });

  it("are counted for a staff preview with both", async () => {
    signIn({ id: "u_staff", role: "SALES_EXEC", perms: ["bookings:read", "packages:read", "tasks:read"] });
    expect((await getGuestEvent("b1"))?.requests).toBe(2);
  });

  it("are never counted for an invited co-host", async () => {
    signIn({ id: "u_invited", role: "CLIENT" });
    db.bookingCollaborator.findMany.mockResolvedValue([{ bookingId: "b1", role: "CO_HOST" }]);
    db.booking.findMany.mockResolvedValue([BOOKING]);
    expect(await getGuestEvent("b1")).toMatchObject({ collaboratorRole: "CO_HOST", requests: 0 });
    expect(db.task.count).not.toHaveBeenCalled();
  });

  it("are counted for the host", async () => {
    signIn({ id: "u_host", role: "CLIENT" });
    verifiedContacts.mockResolvedValue(["c_host"]);
    db.booking.findMany.mockResolvedValue([BOOKING]);
    expect(await getGuestEvent("b1")).toMatchObject({ preview: false, collaboratorRole: null, requests: 2 });
  });
});

describe("staff preview sections", () => {
  it("are hidden, and never read, when their permission was revoked in role settings", async () => {
    // STAFF's defaults include operations:read and execution:read; this session's overrides removed them.
    signIn({ id: "u_staff", role: "STAFF", perms: ["bookings:read", "tasks:read"] });
    expect(await getGuestChecklist("b1")).toMatchObject({ preview: true, planVisible: false });
    const ev = await getGuestEvent("b1");
    expect(ev?.previewHidden).toEqual({ readiness: true, plan: true, documents: true });
    expect(db.executionPlan.findUnique).not.toHaveBeenCalled();
    expect(db.signatureRequest.count).not.toHaveBeenCalled();
    expect(db.beo.findFirst).not.toHaveBeenCalled();
  });

  it("keep the admin bypass", async () => {
    signIn({ id: "u_admin", role: "ADMIN", perms: [] });
    expect((await getGuestChecklist("b1"))?.planVisible).toBe(true);
    expect(db.executionPlan.findUnique).toHaveBeenCalledTimes(1);
  });

  it("show nothing at all once bookings:read is revoked", async () => {
    signIn({ id: "u_staff", role: "STAFF", perms: ["operations:read", "execution:read"] });
    expect(await getGuestEvent("b1")).toBeNull();
    expect(await getGuestChecklist("b1")).toBeNull();
    expect(db.booking.findFirst).not.toHaveBeenCalled();
  });
});
