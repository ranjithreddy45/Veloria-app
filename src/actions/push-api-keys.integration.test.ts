// ============================================================
// Push API key management and metrics, against a real Postgres.
// Covers what can't be proven by typechecking: the rotation claim under
// concurrency, the stored-vs-reported expiry, lineage, scope validation, and
// the metrics SQL (including its UTC binding). *_test databases only.
// ============================================================
import { afterAll, beforeAll, describe as vitestDescribe, expect, it, vi } from "vitest";

const session = { user: { id: "", role: "SUPER_ADMIN" } };
vi.mock("@/../auth", () => ({ auth: async () => session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { generateApiKey, listApiKeys, rotateApiKey } from "@/actions/api-key.actions";
import { getPushApiMetrics } from "@/actions/push-api-metrics.actions";

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
const IS_TEST_DB = dbName.endsWith("_test");
const describe = vitestDescribe.skipIf(!IS_TEST_DB);
const U = Date.now();
const T = 60_000;

beforeAll(async () => {
  if (!IS_TEST_DB) return;
  const user = await prisma.user.create({ data: { email: `keys-${U}@test.local`, name: "Keys", role: "SUPER_ADMIN" } });
  session.user.id = user.id;
}, T);

afterAll(async () => {
  if (!IS_TEST_DB) return;
  await prisma.pushApiRequestLog.deleteMany({ where: { userAgent: `keys-test-${U}` } }).catch(() => {});
  await prisma.apiKey.deleteMany({ where: { createdById: session.user.id } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: session.user.id } }).catch(() => {});
  await prisma.$disconnect();
}, T);

describe("generateApiKey", () => {
  it("keeps the legacy key exactly as before when called without options", async () => {
    const r = await generateApiKey(`legacy ${U}`);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.key.startsWith("vel_")).toBe(true);
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: r.data.id } });
    expect(row).toMatchObject({ scopes: [], source: null, expiresAt: null, lineageId: null });
  }, T);

  it("mints a push key with its own lineage and the default scopes", async () => {
    const r = await generateApiKey(`push ${U}`, { pushApi: true, source: "website", expiresInDays: 30 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.key.startsWith("vg_live_")).toBe(true);
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: r.data.id } });
    expect(row.lineageId).toBe(row.id);
    expect(row.scopes).toEqual(["leads:create", "leads:update"]);
    expect(row.source).toBe("website");
  }, T);

  it("rejects unknown scopes and push keys without leads:create", async () => {
    expect((await generateApiKey(`bad ${U}`, { pushApi: true, scopes: ["bookings:create"] })).success).toBe(false);
    expect((await generateApiKey(`bad2 ${U}`, { pushApi: true, scopes: ["leads:update"] })).success).toBe(false);
    const createOnly = await generateApiKey(`co ${U}`, { pushApi: true, scopes: ["leads:create"] });
    expect(createOnly.success).toBe(true);
  }, T);
});

describe("rotateApiKey", () => {
  it("mints a CallVibe key with call activity only, and refuses update without create", async () => {
    const r = await generateApiKey(`callvibe ${U}`, { pushApi: true, source: "callvibe", scopes: ["calls:create"] });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({ scopes: ["calls:create"], source: "callvibe" });
    expect((await generateApiKey(`cu ${U}`, { pushApi: true, scopes: ["calls:create", "leads:update"] })).success).toBe(false);
    const both = await generateApiKey(`both ${U}`, { pushApi: true, scopes: ["calls:create", "leads:create"] });
    expect(both.success && both.data.scopes).toEqual(["leads:create", "calls:create"]);
  }, T);

  it("L3: reports the expiry actually stored, keeps the lineage, and never extends the old key", async () => {
    const r = await generateApiKey(`rot ${U}`, { pushApi: true, expiresInDays: 1 });
    if (!r.success) throw new Error(r.error);
    // Make the old key expire in 2 hours — sooner than the 24h grace period.
    const soon = new Date(Date.now() + 2 * 3_600_000);
    await prisma.apiKey.update({ where: { id: r.data.id }, data: { expiresAt: soon } });

    const rot = await rotateApiKey(r.data.id);
    expect(rot.success).toBe(true);
    if (!rot.success) return;
    const old = await prisma.apiKey.findUniqueOrThrow({ where: { id: r.data.id } });
    expect(new Date(rot.data.oldKeyExpiresAt).getTime()).toBe(old.expiresAt!.getTime());
    expect(old.expiresAt!.getTime()).toBe(soon.getTime());
    const replacement = await prisma.apiKey.findUniqueOrThrow({ where: { id: rot.data.id } });
    expect(replacement).toMatchObject({ rotatedFromId: old.id, lineageId: old.id });
  }, T);

  it("L3: a key can be rotated once; a second (or concurrent) rotation is refused", async () => {
    const r = await generateApiKey(`rot2 ${U}`, { pushApi: true });
    if (!r.success) throw new Error(r.error);
    const results = await Promise.all([rotateApiKey(r.data.id), rotateApiKey(r.data.id), rotateApiKey(r.data.id)]);
    expect(results.filter((x) => x.success)).toHaveLength(1);
    expect(await prisma.apiKey.count({ where: { rotatedFromId: r.data.id } })).toBe(1);
    const again = await rotateApiKey(r.data.id);
    expect(again.success).toBe(false);
  }, T);

  it("refuses to rotate a legacy key", async () => {
    const r = await generateApiKey(`legacy2 ${U}`);
    if (!r.success) throw new Error(r.error);
    expect((await rotateApiKey(r.data.id)).success).toBe(false);
  }, T);

  it("M3: listApiKeys returns the fields the settings page needs after a reload", async () => {
    const list = await listApiKeys();
    expect(list.success).toBe(true);
    if (!list.success) return;
    const push = list.data.find((k) => k.scopes.includes("leads:create"));
    expect(push).toBeDefined();
    expect(push).toHaveProperty("expiresAt");
    expect(push).toHaveProperty("revokedAt");
    expect(push).toHaveProperty("rotatedFromId");
    expect(push).not.toHaveProperty("keyHash");
  }, T);
});

describe("getPushApiMetrics", () => {
  it("counts outcomes, codes and latency from the request log, in UTC", async () => {
    const base = { endpoint: "/api/v1/push/leads", method: "POST", userAgent: `keys-test-${U}`, apiKeyPrefix: `vg_live_m${U}`.slice(0, 16) };
    const rows = [
      { outcome: "created", responseStatus: 201, durationMs: 100 },
      { outcome: "duplicate", responseStatus: 200, durationMs: 200 },
      { outcome: "rejected", responseStatus: 422, errorCode: "VALIDATION_ERROR", durationMs: 5 },
      { outcome: "rejected", responseStatus: 401, errorCode: "UNAUTHORIZED", durationMs: 2 },
      { outcome: "error", responseStatus: 500, errorCode: "INTERNAL_ERROR", durationMs: 900 },
    ];
    const before = await getPushApiMetrics();
    if (!before.success) throw new Error(before.error);
    await prisma.pushApiRequestLog.createMany({
      data: rows.map((r, i) => ({ ...base, ...r, requestId: `req_metrics_${U}_${i}` })),
    });
    // A row just over a week old must fall outside both windows.
    await prisma.pushApiRequestLog.create({
      data: { ...base, outcome: "created", responseStatus: 201, durationMs: 1, requestId: `req_metrics_${U}_old`, createdAt: new Date(Date.now() - 8 * 86_400_000) },
    });

    const after = await getPushApiMetrics();
    if (!after.success) throw new Error(after.error);
    const d24 = after.data.last24h;
    const b24 = before.data.last24h;
    expect(d24.total - b24.total).toBe(5);
    expect(d24.created - b24.created).toBe(1);
    expect(d24.duplicate - b24.duplicate).toBe(1);
    expect(d24.validationErrors - b24.validationErrors).toBe(1);
    expect(d24.authFailures - b24.authFailures).toBe(1);
    expect(d24.serverErrors - b24.serverErrors).toBe(1);
    expect(after.data.last7d.total - before.data.last7d.total).toBe(5);
    expect(d24.p95Ms).not.toBeNull();
    const key = after.data.byKey24h.find((k) => k.apiKeyPrefix === base.apiKeyPrefix);
    expect(key).toMatchObject({ count: 5, errors: 3 });
    expect(JSON.stringify(after.data)).not.toMatch(/ipHash|userAgent/);
  }, T);
});
