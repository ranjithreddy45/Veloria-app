import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// GET /api/guest/invoice/<id> in staff preview: the download needs the
// invoices:read the team's invoice screen needs, by the viewer's EFFECTIVE
// permissions (a role override that revokes it refuses here too), and admins
// keep the bypass. Auth and Prisma are mocked; the access rules are real.
// ============================================================

const { authMock, db } = vi.hoisted(() => ({
  authMock: vi.fn(),
  db: {
    invoice: { findUnique: vi.fn() },
    bookingCollaborator: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/portal-identity", () => ({ getVerifiedContactIds: async () => [] }));
vi.mock("../../receipt/customer-documents", () => ({ renderInvoiceHtml: () => "<html>invoice</html>" }));

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

const INVOICE = {
  invoiceNumber: "INV-2026-0042",
  status: "SENT",
  issueDate: new Date("2026-09-01T00:00:00.000Z"),
  dueDate: new Date("2026-09-30T00:00:00.000Z"),
  subtotal: 100000,
  discountPercent: 0,
  discountAmount: 0,
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 0,
  cgstAmount: 9000,
  sgstAmount: 9000,
  igstAmount: 0,
  totalAmount: 118000,
  paidAmount: 0,
  balanceDue: 118000,
  notes: null,
  terms: null,
  gstin: null,
  placeOfSupply: null,
  sacCode: null,
  bookingId: "b1",
  contactId: "c_host",
  contact: { firstName: "Priya", lastName: "Sharma", company: null, address: null, city: null, state: null, pincode: null, email: null, phone: null },
  booking: { bookingNumber: "VG-0001", eventName: "Reception", eventType: "WEDDING", date: new Date("2027-01-10T00:00:00.000Z"), venue: { name: "Grand Hall" } },
  lineItems: [],
};

const download = () => GET(new Request("https://app.test/api/guest/invoice/i1"), { params: Promise.resolve({ invoiceId: "i1" }) });

function signIn(role: string, perms?: string[]) {
  authMock.mockResolvedValue({ user: { id: "u_staff", name: "Team member", role, ...(perms ? { perms } : {}) } });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.invoice.findUnique.mockResolvedValue(INVOICE);
  db.bookingCollaborator.findMany.mockResolvedValue([]);
  db.booking.findMany.mockResolvedValue([]);
  db.booking.findFirst.mockResolvedValue(BOOKING);
});

describe("invoice download in staff preview", () => {
  it("is refused when invoices:read was revoked in role settings", async () => {
    signIn("FINANCE", ["bookings:read", "payments:read"]);
    expect((await download()).status).toBe(403);
  });

  it("is allowed with invoices:read in the session", async () => {
    signIn("FINANCE", ["bookings:read", "invoices:read"]);
    const res = await download();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("invoice");
  });

  it("keeps the admin bypass", async () => {
    signIn("ADMIN", []);
    expect((await download()).status).toBe(200);
  });

  it("finds nothing for a team member whose bookings:read was revoked: there is no preview at all", async () => {
    signIn("FINANCE", ["invoices:read", "payments:read"]);
    expect((await download()).status).toBe(404);
    expect(db.booking.findFirst).not.toHaveBeenCalled();
  });
});
