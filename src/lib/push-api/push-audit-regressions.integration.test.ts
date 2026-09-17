// ============================================================
// Push API — regression tests for the 17 Sep 2026 audit.
//
// Every test here is a scenario that was REPRODUCED failing against a real
// database during the audit, now asserting the correct behaviour. The test
// name carries the audit finding id. Runs only against a *_test database.
// ============================================================

import { afterAll, beforeAll, beforeEach, describe as vitestDescribe, expect, it, vi } from "vitest";

vi.mock("@/../auth", () => ({ auth: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/integrations/weflux-crm", () => ({ pushLeadToWeflux: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/crm/lead-assigned-email", () => ({ sendLeadAssignedEmail: vi.fn().mockResolvedValue({ sent: false, reason: "test" }) }));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/v1/push/leads/route";
import { POST as legacyPOST } from "@/app/api/leads/capture/route";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { generatePushKey, hashApiKey } from "./keys";
import { requestHash } from "./idempotency";
import { parsePushLead } from "./leads/schema";
import { resetAuthFailures } from "./guard";
import { randomBytes } from "crypto";

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
const IS_TEST_DB = dbName.endsWith("_test");
if (!IS_TEST_DB) console.warn(`[push-audit-regressions] skipped: "${dbName || "(none)"}" is not a *_test database.`);
const describe = vitestDescribe.skipIf(!IS_TEST_DB);

const U = Date.now();
/** A valid, unique Indian mobile for case n (n < 1000). */
const ph = (n: number) => `9${String(U).slice(-6)}${String(n).padStart(3, "0")}`;
const T = 120_000;

let userId = "";
const keyIds: string[] = [];
const K: Record<string, { raw: string; id: string }> = {};

async function mint(label: string, opts: { scopes?: string[]; source?: string | null; lineageId?: string } = {}) {
  const { raw, hash, prefix } = generatePushKey();
  const row = await prisma.apiKey.create({
    data: {
      name: `audit ${label} ${U}`,
      keyHash: hash,
      prefix,
      createdById: userId,
      scopes: opts.scopes ?? ["leads:create", "leads:update"],
      source: opts.source ?? null,
    },
  });
  await prisma.apiKey.update({ where: { id: row.id }, data: { lineageId: opts.lineageId ?? row.id } });
  keyIds.push(row.id);
  K[label] = { raw, id: row.id };
  return K[label]!;
}

async function push(
  body: unknown,
  opts: { key?: string; idem?: string; headers?: Record<string, string>; raw?: string } = {}
) {
  const headers: Record<string, string> = { "content-type": "application/json", ...opts.headers };
  headers.authorization = `Bearer ${opts.key ?? K.main!.raw}`;
  if (opts.idem) headers["idempotency-key"] = opts.idem;
  const res = await POST(new Request("https://app.test/api/v1/push/leads", { method: "POST", headers, body: opts.raw ?? JSON.stringify(body) }));
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
}

const liveLeadsForPhone = (e164: string) => prisma.lead.count({ where: { deletedAt: null, contact: { phone: e164 } } });

beforeAll(async () => {
  if (!IS_TEST_DB) return;
  process.env.PUSH_API_ENABLED = "true";
  process.env.PUSH_API_RATE_LIMIT_PER_MINUTE = "100000";
  process.env.PUSH_API_RATE_LIMIT_PER_HOUR = "100000";
  const user = await prisma.user.create({ data: { email: `audit-${U}@test.local`, name: "Audit", role: "SUPER_ADMIN" } });
  userId = user.id;
  await mint("main");
}, T);

beforeEach(() => resetAuthFailures());

afterAll(async () => {
  if (!IS_TEST_DB) return;
  await new Promise((r) => setTimeout(r, 2000));
  const leads = await prisma.lead.findMany({ where: { createdById: userId }, select: { id: true, contactId: true } });
  const leadIds = leads.map((l) => l.id);
  const contactIds = [...new Set(leads.map((l) => l.contactId))];
  const q = <X,>(p: Promise<X>) => p.catch(() => undefined);
  await q(prisma.integrationEvent.deleteMany({ where: { resourceId: { in: leadIds } } }));
  await q(prisma.pushApiRequestLog.deleteMany({ where: { OR: [{ apiKeyId: { in: keyIds } }, { userAgent: "audit-regression" }] } }));
  await q(prisma.pushRateLimitCounter.deleteMany({ where: { apiKeyId: { in: keyIds } } }));
  await q(prisma.pushIngestLock.deleteMany({}));
  await q(prisma.activityLog.deleteMany({ where: { userId } }));
  for (const m of ["leadFirstResponse", "leadRoutingDecision", "task", "crmNote"] as const) {
    const d = (prisma as unknown as Record<string, { deleteMany?: (a: unknown) => Promise<unknown> }>)[m];
    if (d?.deleteMany) await q(d.deleteMany({ where: { leadId: { in: leadIds } } }));
  }
  await q(prisma.leadAttribution.deleteMany({ where: { leadId: { in: leadIds } } }));
  await q(prisma.lead.deleteMany({ where: { id: { in: leadIds } } }));
  await q(prisma.consentRecord.deleteMany({ where: { subjectId: { in: contactIds } } }));
  await q(prisma.contact.deleteMany({ where: { id: { in: contactIds } } }));
  await q(prisma.apiKey.deleteMany({ where: { id: { in: keyIds } } }));
  await q(prisma.user.deleteMany({ where: { id: userId } }));
  await prisma.$disconnect();
}, T);

// ------------------------------------------------------------
describe("High", () => {
  it("H1: 12 simultaneous pushes for 12 different people all succeed", async () => {
    const rs = await Promise.all(
      Array.from({ length: 12 }, (_, i) => push({ source: "meta_ads", external_id: `H1-${U}-${i}`, name: `H1 ${i}`, phone: ph(100 + i) }))
    );
    expect(rs.map((r) => r.status)).toEqual(Array(12).fill(201));
    expect(new Set(rs.map((r) => r.json.data.lead_id)).size).toBe(12);
  }, T);

  it("H1 (webhooks too): 12 simultaneous capture deliveries with distinct external ids all succeed", async () => {
    const rs = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        captureLeadFromExternal({ name: `H1w ${i}`, phone: `+91${ph(150 + i)}`, source: "google_ads", externalId: `gads-${U}-${i}` })
      )
    );
    expect(rs.every((r) => r.success)).toBe(true);
    expect(new Set(rs.map((r) => (r as { leadId: string }).leadId)).size).toBe(12);
  }, T);

  it("H2: an enquiry whose external id belonged to a deleted lead becomes a new live lead", async () => {
    const a = await push({ source: "meta_ads", external_id: `H2-${U}`, name: "H2", phone: ph(200) });
    await prisma.lead.update({ where: { id: a.json.data.lead_id }, data: { deletedAt: new Date() } });
    const b = await push({ source: "meta_ads", external_id: `H2-${U}`, name: "H2", phone: ph(200) });
    expect(b.status).toBe(201);
    expect(b.json.data.lead_id).not.toBe(a.json.data.lead_id);
    expect(await liveLeadsForPhone(`+91${ph(200)}`)).toBe(1);
  }, T);

  it("H2 (webhooks too): a redelivered external id of a deleted lead creates a new lead", async () => {
    const a = await captureLeadFromExternal({ name: "H2w", phone: `+91${ph(210)}`, source: "facebook_ads", externalId: `fb-${U}` });
    await prisma.lead.update({ where: { id: (a as { leadId: string }).leadId }, data: { deletedAt: new Date() } });
    const b = await captureLeadFromExternal({ name: "H2w", phone: `+91${ph(210)}`, source: "facebook_ads", externalId: `fb-${U}` });
    expect((b as { leadId: string }).leadId).not.toBe((a as { leadId: string }).leadId);
    expect((b as { deduped?: boolean }).deduped).toBeUndefined();
  }, T);

  it("H3: a UAE number is never merged into an Indian contact with the same last ten digits", async () => {
    const a = await push({ source: "website", name: "H3 India", phone: `+91${ph(300)}` });
    const b = await push({ source: "website", name: "H3 UAE", phone: `+971${ph(300)}` });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.json.data.lead_id).not.toBe(a.json.data.lead_id);
  }, T);

  it("H3: external id \"X\" is never matched to the lead of \"X]\"", async () => {
    const a = await push({ source: "website", external_id: `H3-${U}]`, name: "H3 A", phone: ph(310) });
    const b = await push({ source: "website", external_id: `H3-${U}`, name: "H3 B", phone: ph(311) });
    expect(b.status).toBe(201);
    expect(b.json.data.lead_id).not.toBe(a.json.data.lead_id);
  }, T);

  it("H4: 5 simultaneous pushes for one new person make exactly one lead and one contact", async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () => push({ source: "website", name: "H4", phone: ph(400) })));
    expect(rs.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(new Set(rs.map((r) => r.json.data.lead_id)).size).toBe(1);
    expect(await prisma.contact.count({ where: { phone: `+91${ph(400)}` } })).toBe(1);
  }, T);

  it("H5: a claim abandoned by a crashed request is taken over by the retry", async () => {
    const body = { source: "website", name: "H5", phone: ph(500) };
    const idem = `H5-${U}`;
    const parsed = parsePushLead(body);
    if (!parsed.ok) throw new Error("bad fixture");
    await prisma.pushIdempotencyRecord.create({
      data: {
        apiKeyId: K.main!.id,
        lineageId: K.main!.id,
        idempotencyKey: idem,
        requestHash: requestHash(parsed.lead),
        lockedUntil: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const r = await push(body, { idem });
    expect(r.status).toBe(201);
    const again = await push(body, { idem });
    expect(again.status).toBe(200);
    expect(again.headers.get("idempotent-replayed")).toBe("true");
  }, T);

  it("H5: a claim still within its lease is reported in progress, briefly", async () => {
    const body = { source: "website", name: "H5b", phone: ph(510) };
    const idem = `H5b-${U}`;
    const parsed = parsePushLead(body);
    if (!parsed.ok) throw new Error("bad fixture");
    await prisma.pushIdempotencyRecord.create({
      data: {
        apiKeyId: K.main!.id,
        lineageId: K.main!.id,
        idempotencyKey: idem,
        requestHash: requestHash(parsed.lead),
        lockedUntil: new Date(Date.now() + 60_000),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const r = await push(body, { idem });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("IDEMPOTENCY_KEY_IN_PROGRESS");
    expect(Number(r.headers.get("retry-after"))).toBeLessThanOrEqual(5);
  }, T);
});

// ------------------------------------------------------------
describe("Medium", () => {
  it("M1: a repeat push never overwrites first-touch attribution on the lead", async () => {
    const a = await push({ source: "google_ads", name: "M1", phone: ph(600), utm_source: "google", utm_medium: "cpc", utm_campaign: "first_c", campaign_id: "G111", adset_id: "AG111" });
    await new Promise((r) => setTimeout(r, 1500)); // deferred capture tail writes first-touch attribution
    const read = () =>
      prisma.lead.findUniqueOrThrow({
        where: { id: a.json.data.lead_id },
        select: { utmSource: true, utmCampaign: true, attribution: { select: { utmCampaign: true, gadsCampaignId: true, gadsAdgroupId: true } } },
      });
    const before = await read();
    expect(before.utmSource).toBe("google");
    await push({ source: "google_ads", name: "M1", phone: ph(600), utm_source: "bing", utm_campaign: "second_c", campaign_id: "G222", adset_id: "AG222" });
    expect(await read()).toEqual(before);
    const touches = await prisma.leadTouch.findMany({ where: { leadId: a.json.data.lead_id }, orderBy: { createdAt: "asc" } });
    expect(touches.map((t) => t.utmCampaign)).toEqual(["first_c", "second_c"]);
  }, T);

  it("M2: a different event type from the same person is a separate lead", async () => {
    const a = await push({ source: "website", name: "M2", phone: ph(610), event_type: "wedding", event_date: "2026-12-01" });
    const b = await push({ source: "website", name: "M2", phone: ph(610), event_type: "corporate", event_date: "2027-03-01" });
    expect(b.status).toBe(201);
    expect(b.json.data.lead_id).not.toBe(a.json.data.lead_id);
    const c = await push({ source: "website", name: "M2", phone: ph(610), event_type: "wedding" });
    expect(c.status).toBe(200);
    expect(c.json.data.lead_id).toBe(a.json.data.lead_id);
  }, T);

  it("M2: a lead older than the dedup window is not reused", async () => {
    const a = await push({ source: "website", name: "M2 old", phone: ph(620), event_type: "wedding" });
    await prisma.lead.update({ where: { id: a.json.data.lead_id }, data: { createdAt: new Date(Date.now() - 10 * 86_400_000) } });
    const b = await push({ source: "website", name: "M2 old", phone: ph(620), event_type: "wedding" });
    expect(b.status).toBe(201);
    expect(b.json.data.lead_id).not.toBe(a.json.data.lead_id);
  }, T);

  it("M4: a Push API key is refused by the legacy capture endpoint; a legacy key still works there", async () => {
    const pushKeyRes = await legacyPOST(
      new NextRequest("https://app.test/api/leads/capture", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": K.main!.raw },
        body: JSON.stringify({ name: "M4", phone: ph(630), source: "website" }),
      })
    );
    expect(pushKeyRes.status).toBe(403);

    const legacyRaw = `vel_${randomBytes(32).toString("hex")}`;
    const legacy = await prisma.apiKey.create({
      data: { name: `audit legacy ${U}`, keyHash: hashApiKey(legacyRaw), prefix: legacyRaw.slice(0, 12), createdById: userId },
    });
    keyIds.push(legacy.id);
    const legacyRes = await legacyPOST(
      new NextRequest("https://app.test/api/leads/capture", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": legacyRaw },
        body: JSON.stringify({ name: "M4 legacy", phone: ph(631), source: "website" }),
      })
    );
    expect(legacyRes.status).toBe(201);
    expect(await push({ source: "website", phone: ph(632) }, { key: legacyRaw }).then((r) => r.status)).toBe(401);
  }, T);

  it("M5: a key issued for one source can't push another", async () => {
    const bound = await mint("bound", { source: "website" });
    const r = await push({ source: "meta_ads", name: "M5", phone: ph(640) }, { key: bound.raw });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("SOURCE_NOT_ALLOWED");
    expect((await push({ source: "website", name: "M5", phone: ph(641) }, { key: bound.raw })).status).toBe(201);
  }, T);

  it("M5: two integrations using the same source + external id never touch each other's leads", async () => {
    const a = await mint("integrationA");
    const b = await mint("integrationB");
    const ra = await push({ source: "partner", external_id: `M5-${U}`, name: "M5 A", phone: ph(650) }, { key: a.raw });
    const rb = await push({ source: "partner", external_id: `M5-${U}`, name: "M5 B", phone: ph(651) }, { key: b.raw });
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    expect(rb.json.data.lead_id).not.toBe(ra.json.data.lead_id);
  }, T);

  it("M5: rotation keeps the integration — a retry with the replacement key still replays", async () => {
    const orig = await mint("rotating");
    const body = { source: "website", name: "Rotate", phone: ph(660) };
    const first = await push(body, { key: orig.raw, idem: `rot-${U}` });
    expect(first.status).toBe(201);
    const replacement = await mint("rotated", { lineageId: orig.id });
    const retry = await push(body, { key: replacement.raw, idem: `rot-${U}` });
    expect(retry.status).toBe(200);
    expect(retry.json.data.lead_id).toBe(first.json.data.lead_id);
  }, T);

  it("M6: failed authentication from one IP is throttled and stops writing audit rows", async () => {
    const previous = process.env.PUSH_API_FAILED_AUTH_PER_MINUTE;
    process.env.PUSH_API_FAILED_AUTH_PER_MINUTE = "3";
    try {
      const ip = `203.0.113.${(U % 200) + 1}`;
      const bad = `vg_live_${"A".repeat(43)}`;
      const statuses: number[] = [];
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await push({ source: "website", phone: ph(670) }, { key: bad, headers: { "x-forwarded-for": `6.6.6.6, ${ip}`, "user-agent": "audit-regression" } });
        statuses.push(r.status);
        ids.push(r.headers.get("x-request-id")!);
      }
      expect(statuses).toEqual([401, 401, 401, 429, 429, 429]);
      expect(await prisma.pushApiRequestLog.count({ where: { requestId: { in: ids } } })).toBe(3);
    } finally {
      process.env.PUSH_API_FAILED_AUTH_PER_MINUTE = previous;
    }
  }, T);

  it("M7: a 255-character fbclid keeps every attribution field", async () => {
    const a = await push({ source: "meta_ads", name: "M7", phone: ph(680), utm_source: "facebook", utm_campaign: "m7c", fbclid: "f".repeat(255) });
    expect(a.status).toBe(201);
    await new Promise((r) => setTimeout(r, 1500));
    const attr = await prisma.leadAttribution.findUnique({ where: { leadId: a.json.data.lead_id } });
    expect(attr).toMatchObject({ utmSource: "facebook", utmCampaign: "m7c", fbclid: "f".repeat(255) });
    expect((await push({ source: "meta_ads", phone: ph(681), fbclid: "f".repeat(256) })).status).toBe(422);
  }, T);

  it("M8: rate-limit windows are stored in UTC whatever the database session time zone", async () => {
    await push({ source: "website" }); // 422, but counted
    const minuteStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const row = await prisma.pushRateLimitCounter.findFirst({
      where: { apiKeyId: K.main!.id, window: "minute" },
      orderBy: { windowStart: "desc" },
    });
    const tz = await prisma.$queryRaw<{ tz: string }[]>`SELECT current_setting('TimeZone') AS tz`;
    // On the audit database this runs under America/New_York, like production;
    // the assertion below must hold whatever the session zone is.
    expect(typeof tz[0]!.tz).toBe("string");
    expect(Math.abs(row!.windowStart.getTime() - minuteStart.getTime())).toBeLessThanOrEqual(60_000);
  }, T);

  it("M9: 30,000-deep metadata is a 422, not a 500", async () => {
    const raw = `{"source":"website","phone":"+91${ph(690)}","metadata":{"a":${"[".repeat(30_000)}${"]".repeat(30_000)}}}`;
    const r = await push(null, { raw, idem: `M9-${U}` });
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe("VALIDATION_ERROR");
  }, T);

  it("M10: lead.created is written exactly once, atomically with the lead", async () => {
    const a = await push({ source: "website", external_id: `M10-${U}`, name: "M10", phone: ph(700) });
    await push({ source: "website", external_id: `M10-${U}`, name: "M10", phone: ph(700), message: "again" });
    const events = await prisma.integrationEvent.findMany({ where: { resourceId: a.json.data.lead_id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.dedupeKey).toBe(`lead.created:${a.json.data.lead_id}`);
    expect(await prisma.leadExternalRef.count({ where: { leadId: a.json.data.lead_id } })).toBe(1);
  }, T);

  it("M11: a new key stops creating leads at its daily cap; duplicates are still acknowledged", async () => {
    const previous = process.env.PUSH_API_MAX_NEW_LEADS_PER_DAY;
    process.env.PUSH_API_MAX_NEW_LEADS_PER_DAY = "2";
    try {
      const capped = await mint("capped");
      expect((await push({ source: "website", name: "C1", phone: ph(710) }, { key: capped.raw })).status).toBe(201);
      expect((await push({ source: "website", name: "C2", phone: ph(711) }, { key: capped.raw })).status).toBe(201);
      const third = await push({ source: "website", name: "C3", phone: ph(712) }, { key: capped.raw });
      expect(third.status).toBe(429);
      expect(third.json.error.code).toBe("LEAD_CAP_REACHED");
      expect((await push({ source: "website", name: "C1", phone: ph(710) }, { key: capped.raw })).status).toBe(200);
    } finally {
      process.env.PUSH_API_MAX_NEW_LEADS_PER_DAY = previous;
    }
  }, T);
});

// ------------------------------------------------------------
describe("Low and spec gaps", () => {
  it("L1: consent given on a repeat push is recorded once", async () => {
    const a = await push({ source: "website", name: "L1", phone: ph(800) });
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: a.json.data.lead_id } });
    const b = await push({ source: "website", name: "L1", phone: ph(800), consent: true });
    expect(b.json.data.updated_fields).toContain("consent");
    await push({ source: "website", name: "L1", phone: ph(800), consent: true });
    expect(await prisma.consentRecord.count({ where: { subjectId: lead.contactId } })).toBe(1);
  }, T);

  it("L5: the same message pushed again isn't appended twice", async () => {
    const a = await push({ source: "website", name: "L5", phone: ph(810), message: "first" });
    await push({ source: "website", name: "L5", phone: ph(810), message: "Please call after 6pm" });
    await push({ source: "website", name: "L5", phone: ph(810), message: "Please call after 6pm" });
    const d = (await prisma.lead.findUniqueOrThrow({ where: { id: a.json.data.lead_id } })).description ?? "";
    expect(d.split("Please call after 6pm").length - 1).toBe(1);
  }, T);

  it("L6: matched_by and updated_fields describe what actually happened", async () => {
    const a = await push({ source: "website", external_id: `L6-${U}`, name: "L6", phone: ph(820) });
    const b = await push({ source: "website", external_id: `L6-${U}`, name: "L6", phone: ph(820), budget: 50000 });
    expect(b.json.data).toMatchObject({ lead_id: a.json.data.lead_id, matched_by: "external_id", updated_fields: ["budget"] });
    const c = await push({ source: "website", name: "L6", phone: ph(820), guest_count: 90 });
    expect(c.json.data).toMatchObject({ matched_by: "recent_contact", updated_fields: ["guest_count"] });
  }, T);

  it("Scope: without leads:update a match is acknowledged and the lead is left untouched", async () => {
    const createOnly = await mint("createOnly", { scopes: ["leads:create"] });
    const a = await push({ source: "website", name: "RO", phone: ph(830) }, { key: createOnly.raw });
    const b = await push({ source: "website", name: "RO", phone: ph(830), budget: 99999, message: "should not land" }, { key: createOnly.raw });
    expect(b.status).toBe(200);
    expect(b.json.data.updated_fields).toEqual([]);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: a.json.data.lead_id } });
    expect(lead.estimatedValue).toBeNull();
    expect(lead.description ?? "").not.toContain("should not land");
  }, T);

  it("Contact gaps: a new email on a phone-matched lead fills the contact's missing email", async () => {
    const a = await push({ source: "website", name: "Fill", phone: ph(840) });
    const b = await push({ source: "website", name: "Fill", phone: ph(840), email: `fill.${U}@example.com` });
    expect(b.json.data.updated_fields).toContain("email");
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: a.json.data.lead_id }, include: { contact: true } });
    expect(lead.contact.email).toBe(`fill.${U}@example.com`);
  }, T);

  it("HTTPS only: a request that arrived over plain HTTP is refused", async () => {
    const r = await push({ source: "website", phone: ph(850) }, { headers: { "x-forwarded-proto": "http" } });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("HTTPS_REQUIRED");
  }, T);

  it("L7: a Meta push reaches capture as facebook_ads, the name assignment rules use", async () => {
    const a = await push({ source: "meta_ads", name: "L7", phone: ph(860) });
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: a.json.data.lead_id } });
    expect(lead.title.startsWith("facebook_ads Lead")).toBe(true);
    expect(lead.source).toBe("FACEBOOK_ADS");
  }, T);
});
