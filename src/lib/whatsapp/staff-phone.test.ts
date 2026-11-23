import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ user: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { findStaffByPhone } from "./staff-phone";

describe("findStaffByPhone", () => {
  beforeEach(() => vi.clearAllMocks());

  it("matches a staff profile number however either side is spelled", async () => {
    db.user.findMany.mockResolvedValue([{ id: "u1", name: "Asha", phone: "098000 00001" }]);
    expect(await findStaffByPhone("919800000001")).toEqual({ id: "u1", name: "Asha" });
    expect(db.user.findMany.mock.calls[0][0].where).toMatchObject({ isActive: true });
  });

  it("does not match a different number that only shares the tail", async () => {
    db.user.findMany.mockResolvedValue([{ id: "u1", name: "Asha", phone: "+91 7700000001" }]);
    expect(await findStaffByPhone("+919800000001")).toBeNull();
  });

  it("ignores junk and never throws", async () => {
    expect(await findStaffByPhone("123")).toBeNull();
    db.user.findMany.mockRejectedValue(new Error("db"));
    expect(await findStaffByPhone("+919800000001")).toBeNull();
  });
});
