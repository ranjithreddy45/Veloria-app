import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// purgeOldTrash must hard-delete a trashed lead together with its pure child
// rows (LeadAttribution, LeadFirstResponse — both restricting FKs that used to
// fail every purge with P2003), in one transaction, and must leave a lead with
// a business record (deal / quote / sales quotation) in trash without an error.
// Prisma and the framework are stubbed.
// ============================================================

const { db } = vi.hoisted(() => {
  const table = () => ({ findMany: vi.fn(), deleteMany: vi.fn(), delete: vi.fn() });
  return {
    db: {
      lead: table(),
      contact: table(),
      leadAttribution: table(),
      leadFirstResponse: table(),
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/../auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ authorization: "Bearer cron" }) }));
vi.mock("@/lib/cron-auth", () => ({ isValidCronSecret: () => true }));

import { purgeOldTrash } from "./trash.actions";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

function trashedLead(id: string, over: Record<string, unknown> = {}) {
  return { id, deletedAt: daysAgo(45), deal: null, quotes: [], salesQuotations: [], ...over };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  db.contact.findMany.mockResolvedValue([]);
  // Each builder returns a tagged "operation" so the batch can be inspected.
  db.leadAttribution.deleteMany.mockImplementation((args) => ({ op: "attribution", args }));
  db.leadFirstResponse.deleteMany.mockImplementation((args) => ({ op: "firstResponse", args }));
  db.lead.deleteMany.mockImplementation((args) => ({ op: "lead", args }));
  db.$transaction.mockImplementation(async (ops: Array<{ op: string }>) =>
    ops.map((o) => ({ count: 1, op: o.op }))
  );
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  infoSpy.mockRestore();
});

describe("purgeOldTrash — leads", () => {
  it("deletes attribution + first response, then the lead, in one transaction", async () => {
    db.lead.findMany.mockResolvedValue([trashedLead("lead_1")]);

    const result = await purgeOldTrash();

    expect(result).toEqual({ leadsPurged: 1, contactsPurged: 0, skipped: 0 });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const ops = db.$transaction.mock.calls[0][0] as Array<{ op: string; args: { where: Record<string, unknown> } }>;
    // Children first, lead last — the order the FKs require.
    expect(ops.map((o) => o.op)).toEqual(["attribution", "firstResponse", "lead"]);
    expect(ops[0].args.where.leadId).toBe("lead_1");
    expect(ops[1].args.where.leadId).toBe("lead_1");
    expect(ops[2].args.where.id).toBe("lead_1");
    // Every statement is re-scoped to "still in trash", so a lead restored
    // mid-run keeps its child rows.
    expect(ops[0].args.where.lead).toMatchObject({ deletedAt: { not: null } });
    expect(ops[1].args.where.lead).toMatchObject({ deletedAt: { not: null } });
    expect(ops[2].args.where).toMatchObject({ deletedAt: { not: null } });
    // The old bare delete (which hit the FK) is gone.
    expect(db.lead.delete).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("does not count a lead restored between the scan and the delete", async () => {
    db.lead.findMany.mockResolvedValue([trashedLead("lead_restored")]);
    db.$transaction.mockResolvedValue([{ count: 0 }, { count: 0 }, { count: 0 }]);

    const result = await purgeOldTrash();

    expect(result.leadsPurged).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["a deal", { deal: { id: "deal_1" } }],
    ["a quote", { quotes: [{ id: "quote_1" }] }],
    ["a sales quotation", { salesQuotations: [{ id: "sq_1" }] }],
  ])("keeps a lead with %s in trash, without an error log", async (_label, over) => {
    db.lead.findMany.mockResolvedValue([trashedLead("lead_biz", over)]);

    const result = await purgeOldTrash();

    expect(result).toEqual({ leadsPurged: 0, contactsPurged: 0, skipped: 1 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.leadAttribution.deleteMany).not.toHaveBeenCalled();
    expect(db.leadFirstResponse.deleteMany).not.toHaveBeenCalled();
    expect(db.lead.deleteMany).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("logs a kept lead once — on the run it crosses the retention window, not after", async () => {
    // Crossed the 30-day cutoff a few hours ago → first run to see it.
    const fresh = trashedLead("lead_new", { deletedAt: new Date(Date.now() - 30 * DAY - 3 * 60 * 60 * 1000), deal: { id: "d" } });
    // Kept for weeks already → reported on an earlier run, stays quiet now.
    const old = trashedLead("lead_old", { deletedAt: daysAgo(60), deal: { id: "d2" } });
    db.lead.findMany.mockResolvedValue([fresh, old]);

    const result = await purgeOldTrash();

    expect(result.skipped).toBe(2);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][0]).toContain("lead_new");
    expect(infoSpy.mock.calls[0][0]).not.toContain("lead_old");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("purges clean leads and keeps business ones in the same run", async () => {
    db.lead.findMany.mockResolvedValue([
      trashedLead("lead_clean"),
      trashedLead("lead_biz", { quotes: [{ id: "q" }] }),
    ]);

    const result = await purgeOldTrash();

    expect(result).toEqual({ leadsPurged: 1, contactsPurged: 0, skipped: 1 });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("still logs and skips when the transaction itself fails", async () => {
    db.lead.findMany.mockResolvedValue([trashedLead("lead_x")]);
    db.$transaction.mockRejectedValue(new Error("P2003"));

    const result = await purgeOldTrash();

    expect(result).toEqual({ leadsPurged: 0, contactsPurged: 0, skipped: 1 });
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
