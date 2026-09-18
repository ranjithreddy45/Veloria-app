import { describe, it, expect } from "vitest";
import { computeQuotation } from "@/lib/sales/quotation-calc";
import {
  CUSTOMER_NOTES_HEADING,
  MENU_REQUEST_LIMITS,
  MENU_REQUEST_STATUSES,
  NO_PACKAGE_RULES,
  SPECIAL_INSTRUCTIONS_MAX,
  cleanMenuNotes,
  computeMenuPricing,
  eventDateHasPassed,
  groupByMenuCategory,
  isNonVegetarian,
  isOpenMenuRequest,
  menuRequestTransition,
  menuTastingHref,
  mergeSpecialInstructions,
  packageAllows,
  packageRulesFromQuotation,
  parseStoredItems,
  reviewMenuRequest,
  selectionsToWrite,
  validateMenuSelection,
  type MenuCatalogEntry,
  type MenuPricingLine,
  type MenuRequestAction,
  type MenuRequestActor,
} from "./menu-rules";

const dish = (id: string, over: Partial<MenuCatalogEntry> = {}): MenuCatalogEntry => ({
  id, name: id, category: "Starters", cuisine: null, dietaryTags: [], pricePerHead: 100, isActive: true, ...over,
});

const catalog = new Map<string, MenuCatalogEntry>([
  ["paneer", dish("paneer", { name: "Paneer Tikka", dietaryTags: ["Vegetarian"], pricePerHead: 120 })],
  ["chicken", dish("chicken", { name: "Chicken 65", dietaryTags: ["Non-Vegetarian"], pricePerHead: 150 })],
  ["gulab", dish("gulab", { name: "Gulab Jamun", category: "Desserts", pricePerHead: 40 })],
  ["old", dish("old", { name: "Old Dish", isActive: false })],
]);

const vegGold = packageRulesFromQuotation({ foodPackageId: "veg_gold" });

describe("menu request status transitions", () => {
  it("SUBMITTED moves to ACCEPTED or DECLINED by the team, WITHDRAWN by the customer", () => {
    expect(menuRequestTransition("SUBMITTED", "ACCEPT", "TEAM")).toEqual({ ok: true, from: "SUBMITTED", to: "ACCEPTED" });
    expect(menuRequestTransition("SUBMITTED", "DECLINE", "TEAM")).toEqual({ ok: true, from: "SUBMITTED", to: "DECLINED" });
    expect(menuRequestTransition("SUBMITTED", "WITHDRAW", "CUSTOMER")).toEqual({ ok: true, from: "SUBMITTED", to: "WITHDRAWN" });
  });

  it("allows nothing else, for any status, action and actor", () => {
    const actions: MenuRequestAction[] = ["ACCEPT", "DECLINE", "WITHDRAW"];
    const actors: MenuRequestActor[] = ["TEAM", "CUSTOMER"];
    for (const status of [...MENU_REQUEST_STATUSES, "UNKNOWN"]) {
      for (const action of actions) {
        for (const actor of actors) {
          const rightActor = action === "WITHDRAW" ? actor === "CUSTOMER" : actor === "TEAM";
          expect(menuRequestTransition(status, action, actor).ok).toBe(status === "SUBMITTED" && rightActor);
        }
      }
    }
  });

  it("explains why a closed request can't change", () => {
    expect(menuRequestTransition("ACCEPTED", "WITHDRAW", "CUSTOMER")).toEqual({ ok: false, error: "This menu request has already been accepted." });
    expect(menuRequestTransition("WITHDRAWN", "ACCEPT", "TEAM")).toEqual({ ok: false, error: "This menu request was withdrawn." });
    expect(menuRequestTransition("SUBMITTED", "ACCEPT", "CUSTOMER")).toMatchObject({ ok: false });
    expect(isOpenMenuRequest("SUBMITTED")).toBe(true);
    for (const s of ["ACCEPTED", "DECLINED", "WITHDRAWN"]) expect(isOpenMenuRequest(s)).toBe(false);
  });
});

describe("package rules come from the booking's quotation", () => {
  it("a vegetarian food package sets veg-only, priced per plate by the quote engine", () => {
    expect(vegGold).toEqual({ packageId: "veg_gold", packageLabel: "Veg Gold package", perPlate: 699, vegOnly: true, foodMode: "WITH_FOOD" });
    expect(vegGold.perPlate).toBe(computeQuotation({ guestCount: 1, foodPackageId: "veg_gold" }).subtotal);
  });
  it("uses a negotiated per-plate price when the quotation has one", () => {
    expect(packageRulesFromQuotation({ foodPackageId: "nonveg_classic", foodPerPlateOverride: 850 })).toMatchObject({ perPlate: 850, vegOnly: false });
  });
  it("hall-only, unknown and missing quotations carry no package", () => {
    expect(packageRulesFromQuotation({ foodMode: "HALL_ONLY", foodPackageId: "veg_gold" })).toEqual({ ...NO_PACKAGE_RULES, foodMode: "HALL_ONLY" });
    expect(packageRulesFromQuotation({ foodPackageId: "retired_package" })).toEqual({ ...NO_PACKAGE_RULES, foodMode: "WITH_FOOD" });
    for (const junk of [null, undefined, "x", [], 42]) expect(packageRulesFromQuotation(junk)).toEqual(NO_PACKAGE_RULES);
  });
  it("recognises the team's non-vegetarian tag however it is spelled", () => {
    for (const t of ["Non-Vegetarian", "non vegetarian", "NON_VEGETARIAN"]) expect(isNonVegetarian([t])).toBe(true);
    expect(isNonVegetarian(["Vegetarian", "Jain"])).toBe(false);
    expect(packageAllows(catalog.get("chicken")!, vegGold)).toBe(false);
    expect(packageAllows(catalog.get("gulab")!, vegGold)).toBe(true);
    expect(packageAllows(catalog.get("chicken")!, NO_PACKAGE_RULES)).toBe(true);
  });
});

describe("validateMenuSelection", () => {
  it("normalises valid picks: quantity defaults to 1, notes are trimmed or dropped", () => {
    const r = validateMenuSelection([{ menuItemId: "paneer", note: "  less spicy " }, { menuItemId: "gulab", quantity: 2, note: "   " }], catalog, vegGold);
    expect(r).toEqual({ ok: true, items: [{ menuItemId: "paneer", quantity: 1, note: "less spicy" }, { menuItemId: "gulab", quantity: 2 }] });
  });

  it("needs at least one dish and caps the request size", () => {
    expect(validateMenuSelection([], catalog, NO_PACKAGE_RULES)).toEqual({ ok: false, errors: ["Pick at least one dish."] });
    expect(validateMenuSelection("paneer", catalog, NO_PACKAGE_RULES).ok).toBe(false);
    const tooMany = Array.from({ length: MENU_REQUEST_LIMITS.maxItems + 1 }, (_, i) => ({ menuItemId: `d${i}` }));
    expect(validateMenuSelection(tooMany, catalog, NO_PACKAGE_RULES).ok).toBe(false);
  });

  it("rejects unknown, inactive, duplicate and malformed dishes", () => {
    const r = validateMenuSelection([{ menuItemId: "nope" }, { menuItemId: "old" }, { menuItemId: "paneer" }, { menuItemId: "paneer" }, null, {}], catalog, NO_PACKAGE_RULES);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain("A dish you picked is no longer on the menu.");
      expect(r.errors).toContain('"Old Dish" is no longer on the menu.');
      expect(r.errors).toContain('"Paneer Tikka" is in your selection more than once.');
      expect(r.errors.filter((e) => e.includes("couldn't be read"))).toHaveLength(2);
    }
  });

  it("enforces a vegetarian package, and only when one applies", () => {
    const r = validateMenuSelection([{ menuItemId: "chicken" }], catalog, vegGold);
    expect(r).toEqual({ ok: false, errors: ['"Chicken 65" isn\'t vegetarian, and Veg Gold package is a vegetarian package.'] });
    expect(validateMenuSelection([{ menuItemId: "chicken" }], catalog, NO_PACKAGE_RULES).ok).toBe(true);
  });

  it("bounds quantity and note length", () => {
    for (const quantity of [0, 1.5, MENU_REQUEST_LIMITS.maxQuantity + 1, "2"]) {
      expect(validateMenuSelection([{ menuItemId: "paneer", quantity }], catalog, NO_PACKAGE_RULES).ok).toBe(false);
    }
    expect(validateMenuSelection([{ menuItemId: "paneer", quantity: MENU_REQUEST_LIMITS.maxQuantity }], catalog, NO_PACKAGE_RULES).ok).toBe(true);
    expect(validateMenuSelection([{ menuItemId: "paneer", note: "x".repeat(MENU_REQUEST_LIMITS.maxItemNote + 1) }], catalog, NO_PACKAGE_RULES).ok).toBe(false);
  });

  it("cleans overall notes", () => {
    expect(cleanMenuNotes(undefined)).toEqual({ ok: true, value: null });
    expect(cleanMenuNotes("   ")).toEqual({ ok: true, value: null });
    expect(cleanMenuNotes(" Jain food for 10 ")).toEqual({ ok: true, value: "Jain food for 10" });
    expect(cleanMenuNotes("x".repeat(MENU_REQUEST_LIMITS.maxNotes + 1)).ok).toBe(false);
    expect(cleanMenuNotes(7).ok).toBe(false);
  });

  it("reads stored items back defensively", () => {
    expect(parseStoredItems([{ menuItemId: "a", quantity: 3, note: " hot " }, { menuItemId: "b", quantity: -1 }, { quantity: 2 }, "x"])).toEqual([
      { menuItemId: "a", quantity: 3, note: "hot" },
      { menuItemId: "b", quantity: 1 },
    ]);
    expect(parseStoredItems({})).toEqual([]);
  });
});

describe("computeMenuPricing matches the team's booking-menu rule", () => {
  // The menu builder / saveBookingMenu arithmetic, written out as the oracle.
  const builder = (lines: MenuPricingLine[], guests: number) => {
    const pricePerHead = lines.reduce((sum, l) => sum + (l.customPrice ?? l.pricePerHead) * l.quantity, 0);
    return { pricePerHead, totalPrice: pricePerHead * guests };
  };

  it("per head = Σ (customPrice ?? pricePerHead) × quantity; total = per head × guests", () => {
    const cases: [MenuPricingLine[], number][] = [
      [[{ pricePerHead: 120, quantity: 1 }, { pricePerHead: 40, quantity: 2 }], 150],
      [[{ pricePerHead: 120, quantity: 1, customPrice: 95 }, { pricePerHead: 150, quantity: 1, customPrice: null }], 300],
      [[], 100],
    ];
    for (const [lines, guests] of cases) {
      const ours = computeMenuPricing(lines, guests);
      const team = builder(lines, guests);
      expect(ours.pricePerHead).toBeCloseTo(team.pricePerHead, 2);
      expect(ours.totalPrice).toBeCloseTo(team.totalPrice, 2);
      expect(ours.guestCount).toBe(guests);
    }
  });

  it("keeps money to the paise, like the Decimal(12,2) columns", () => {
    expect(computeMenuPricing([{ pricePerHead: 0.1, quantity: 1 }, { pricePerHead: 0.2, quantity: 1 }], 3)).toEqual({ pricePerHead: 0.3, guestCount: 3, totalPrice: 0.9 });
    expect(computeMenuPricing([{ pricePerHead: 33.33, quantity: 1 }], 3).totalPrice).toBe(99.99);
    expect(computeMenuPricing([{ pricePerHead: 10, quantity: 1 }], -5).totalPrice).toBe(0);
  });
});

describe("the team's review of a request", () => {
  const stored = [{ menuItemId: "paneer", quantity: 1 }, { menuItemId: "chicken", quantity: 2, note: "mild" }, { menuItemId: "old", quantity: 1 }, { menuItemId: "gone", quantity: 1 }];

  it("blocks unavailable dishes, warns on package rules, and prices only what can be written", () => {
    const r = reviewMenuRequest(stored, catalog, new Map([["paneer", 100]]), vegGold, 200);
    expect(r.blockers).toEqual(['"Old Dish" is inactive in the menu catalog.', "A dish in this request no longer exists in the menu catalog."]);
    expect(r.warnings).toEqual(['"Chicken 65" is non-vegetarian, but the booking\'s quoted package (Veg Gold package) is vegetarian.']);
    // paneer at its negotiated 100 + chicken 150 × 2 = 400 per head.
    expect(r.pricing).toEqual({ pricePerHead: 400, guestCount: 200, totalPrice: 80_000 });
    expect(r.items.find((i) => i.menuItemId === "gone")).toMatchObject({ name: "Removed dish", available: false, pricePerHead: null });
  });

  it("a clean request has no blockers and an empty one can't be accepted", () => {
    expect(reviewMenuRequest([{ menuItemId: "paneer", quantity: 1 }], catalog, new Map(), vegGold, 50).blockers).toEqual([]);
    expect(reviewMenuRequest([], catalog, new Map(), NO_PACKAGE_RULES, 50).blockers).toEqual(["This request has no dishes."]);
  });

  it("writes selections in the host's order and keeps negotiated prices", () => {
    expect(selectionsToWrite([{ menuItemId: "gulab", quantity: 2 }, { menuItemId: "paneer", quantity: 1 }], new Map([["paneer", 95]]))).toEqual([
      { menuItemId: "gulab", quantity: 2, customPrice: null, order: 0 },
      { menuItemId: "paneer", quantity: 1, customPrice: 95, order: 1 },
    ]);
  });
});

describe("mergeSpecialInstructions", () => {
  it("keeps the team's text and adds the customer's notes under a heading", () => {
    const out = mergeSpecialInstructions("Serve starters by 7pm.", "Two guests are Jain.", [{ name: "Paneer Tikka", note: "less spicy" }]);
    expect(out).toBe(`Serve starters by 7pm.\n\n${CUSTOMER_NOTES_HEADING}\nTwo guests are Jain.\n• Paneer Tikka: less spicy`);
  });
  it("replaces an earlier customer block instead of stacking it", () => {
    const first = mergeSpecialInstructions("Team note.", "Old request note.", []);
    expect(mergeSpecialInstructions(first, "New note.", [])).toBe(`Team note.\n\n${CUSTOMER_NOTES_HEADING}\nNew note.`);
    expect(mergeSpecialInstructions(first, null, [])).toBe("Team note.");
    expect(mergeSpecialInstructions(null, null, [])).toBeNull();
  });
  it("stays within the menu form's limit", () => {
    expect(mergeSpecialInstructions("x".repeat(SPECIAL_INSTRUCTIONS_MAX), "note", [])!.length).toBe(SPECIAL_INSTRUCTIONS_MAX);
  });
});

describe("helpers", () => {
  it("links a menu tasting at the booking's hall on the public visit page", () => {
    expect(menuTastingHref("venue_1")).toBe("/visit?kind=MENU_TASTING&venue=venue_1");
    expect(menuTastingHref(null)).toBe("/visit?kind=MENU_TASTING");
  });
  it("judges a past event on the Indian calendar", () => {
    const eventDay = new Date("2026-09-15T00:00:00.000Z"); // a @db.Date value
    expect(eventDateHasPassed(eventDay, new Date("2026-09-15T12:00:00.000Z"))).toBe(false);
    expect(eventDateHasPassed(eventDay, new Date("2026-09-15T20:00:00.000Z"))).toBe(true); // 16 Sep, 1:30 am IST
    expect(eventDateHasPassed("2026-09-20T00:00:00.000Z", new Date("2026-09-16T05:00:00.000Z"))).toBe(false);
  });
  it("orders menu categories the way the team's menu does", () => {
    const groups = groupByMenuCategory([
      { name: "Gulab Jamun", category: "Desserts" },
      { name: "Tikka", category: "Starters" },
      { name: "Aloo Tikki", category: "Starters" },
      { name: "Mocktail", category: "Signature" },
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Starters", "Desserts", "Signature"]);
    expect(groups[0].rows.map((r) => r.name)).toEqual(["Aloo Tikki", "Tikka"]);
  });
});
