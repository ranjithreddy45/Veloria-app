import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Money and documents in staff preview follow the team's EFFECTIVE
// permissions: a section whose team permission was revoked in Settings →
// Roles is left out and never read, and admins keep the bypass. Auth and
// Prisma are mocked; getHostScope and the money rules are real.
// ============================================================

const { authMock, db } = vi.hoisted(() => ({
  authMock: vi.fn(),
  db: {
    bookingCollaborator: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), findFirst: vi.fn() },
    invoice: { findMany: vi.fn() },
    signatureRequest: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    salesQuotation: { findMany: vi.fn() },
    quoteShareLink: { findMany: vi.fn() },
  },
}));

vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/portal-identity", () => ({ getVerifiedContactIds: async () => [] }));
vi.mock("@/actions/payment.actions", () => ({ getPublicInvoiceForPayment: vi.fn() }));

import { getGuestDocumentsScreen, getGuestPaymentsScreen } from "./guest-payments.actions";

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

function signIn(role: string, perms?: string[]) {
  authMock.mockResolvedValue({ user: { id: "u_staff", name: "Team member", role, ...(perms ? { perms } : {}) } });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.bookingCollaborator.findMany.mockResolvedValue([]);
  db.booking.findMany.mockResolvedValue([]);
  db.booking.findFirst.mockResolvedValue(BOOKING);
  db.invoice.findMany.mockResolvedValue([]);
  db.signatureRequest.findMany.mockResolvedValue([]);
  db.contract.findMany.mockResolvedValue([]);
  db.salesQuotation.findMany.mockResolvedValue([]);
  db.quoteShareLink.findMany.mockResolvedValue([]);
});

describe("the payments screen in staff preview", () => {
  it("hides invoices, instalments and receipts once payments:read is revoked in role settings, without reading them", async () => {
    signIn("FINANCE", ["bookings:read", "invoices:read"]);
    expect(await getGuestPaymentsScreen("b1")).toMatchObject({ preview: true, hiddenInPreview: true, invoices: [], receipts: [] });
    expect(db.invoice.findMany).not.toHaveBeenCalled();
  });

  it("shows them with invoices:read and payments:read in the session", async () => {
    signIn("FINANCE", ["bookings:read", "invoices:read", "payments:read"]);
    expect((await getGuestPaymentsScreen("b1"))?.hiddenInPreview).toBe(false);
    expect(db.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ bookingId: "b1" }, { status: { not: "DRAFT" } }] } })
    );
  });

  it("keeps the admin bypass", async () => {
    signIn("ADMIN", []);
    expect((await getGuestPaymentsScreen("b1"))?.hiddenInPreview).toBe(false);
  });

  it("shows nothing to a team member whose bookings:read was revoked", async () => {
    signIn("FINANCE", ["invoices:read", "payments:read"]);
    expect(await getGuestPaymentsScreen("b1")).toMatchObject({ preview: false, booking: null, invoices: [] });
    expect(db.booking.findFirst).not.toHaveBeenCalled();
    expect(db.invoice.findMany).not.toHaveBeenCalled();
  });
});

describe("the documents screen in staff preview", () => {
  it("leaves out every section whose team permission is missing from the session, without reading it", async () => {
    signIn("FINANCE", ["bookings:read", "payments:read"]);
    const screen = await getGuestDocumentsScreen("b1");
    expect([...(screen?.hiddenInPreview ?? [])].sort()).toEqual(["contracts", "invoices", "quotations", "receipts", "signatures"]);
    expect(screen).toMatchObject({ invoices: [], receipts: [], agreements: [], quotations: [] });
    expect(db.invoice.findMany).not.toHaveBeenCalled();
    expect(db.contract.findMany).not.toHaveBeenCalled();
    expect(db.signatureRequest.findMany).not.toHaveBeenCalled();
    expect(db.salesQuotation.findMany).not.toHaveBeenCalled();
  });
});
