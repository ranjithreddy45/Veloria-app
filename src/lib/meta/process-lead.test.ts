import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  metaLeadCapture: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  venue: { findFirst: vi.fn() },
  lead: { update: vi.fn() },
}));
const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/lead-capture", () => ({ captureLeadFromExternal: capture }));
const ownerDb = vi.hoisted(() => ({ createAcqLeadFromMeta: vi.fn() }));
vi.mock("./owner-lead-db", () => ownerDb);
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
    db.metaLeadCapture.findFirst.mockResolvedValue(null);
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

  it("recognises the same lead under another export's id: same phone, same submit time", async () => {
    db.metaLeadCapture.findFirst.mockResolvedValue({ leadId: "lead-from-sheet" });
    const out = await processMetaLeadPayload(lead({ id: "LEADS-CENTRE-ID" }), creds);
    expect(out).toEqual({ status: "duplicate", metaLeadId: "LEADS-CENTRE-ID", leadId: "lead-from-sheet" });
    expect(capture).not.toHaveBeenCalled();
    expect(db.metaLeadCapture.findFirst.mock.calls[0][0].where).toMatchObject({
      metaCreatedAt: new Date("2026-10-03T09:15:00Z"),
      lead: { contact: { phone: { endsWith: "9006612345" } } },
    });
  });

  it("sends a venue-owner form to the BD CRM, never to a sales rep", async () => {
    ownerDb.createAcqLeadFromMeta.mockResolvedValue({ status: "created", acqLeadId: "acq-1" });
    const ownerForm = lead({
      campaign_name: "VG Owner Partnership - Leads Form - Bengaluru",
      field_data: [
        { name: "what_is_your_role_at_the_venue?", values: ["Owner / co-owner"] },
        { name: "what_type_of_venue_is_it?", values: ["Banquet hall"] },
        { name: "which_venue_is_this,_and_in_which_part_of_bengaluru?", values: ["Test Hall, Yelahanka"] },
        { name: "full_name", values: ["Test Owner"] },
        { name: "phone", values: ["+919000000002"] },
      ],
    });
    const { fetchFormName } = await import("./graph");
    vi.mocked(fetchFormName).mockResolvedValueOnce("VG Owner Partnership Application");
    const out = await processMetaLeadPayload(ownerForm, creds);
    expect(out).toMatchObject({ status: "captured", leadId: "", acqLeadId: "acq-1", pipeline: "owner_partnership" });
    expect(capture).not.toHaveBeenCalled();
    const mapped = ownerDb.createAcqLeadFromMeta.mock.calls[0][0];
    expect(mapped).toMatchObject({ city: "Bengaluru", propertyName: "Test Hall", locality: "Yelahanka", propertyType: "BANQUET" });
    expect(ownerDb.createAcqLeadFromMeta.mock.calls[0][1].enquiryAt.toISOString()).toBe("2026-10-03T09:15:00.000Z");
    expect(db.metaLeadCapture.create.mock.calls[0][0].data).toMatchObject({ leadId: null, acqLeadId: "acq-1", pipeline: "owner_partnership" });
  });

  it("records an owner the BD CRM already has as a duplicate, and skips Meta's test owners", async () => {
    const { fetchFormName } = await import("./graph");
    vi.mocked(fetchFormName).mockResolvedValue("VG Owner Partnership Application");
    ownerDb.createAcqLeadFromMeta.mockResolvedValue({ status: "duplicate", acqLeadId: "acq-9" });
    const owner = lead({ field_data: [{ name: "full_name", values: ["Test Owner"] }, { name: "phone", values: ["+919000000002"] }] });
    expect(await processMetaLeadPayload(owner, creds)).toEqual({ status: "duplicate", metaLeadId: "L1", leadId: null });
    expect(db.metaLeadCapture.create.mock.calls[0][0].data).toMatchObject({ acqLeadId: "acq-9" });

    ownerDb.createAcqLeadFromMeta.mockClear();
    const test = lead({ id: "L2", field_data: [{ name: "full_name", values: ["<test lead: dummy data for full_name>"] }, { name: "phone", values: ["<test lead: dummy data for phone>"] }] });
    expect(await processMetaLeadPayload(test, creds)).toMatchObject({ status: "skipped", reason: "Meta test lead" });
    expect(ownerDb.createAcqLeadFromMeta).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });
});
