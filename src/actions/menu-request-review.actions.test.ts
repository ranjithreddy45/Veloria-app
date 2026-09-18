import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Team decisions on a customer's menu request reach the booking's own
// customer only: the request, the resulting menu and the team's note are
// private to the host, so the notice is HOST_ONLY and never goes to the
// people the host invited. Auth, Prisma and delivery are mocked; the menu
// rules are real.
// ============================================================

const { authMock, db, notifyCustomer } = vi.hoisted(() => {
  const table = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  });
  return {
    authMock: vi.fn(),
    notifyCustomer: vi.fn(),
    db: {
      menuSelectionRequest: table(),
      booking: table(),
      salesQuotation: table(),
      menuItem: table(),
      bookingMenu: table(),
      bookingMenuSelection: table(),
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/customer-notify", () => ({ notifyCustomer }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { acceptMenuRequest, declineMenuRequest } from "./menu-request-review.actions";

const COORDINATOR = { id: "s1", role: "EVENT_COORDINATOR", perms: ["menu:read", "menu:update", "bookings:read", "bookings:update"] };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: COORDINATOR });
  notifyCustomer.mockResolvedValue(1);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.menuSelectionRequest.updateMany.mockResolvedValue({ count: 1 });
});

describe("menu request decisions", () => {
  it("tell only the booking's own customer when the team accepts", async () => {
    db.menuSelectionRequest.findUnique.mockResolvedValue({
      id: "r1",
      bookingId: "b1",
      contactId: "c_host",
      status: "SUBMITTED",
      items: [{ menuItemId: "d1", quantity: 1 }],
      notes: null,
    });
    db.booking.findUnique.mockResolvedValue({ id: "b1", eventName: "Reception", guestCount: 120, status: "CONFIRMED" });
    db.menuItem.findMany.mockResolvedValue([
      { id: "d1", name: "Paneer tikka", category: "Starters", cuisine: "North Indian", dietaryTags: ["VEG"], pricePerHead: 250, isActive: true },
    ]);
    db.salesQuotation.findFirst.mockResolvedValue(null);
    db.bookingMenu.findUnique.mockResolvedValue(null);
    db.bookingMenu.create.mockResolvedValue({ id: "m1" });

    const res = await acceptMenuRequest("r1", "Chef will plate it family style.");
    expect(res.success).toBe(true);
    expect(notifyCustomer).toHaveBeenCalledTimes(1);
    expect(notifyCustomer).toHaveBeenCalledWith(expect.objectContaining({ contactId: "c_host", bookingId: "b1", audience: "HOST_ONLY" }));
  });

  it("tell only the booking's own customer when the team declines, with the team's note", async () => {
    db.menuSelectionRequest.findUnique.mockResolvedValue({ id: "r1", bookingId: "b1", contactId: "c_host", status: "SUBMITTED" });
    db.booking.findUnique.mockResolvedValue({ id: "b1", eventName: "Reception" });

    const res = await declineMenuRequest("r1", "Two of these dishes are seasonal and unavailable in December.");
    expect(res).toEqual({ success: true, data: { status: "DECLINED" } });
    expect(notifyCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: "c_host", bookingId: "b1", audience: "HOST_ONLY", message: expect.stringContaining("seasonal") })
    );
  });

  it("are refused, and nobody is told, when menu:update was revoked in role settings", async () => {
    authMock.mockResolvedValue({ user: { ...COORDINATOR, perms: ["menu:read", "bookings:read", "bookings:update"] } });
    expect(await declineMenuRequest("r1", "Not available")).toEqual({ success: false, error: "Insufficient permissions" });
    expect(notifyCustomer).not.toHaveBeenCalled();
  });
});
