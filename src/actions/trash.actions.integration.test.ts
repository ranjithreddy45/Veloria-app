// purgeOldTrash against the real DB, so the real foreign keys judge it. The
// production failure was P2003 on LeadAttribution_leadId_fkey and
// LeadFirstResponse_leadId_fkey; a mocked prisma can't prove those are gone.
//  - a trashed lead carrying every child relation (restricting, cascading and
//    set-null) is purged with no error, and its children go with it;
//  - a trashed lead with a quote stays in trash, attribution intact, no error;
//  - a lead trashed inside the retention window is not touched.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("@/../auth", () => ({ auth: vi.fn(async () => null) }));
// The trusted cron path: a valid CRON_SECRET on the in-process request.
vi.mock("next/headers", () => ({ headers: async () => new Headers({ authorization: "Bearer test" }) }));
vi.mock("@/lib/cron-auth", () => ({ isValidCronSecret: () => true }));

import { prisma } from "@/lib/prisma";
import { purgeOldTrash } from "./trash.actions";

const U = Date.now();
const DAY = 24 * 60 * 60 * 1000;
let userId: string;
let contactId: string;
let cleanLeadId: string;
let quotedLeadId: string;
let recentLeadId: string;
let quoteId: string;
let metaCaptureId: string;

async function trashedLead(title: string, deletedAt: Date) {
  const lead = await prisma.lead.create({
    data: { title, contactId, createdById: userId, deletedAt },
    select: { id: true },
  });
  // The two restricting children that broke the purge in production.
  await prisma.leadAttribution.create({ data: { leadId: lead.id } });
  await prisma.leadFirstResponse.create({ data: { leadId: lead.id } });
  return lead.id;
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Trash Purge", email: `trash-purge-${U}@t.local`, role: "ADMIN", isActive: true },
    select: { id: true },
  });
  userId = user.id;
  const contact = await prisma.contact.create({
    data: { firstName: "Trash", lastName: `Purge${U}`, phone: `+9197${String(U).slice(-8)}` },
    select: { id: true },
  });
  contactId = contact.id;

  cleanLeadId = await trashedLead(`purge-clean-${U}`, new Date(Date.now() - 45 * DAY));
  // Cascade + set-null children too, so the whole relation map is exercised.
  await prisma.leadTouch.create({ data: { leadId: cleanLeadId, channel: "WEBSITE" } });
  await prisma.leadExternalRef.create({
    data: { leadId: cleanLeadId, source: "test", externalId: `ext-${U}`, lineageId: `lin-${U}` },
  });
  await prisma.conversionExportLog.create({
    data: { leadId: cleanLeadId, conversionName: "Qualified Lead", conversionTime: new Date(), value: 0 },
  });
  const capture = await prisma.metaLeadCapture.create({
    data: { metaLeadId: `purge-${U}`, leadId: cleanLeadId },
    select: { id: true },
  });
  metaCaptureId = capture.id;

  quotedLeadId = await trashedLead(`purge-quoted-${U}`, new Date(Date.now() - 45 * DAY));
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QT-PURGE-${U}`,
      title: "Kept",
      validUntil: new Date(Date.now() + 30 * DAY),
      subtotal: 1000,
      totalAmount: 1000,
      contactId,
      createdById: userId,
      leadId: quotedLeadId,
    },
    select: { id: true },
  });
  quoteId = quote.id;

  recentLeadId = await trashedLead(`purge-recent-${U}`, new Date(Date.now() - 5 * DAY));
});

afterAll(async () => {
  const ids = [cleanLeadId, quotedLeadId, recentLeadId].filter(Boolean);
  await prisma.metaLeadCapture.deleteMany({ where: { id: metaCaptureId } }).catch(() => {});
  await prisma.quote.deleteMany({ where: { id: quoteId } }).catch(() => {});
  await prisma.leadAttribution.deleteMany({ where: { leadId: { in: ids } } }).catch(() => {});
  await prisma.leadFirstResponse.deleteMany({ where: { leadId: { in: ids } } }).catch(() => {});
  await prisma.lead.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await prisma.contact.deleteMany({ where: { id: contactId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

describe("purgeOldTrash (real DB)", () => {
  it("purges old leads with no FK error and keeps business ones", async () => {
    const errorSpy = vi.spyOn(console, "error");

    const result = await purgeOldTrash();

    // No "[purgeOldTrash] Failed to purge lead …" — the production symptom.
    const purgeErrors = errorSpy.mock.calls.filter((c) => String(c[0]).includes("[purgeOldTrash]"));
    errorSpy.mockRestore();
    expect(purgeErrors).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(result.leadsPurged).toBeGreaterThanOrEqual(1);

    // Clean lead: gone, with every child.
    expect(await prisma.lead.findUnique({ where: { id: cleanLeadId } })).toBeNull();
    expect(await prisma.leadAttribution.count({ where: { leadId: cleanLeadId } })).toBe(0);
    expect(await prisma.leadFirstResponse.count({ where: { leadId: cleanLeadId } })).toBe(0);
    expect(await prisma.leadTouch.count({ where: { leadId: cleanLeadId } })).toBe(0);
    expect(await prisma.leadExternalRef.count({ where: { leadId: cleanLeadId } })).toBe(0);
    expect(await prisma.conversionExportLog.count({ where: { leadId: cleanLeadId } })).toBe(0);
    const capture = await prisma.metaLeadCapture.findUnique({ where: { id: metaCaptureId } });
    expect(capture).not.toBeNull();
    expect(capture?.leadId).toBeNull();

    // Lead with a quote: still in trash, untouched.
    expect(await prisma.lead.findUnique({ where: { id: quotedLeadId } })).not.toBeNull();
    expect(await prisma.leadAttribution.count({ where: { leadId: quotedLeadId } })).toBe(1);
    expect(await prisma.quote.findUnique({ where: { id: quoteId } })).not.toBeNull();

    // Inside the retention window: untouched.
    expect(await prisma.lead.findUnique({ where: { id: recentLeadId } })).not.toBeNull();
    expect(await prisma.leadAttribution.count({ where: { leadId: recentLeadId } })).toBe(1);
  });
});
