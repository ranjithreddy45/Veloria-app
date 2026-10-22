import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  acqLead: { findFirst: vi.fn(), groupBy: vi.fn(), create: vi.fn() },
  acqStageTransition: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/acq/config", () => ({ getAcqConfig: vi.fn(async () => ({ LEAD_FIRST_CONTACT_SLA_HOURS: 24 })) }));
vi.mock("@/lib/lead-capture", () => ({ getSystemUserId: vi.fn(async () => "admin") }));

import { createAcqLeadFromMeta, pickBdExecutive } from "./owner-lead-db";
import type { MappedOwnerLead } from "./owner-lead";

const BD = [
  { id: "nick", name: "Nickson Walter", role: "BD_HEAD" },
  { id: "rak", name: "Rakshith", role: "BD_HEAD" },
  { id: "sri", name: "Srinivas K", role: "BD_EXECUTIVE" },
];

const mapped: MappedOwnerLead = {
  ownerName: "Test Owner",
  phone: "+919000000002",
  email: null,
  propertyName: "Test Hall",
  locality: "Yelahanka",
  localityIsPlaceholder: false,
  city: "Bengaluru",
  propertyType: "BANQUET",
  propertyTypeIsPlaceholder: false,
  propertyStage: "OPERATIONAL",
  ownerType: "SOLE_OWNER",
  leadSource: "SOCIAL_MEDIA",
  notes: "n",
  isTest: false,
};

describe("pickBdExecutive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findMany.mockResolvedValue(BD);
  });

  it("gives Bengaluru to whichever of Nickson and Rakshith holds fewer open leads", async () => {
    db.acqLead.groupBy.mockResolvedValue([{ bdExecutiveId: "rak", _count: { _all: 12 } }, { bdExecutiveId: "nick", _count: { _all: 3 } }]);
    expect(await pickBdExecutive("Bengaluru")).toBe("nick");
    db.acqLead.groupBy.mockResolvedValue([{ bdExecutiveId: "nick", _count: { _all: 20 } }]);
    expect(await pickBdExecutive("Bengaluru")).toBe("rak");
  });

  it("gives Guntur and Vijayawada to Srinivas without counting", async () => {
    expect(await pickBdExecutive("Guntur")).toBe("sri");
    expect(await pickBdExecutive("Vijayawada")).toBe("sri");
    expect(db.acqLead.groupBy).not.toHaveBeenCalled();
  });

  it("falls back to an active BD head when a named person is missing, and to null when there is nobody", async () => {
    db.user.findMany.mockResolvedValue([{ id: "x", name: "Someone", role: "BD_HEAD" }]);
    expect(await pickBdExecutive("Guntur")).toBe("x");
    db.user.findMany.mockResolvedValue([]);
    expect(await pickBdExecutive("Guntur")).toBeNull();
  });
});

describe("createAcqLeadFromMeta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findMany.mockResolvedValue(BD);
    db.acqLead.findFirst.mockResolvedValue(null);
    db.acqLead.groupBy.mockResolvedValue([]);
    db.acqLead.create.mockResolvedValue({ id: "acq-1" });
    db.acqStageTransition.create.mockResolvedValue({});
  });

  it("creates the BD lead dated at the enquiry, with the SLA counted from now", async () => {
    const enquiryAt = new Date(Date.now() - 10 * 86_400_000);
    const out = await createAcqLeadFromMeta(mapped, { enquiryAt });
    expect(out).toEqual({ status: "created", acqLeadId: "acq-1" });
    const data = db.acqLead.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ mobilePrimary: "+919000000002", city: "Bengaluru", bdExecutiveId: "nick", status: "NEW", createdAt: enquiryAt });
    expect(data.firstContactDue.getTime()).toBeGreaterThan(Date.now());
    expect(db.acqStageTransition.create.mock.calls[0][0].data).toMatchObject({ entity: "LEAD", entityId: "acq-1", toState: "NEW", actorId: "admin" });
  });

  it("does not create a second lead for an owner already in the BD CRM", async () => {
    db.acqLead.findFirst.mockResolvedValue({ id: "acq-old" });
    expect(await createAcqLeadFromMeta(mapped, { enquiryAt: null })).toEqual({ status: "duplicate", acqLeadId: "acq-old" });
    expect(db.acqLead.create).not.toHaveBeenCalled();
  });

  it("skips a lead with no usable mobile, and one nobody can be assigned to", async () => {
    expect((await createAcqLeadFromMeta({ ...mapped, phone: "12345" }, { enquiryAt: null })).status).toBe("skipped");
    db.user.findMany.mockResolvedValue([]);
    expect(await createAcqLeadFromMeta(mapped, { enquiryAt: null })).toMatchObject({ status: "skipped" });
    expect(db.acqLead.create).not.toHaveBeenCalled();
  });
});
