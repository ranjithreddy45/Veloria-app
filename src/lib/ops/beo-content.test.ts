import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// The kitchen's menu (loadBookingMenu) and the function sheet built from it.
// Prisma is mocked, so this runs without a database. Pinned here: the booking's
// saved menu (what the team builds and accepted customer requests write) wins
// over the quotation; its dishes are costed the way the menu builder prices
// them; the quotation fallback is unchanged; and the run of show starts at the
// team's slot hours.
// ============================================================

const db = vi.hoisted(() => ({
  bookingMenu: { findUnique: vi.fn() },
  salesQuotation: { findFirst: vi.fn() },
  booking: { findUnique: vi.fn() },
  sOPTemplate: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));

import { SLOT_HOURS, TIME_SLOTS, slotScheduleStartMin } from "@/lib/sales/slot";
import {
  buildDefaultRunOfShow,
  composeBeoContent,
  kitchenMenuFromBookingMenu,
  loadBookingMenu,
  type SavedBookingMenu,
} from "./beo-content";

type Selection = SavedBookingMenu["selections"][number];

const dish = (
  name: string,
  category: string,
  pricePerHead: Selection["menuItem"]["pricePerHead"],
  quantity = 1,
  customPrice: Selection["customPrice"] = null
): Selection => ({ quantity, customPrice, menuItem: { name, category, pricePerHead } });

const savedMenu = (over: Partial<SavedBookingMenu> = {}): SavedBookingMenu => ({
  guestCount: 180,
  specialInstructions: null,
  selections: [
    dish("Paneer Tikka", "Starters", 120),
    dish("Gulab Jamun", "Desserts", 40, 2),
    dish("Dal Makhani", "Main Course", 150, 1, 130),
  ],
  ...over,
});

const quotation = {
  outputsJson: {
    lines: [
      { particulars: "Venue Rental", plan: "Grand Hall", amount: 50000 },
      { particulars: "Food Plan", plan: "Veg Platinum package (899 × 180)", amount: 161820 },
      { particulars: "Cake Plan", plan: "Black forest", amount: 3000 },
      { particulars: "Drinks Plan", plan: "—", amount: 0 },
      { particulars: "Decor Plan", plan: "Wedding Premium", amount: 75000 },
    ],
  },
  inputsJson: { cakeKg: 2 },
  guestCount: 180,
};

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

beforeEach(() => {
  for (const table of Object.values(db)) for (const fn of Object.values(table)) fn.mockReset();
  db.bookingMenu.findUnique.mockResolvedValue(null);
  db.salesQuotation.findFirst.mockResolvedValue(null);
  db.booking.findUnique.mockResolvedValue(null);
  db.sOPTemplate.findFirst.mockResolvedValue(null);
});

describe("loadBookingMenu", () => {
  it("prefers the booking's saved menu over the quotation", async () => {
    db.bookingMenu.findUnique.mockResolvedValue(savedMenu({ specialInstructions: "  Jain food for 20 guests.  " }));
    db.salesQuotation.findFirst.mockResolvedValue(quotation);

    const menu = await loadBookingMenu("bk1", 180);

    expect(menu?.source).toBe("booking_menu");
    expect(db.salesQuotation.findFirst).not.toHaveBeenCalled();
    expect(db.bookingMenu.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: "bk1" },
        select: expect.objectContaining({ selections: expect.objectContaining({ orderBy: { order: "asc" } }) }),
      })
    );
    expect(menu?.items).toEqual([
      { name: "Paneer Tikka", category: "Starters", quantity: 180, unit: "plate", estUnitCost: 120 },
      { name: "Gulab Jamun (×2 per guest)", category: "Desserts", quantity: 180, unit: "plate", estUnitCost: 80 },
      { name: "Dal Makhani", category: "Main Course", quantity: 180, unit: "plate", estUnitCost: 130 },
    ]);
    expect(menu?.menuNotes).toBe(
      [
        "Menu for 180 guests (from the booking's menu):",
        "• Starters: Paneer Tikka — 180 plate",
        "• Desserts: Gulab Jamun (×2 per guest) — 180 plate",
        "• Main Course: Dal Makhani — 180 plate",
        "",
        "Menu instructions:",
        "Jain food for 20 guests.",
      ].join("\n")
    );
  });

  it("costs the menu the way the menu builder prices it: per head = Σ (customPrice ?? pricePerHead) × quantity", async () => {
    const decimal = (v: string) => ({ toString: () => v }); // how Prisma Decimal columns arrive
    db.bookingMenu.findUnique.mockResolvedValue(
      savedMenu({
        guestCount: 150,
        selections: [
          dish("Veg Biryani", "Rice & Biryani", decimal("210.50")),
          dish("Raita", "Accompaniments", decimal("35.25"), 2, decimal("30.00")),
        ],
      })
    );

    const menu = await loadBookingMenu("bk1", 150);

    const menuBuilderPerHead = 210.5 * 1 + 30 * 2;
    expect(menu?.items.map((i) => i.estUnitCost)).toEqual([210.5, 60]);
    expect(menu?.estFoodCost).toBe(menuBuilderPerHead * 150);
  });

  it("sizes to the booking's guest count, else the menu's, and flags a menu priced for another count", async () => {
    db.bookingMenu.findUnique.mockResolvedValue(savedMenu());

    const grown = await loadBookingMenu("bk1", 200);
    expect(grown?.items.every((i) => i.quantity === 200)).toBe(true);
    expect(grown?.estFoodCost).toBe(200 * (120 + 80 + 130));
    expect(grown?.menuNotes).toContain("Note: the saved menu was priced for 180 guests; the booking now has 200.");

    const unset = await loadBookingMenu("bk1", 0);
    expect(unset?.items.every((i) => i.quantity === 180)).toBe(true);
    expect(unset?.menuNotes).not.toContain("Note:");
  });

  it("falls back to the quotation, as before, when there is no saved menu or it has no dishes", async () => {
    db.salesQuotation.findFirst.mockResolvedValue(quotation);
    const fromQuotation = {
      items: [
        { name: "Food: Veg Platinum package (899 × 180)", category: "Food", quantity: 180, unit: "plate", estUnitCost: 899 },
        { name: "Cake: Black forest", category: "Cake", quantity: 2, unit: "kg", estUnitCost: 1500 },
      ],
      estFoodCost: 164820,
      menuNotes:
        "Menu for 180 guests (from the customer's quotation):\n" +
        "• Food: Veg Platinum package (899 × 180) — 180 plate\n" +
        "• Cake: Black forest — 2 kg",
      source: "quotation",
    };

    expect(await loadBookingMenu("bk1", 180)).toEqual(fromQuotation);

    db.bookingMenu.findUnique.mockResolvedValue(savedMenu({ selections: [] }));
    expect(await loadBookingMenu("bk1", 180)).toEqual(fromQuotation);
    expect(db.salesQuotation.findFirst).toHaveBeenCalledWith({
      where: { bookingId: "bk1" },
      orderBy: { updatedAt: "desc" },
      select: { outputsJson: true, inputsJson: true, guestCount: true },
    });
  });

  it("returns null when neither has a menu, and never throws", async () => {
    expect(await loadBookingMenu("bk1", 180)).toBeNull();

    db.bookingMenu.findUnique.mockRejectedValue(new Error("database unavailable"));
    db.salesQuotation.findFirst.mockResolvedValue(quotation);
    expect(await loadBookingMenu("bk1", 180)).toBeNull();
  });
});

describe("kitchenMenuFromBookingMenu", () => {
  it("has no menu without dishes, and reads an unreadable stored value as zero cost and one serving", () => {
    expect(kitchenMenuFromBookingMenu(savedMenu({ selections: [] }), 100)).toBeNull();
    const odd = kitchenMenuFromBookingMenu(savedMenu({ selections: [dish("Soup", "Starters", "not a number", 0)] }), 100);
    expect(odd?.items).toEqual([{ name: "Soup", category: "Starters", quantity: 100, unit: "plate", estUnitCost: 0 }]);
    expect(odd?.estFoodCost).toBe(0);
  });
});

describe("composeBeoContent", () => {
  it("puts the booking's saved menu on the function sheet and welcomes guests at the slot's start", async () => {
    db.booking.findUnique.mockResolvedValue({ eventType: "Wedding", timeSlot: "EVENING", guestCount: 180 });
    db.bookingMenu.findUnique.mockResolvedValue(savedMenu());
    db.salesQuotation.findFirst.mockResolvedValue(quotation);

    const c = await composeBeoContent("bk1");

    expect(c.menuNotes).toBe((await loadBookingMenu("bk1", 180))?.menuNotes);
    expect(c.menuNotes).toContain("(from the booking's menu)");
    expect(c.decorNotes).toContain("Booked: Wedding Premium.");
    const arrival = c.runOfShow.find((r) => r.activity === "Guest arrival & welcome");
    expect(arrival?.time).toBe(hhmm(SLOT_HOURS.EVENING!.startMin));
  });
});

describe("buildDefaultRunOfShow", () => {
  it("welcomes guests at the slot's schedule start: the team's slot start whenever the slot has hours", () => {
    for (const slot of TIME_SLOTS) {
      const arrival = buildDefaultRunOfShow(slot).find((r) => r.activity === "Guest arrival & welcome");
      expect(arrival?.time, slot).toBe(hhmm(slotScheduleStartMin(slot)));
      const hours = SLOT_HOURS[slot];
      if (hours) expect(arrival?.time, slot).toBe(hhmm(hours.startMin));
    }
    expect(buildDefaultRunOfShow(null)).toEqual(buildDefaultRunOfShow("EVENING"));
  });
});
