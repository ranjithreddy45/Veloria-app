import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  metaLeadCapture: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  venue: { findFirst: vi.fn() },
  lead: { update: vi.fn() },
}));
const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/lead-capture", () => ({ captureLeadFromExternal: capture }));
vi.mock("./graph", () => ({
  fetchFormName: vi.fn(async () => "Wedding enquiry form"),
  fetchLead: vi.fn(),
  getMetaCredentials: vi.fn(),
}));

import { processMetaLeadPayload } from "./process-lead";

const creds = { pageId: "p", pageAccessToken: "t" } as never;
const NOW = new Date("2026-10-19T12:00:00Z");

function lead(over: Record<string, unknown> = {}) {
  return {
    id: "L1",
    created_time: "2026-10-03T09:15:00+0000",
    form_id: "F1",
    campaign_name: "Wedding Hall Leads",
    field_data: [
      { name: "full_name", values: ["Asha Rao"] },
      { name: "phone_number", values: ["+919006612345"] },
      { name: "event_date", values: ["5 Oct"] },
    ],
    ...over,
  };
}

describe("processMetaLeadPayload — dates, quiet import, excluded campaigns", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    db.metaLeadCapture.findUnique.mockResolvedValue(null);
    db.metaLeadCapture.create.mockResolvedValue({});
    db.metaLeadCapture.delete.mockResolvedValue({});
    db.venue.findFirst.mockResolvedValue(null);
    capture.mockResolvedValue({ success: true, leadId: "lead-1" });
  });
  afterEach(() => vi.useRealTimers());

  it("imports a past lead dated when the form was filled, quietly", async () => {
    const out = await processMetaLeadPayload(lead(), creds);
    expect(out.status).toBe("captured");
    const arg = capture.mock.calls[0][0];
    expect(arg.occurredAt.toISOString()).toBe("2026-10-03T09:15:00.000Z");
    expect(arg.historical.receivedAt.toISOString()).toBe("2026-10-03T09:15:00.000Z");
    // "5 Oct" written on 3 October means this year's 5 October.
    expect(arg.eventDate.slice(0, 10)).toBe("2026-10-05");
    expect(db.metaLeadCapture.create.mock.calls[0][0].data.metaCreatedAt.toISOString()).toBe("2026-10-03T09:15:00.000Z");
  });

  it("treats a lead from the last day as live: real time kept, welcome and SLA left on", async () => {
    await processMetaLeadPayload(lead({ created_time: "2026-10-19T11:30:00+0000" }), creds);
    const arg = capture.mock.calls[0][0];
    expect(arg.occurredAt.toISOString()).toBe("2026-10-19T11:30:00.000Z");
    expect(arg.historical).toBeUndefined();
  });

  it("holds back the Hotel sales and Venue acquisition campaigns, and records them", async () => {
    const out = await processMetaLeadPayload(lead({ campaign_name: "Hotel Sales - Oct" }), creds);
    expect(out).toMatchObject({ status: "skipped" });
    expect(capture).not.toHaveBeenCalled();
    expect(db.metaLeadCapture.create.mock.calls[0][0].data).toMatchObject({ leadId: null, pipeline: "excluded_campaign" });

    await processMetaLeadPayload(lead({ id: "L2", campaign_name: "Venue Acquisition" }), creds);
    expect(capture).not.toHaveBeenCalled();
  });

  it("does not record a held-back lead twice", async () => {
    db.metaLeadCapture.findUnique.mockResolvedValue({ leadId: null, pipeline: "excluded_campaign" });
    const out = await processMetaLeadPayload(lead({ campaign_name: "Hotel Sales" }), creds);
    expect(out.status).toBe("skipped");
    expect(db.metaLeadCapture.create).not.toHaveBeenCalled();
  });

  it("brings a held-back lead in once its campaign is no longer excluded", async () => {
    db.metaLeadCapture.findUnique.mockResolvedValue({ leadId: null, pipeline: "excluded_campaign" });
    vi.stubEnv("META_EXCLUDED_CAMPAIGNS", "none");
    try {
      const out = await processMetaLeadPayload(lead({ campaign_name: "Hotel Sales" }), creds);
      expect(out.status).toBe("captured");
      expect(db.metaLeadCapture.delete).toHaveBeenCalledWith({ where: { metaLeadId: "L1" } });
      expect(capture).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("still treats an already-imported lead as a duplicate", async () => {
    db.metaLeadCapture.findUnique.mockResolvedValue({ leadId: "lead-9", pipeline: "event" });
    expect(await processMetaLeadPayload(lead(), creds)).toEqual({ status: "duplicate", metaLeadId: "L1", leadId: "lead-9" });
    expect(capture).not.toHaveBeenCalled();
  });
});
