import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// GET /api/guest/receipt/<paymentId> in staff preview: the download needs
// invoices:read and payments:read, by the viewer's EFFECTIVE permissions (a
// role override that revokes either refuses here too), and admins keep the
// bypass. Auth and Prisma are mocked; the access rules are real.
// ============================================================

const { authMock, db } = vi.hoisted(() => ({
  authMock: vi.fn(),
  db: {
    payment: { findUnique: vi.fn() },
    bookingCollaborator: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/portal-identity", () => ({ getVerifiedContactIds: async () => [] }));
vi.mock("../customer-documents", () => ({ renderReceiptHtml: () => "<html>receipt</html>" }));

import { GET } from "./route";

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

const PAYMENT = {
  id: "p1",
  amount: 50000,
  status: "COMPLETED",
  method: "UPI",
  receiptNumber: "RCPT-0007",
  paidAt: new Date("2026-09-10T00:00:00.000Z"),
  transactionId: "upi_123",
  invoice: {
    invoiceNumber: "INV-2026-0042",
    status: "PARTIALLY_PAID",
    totalAmount: 118000,
    paidAmount: 50000,
    balanceDue: 68000,
    bookingId: "b1",
    contactId: "c_host",
    contact: { firstName: "Priya", lastName: "Sharma" },
    booking: { bookingNumber: "VG-0001", eventName: "Reception", date: new Date("2027-01-10T00:00:00.000Z"), venue: { name: "Grand Hall" } },
  },
};

const download = () => GET(new Request("https://app.test/api/guest/receipt/p1"), { params: Promise.resolve({ paymentId: "p1" }) });

function signIn(role: string, perms?: string[]) {
  authMock.mockResolvedValue({ user: { id: "u_staff", name: "Team member", role, ...(perms ? { perms } : {}) } });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.payment.findUnique.mockResolvedValue(PAYMENT);
  db.bookingCollaborator.findMany.mockResolvedValue([]);
  db.booking.findMany.mockResolvedValue([]);
  db.booking.findFirst.mockResolvedValue(BOOKING);
});

describe("receipt download in staff preview", () => {
  it("is refused when payments:read was revoked in role settings", async () => {
    signIn("FINANCE", ["bookings:read", "invoices:read"]);
    expect((await download()).status).toBe(403);
  });

  it("is allowed with invoices:read and payments:read in the session", async () => {
    signIn("FINANCE", ["bookings:read", "invoices:read", "payments:read"]);
    const res = await download();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("receipt");
  });

  it("keeps the admin bypass", async () => {
    signIn("SUPER_ADMIN", ["*"]);
    expect((await download()).status).toBe(200);
  });
});
