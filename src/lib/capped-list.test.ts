import { describe, it, expect, vi } from "vitest";
import { cappedList, truncationNotice } from "./capped-list";

// A fake Prisma delegate: findMany honours `take`, count ignores it.
function delegateWith(rowCount: number) {
  const all = Array.from({ length: rowCount }, (_, i) => ({ id: `r${i}` }));
  return {
    findMany: vi.fn(async (args: unknown) => {
      const take = (args as { take?: number }).take ?? all.length;
      return all.slice(0, take);
    }),
    count: vi.fn(async () => all.length),
  };
}

describe("cappedList", () => {
  it("reports truncation when rows were left behind", async () => {
    const d = delegateWith(900);
    const res = await cappedList(d, { where: { deletedAt: null } }, 500);
    expect(res.rows).toHaveLength(500);
    expect(res.total).toBe(900);
    expect(res.truncated).toBe(true);
  });

  it("is not 'truncated' when everything fits", async () => {
    const res = await cappedList(delegateWith(12), { where: {} }, 500);
    expect(res.rows).toHaveLength(12);
    expect(res.total).toBe(12);
    expect(res.truncated).toBe(false);
  });

  it("counts with the SAME where as the rows", async () => {
    // If these ever diverge the notice lies in the other direction — claiming
    // rows are missing when they are not, or hiding that they are.
    const d = delegateWith(3);
    const where = { deletedAt: null, status: "OPEN" };
    await cappedList(d, { where, orderBy: { createdAt: "desc" } }, 500);
    expect(d.count).toHaveBeenCalledWith({ where });
    expect((d.findMany.mock.calls[0][0] as { where: unknown }).where).toEqual(where);
  });

  it("applies the cap it was given, not the caller's take", async () => {
    const d = delegateWith(900);
    // A stray `take` in args must not win over the explicit limit.
    const res = await cappedList(d, { where: {}, take: 10 }, 500);
    expect(res.rows).toHaveLength(500);
  });
});

describe("truncationNotice", () => {
  it("stays silent when nothing was dropped", () => {
    expect(truncationNotice({ rows: [1, 2], total: 2, truncated: false }, "deals")).toBeNull();
  });

  it("names both numbers so the gap is explainable", () => {
    const msg = truncationNotice(
      { rows: new Array(500).fill(0), total: 912, truncated: true },
      "deals"
    );
    expect(msg).toContain("500");
    expect(msg).toContain("912");
    expect(msg).toContain("deals");
  });
});
