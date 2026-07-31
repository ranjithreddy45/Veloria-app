// ============================================================
// Lead source, end to end against the local DB.
//
// The unit test proves the string→channel mapping. This proves the thing the
// user actually asked for: that an enquiry arriving from outside RECORDS its
// channel, without anyone typing it in. It drives the real capture choke point
// and the real backfill — no stubs of our own code.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// External side-effects only. The capture pipeline itself is real.
// auth is stubbed because the capture path reaches assignment rules, which are
// server actions — the session plays no part in what we're proving here.
vi.mock("@/../auth", () => ({ auth: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { backfillEnquirySource } from "@/lib/enquiry-source-backfill";

const U = Date.now();
const contactIds: string[] = [];
const leadIds: string[] = [];

/** Unique 10-digit Indian mobile per case, so dedup never merges two cases. */
const phoneFor = (n: number) => `9${String(U).slice(-8)}${n}`;

async function track(contactId: string) {
  contactIds.push(contactId);
  const leads = await prisma.lead.findMany({ where: { contactId }, select: { id: true } });
  leadIds.push(...leads.map((l) => l.id));
}

afterAll(async () => {
  // FK order: everything hanging off the lead, then leads, then contacts.
  if (leadIds.length) {
    await prisma.leadFirstResponse.deleteMany({ where: { leadId: { in: leadIds } } }).catch(() => {});
    await prisma.leadAttribution.deleteMany({ where: { leadId: { in: leadIds } } }).catch(() => {});
    await prisma.task.deleteMany({ where: { leadId: { in: leadIds } } }).catch(() => {});
    await prisma.crmNote.deleteMany({ where: { leadId: { in: leadIds } } }).catch(() => {});
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } }).catch(() => {});
  }
  if (contactIds.length) {
    await prisma.communication.deleteMany({ where: { contactId: { in: contactIds } } }).catch(() => {});
    await prisma.contact.deleteMany({ where: { id: { in: contactIds } } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("captureLeadFromExternal records the marketing channel", () => {
  it.each([
    ["google_ads", "GOOGLE_ADS"],
    ["facebook_ads", "PAID_SOCIAL"],
    ["WEBSITE", "LEAD_FORM"],
    ["WALK_IN", "DIRECT"],
  ])("source %s → %s", async (raw, expected) => {
    const idx = ["google_ads", "facebook_ads", "WEBSITE", "WALK_IN"].indexOf(raw);
    const res = await captureLeadFromExternal({
      name: `Src Case ${idx} ${U}`,
      phone: phoneFor(idx),
      source: raw,
    });
    expect(res.success).toBe(true);
    await track(res.contactId!);

    const contact = await prisma.contact.findUnique({
      where: { id: res.contactId! },
      select: { enquirySource: true },
    });
    expect(contact?.enquirySource).toBe(expected);
  });

  it("does not overwrite an existing credit when the same person re-enquires", async () => {
    // First touch: a paid Google click. This is the channel that won them.
    const first = await captureLeadFromExternal({
      name: `Repeat ${U}`,
      phone: phoneFor(8),
      source: "google_ads",
    });
    expect(first.success).toBe(true);
    await track(first.contactId!);

    // Later they walk in. Re-crediting to DIRECT would erase the ad spend that
    // actually produced the customer, so the first credit must survive.
    const second = await captureLeadFromExternal({
      name: `Repeat ${U}`,
      phone: phoneFor(8),
      source: "WALK_IN",
    });
    expect(second.success).toBe(true);
    expect(second.contactId).toBe(first.contactId);

    const contact = await prisma.contact.findUnique({
      where: { id: first.contactId! },
      select: { enquirySource: true },
    });
    expect(contact?.enquirySource).toBe("GOOGLE_ADS");
  });
});

describe("backfillEnquirySource", () => {
  it("fills a blank contact from its first lead, and leaves lead-less ones alone", async () => {
    // A legacy contact: has a lead, but no channel recorded on the contact.
    const withLead = await prisma.contact.create({
      data: { firstName: "Legacy", lastName: `Web ${U}`, phone: phoneFor(6) },
      select: { id: true },
    });
    contactIds.push(withLead.id);
    // Lead.createdBy is required; any existing user will do — the backfill
    // reads the lead's SOURCE, not who entered it.
    const someUser = await prisma.user.findFirst({ select: { id: true } });
    const lead = await prisma.lead.create({
      data: {
        title: `Legacy lead ${U}`,
        contact: { connect: { id: withLead.id } },
        createdBy: { connect: { id: someUser!.id } },
        source: "WEBSITE",
        status: "NEW",
      },
      select: { id: true },
    });
    leadIds.push(lead.id);

    // A contact with no lead at all — nothing real to derive from.
    const noLead = await prisma.contact.create({
      data: { firstName: "Legacy", lastName: `NoLead ${U}`, phone: phoneFor(7) },
      select: { id: true },
    });
    contactIds.push(noLead.id);

    const result = await backfillEnquirySource();
    expect(result.filled).toBeGreaterThanOrEqual(1);

    expect(
      (await prisma.contact.findUnique({ where: { id: withLead.id }, select: { enquirySource: true } }))
        ?.enquirySource
    ).toBe("LEAD_FORM");

    // Left NULL on purpose: guessing "Direct" would fabricate attribution.
    expect(
      (await prisma.contact.findUnique({ where: { id: noLead.id }, select: { enquirySource: true } }))
        ?.enquirySource
    ).toBeNull();
  });

  it("is idempotent — a second pass changes nothing", async () => {
    const before = await prisma.contact.count({ where: { enquirySource: { not: null } } });
    const second = await backfillEnquirySource();
    const after = await prisma.contact.count({ where: { enquirySource: { not: null } } });
    expect(after).toBe(before + second.filled);
    // Nothing new to fill on the rows the first pass already handled.
    expect(second.filled).toBe(0);
  });
});
