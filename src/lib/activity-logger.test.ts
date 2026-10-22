import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ activityLog: { create: vi.fn() }, user: { findFirst: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { logActivity } from "./activity-logger";

describe("logActivity — who an automated action is recorded under", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.activityLog.create.mockResolvedValue({});
    db.user.findFirst.mockResolvedValue({ id: "admin-1" });
  });

  it("writes a real user id straight through", async () => {
    await logActivity({ userId: "u1", action: "updated", entityType: "Lead", entityId: "l1" });
    expect(db.activityLog.create.mock.calls[0][0].data.userId).toBe("u1");
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it('records "system" (and an empty id) under the first active admin, looked up once', async () => {
    await logActivity({ userId: "system", action: "auto", entityType: "Lead", entityId: "l1" });
    await logActivity({ userId: "", action: "auto", entityType: "Lead", entityId: "l2" });
    expect(db.activityLog.create.mock.calls.map((c) => c[0].data.userId)).toEqual(["admin-1", "admin-1"]);
    expect(db.user.findFirst).toHaveBeenCalledTimes(1);
  });

  it("never throws into the caller", async () => {
    db.activityLog.create.mockRejectedValue(new Error("db down"));
    await expect(logActivity({ userId: "u1", action: "x", entityType: "Lead", entityId: "l1" })).resolves.toBeUndefined();
  });
});
