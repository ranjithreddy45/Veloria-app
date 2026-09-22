import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

// A sales rep must be able to bill and ask for the advance, because a slot only
// confirms once 20% is in — but must NOT be able to record money as received,
// which would let them certify their own advance and confirm their own booking.
describe("sales billing permissions", () => {
  for (const role of ["SALES_EXEC", "SALES_HEAD"]) {
    it(`${role} can raise and send an invoice and ask for payment`, () => {
      expect(hasPermission(role, "invoices:create")).toBe(true);
      expect(hasPermission(role, "invoices:send")).toBe(true);
      expect(hasPermission(role, "payments:link")).toBe(true);
    });

    it(`${role} cannot record money as received, refund or cancel it`, () => {
      expect(hasPermission(role, "payments:create")).toBe(false);
      expect(hasPermission(role, "payments:update")).toBe(false);
      expect(hasPermission(role, "payments:refund")).toBe(false);
      expect(hasPermission(role, "invoices:cancel")).toBe(false);
    });
  }

  it("finance keeps recording money, and can also raise links", () => {
    expect(hasPermission("FINANCE", "payments:create")).toBe(true);
    expect(hasPermission("FINANCE", "invoices:create")).toBe(true);
  });

  it("admin still has everything", () => {
    expect(hasPermission("ADMIN", "payments:link")).toBe(true);
    expect(hasPermission("ADMIN", "payments:create")).toBe(true);
  });

  it("a role with no billing rights gains nothing", () => {
    expect(hasPermission("STAFF", "invoices:create")).toBe(false);
    expect(hasPermission("STAFF", "payments:link")).toBe(false);
  });
});
