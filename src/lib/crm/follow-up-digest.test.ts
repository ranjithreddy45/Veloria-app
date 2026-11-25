import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  lead: { groupBy: vi.fn(), findMany: vi.fn() },
  notification: { findMany: vi.fn(), findFirst: vi.fn() },
  cronLaneLease: { createMany: vi.fn(), deleteMany: vi.fn() },
}));
const m = vi.hoisted(() => ({ notifyAwait: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/notify", () => ({ notifyAwait: m.notifyAwait }));

import { sendFollowUpDigests, digestTitle, digestMessage, digestKey } from "./follow-up-digest";

// 24 Nov 2026, 10:00 IST = 04:30 UTC
const TEN_AM_IST = new Date("2026-11-24T04:30:00Z");

describe("sendFollowUpDigests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.lead.groupBy.mockReset();
    db.notification.findMany.mockResolvedValue([]);
    db.lead.findMany.mockResolvedValue([
      { title: "L1", contact: { firstName: "Priya", lastName: "Sharma" } },
      { title: "Corporate offsite", contact: { firstName: "", lastName: "" } },
    ]);
    m.notifyAwait.mockResolvedValue(undefined);
    db.cronLaneLease.createMany.mockResolvedValue({ count: 1 });
    db.notification.findFirst.mockResolvedValue({ id: "n1" });
    db.cronLaneLease.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("a rep who deleted today's notice doesn't get it again next hour", async () => {
    db.lead.groupBy
      .mockResolvedValueOnce([{ assignedToId: "rep1", _count: { _all: 2 } }])
      .mockResolvedValueOnce([]);
    db.cronLaneLease.createMany.mockResolvedValue({ count: 0 }); // marker already there
    const res = await sendFollowUpDigests(TEN_AM_IST);
    expect(m.notifyAwait).not.toHaveBeenCalled();
    expect(res.sent).toBe(0);
    expect(db.cronLaneLease.createMany.mock.calls[0][0]).toMatchObject({
      data: [{ lane: `digest:${digestKey("2026-11-24")}:rep1` }],
      skipDuplicates: true,
    });
  });

  it("a failed send gives the marker back so the next run retries", async () => {
    db.lead.groupBy
      .mockResolvedValueOnce([{ assignedToId: "rep1", _count: { _all: 1 } }])
      .mockResolvedValueOnce([]);
    // notifyAwait swallows its own errors, so the notice just never appears
    db.notification.findFirst.mockResolvedValueOnce(null);
    const res = await sendFollowUpDigests(TEN_AM_IST);
    expect(res.sent).toBe(0);
    expect(db.cronLaneLease.deleteMany).toHaveBeenCalledWith({ where: { lane: `digest:${digestKey("2026-11-24")}:rep1` } });
  });

  it("waits until 9 am India time", async () => {
    const res = await sendFollowUpDigests(new Date("2026-11-24T03:00:00Z")); // 08:30 IST
    expect(res.skipped).toMatch(/9 am/);
    expect(db.lead.groupBy).not.toHaveBeenCalled();
  });

  it("sends one notice per rep with today's and overdue counts", async () => {
    db.lead.groupBy
      .mockResolvedValueOnce([{ assignedToId: "rep1", _count: { _all: 2 } }]) // today
      .mockResolvedValueOnce([
        { assignedToId: "rep1", _count: { _all: 5 } },
        { assignedToId: "rep2", _count: { _all: 1 } },
      ]); // overdue
    const res = await sendFollowUpDigests(TEN_AM_IST);
    expect(res).toMatchObject({ day: "2026-11-24", reps: 2, sent: 2, alreadySent: 0 });

    // the IST day window: 23 Nov 18:30 UTC → 24 Nov 18:30 UTC
    const todayWhere = db.lead.groupBy.mock.calls[0][0].where;
    expect(todayWhere.followUpDate.gte.toISOString()).toBe("2026-11-23T18:30:00.000Z");
    expect(todayWhere.followUpDate.lt.toISOString()).toBe("2026-11-24T18:30:00.000Z");
    expect(todayWhere.assignedTo).toMatchObject({ isActive: true });
    expect(todayWhere.status).toEqual({ notIn: ["WON", "LOST"] });

    const first = m.notifyAwait.mock.calls.find((c) => c[0].userId === "rep1")![0];
    expect(first.title).toBe("2 follow-ups due today · 5 overdue");
    expect(first.message).toBe("Today: Priya Sharma, Corporate offsite.");
    expect(first.actionUrl).toBe("/leads/followups");
    expect(first.metadata.digestKey).toBe("FOLLOW_UP_DIGEST:2026-11-24");

    const second = m.notifyAwait.mock.calls.find((c) => c[0].userId === "rep2")![0];
    expect(second.title).toBe("1 follow-up overdue");
    // nobody due today → no name lookup for that rep
    expect(db.lead.findMany).toHaveBeenCalledTimes(1);
  });

  it("does not repeat a reminder already sent today", async () => {
    db.lead.groupBy
      .mockResolvedValueOnce([{ assignedToId: "rep1", _count: { _all: 1 } }])
      .mockResolvedValueOnce([]);
    db.notification.findMany.mockResolvedValue([{ userId: "rep1" }]);
    const res = await sendFollowUpDigests(TEN_AM_IST);
    expect(res).toMatchObject({ reps: 1, sent: 0, alreadySent: 1 });
    expect(m.notifyAwait).not.toHaveBeenCalled();
    expect(db.notification.findMany.mock.calls[0][0].where.metadata).toEqual({
      path: ["digestKey"],
      equals: "FOLLOW_UP_DIGEST:2026-11-24",
    });
  });

  it("sends nothing when no rep has a follow-up due", async () => {
    db.lead.groupBy.mockResolvedValue([]);
    const res = await sendFollowUpDigests(TEN_AM_IST);
    expect(res.sent).toBe(0);
    expect(m.notifyAwait).not.toHaveBeenCalled();
  });
});

describe("wording", () => {
  it("titles", () => {
    expect(digestTitle(1, 0)).toBe("1 follow-up due today");
    expect(digestTitle(3, 0)).toBe("3 follow-ups due today");
    expect(digestTitle(0, 7)).toBe("7 follow-ups overdue");
    expect(digestTitle(1, 1)).toBe("1 follow-up due today · 1 overdue");
  });
  it("names the first few and counts the rest", () => {
    expect(digestMessage(["A", "B", "C"], 8)).toBe("Today: A, B, C and 5 more.");
    expect(digestMessage([], 0)).toMatch(/Open your follow-ups/);
  });
  it("key is per IST day", () => {
    expect(digestKey("2026-11-24")).toBe("FOLLOW_UP_DIGEST:2026-11-24");
  });
});
