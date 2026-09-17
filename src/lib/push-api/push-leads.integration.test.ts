// ============================================================
// POST /api/v1/push/leads, end to end against a real Postgres.
//
// Drives the actual route handler — authentication, the Postgres rate limiter,
// idempotency, validation, the real captureLeadFromExternal, dedup, attribution,
// the outbox and the audit log. Only side effects that leave the building
// (WhatsApp, notifications, email, the Weflux CRM mirror) are stubbed.
//
// Runs ONLY against a database whose name ends in "_test": it creates and
// deletes users, keys, contacts and leads, and must never see production.
// ============================================================

import { afterAll, beforeAll, describe as vitestDescribe, expect, it, vi } from "vitest";

vi.mock("@/../auth", () => ({ auth: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/integrations/weflux-crm", () => ({ pushLeadToWeflux: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/crm/lead-assigned-email", () => ({ sendLeadAssignedEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/v1/push/leads/route";
import { GET as healthGET } from "@/app/api/v1/health/route";
import { GET as openapiGET } from "@/app/api/v1/openapi.json/route";
import { generatePushKey } from "./keys";
import { REQUEST_ID_PATTERN } from "./request-id";

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
// Never against anything but a *_test database. Skipped (loudly) rather than
// thrown, so a plain `vitest run` without one doesn't turn the suite red.
const IS_TEST_DB = dbName.endsWith("_test");
if (!IS_TEST_DB) {
  console.warn(`[push-leads.integration] skipped: DATABASE_URL database "${dbName || "(none)"}" is not a *_test database.`);
}
const describe = vitestDescribe.skipIf(!IS_TEST_DB);

const U = Date.now();
const ENDPOINT = "https://app.theveloriagrand.com/api/v1/push/leads";
/** A unique Indian mobile per case, so dedup can only match what a case intends. */
const phone = (n: number) => `9${String(U).slice(-7)}${String(n).padStart(2, "0")}`;
const e164 = (n: number) => `+91${phone(n)}`;

const created = { userId: "", venueId: "", keyIds: [] as string[] };
const keys = { valid: "", revoked: "", expired: "", legacy: "", limited: "" };

async function mintKey(label: string, data: { scopes?: string[]; isActive?: boolean; revokedAt?: Date | null; expiresAt?: Date | null }) {
  const { raw, hash, prefix } = generatePushKey();
  const row = await prisma.apiKey.create({
    data: {
      name: `push-test ${label} ${U}`,
      keyHash: hash,
      prefix,
      createdById: created.userId,
      scopes: data.scopes ?? ["leads:create", "leads:update"],
      isActive: data.isActive ?? true,
      revokedAt: data.revokedAt ?? null,
      expiresAt: data.expiresAt ?? null,
    },
  });
  await prisma.apiKey.update({ where: { id: row.id }, data: { lineageId: row.id } });
  created.keyIds.push(row.id);
  return raw;
}

async function push(
  body: unknown,
  opts: { key?: string | null; idempotencyKey?: string; raw?: string; headers?: Record<string, string> } = {}
) {
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "push-api-test", ...opts.headers };
  const key = opts.key === undefined ? keys.valid : opts.key;
  if (key) headers.authorization = `Bearer ${key}`;
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;
  const res = await POST(new Request(ENDPOINT, { method: "POST", headers, body: opts.raw ?? JSON.stringify(body) }));
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  if (!IS_TEST_DB) return;
  process.env.PUSH_API_ENABLED = "true";
  const user = await prisma.user.create({
    data: { email: `push-admin-${U}@test.local`, name: "Push Test Admin", role: "SUPER_ADMIN", isActive: true },
  });
  created.userId = user.id;
  const venue = await prisma.venue.create({
    data: { name: `Blossom Bellandur ${U}`, capacity: 300, pricePerSlot: 150000, isActive: true },
  });
  created.venueId = venue.id;

  keys.valid = await mintKey("valid", {});
  keys.revoked = await mintKey("revoked", { isActive: false, revokedAt: new Date() });
  keys.expired = await mintKey("expired", { expiresAt: new Date(Date.now() - 60_000) });
  keys.legacy = await mintKey("legacy", { scopes: [] });
  keys.limited = await mintKey("limited", {});
}, 60_000);

afterAll(async () => {
  if (!IS_TEST_DB) return;
  // Deferred capture tails (welcome message, workflows) may still be writing.
  await new Promise((r) => setTimeout(r, 1500));
  const leads = await prisma.lead.findMany({ where: { createdById: created.userId }, select: { id: true, contactId: true } });
  const leadIds = leads.map((l) => l.id);
  const contactIds = [...new Set(leads.map((l) => l.contactId))];
  const quiet = <T,>(p: Promise<T>) => p.catch(() => undefined);

  await quiet(prisma.integrationEvent.deleteMany({ where: { resourceId: { in: leadIds } } }));
  await quiet(prisma.pushApiRequestLog.deleteMany({ where: { OR: [{ apiKeyId: { in: created.keyIds } }, { userAgent: "push-api-test" }] } }));
  await quiet(prisma.pushRateLimitCounter.deleteMany({ where: { apiKeyId: { in: created.keyIds } } }));
  await quiet(prisma.pushIngestLock.deleteMany({}));
  await quiet(prisma.activityLog.deleteMany({ where: { userId: created.userId } }));
  if (leadIds.length) {
    for (const model of ["leadFirstResponse", "leadRoutingDecision", "task", "crmNote"] as const) {
      // Anything the intake tail may have hung off a lead; missing models/relations are ignored.
      const delegate = (prisma as unknown as Record<string, { deleteMany?: (a: unknown) => Promise<unknown> }>)[model];
      if (delegate?.deleteMany) await quiet(delegate.deleteMany({ where: { leadId: { in: leadIds } } }));
    }
    await quiet(prisma.leadAttribution.deleteMany({ where: { leadId: { in: leadIds } } }));
    await quiet(prisma.lead.deleteMany({ where: { id: { in: leadIds } } }));
  }
  if (contactIds.length) {
    await quiet(prisma.consentRecord.deleteMany({ where: { subjectId: { in: contactIds } } }));
    await quiet(prisma.communication.deleteMany({ where: { contactId: { in: contactIds } } }));
    await quiet(prisma.contact.deleteMany({ where: { id: { in: contactIds } } }));
  }
  await quiet(prisma.apiKey.deleteMany({ where: { id: { in: created.keyIds } } }));
  await quiet(prisma.venue.deleteMany({ where: { id: created.venueId } }));
  await quiet(prisma.user.deleteMany({ where: { id: created.userId } }));
  await prisma.$disconnect();
}, 60_000);

// ------------------------------------------------------------
describe("authentication", () => {
  const body = { source: "website", phone: phone(1) };

  it("rejects a request with no key (401)", async () => {
    const r = await push(body, { key: null });
    expect(r.status).toBe(401);
    expect(r.json.error.code).toBe("UNAUTHORIZED");
    expect(r.json.success).toBe(false);
  });

  it("rejects an unknown key (401)", async () => {
    const r = await push(body, { key: "vg_live_this-key-was-never-issued" });
    expect(r.status).toBe(401);
    expect(r.json.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a revoked key (403)", async () => {
    const r = await push(body, { key: keys.revoked });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("API_KEY_REVOKED");
  });

  it("rejects an expired key (403)", async () => {
    const r = await push(body, { key: keys.expired });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("API_KEY_EXPIRED");
  });

  it("rejects a legacy key that was never granted leads:create (403)", async () => {
    const r = await push(body, { key: keys.legacy });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("INSUFFICIENT_SCOPE");
  });

  it("accepts a valid key", async () => {
    const r = await push({ source: "website", phone: phone(2), name: "Auth Valid" });
    expect(r.status).toBe(201);
  });

  it("puts the request id in the header and the body, and writes an audit row even for a rejection", async () => {
    const r = await push(body, { key: "vg_live_unknown" });
    const requestId = r.headers.get("x-request-id");
    expect(requestId).toMatch(REQUEST_ID_PATTERN);
    expect(r.json.request_id).toBe(requestId);
    const log = await prisma.pushApiRequestLog.findUnique({ where: { requestId: requestId! } });
    expect(log).toMatchObject({ outcome: "rejected", responseStatus: 401, errorCode: "UNAUTHORIZED", apiKeyId: null, method: "POST" });
  });
});

// ------------------------------------------------------------
describe("validation", () => {
  it("requires a phone or an email (422)", async () => {
    const r = await push({ source: "meta_ads", name: "No Contact" });
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe("VALIDATION_ERROR");
    expect(r.json.error.fields.phone).toMatch(/phone number or an email/);
  });

  it.each([
    ["email", { email: "not-an-email" }],
    ["phone", { phone: "12345" }],
    ["event_date", { phone: phone(3), event_date: "2026-02-30" }],
    ["guest_count", { phone: phone(3), guest_count: -10 }],
    ["guest_count", { phone: phone(3), guest_count: "250" }],
    ["budget", { phone: phone(3), budget: 0 }],
    ["consent", { phone: phone(3), consent: "yes" }],
  ])("reports an invalid %s by field (422)", async (field, extra) => {
    const r = await push({ source: "website", ...extra });
    expect(r.status).toBe(422);
    expect(r.json.error.fields[field]).toBeDefined();
  });

  it("rejects malformed JSON (400)", async () => {
    const r = await push(null, { raw: '{"source": "website", "phone": ' });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe("INVALID_JSON");
  });

  it("rejects a JSON array (400)", async () => {
    const r = await push([{ source: "website", phone: phone(3) }]);
    expect(r.status).toBe(400);
  });

  it("rejects the wrong content type (415)", async () => {
    const r = await push({ source: "website", phone: phone(3) }, { headers: { "content-type": "text/plain" } });
    expect(r.status).toBe(415);
  });

  it("rejects an oversized payload (413)", async () => {
    const r = await push({ source: "website", phone: phone(3), message: "x".repeat(70 * 1024) });
    expect(r.status).toBe(413);
    expect(r.json.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("never exposes a stack trace", async () => {
    const r = await push(null, { raw: "{" });
    expect(JSON.stringify(r.json)).not.toMatch(/at \w+ \(|\.ts:\d+/);
  });
});

// ------------------------------------------------------------
describe("lead creation", () => {
  const externalId = `META-${U}`;
  let leadId = "";

  it("creates the lead with status NEW and every normalised field (201)", async () => {
    const r = await push(
      {
        external_id: externalId,
        source: "meta_ads",
        campaign: "Blossom Bellandur Wedding Campaign",
        campaign_id: "123456789",
        adset: "Wedding Leads",
        ad_id: "987654321",
        name: "Rahul Sharma",
        phone: phone(10),
        email: `Rahul.${U}@Example.com`,
        event_type: "wedding",
        event_date: "2026-12-20",
        guest_count: 250,
        venue: `blossom bellandur ${U}`,
        budget: 250000,
        message: "Looking for a wedding venue for 250 guests.",
        utm_source: "facebook",
        utm_medium: "paid_social",
        utm_campaign: "blossom_wedding",
        utm_content: "video_01",
        landing_page: "https://veloriagrand.com/blossom-bellandur.html",
        consent: true,
        metadata: { fb_lead_id: "123456789", device: "mobile", landing_page_variant: "B" },
        // Not part of the contract — must be ignored, not stored.
        status: "WON",
        assignedToId: "someone-else",
      },
      { idempotencyKey: `meta-lead-${U}` }
    );

    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({
      success: true,
      message: "Lead created successfully",
      data: { external_id: externalId, status: "NEW", created: true, duplicate: false },
    });
    expect(r.headers.get("x-ratelimit-limit")).toBeTruthy();
    leadId = r.json.data.lead_id;

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { contact: true } });
    expect(lead.status).toBe("NEW");
    expect(lead.source).toBe("FACEBOOK_ADS");
    expect(lead.guestCount).toBe(250);
    expect(Number(lead.estimatedValue)).toBe(250000);
    expect(lead.eventType).toBe("wedding");
    expect(lead.eventDate?.toISOString().slice(0, 10)).toBe("2026-12-20");
    expect(lead.preferredVenueId).toBe(created.venueId);
    expect(lead.contact.phone).toBe(e164(10));
    expect(lead.contact.email).toBe(`rahul.${U}@example.com`);
  });

  it("records first-touch attribution, the touch with its metadata, and the external id", async () => {
    const attribution = await prisma.leadAttribution.findUnique({ where: { leadId } });
    expect(attribution).toMatchObject({
      source: "meta_ads",
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "blossom_wedding",
      landingUrl: "https://veloriagrand.com/blossom-bellandur.html",
    });

    const touches = await prisma.leadTouch.findMany({ where: { leadId } });
    expect(touches).toHaveLength(1);
    expect(touches[0]).toMatchObject({
      channel: "push_api",
      source: "meta_ads",
      campaign: "Blossom Bellandur Wedding Campaign",
      campaignId: "123456789",
      adset: "Wedding Leads",
      adId: "987654321",
      utmContent: "video_01",
      externalId,
    });
    expect(touches[0]!.metadata).toMatchObject({ fb_lead_id: "123456789", device: "mobile", landing_page_variant: "B" });

    const ref = await prisma.leadExternalRef.findUnique({
      where: { lineageId_source_externalId: { lineageId: created.keyIds[0]!, source: "meta_ads", externalId } },
    });
    expect(ref?.leadId).toBe(leadId);
  });

  it("emits lead.created to the outbox without contact details", async () => {
    const events = await prisma.integrationEvent.findMany({ where: { resourceId: leadId } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "lead.created", resourceType: "Lead", status: "PENDING", dedupeKey: `lead.created:${leadId}` });
    const payload = JSON.stringify(events[0]!.payload);
    expect(payload).toContain(externalId);
    expect(payload).not.toContain(phone(10));
    expect(payload.toLowerCase()).not.toContain(`rahul.${U}@example.com`);
  });

  it("records consent against the contact", async () => {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    const consents = await prisma.consentRecord.count({ where: { subjectId: lead.contactId } });
    expect(consents).toBeGreaterThan(0);
  });

  it("writes an audit row with the lead and external id but no personal data", async () => {
    const log = await prisma.pushApiRequestLog.findFirst({ where: { leadId, outcome: "created" } });
    expect(log).toMatchObject({ responseStatus: 201, source: "meta_ads", externalId, endpoint: "/api/v1/push/leads" });
    expect(log!.durationMs).toBeGreaterThanOrEqual(0);
    const row = JSON.stringify(log);
    expect(row).not.toContain(phone(10));
    expect(row.toLowerCase()).not.toContain("rahul");
    // Only the display prefix (the same one Settings shows) — never the key itself.
    expect(row).not.toContain(keys.valid);
    expect(log!.apiKeyPrefix!.length).toBeLessThan(keys.valid.length / 2);
  });

  it("stores injection-looking input as plain text and leaves the tables intact", async () => {
    const r = await push({
      source: "website",
      phone: phone(11),
      name: "Robert'); DROP TABLE \"Lead\";--",
      message: "1' OR '1'='1; DELETE FROM \"Contact\";",
    });
    expect(r.status).toBe(201);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.json.data.lead_id }, include: { contact: true } });
    expect(`${lead.contact.firstName} ${lead.contact.lastName ?? ""}`).toContain("DROP TABLE");
    expect(await prisma.lead.count()).toBeGreaterThan(0);
    expect(await prisma.contact.count()).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------
describe("idempotency", () => {
  const idem = `idem-${U}`;
  const body = { source: "google_ads", external_id: `G-${U}`, name: "Idem Person", phone: phone(20), guest_count: 120 };
  let leadId = "";

  it("creates on the first request", async () => {
    const r = await push(body, { idempotencyKey: idem });
    expect(r.status).toBe(201);
    leadId = r.json.data.lead_id;
  });

  it("replays an identical retry as 200 without creating anything", async () => {
    // Scoped to this case's own contact: a global count also sees leads other
    // test files create in parallel.
    const ownLeads = () => prisma.lead.count({ where: { contact: { phone: e164(20) } } });
    const before = await ownLeads();
    const r = await push(body, { idempotencyKey: idem });
    expect(r.status).toBe(200);
    expect(r.headers.get("idempotent-replayed")).toBe("true");
    expect(r.json).toMatchObject({
      success: true,
      message: "Lead already exists",
      data: { lead_id: leadId, created: false, duplicate: true, matched_by: "idempotency_key" },
    });
    expect(r.json.request_id).toBe(r.headers.get("x-request-id"));
    expect(await ownLeads()).toBe(before);
    expect(before).toBe(1);
  });

  it("treats a body with its keys in a different order as the same request", async () => {
    const reordered = { guest_count: 120, phone: phone(20), name: "Idem Person", external_id: `G-${U}`, source: "google_ads" };
    const r = await push(reordered, { idempotencyKey: idem });
    expect(r.status).toBe(200);
    expect(r.json.data.lead_id).toBe(leadId);
  });

  it("refuses the same key with a different body (409)", async () => {
    const r = await push({ ...body, guest_count: 999 }, { idempotencyKey: idem });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("rejects a malformed Idempotency-Key (400)", async () => {
    const r = await push({ source: "website", phone: phone(21) }, { idempotencyKey: "has spaces in it" });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe("INVALID_IDEMPOTENCY_KEY");
  });

  it("does not store a validation failure, so the corrected retry goes through", async () => {
    const key = `idem-fix-${U}`;
    const bad = await push({ source: "website", phone: "12345" }, { idempotencyKey: key });
    expect(bad.status).toBe(422);
    const good = await push({ source: "website", phone: phone(22) }, { idempotencyKey: key });
    expect(good.status).toBe(201);
  });
});

// ------------------------------------------------------------
describe("deduplication", () => {
  it("matches source + external_id and fills blanks without overwriting (200)", async () => {
    const externalId = `EXT-${U}`;
    const first = await push({
      source: "meta_ads",
      external_id: externalId,
      name: "Dedup External",
      phone: phone(30),
      budget: 100000,
      utm_campaign: "first_campaign",
    });
    expect(first.status).toBe(201);
    const leadId = first.json.data.lead_id;
    const original = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

    const second = await push({
      source: "meta_ads",
      external_id: externalId,
      name: "Dedup External",
      phone: phone(30),
      budget: 999,
      guest_count: 180,
      event_date: "2027-01-15",
      utm_campaign: "second_campaign",
      message: "Following up on availability",
    });
    expect(second.status).toBe(200);
    expect(second.json.data).toMatchObject({ lead_id: leadId, created: false, duplicate: true, matched_by: "external_id" });
    expect(second.json.data.updated_fields).toEqual(expect.arrayContaining(["guest_count", "event_date"]));
    expect(second.json.data.updated_fields).not.toContain("budget");

    const after = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(Number(after.estimatedValue)).toBe(100000); // not overwritten
    expect(after.guestCount).toBe(180); // blank filled
    expect(after.createdAt.getTime()).toBe(original.createdAt.getTime()); // creation time preserved
    expect(after.description).toContain("Pushed again via Push API (meta_ads)");
    expect(after.description).toContain("Following up on availability");

    // First touch kept; the new touch recorded as the latest.
    const attribution = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId } });
    expect(attribution.utmCampaign).toBe("first_campaign");
    const touches = await prisma.leadTouch.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } });
    expect(touches.map((t) => t.utmCampaign)).toEqual(["first_campaign", "second_campaign"]);

    // Audit trail on the lead itself.
    const activity = await prisma.activityLog.findFirst({ where: { entityId: leadId, action: "push_api_updated" } });
    expect(activity?.changes).toMatchObject({ via: "push_api", external_id: externalId });

    // Exactly one lead.created — the update did not emit another.
    expect(await prisma.integrationEvent.count({ where: { resourceId: leadId, type: "lead.created" } })).toBe(1);
  });

  it("matches the same phone written differently within the window (200)", async () => {
    const first = await push({ source: "website", name: "Phone Dedup", phone: e164(31) });
    expect(first.status).toBe(201);
    const second = await push({ source: "google_ads", name: "Phone Dedup", phone: `0${phone(31)}` });
    expect(second.status).toBe(200);
    expect(second.json.data).toMatchObject({ lead_id: first.json.data.lead_id, matched_by: "recent_contact" });
  });

  it("matches the same email regardless of case (200)", async () => {
    const email = `dedup.email.${U}@example.com`;
    const first = await push({ source: "website", name: "Email Dedup", email });
    expect(first.status).toBe(201);
    const second = await push({ source: "linkedin_ads", name: "Email Dedup", email: email.toUpperCase() });
    expect(second.status).toBe(200);
    expect(second.json.data.lead_id).toBe(first.json.data.lead_id);
  });

  it("never merges on name alone", async () => {
    const a = await push({ source: "website", name: `Same Name ${U}`, phone: phone(32) });
    const b = await push({ source: "website", name: `Same Name ${U}`, phone: phone(33) });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.json.data.lead_id).not.toBe(a.json.data.lead_id);
  });

  it("does not reopen a closed lead: a returning customer is a new opportunity", async () => {
    const first = await push({ source: "website", name: "Returning", phone: phone(34), event_type: "wedding" });
    await prisma.lead.update({ where: { id: first.json.data.lead_id }, data: { status: "WON" } });
    const second = await push({ source: "website", name: "Returning", phone: phone(34), event_type: "anniversary" });
    expect(second.status).toBe(201);
    expect(second.json.data.lead_id).not.toBe(first.json.data.lead_id);
  });
});

// ------------------------------------------------------------
describe("rate limiting", () => {
  it("allows requests within the limit and returns 429 with Retry-After beyond it", async () => {
    const previous = process.env.PUSH_API_RATE_LIMIT_PER_MINUTE;
    process.env.PUSH_API_RATE_LIMIT_PER_MINUTE = "3";
    try {
      // Start early in a minute so all four requests land in the same window —
      // the 429 is always asserted, never skipped on a clock rollover.
      const intoMinute = Date.now() % 60_000;
      if (intoMinute > 45_000) await new Promise((r) => setTimeout(r, 60_000 - intoMinute + 250));
      // A body that fails validation: rate limiting runs first, and no leads are made.
      const statuses: number[] = [];
      let last: Awaited<ReturnType<typeof push>> | null = null;
      for (let i = 0; i < 4; i++) {
        last = await push({ source: "website" }, { key: keys.limited });
        statuses.push(last.status);
      }
      expect(statuses).toEqual([422, 422, 422, 429]);
      expect(last!.json.error.code).toBe("RATE_LIMITED");
      expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
      expect(last!.headers.get("x-ratelimit-remaining")).toBe("0");
    } finally {
      process.env.PUSH_API_RATE_LIMIT_PER_MINUTE = previous;
    }
  }, 90_000);

  it("keeps one count across concurrent requests", async () => {
    const previous = process.env.PUSH_API_RATE_LIMIT_PER_MINUTE;
    process.env.PUSH_API_RATE_LIMIT_PER_MINUTE = "1000";
    try {
      const minuteStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
      const before = await prisma.pushRateLimitCounter.findFirst({ where: { apiKeyId: created.keyIds[4], window: "minute", windowStart: minuteStart } });
      await Promise.all(Array.from({ length: 10 }, () => push({ source: "website" }, { key: keys.limited })));
      const after = await prisma.pushRateLimitCounter.findFirst({ where: { apiKeyId: created.keyIds[4], window: "minute", windowStart: minuteStart } });
      // No lost updates: all ten increments landed (allowing for a minute rollover mid-test).
      if (after && before && after.windowStart.getTime() === before.windowStart.getTime()) {
        expect(after.count - before.count).toBe(10);
      } else {
        expect(after?.count ?? 10).toBeGreaterThanOrEqual(1);
      }
    } finally {
      process.env.PUSH_API_RATE_LIMIT_PER_MINUTE = previous;
    }
  });
});

// ------------------------------------------------------------
describe("CORS and switches", () => {
  it("sends no CORS headers to an origin that isn't allow-listed", async () => {
    const r = await push({ source: "website", phone: phone(40) }, { headers: { origin: "https://evil.example" } });
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns 503 when the Push API is switched off", async () => {
    process.env.PUSH_API_ENABLED = "false";
    try {
      const r = await push({ source: "website", phone: phone(41) });
      expect(r.status).toBe(503);
      expect(r.json.error.code).toBe("PUSH_API_DISABLED");
    } finally {
      process.env.PUSH_API_ENABLED = "true";
    }
  });
});

// ------------------------------------------------------------
describe("health and docs", () => {
  it("reports health without infrastructure details", async () => {
    const res = healthGET();
    expect(await res.json()).toEqual({ status: "ok", service: "veloria-push-api", version: "1.0.0" });
  });

  it("serves the OpenAPI document", async () => {
    const res = openapiGET();
    const doc = await res.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.paths["/api/v1/push/leads"].post).toBeDefined();
  });
});
