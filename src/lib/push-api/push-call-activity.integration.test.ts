// ============================================================
// POST /api/v1/push/call-activity, end to end against a real Postgres: the
// actual route handler with authentication, scopes, source binding,
// idempotency, lead matching / creation and the call record itself.
//
// Runs ONLY against a database whose name ends in "_test".
// ============================================================

import { afterAll, beforeAll, describe as vitestDescribe, expect, it, vi } from "vitest";

vi.mock("@/../auth", () => ({ auth: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: async () => ({ sent: false }) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/integrations/weflux-crm", () => ({ pushLeadToWeflux: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/crm/lead-assigned-email", () => ({ sendLeadAssignedEmail: async () => ({ sent: false, reason: "test" }) }));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/v1/push/call-activity/route";
import { POST as leadsPOST } from "@/app/api/v1/push/leads/route";
import { generatePushKey } from "./keys";

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
const IS_TEST_DB = dbName.endsWith("_test");
if (!IS_TEST_DB) {
  console.warn(`[push-call-activity.integration] skipped: DATABASE_URL database "${dbName || "(none)"}" is not a *_test database.`);
}
const describe = vitestDescribe.skipIf(!IS_TEST_DB);

const U = Date.now();
const ENDPOINT = "https://app.theveloriagrand.com/api/v1/push/call-activity";
const phone = (n: number) => `+919${String(U).slice(-7)}${String(n).padStart(2, "0")}`;
const created = { userId: "", agentId: "", keyIds: [] as string[] };
const created_agent = () => created.agentId;
const keys = { calls: "", leadsOnly: "", metaCalls: "" };

async function mintKey(label: string, scopes: string[], source: string | null) {
  const { raw, hash, prefix } = generatePushKey();
  const row = await prisma.apiKey.create({
    data: { name: `call-test ${label} ${U}`, keyHash: hash, prefix, createdById: created.userId, scopes, source },
  });
  await prisma.apiKey.update({ where: { id: row.id }, data: { lineageId: row.id } });
  created.keyIds.push(row.id);
  return raw;
}

async function push(body: unknown, opts: { key?: string; idempotencyKey?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "call-activity-test",
    authorization: `Bearer ${opts.key ?? keys.calls}`,
  };
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;
  const res = await POST(new Request(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) }));
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
}

let callSeq = 0;
const call = (n: number, extra: Record<string, unknown> = {}) => ({
  external_call_id: `cv_${U}_auto_${++callSeq}`,
  phone: phone(n),
  call_summary: `Asked about Saturday availability (${n}); wants a site visit.`,
  call_date: new Date(Date.now() - 60 * 60_000).toISOString(),
  ...extra,
});

beforeAll(async () => {
  if (!IS_TEST_DB) return;
  process.env.PUSH_API_ENABLED = "true";
  const admin = await prisma.user.create({
    data: { email: `call-admin-${U}@test.local`, name: "Call Test Admin", role: "SUPER_ADMIN", isActive: true },
  });
  created.userId = admin.id;
  const agent = await prisma.user.create({
    data: { email: `riya-${U}@test.local`, name: `Riya Sharma ${U}`, role: "SALES_EXEC", isActive: true },
  });
  created.agentId = agent.id;
  keys.calls = await mintKey("calls", ["calls:create"], "callvibe");
  keys.leadsOnly = await mintKey("leads", ["leads:create"], null);
  keys.metaCalls = await mintKey("meta", ["calls:create"], "meta_ads");
}, 60_000);

afterAll(async () => {
  if (!IS_TEST_DB) return;
  await new Promise((r) => setTimeout(r, 1500)); // deferred capture tails
  const quiet = <T,>(p: Promise<T>) => p.catch(() => undefined);
  const contacts = await prisma.contact.findMany({ where: { phone: { startsWith: `+919${String(U).slice(-7)}` } }, select: { id: true } });
  const contactIds = contacts.map((c) => c.id);
  const leads = await prisma.lead.findMany({ where: { contactId: { in: contactIds } }, select: { id: true } });
  const leadIds = leads.map((l) => l.id);
  await quiet(prisma.communication.deleteMany({ where: { contactId: { in: contactIds } } }));
  await quiet(prisma.integrationEvent.deleteMany({ where: { resourceId: { in: leadIds } } }));
  await quiet(prisma.leadTouch.deleteMany({ where: { leadId: { in: leadIds } } }));
  await quiet(prisma.leadAttribution.deleteMany({ where: { leadId: { in: leadIds } } }));
  await quiet(prisma.activityLog.deleteMany({ where: { entityId: { in: leadIds } } }));
  await quiet(prisma.lead.deleteMany({ where: { id: { in: leadIds } } }));
  await quiet(prisma.contact.deleteMany({ where: { id: { in: contactIds } } }));
  await quiet(prisma.pushApiRequestLog.deleteMany({ where: { apiKeyId: { in: created.keyIds } } }));
  await quiet(prisma.pushIdempotencyRecord.deleteMany({ where: { apiKeyId: { in: created.keyIds } } }));
  await quiet(prisma.pushRateLimitCounter.deleteMany({ where: { apiKeyId: { in: created.keyIds } } }));
  await quiet(prisma.apiKey.deleteMany({ where: { id: { in: created.keyIds } } }));
  await quiet(prisma.user.deleteMany({ where: { id: { in: [created.userId, created.agentId] } } }));
  await prisma.$disconnect();
}, 60_000);

describe("recording calls", () => {
  let leadId = "";

  it("creates the lead when none exists (201) and records the call on it", async () => {
    const r = await push(
      call(1, {
        contact_name: "Rahul Sharma",
        external_call_id: `cv_${U}_1`,
        sentiment: "positive",
        ai_score: 82,
        ai_insights: { objections: ["Price felt high"], budget_signal: "250000" },
        recording_url: "https://storage.callvibe.ai/rec/1.mp3",
        call_duration_seconds: 246,
        action_items: ["Schedule site visit", "Email price sheet"],
      })
    );
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json).toMatchObject({ success: true, message: "Lead created and call recorded", data: { lead_created: true, duplicate: false, matched_by: "created" } });
    leadId = r.json.data.lead_id;

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { contact: true } });
    expect(lead.source).toBe("PHONE_INQUIRY");
    expect(lead.contact.phone).toBe(phone(1));
    expect(`${lead.contact.firstName} ${lead.contact.lastName}`.trim()).toBe("Rahul Sharma");

    const comm = await prisma.communication.findUniqueOrThrow({ where: { id: r.json.data.call_id }, include: { callLog: true } });
    expect(comm).toMatchObject({ type: "CALL", direction: "OUTBOUND", contactId: lead.contactId, sentiment: "POSITIVE" });
    expect(comm.callLog).toMatchObject({
      disposition: "COMPLETED",
      durationSeconds: 246,
      recordingUrl: "https://storage.callvibe.ai/rec/1.mp3",
      externalCallId: `callvibe:cv_${U}_1`,
    });
    expect(comm.metadata).toMatchObject({
      provider: "CALLVIBE",
      leadId,
      aiScore: 82,
      actionItems: ["Schedule site visit", "Email price sheet"],
      aiInsights: { budget_signal: "250000" },
    });
  });

  it("attaches a later call to the same lead by phone (200)", async () => {
    const r = await push(call(1, { external_call_id: `cv_${U}_2`, call_status: "no_answer" }));
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ lead_id: leadId, lead_created: false, duplicate: false, matched_by: "phone" });
    expect(await prisma.lead.count({ where: { contact: { phone: phone(1) } } })).toBe(1);
  });

  it("never records the same CallVibe call twice", async () => {
    const r = await push(call(1, { external_call_id: `cv_${U}_2` }));
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ message: "Call already recorded", data: { duplicate: true, matched_by: "external_call_id", lead_id: leadId } });
    expect(await prisma.callLog.count({ where: { externalCallId: `callvibe:cv_${U}_2` } })).toBe(1);
  });

  it("treats a call the hourly import already stored as recorded", async () => {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    await prisma.communication.create({
      data: {
        type: "CALL",
        content: "Imported",
        contactId: lead.contactId,
        createdById: created.userId,
        metadata: { provider: "CALLVIBE", callId: `pulled_${U}` },
        callLog: { create: { disposition: "COMPLETED", externalCallId: `callvibe:pulled_${U}`, contactId: lead.contactId, agentId: created.userId } },
      },
    });
    const r = await push(call(1, { external_call_id: `pulled_${U}` }));
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ duplicate: true, lead_id: leadId });
    expect(await prisma.callLog.count({ where: { externalCallId: `callvibe:pulled_${U}` } })).toBe(1);
  });

  it("replays an Idempotency-Key without recording again", async () => {
    const body = call(3);
    const first = await push(body, { idempotencyKey: `cv-idem-${U}` });
    expect(first.status).toBe(201);
    const again = await push(body, { idempotencyKey: `cv-idem-${U}` });
    expect(again.status).toBe(200);
    expect(again.headers.get("idempotent-replayed")).toBe("true");
    expect(again.json.data).toMatchObject({ call_id: first.json.data.call_id, lead_id: first.json.data.lead_id, duplicate: true, matched_by: "idempotency_key" });
    const contact = await prisma.contact.findFirstOrThrow({ where: { phone: phone(3) } });
    expect(await prisma.communication.count({ where: { contactId: contact.id, type: "CALL" } })).toBe(1);
  });

  it("uses lead_id when sent, and refuses an unknown one", async () => {
    const r = await push({ lead_id: leadId, external_call_id: `cv_${U}_byid`, call_summary: "Follow-up call.", call_date: new Date(Date.now() - 60_000).toISOString() });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ lead_id: leadId, matched_by: "lead_id" });

    const bad = await push({ lead_id: "does-not-exist", external_call_id: `cv_${U}_bad`, call_summary: "x", call_date: new Date().toISOString() });
    expect(bad.status).toBe(422);
    expect(bad.json.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { lead_id: "No lead with this id" } });
  });

  it("puts the call on an existing open lead created by a lead push", async () => {
    const leadKey = keys.leadsOnly;
    const res = await leadsPOST(
      new Request("https://app.theveloriagrand.com/api/v1/push/leads", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${leadKey}`, "user-agent": "call-activity-test" },
        body: JSON.stringify({ source: "website", phone: phone(4), name: "Web Enquirer" }),
      })
    );
    const lead = await res.json();
    expect(res.status).toBe(201);
    const r = await push(call(4));
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ lead_id: lead.data.lead_id, matched_by: "phone", lead_created: false });
  });

  it("a connected outbound call by a known agent stops an existing lead's first-response clock at the call time", async () => {
    const first = await push(call(5, { call_status: "no_answer" })); // creates the lead
    expect(first.status).toBe(201);
    const created = await prisma.lead.findUniqueOrThrow({ where: { id: first.json.data.lead_id } });
    expect(created.firstRespondedAt).toBeNull(); // never for the call that created it

    const at = new Date(Date.now() + 1000 - 1000).toISOString();
    const r = await push(call(5, { agent_name: `Riya Sharma ${U}`, call_date: at }));
    expect(r.status).toBe(200);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.json.data.lead_id } });
    expect(lead.firstRespondedAt?.toISOString()).toBe(new Date(at).toISOString());
    const comm = await prisma.communication.findUniqueOrThrow({ where: { id: r.json.data.call_id }, include: { callLog: true } });
    expect(comm.createdById).toBe(created_agent());
    expect(comm.callLog!.agentId).toBe(created_agent());
  });

  it("a cold outbound call that creates the lead doesn't count as a first response", async () => {
    const r = await push(call(6, { agent_name: `Riya Sharma ${U}` }));
    expect(r.status).toBe(201);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: r.json.data.lead_id } })).firstRespondedAt).toBeNull();
  });

  it("never credits an admin account, even by exact email", async () => {
    const r = await push(call(9, { agent_email: `call-admin-${U}@test.local` }));
    const comm = await prisma.communication.findUniqueOrThrow({ where: { id: r.json.data.call_id }, include: { callLog: true } });
    // Falls back to the system user, and isn't treated as a known agent.
    expect(comm.metadata).toMatchObject({ agentEmail: `call-admin-${U}@test.local` });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: r.json.data.lead_id } })).firstRespondedAt).toBeNull();
  });

  it("refuses a lead_id whose customer has a different phone, and falls back to the phone for a deleted lead", async () => {
    const other = await push(call(10));
    const mismatch = await push({ ...call(11), lead_id: other.json.data.lead_id });
    expect(mismatch.status).toBe(422);
    expect(mismatch.json.error.fields).toHaveProperty("phone");

    await prisma.lead.update({ where: { id: other.json.data.lead_id }, data: { deletedAt: new Date() } });
    const fallback = await push({ ...call(10), lead_id: other.json.data.lead_id });
    expect(fallback.status).toBe(201); // the deleted lead's customer gets a fresh lead
    expect(fallback.json.data.lead_id).not.toBe(other.json.data.lead_id);
  });

  it("requires external_call_id and refuses calls more than a year old", async () => {
    const { external_call_id: _omit, ...noId } = call(12);
    void _omit;
    const r = await push(noId);
    expect(r.status).toBe(422);
    expect(r.json.error.fields).toHaveProperty("external_call_id");
    const old = await push(call(12, { call_date: new Date(Date.now() - 400 * 86_400_000).toISOString() }));
    expect(old.status).toBe(422);
    expect(old.json.error.fields.call_date).toContain("year");
  });

  it("records a call once when CallVibe sends it several times at once", async () => {
    const body = call(7, { external_call_id: `cv_${U}_burst` });
    const results = await Promise.all(Array.from({ length: 5 }, () => push(body)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(await prisma.callLog.count({ where: { externalCallId: `callvibe:cv_${U}_burst` } })).toBe(1);
    expect(new Set(results.map((r) => r.json.data.lead_id)).size).toBe(1);
  });
});

describe("access", () => {
  it("refuses a key without calls:create", async () => {
    const r = await push(call(8), { key: keys.leadsOnly });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("INSUFFICIENT_SCOPE");
  });

  it("refuses a key issued for a different source", async () => {
    const r = await push(call(8), { key: keys.metaCalls });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("SOURCE_NOT_ALLOWED");
  });

  it("names every invalid field", async () => {
    const r = await push({ phone: "12345", call_summary: "", call_date: "yesterday", ai_score: 150 });
    expect(r.status).toBe(422);
    expect(Object.keys(r.json.error.fields).sort()).toEqual(["ai_score", "call_date", "call_summary", "external_call_id", "phone"]);
  });
});
