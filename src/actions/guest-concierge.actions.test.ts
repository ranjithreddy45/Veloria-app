import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// The customer's side of a concierge conversation, on the server: who reads
// the thread and who sees the requests in it. getHostScope runs for real over
// mocked auth and Prisma; the conversation data layer is mocked.
// Pinned: an invited viewer never reads the conversation (the collaborator
// matrix gives them no concierge access); a co-host reads and writes it but
// never sees the host's package or points requests; a staff preview sees each
// request kind only with the team access its contents need, and nothing at
// all once bookings:read is revoked in role settings; admins keep the bypass.
// ============================================================

const { authMock, db, server, verifiedContacts } = vi.hoisted(() => ({
  authMock: vi.fn(),
  verifiedContacts: vi.fn(),
  db: {
    bookingCollaborator: { findMany: vi.fn(), count: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn() },
    contact: { findUnique: vi.fn() },
    conciergeThread: { findUnique: vi.fn(), findMany: vi.fn() },
    conciergeMessage: { count: vi.fn() },
    notification: { findMany: vi.fn(), updateMany: vi.fn() },
  },
  server: {
    fallbackTeamRecipients: vi.fn(),
    findThread: vi.fn(),
    loadMessages: vi.fn(),
    loadPeople: vi.fn(),
    loadRequestEntries: vi.fn(),
    markReadBy: vi.fn(),
    resolveTeamOwner: vi.fn(),
    writeCustomerMessage: vi.fn(),
  },
}));

vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/portal-identity", () => ({ getVerifiedContactIds: (userId: string) => verifiedContacts(userId) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => ({ success: true, remaining: 19, resetIn: 300 }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/(guest)/app/concierge/_lib/concierge-server", () => server);

import { getMyConversation, getMyNotifications, markConciergeRead, sendConciergeMessage } from "./guest-concierge.actions";

const booking = {
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

const thread = {
  id: "th1",
  contactId: "c_host",
  bookingId: "b1",
  status: "OPEN",
  assignedToId: "s1",
  lastMessageAt: new Date("2026-09-15T10:00:00.000Z"),
  lastCustomerAt: null,
  lastStaffAt: new Date("2026-09-15T10:00:00.000Z"),
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
};

const teamMessage = {
  id: "m1",
  threadId: "th1",
  authorType: "STAFF",
  authorUserId: "s1",
  body: "Your tasting is booked for Saturday.",
  customerReadAt: null,
  staffReadAt: null,
  createdAt: new Date("2026-09-15T10:00:00.000Z"),
};

const entry = (id: string, kind: string, text: string) => ({
  id,
  kind,
  label: kind,
  text,
  status: "TODO",
  statusLabel: "Sent to the team",
  createdAt: "2026-09-14T10:00:00.000Z",
});

const REQUESTS = [
  entry("t_pk", "PACKAGES", "Please add to my booking: • Decor (₹90,000). App estimate for 300 guests: ₹1,20,000"),
  entry("t_rd", "REDEEM", "Use 500 of 1,200 loyalty points: towards decor"),
  entry("t_msg", "MESSAGE", "Can we visit on Sunday?"),
];

const requestIds = (c: { requests: { id: string }[] }) => c.requests.map((r) => r.id);

function signedIn(user: { id: string; role: string; perms?: string[] }) {
  authMock.mockResolvedValue({ user: { name: "Test User", ...user } });
}

function asHost() {
  signedIn({ id: "u_host", role: "CLIENT" });
  verifiedContacts.mockResolvedValue(["c_host"]);
  db.booking.findMany.mockResolvedValue([booking]);
}

function asInvited(role: "CO_HOST" | "VIEWER") {
  signedIn({ id: "u_invited", role: "CLIENT" });
  db.bookingCollaborator.findMany.mockResolvedValue([{ bookingId: "b1", role }]);
  db.booking.findMany.mockResolvedValue([booking]);
}

function asStaff(role: string, perms?: string[]) {
  signedIn({ id: "u_staff", role, ...(perms ? { perms } : {}) });
}

beforeEach(() => {
  vi.clearAllMocks();
  verifiedContacts.mockResolvedValue([]);
  db.bookingCollaborator.findMany.mockResolvedValue([]);
  db.bookingCollaborator.count.mockResolvedValue(0);
  db.booking.findMany.mockResolvedValue([]);
  db.booking.findFirst.mockResolvedValue(booking);
  db.notification.findMany.mockResolvedValue([]);
  server.findThread.mockResolvedValue({ thread, attachBooking: false });
  server.loadMessages.mockResolvedValue([teamMessage]);
  server.loadPeople.mockResolvedValue(new Map([["s1", { name: "Arjun Mehta", email: "arjun@veloria.test" }]]));
  server.loadRequestEntries.mockResolvedValue(REQUESTS);
  server.resolveTeamOwner.mockResolvedValue("s1");
  server.markReadBy.mockResolvedValue(1);
});

describe("an invited viewer", () => {
  it("can't read the conversation: nothing of it is loaded", async () => {
    asInvited("VIEWER");
    const conv = await getMyConversation("b1");
    expect(conv).toMatchObject({
      state: "NO_ACCESS",
      access: "VIEWER",
      canSend: false,
      threadId: null,
      coordinator: null,
      messages: [],
      requests: [],
    });
    expect(server.findThread).not.toHaveBeenCalled();
    expect(server.loadMessages).not.toHaveBeenCalled();
    expect(server.loadRequestEntries).not.toHaveBeenCalled();
    expect(server.loadPeople).not.toHaveBeenCalled();
  });

  it("can't write to it or mark it as read", async () => {
    asInvited("VIEWER");
    expect((await sendConciergeMessage({ bookingId: "b1", body: "Hello" })).success).toBe(false);
    expect(server.writeCustomerMessage).not.toHaveBeenCalled();
    db.conciergeThread.findUnique.mockResolvedValue({ id: "th1", contactId: "c_host", bookingId: "b1" });
    expect(await markConciergeRead("th1")).toEqual({ success: false, error: "Not found." });
    expect(server.markReadBy).not.toHaveBeenCalled();
  });
});

describe("an invited co-host", () => {
  it("reads the booking's conversation but never the host's requests", async () => {
    asInvited("CO_HOST");
    const conv = await getMyConversation("b1");
    expect(conv).toMatchObject({ state: "READY", access: "CO_HOST", canSend: true, threadId: "th1", requests: [] });
    expect(conv.messages.map((m) => m.body)).toEqual(["Your tasting is booked for Saturday."]);
    expect(server.findThread).toHaveBeenCalledWith(expect.objectContaining({ bookingId: "b1", bookingOnly: true }));
    expect(server.loadRequestEntries).not.toHaveBeenCalled();
  });

  it("still marks the team's messages as seen", async () => {
    asInvited("CO_HOST");
    db.conciergeThread.findUnique.mockResolvedValue({ id: "th1", contactId: "c_host", bookingId: "b1" });
    expect(await markConciergeRead("th1")).toEqual({ success: true, data: { updated: 1 } });
  });
});

describe("the host", () => {
  it("sees every request on their booking", async () => {
    asHost();
    const conv = await getMyConversation("b1");
    expect(conv).toMatchObject({ state: "READY", access: "HOST", canSend: true });
    expect(requestIds(conv)).toEqual(["t_pk", "t_rd", "t_msg"]);
  });

  it("is told how many co-hosts share the conversation, not viewers", async () => {
    asHost();
    db.bookingCollaborator.count.mockResolvedValue(2);
    expect((await getMyConversation("b1")).sharedWith).toBe(2);
    expect(db.bookingCollaborator.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ bookingId: "b1", status: "ACTIVE", role: "CO_HOST" }),
    });
  });
});

describe("a staff preview", () => {
  it("sees points requests only with loyalty:read, and package requests only with packages:read and tasks:read", async () => {
    asStaff("SALES_EXEC", ["bookings:read"]);
    const bare = await getMyConversation("b1");
    expect(bare).toMatchObject({ state: "READY", access: "PREVIEW", preview: true, canSend: false });
    expect(requestIds(bare)).toEqual(["t_msg"]);

    asStaff("SALES_EXEC", ["bookings:read", "loyalty:read"]);
    expect(requestIds(await getMyConversation("b1"))).toEqual(["t_rd", "t_msg"]);

    asStaff("SALES_EXEC", ["bookings:read", "packages:read"]);
    expect(requestIds(await getMyConversation("b1"))).toEqual(["t_msg"]);

    asStaff("SALES_EXEC", ["bookings:read", "packages:read", "tasks:read"]);
    expect(requestIds(await getMyConversation("b1"))).toEqual(["t_pk", "t_msg"]);
  });

  it("keeps the admin bypass", async () => {
    asStaff("ADMIN", ["*"]);
    expect(requestIds(await getMyConversation("b1"))).toEqual(["t_pk", "t_rd", "t_msg"]);
  });

  it("gets nothing once bookings:read is revoked in role settings, even for a booking asked for by id", async () => {
    asStaff("SALES_EXEC", ["loyalty:read", "packages:read", "tasks:read"]);
    const conv = await getMyConversation("b1");
    expect(conv).toMatchObject({ preview: false, state: "UNLINKED", booking: null, messages: [], requests: [] });
    expect(server.findThread).not.toHaveBeenCalled();
    expect(db.booking.findFirst).not.toHaveBeenCalled();
  });

  it("can never send", async () => {
    asStaff("ADMIN", ["*"]);
    expect((await sendConciergeMessage({ bookingId: "b1", body: "Hi" })).success).toBe(false);
    expect(server.writeCustomerMessage).not.toHaveBeenCalled();
  });
});

describe("the customer app's notifications", () => {
  it("show a team login only the notices sent to it as a customer, whatever its permissions", async () => {
    asStaff("SALES_EXEC", []);
    await getMyNotifications();
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u_staff", metadata: { path: ["audience"], equals: "CUSTOMER" } } })
    );
  });

  it("show a customer all of their own notices", async () => {
    asHost();
    await getMyNotifications();
    expect(db.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u_host" } }));
  });
});
