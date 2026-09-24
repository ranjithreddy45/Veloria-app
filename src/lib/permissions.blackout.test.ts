import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

// Blocking a date used to require settings:venues, which ONLY super-admin held —
// so sales, coordinators and ops could not block a date at all, while that same
// permission also unlocks venue public info, customer content, business contact
// details and GST rates. bookings:blackout separates the two.
describe("who can block a date on the calendar", () => {
  const CAN = ["SUPER_ADMIN", "ADMIN", "EVENT_COORDINATOR", "SALES_EXEC", "SALES_HEAD", "OPERATIONS", "OPERATIONS_HEAD", "PROPERTY_MANAGER"];
  const CANNOT = ["STAFF", "CLIENT", "FINANCE", "BD_EXECUTIVE"];

  for (const role of CAN) {
    it(`${role} can block a date`, () => {
      expect(hasPermission(role, "bookings:blackout") || hasPermission(role, "settings:venues")).toBe(true);
    });
  }

  for (const role of CANNOT) {
    it(`${role} cannot block a date`, () => {
      expect(hasPermission(role, "bookings:blackout") || hasPermission(role, "settings:venues")).toBe(false);
    });
  }

  it("does NOT hand out venue settings with it", () => {
    for (const role of ["EVENT_COORDINATOR", "SALES_EXEC", "SALES_HEAD", "OPERATIONS"]) {
      expect(hasPermission(role, "settings:venues")).toBe(false);
    }
  });
});
