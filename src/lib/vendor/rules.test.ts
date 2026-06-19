import { describe, it, expect } from "vitest";
import {
  validateVendorFields,
  validateItem,
  activationUnmet,
  type VendorPackageInput,
} from "./rules";

// ============================================================
// Vendor Module rule tests — at least one NEGATIVE test per pure rule
// (R1, R4, R6) plus the R5 activation gate. DB-dependent rules (R2 unique
// name, R3 category membership, R7/R8 cover, R10 soft-delete, R11 reorder)
// are enforced in the actions against the DB and not covered here.
// ============================================================

const pkg = (over: Partial<VendorPackageInput> = {}): VendorPackageInput => ({
  vendorId: "v1",
  name: "Veg Silver Package",
  category: "catering",
  price: 950,
  priceUnit: "PER_PLATE",
  sections: [
    { title: "Welcome", items: [{ name: "Welcome Juice", type: "SINGLE_CHOICE", options: ["Watermelon", "Grape"] }] },
  ],
  ...over,
});

describe("R1 — vendor needs ≥ 1 category", () => {
  it("rejects zero categories", () => {
    const f = validateVendorFields({ name: "Spice Route", categories: [] });
    expect(f.categories).toBeTruthy();
  });
  it("rejects unknown category keys (filtered out → zero)", () => {
    const f = validateVendorFields({ name: "Spice Route", categories: ["not_a_real_key"] });
    expect(f.categories).toBeTruthy();
  });
  it("accepts a valid category", () => {
    const f = validateVendorFields({ name: "Spice Route", categories: ["catering"] });
    expect(f.categories).toBeUndefined();
  });
  it("rejects a blank name", () => {
    const f = validateVendorFields({ name: "  ", categories: ["catering"] });
    expect(f.name).toBeTruthy();
  });
  it("rejects a malformed email", () => {
    const f = validateVendorFields({ name: "Spice Route", categories: ["catering"], email: "nope" });
    expect(f.email).toBeTruthy();
  });
});

describe("R4 — item options by type", () => {
  it("single_choice with no options is rejected", () => {
    expect(validateItem({ name: "Juice", type: "SINGLE_CHOICE", options: [] })).toBeTruthy();
  });
  it("single_choice with blank-only options is rejected", () => {
    expect(validateItem({ name: "Juice", type: "SINGLE_CHOICE", options: ["", "  "] })).toBeTruthy();
  });
  it("single_choice with ≥1 option passes", () => {
    expect(validateItem({ name: "Juice", type: "SINGLE_CHOICE", options: ["Watermelon"] })).toBeNull();
  });
  it("multi_choice with chooseCount > options is rejected", () => {
    expect(validateItem({ name: "Starters", type: "MULTI_CHOICE", options: ["A", "B"], chooseCount: 3 })).toBeTruthy();
  });
  it("multi_choice with chooseCount < 1 is rejected", () => {
    expect(validateItem({ name: "Starters", type: "MULTI_CHOICE", options: ["A", "B", "C"], chooseCount: 0 })).toBeTruthy();
  });
  it("multi_choice pick 3 of 5 passes", () => {
    expect(validateItem({ name: "Starters", type: "MULTI_CHOICE", options: ["A", "B", "C", "D", "E"], chooseCount: 3 })).toBeNull();
  });
  it("fixed ignores options and passes", () => {
    expect(validateItem({ name: "Mineral water", type: "FIXED", options: [] })).toBeNull();
  });
  it("unknown type is rejected", () => {
    expect(validateItem({ name: "X", type: "WHATEVER" })).toBeTruthy();
  });
  it("blank item name is rejected", () => {
    expect(validateItem({ name: " ", type: "FIXED" })).toBeTruthy();
  });
});

describe("R5/R6 — activation gate", () => {
  it("a complete package has no unmet conditions", () => {
    expect(activationUnmet(pkg())).toEqual([]);
  });
  it("R6 — negative price is unmet", () => {
    expect(activationUnmet(pkg({ price: -1 }))).toContain("price must be ≥ 0");
  });
  it("no sections/items is unmet", () => {
    expect(activationUnmet(pkg({ sections: [] }))).toContain("needs at least one item");
  });
  it("empty section (no items) is unmet", () => {
    expect(activationUnmet(pkg({ sections: [{ title: "Welcome", items: [] }] }))).toContain("needs at least one item");
  });
  it("missing name is unmet", () => {
    expect(activationUnmet(pkg({ name: "" }))).toContain("needs a name");
  });
  it("invalid price unit is unmet", () => {
    expect(activationUnmet(pkg({ priceUnit: "PER_LIGHTYEAR" }))).toContain("needs a valid price unit");
  });
  it("a malformed item bubbles its R4 error into unmet", () => {
    const bad = pkg({ sections: [{ title: "Welcome", items: [{ name: "Juice", type: "SINGLE_CHOICE", options: [] }] }] });
    expect(activationUnmet(bad).length).toBeGreaterThan(0);
  });
});
