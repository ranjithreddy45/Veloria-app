import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ user: { findFirst: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { getDefaultLeadOwnerId, resetDefaultLeadOwnerCache, DEFAULT_LEAD_OWNER_ENV } from "./default-lead-owner";

describe("getDefaultLeadOwnerId", () => {
  const saved = process.env[DEFAULT_LEAD_OWNER_ENV];
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultLeadOwnerCache();
    process.env[DEFAULT_LEAD_OWNER_ENV] = saved;
  });

  it("is the named person when they are active and can own leads", async () => {
    process.env[DEFAULT_LEAD_OWNER_ENV] = " Rajitha@Example.com ";
    db.user.findFirst.mockResolvedValueOnce({ id: "rajitha" });
    expect(await getDefaultLeadOwnerId()).toBe("rajitha");
    const where = db.user.findFirst.mock.calls[0][0].where;
    expect(where.email).toEqual({ equals: "Rajitha@Example.com", mode: "insensitive" });
    expect(where.isActive).toBe(true);
    expect(where.role.in).not.toContain("VENUE_OWNER");
  });

  it("falls back to the longest-standing admin, in a fixed order, if the named person can't take leads", async () => {
    process.env[DEFAULT_LEAD_OWNER_ENV] = "gone@example.com";
    db.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "first-admin" });
    expect(await getDefaultLeadOwnerId()).toBe("first-admin");
    expect(db.user.findFirst.mock.calls[1][0].orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
  });

  it("uses the fixed-order admin when nothing is configured", async () => {
    delete process.env[DEFAULT_LEAD_OWNER_ENV];
    db.user.findFirst.mockResolvedValueOnce({ id: "first-admin" });
    expect(await getDefaultLeadOwnerId()).toBe("first-admin");
    expect(db.user.findFirst).toHaveBeenCalledTimes(1);
  });

  it("caches for a few minutes, then looks again", async () => {
    process.env[DEFAULT_LEAD_OWNER_ENV] = "r@example.com";
    db.user.findFirst.mockResolvedValue({ id: "rajitha" });
    await getDefaultLeadOwnerId(1_000);
    await getDefaultLeadOwnerId(2_000);
    expect(db.user.findFirst).toHaveBeenCalledTimes(1);
    await getDefaultLeadOwnerId(1_000 + 6 * 60 * 1000);
    expect(db.user.findFirst).toHaveBeenCalledTimes(2);
  });
});
