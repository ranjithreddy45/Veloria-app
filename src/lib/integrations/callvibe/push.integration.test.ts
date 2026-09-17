// ============================================================
// CallVibe lead push, end to end: the real job queue on a real Postgres,
// pushing into a local mock CallVibe server (mock-callvibe-server.ts).
//
// Runs ONLY against a database whose name ends in "_test": it creates and
// deletes users, CallVibe configs, contacts and leads.
// ============================================================

import { afterAll, afterEach, beforeAll, beforeEach, describe as vitestDescribe, expect, it, vi } from "vitest";

vi.mock("@/../auth", () => ({ auth: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: async () => ({ sent: false }) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/integrations/weflux-crm", () => ({ pushLeadToWeflux: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/crm/lead-assigned-email", () => ({ sendLeadAssignedEmail: async () => ({ sent: false, reason: "test" }) }));

import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { startMockCallVibe, MOCK_CREDENTIALS, type MockCallVibe } from "./mock-callvibe-server";
import { resetCallVibeThrottle } from "./write-client";
import {
  autoPushContactToCallVibe,
  enqueueCallVibePush,
  processDueCallVibePushJobs,
  resetCallVibeAgentCache,
  retryDelayMs,
  runCallVibePushJob,
} from "./push";

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
const IS_TEST_DB = dbName.endsWith("_test");
if (!IS_TEST_DB) {
  console.warn(`[callvibe-push.integration] skipped: DATABASE_URL database "${dbName || "(none)"}" is not a *_test database.`);
}
const describe = vitestDescribe.skipIf(!IS_TEST_DB);

const U = Date.now();
let seq = 0;
/** A fresh Indian mobile per contact. */
const mobile = () => `9${String(U).slice(-7)}${String(++seq).padStart(2, "0")}`;

let server: MockCallVibe;
const created = { userId: "", agentUserId: "", configId: "" };

async function setConfig(data: { pushEnabled?: boolean; pushDefaultAssignee?: string | null; pushCallingList?: string | null; isActive?: boolean } = {}) {
  await prisma.callVibeConfig.update({
    where: { id: created.configId },
    data: {
      baseUrl: server.baseUrl,
      isActive: data.isActive ?? true,
      pushEnabled: data.pushEnabled ?? false,
      pushDefaultAssignee: data.pushDefaultAssignee ?? null,
      pushCallingList: data.pushCallingList ?? null,
    },
  });
}

async function makeContact(opts: { phone?: string | null; withLead?: boolean; ownerId?: string } = {}) {
  const contact = await prisma.contact.create({
    data: {
      firstName: "Priya",
      lastName: `Push${U}`,
      email: `priya-${U}-${seq}@test.local`,
      phone: opts.phone === undefined ? mobile() : opts.phone,
    },
  });
  if (opts.withLead !== false) {
    await prisma.lead.create({
      data: {
        title: `Wedding reception ${U}`,
        contactId: contact.id,
        eventType: "WEDDING",
        eventDate: new Date("2026-12-20T00:00:00Z"),
        guestCount: 400,
        assignedToId: opts.ownerId ?? null,
        createdById: created.userId,
      },
    });
  }
  return contact;
}

/** Run a job now even if its backoff hasn't elapsed. */
async function runNow(jobId: string) {
  await prisma.callVibePushJob.update({ where: { id: jobId }, data: { nextRunAt: new Date(Date.now() - 1000) } });
  return runCallVibePushJob(jobId);
}

beforeAll(async () => {
  if (!IS_TEST_DB) return;
  process.env.CALLVIBE_PUSH_MIN_INTERVAL_MS = "0";
  server = await startMockCallVibe();
  const admin = await prisma.user.create({
    data: { email: `cv-admin-${U}@test.local`, name: "CallVibe Test Admin", role: "SUPER_ADMIN", isActive: true },
  });
  created.userId = admin.id;
  // A CRM user whose name matches a CallVibe agent in the mock.
  const agent = await prisma.user.create({
    data: { email: `cv-agent-${U}@test.local`, name: "Asha Rao", role: "SALES_EXEC", isActive: true },
  });
  created.agentUserId = agent.id;
  await prisma.callVibeConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
  const config = await prisma.callVibeConfig.create({
    data: { baseUrl: server.baseUrl, ...MOCK_CREDENTIALS, createdById: admin.id, syncEnabled: false },
  });
  created.configId = config.id;
});

beforeEach(async () => {
  if (!IS_TEST_DB) return;
  await server.close();
  server = await startMockCallVibe(); // fresh leads, and a fresh token cache key
  resetCallVibeThrottle();
  resetCallVibeAgentCache();
  await setConfig();
});

// Expected failures log on purpose; silence them per test. (Not restoreAllMocks:
// that would also reset the module stubs above.)
let errorSpy: ReturnType<typeof vi.spyOn> | null = null;
const quietErrors = () => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
};
afterEach(() => {
  errorSpy?.mockRestore();
  errorSpy = null;
});

afterAll(async () => {
  if (!IS_TEST_DB) return;
  await new Promise((r) => setTimeout(r, 1500)); // deferred capture tails
  const contacts = await prisma.contact.findMany({ where: { lastName: { startsWith: `Push${U}` } }, select: { id: true } });
  const ids = contacts.map((c) => c.id);
  const leads = await prisma.lead.findMany({ where: { contactId: { in: ids } }, select: { id: true } });
  const leadIds = leads.map((l) => l.id);
  await prisma.leadAttribution.deleteMany({ where: { leadId: { in: leadIds } } }).catch(() => {});
  await prisma.activityLog.deleteMany({ where: { entityId: { in: [...ids, ...leadIds] } } }).catch(() => {});
  await prisma.task.deleteMany({ where: { leadId: { in: leadIds } } }).catch(() => {});
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } }).catch((e) => console.warn("lead cleanup:", e.message));
  await prisma.callVibePushJob.deleteMany({ where: { contactId: { in: ids } } });
  await prisma.contact.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.warn("contact cleanup:", e.message));
  await prisma.callVibeConfig.delete({ where: { id: created.configId } });
  await prisma.user.deleteMany({ where: { id: { in: [created.userId, created.agentUserId] } } }).catch(() => {});
  await server.close();
  await prisma.$disconnect();
});

describe("CallVibe push queue", () => {
  it("creates the CallVibe lead and records the result on the contact", async () => {
    await setConfig({ pushCallingList: "Weddings" });
    const contact = await makeContact({ ownerId: created.agentUserId });
    const [jobId] = await enqueueCallVibePush([contact.id], "manual", created.userId);
    expect(await runCallVibePushJob(jobId!)).toBe("SUCCESS");

    const lead = server.leads.get(contact.phone!.replace(/^/, "91"))!;
    expect(lead).toMatchObject({ name: `Priya Push${U}`, assigned_to: "Asha Rao", source: "Veloria CRM" });
    expect(lead.custom_fields).toMatchObject({ veloria_contact_id: contact.id, calling_list: "Weddings", guest_count: 400, event_date: "2026-12-20" });
    expect(lead.notes).toHaveLength(1);
    expect(lead.notes[0]).toContain("Guests: 400");

    const after = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(after).toMatchObject({
      callvibeLastPushStatus: "SUCCESS",
      callvibeLastPushError: null,
      callvibeLeadId: lead.id,
      callvibePushedPhone: `+91${contact.phone}`,
    });
    expect(after.callvibeLastPushedAt).toBeInstanceOf(Date);
    const job = await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: jobId! } });
    expect(job).toMatchObject({ status: "SUCCESS", attempts: 1, dedupeKey: null });
    const config = await prisma.callVibeConfig.findUniqueOrThrow({ where: { id: created.configId } });
    expect(config.lastPushStatus).toBe("SUCCESS");
  });

  it("updates the same lead on a second push: no duplicate, no second context note", async () => {
    const contact = await makeContact();
    const [first] = await enqueueCallVibePush([contact.id], "manual");
    await runCallVibePushJob(first!);
    await prisma.contact.update({ where: { id: contact.id }, data: { firstName: "Priyanka" } });
    const [second] = await enqueueCallVibePush([contact.id], "bulk");
    expect(second).not.toBe(first);
    expect(await runCallVibePushJob(second!)).toBe("SUCCESS");

    expect(server.leads.size).toBe(1);
    const lead = [...server.leads.values()][0]!;
    expect(lead.name).toBe(`Priyanka Push${U}`);
    expect(lead.notes).toHaveLength(1);
  });

  it("collapses repeated requests into one live job", async () => {
    const contact = await makeContact();
    const a = await enqueueCallVibePush([contact.id], "manual");
    const b = await enqueueCallVibePush([contact.id, contact.id], "bulk");
    const c = await enqueueCallVibePush([contact.id], "auto");
    expect(new Set([...a, ...b, ...c]).size).toBe(1);
    // Two workers race for it: exactly one runs.
    const results = await Promise.all([runCallVibePushJob(a[0]!), runCallVibePushJob(a[0]!)]);
    expect(results.filter((r) => r === "SUCCESS")).toHaveLength(1);
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(server.requests.filter((r) => r.method === "PUT")).toHaveLength(1);
  });

  it("an edit that arrives while a push is running is pushed once that push settles", { timeout: 20_000 }, async () => {
    const contact = await makeContact();
    const [jobId] = await enqueueCallVibePush([contact.id], "manual");
    // A worker holds the job.
    await prisma.callVibePushJob.update({ where: { id: jobId! }, data: { status: "RUNNING", lockedUntil: new Date(Date.now() + 60_000) } });
    await prisma.contact.update({ where: { id: contact.id }, data: { firstName: "Edited" } });
    expect(await enqueueCallVibePush([contact.id], "manual")).toEqual([jobId]);
    expect((await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: jobId! } })).rerunRequested).toBe(true);

    // The worker's lease runs out and the job is picked up and settles; a fresh job follows.
    await prisma.callVibePushJob.update({ where: { id: jobId! }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect(await runCallVibePushJob(jobId!)).toBe("SUCCESS");
    let jobs: { status: string }[] = [];
    for (let i = 0; i < 40; i++) {
      jobs = await prisma.callVibePushJob.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "asc" } });
      if (jobs.length === 2 && jobs[1]!.status === "SUCCESS") break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(jobs.map((j) => j.status)).toEqual(["SUCCESS", "SUCCESS"]);
    expect(server.requests.filter((r) => r.method === "PUT")).toHaveLength(2);
    expect([...server.leads.values()][0]!.name).toBe(`Edited Push${U}`);
  });

  it("a worker that overran its lease can't overwrite the worker that took over", { timeout: 20_000 }, async () => {
    const contact = await makeContact();
    const [jobId] = await enqueueCallVibePush([contact.id], "manual");
    await runCallVibePushJob((await enqueueCallVibePush([(await makeContact()).id], "manual"))[0]!); // sign in first
    server.setDelay(1500); // the first worker stalls inside CallVibe
    const slow = runCallVibePushJob(jobId!);
    await new Promise((r) => setTimeout(r, 300));
    // Its lease runs out and a second worker takes the job over.
    await prisma.callVibePushJob.update({ where: { id: jobId! }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    server.setDelay(0);
    const takeover = await runCallVibePushJob(jobId!);
    expect(takeover).toBe("SUCCESS");
    quietErrors();
    expect(await slow).toBeNull(); // its late result is discarded
    const job = await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: jobId! } });
    expect(job).toMatchObject({ status: "SUCCESS", attempts: 2, leaseId: null, dedupeKey: null });
    expect(server.leads.size).toBe(2);
  });

  it("queues many contacts in one go, reusing live jobs", async () => {
    const [a, b, c] = [await makeContact(), await makeContact(), await makeContact()];
    const [aJob] = await enqueueCallVibePush([a.id], "manual");
    await prisma.callVibePushJob.update({ where: { id: aJob! }, data: { status: "RUNNING", lockedUntil: new Date(Date.now() + 60_000) } });
    const ids = await enqueueCallVibePush([a.id, b.id, c.id, b.id], "bulk");
    expect(ids).toHaveLength(3);
    expect(ids).toContain(aJob);
    expect((await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: aJob! } })).rerunRequested).toBe(true);
    const statuses = await prisma.contact.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, select: { callvibeLastPushStatus: true } });
    expect(statuses.every((x) => x.callvibeLastPushStatus === "PENDING")).toBe(true);
    // Settle these so other tests' sweeps don't pick them up.
    await prisma.callVibePushJob.updateMany({ where: { id: { in: ids } }, data: { status: "FAILED", dedupeKey: null, rerunRequested: false } });
  });

  it("a request during a rate-limit backoff doesn't cut the wait short", async () => {
    quietErrors();
    const contact = await makeContact();
    await runCallVibePushJob((await enqueueCallVibePush([(await makeContact()).id], "manual"))[0]!); // sign in first
    server.throttleNext(1, 600);
    const [jobId] = await enqueueCallVibePush([contact.id], "manual");
    expect(await runCallVibePushJob(jobId!)).toBe("RETRY");
    const before = (await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: jobId! } })).nextRunAt;
    expect(await enqueueCallVibePush([contact.id], "manual")).toEqual([jobId]);
    expect((await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: jobId! } })).nextRunAt).toEqual(before);
    await prisma.callVibePushJob.update({ where: { id: jobId! }, data: { status: "FAILED", dedupeKey: null } });
  });

  it("retries when the context note fails, without repeating the lead or the note", async () => {
    quietErrors();
    const contact = await makeContact();
    const [jobId] = await enqueueCallVibePush([contact.id], "manual");
    await runCallVibePushJob((await enqueueCallVibePush([(await makeContact()).id], "manual"))[0]!); // sign in first
    server.failPathNext("/notes", 1, 503);
    expect(await runCallVibePushJob(jobId!)).toBe("RETRY");
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).callvibeLastPushError).toContain("context note didn't save yet");
    expect(await runNow(jobId!)).toBe("SUCCESS");
    expect(server.leads.get(`91${contact.phone}`)!.notes).toHaveLength(1);
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({
      callvibeNotedPhone: `+91${contact.phone}`,
      callvibeLastPushStatus: "SUCCESS",
    });
  });

  it("retries when the agent list is temporarily unavailable, instead of guessing", async () => {
    quietErrors();
    await setConfig({ pushDefaultAssignee: "Vikram Nair" });
    const contact = await makeContact({ ownerId: created.userId });
    const [jobId] = await enqueueCallVibePush([contact.id], "manual");
    server.failPathNext("/agent-list", 1, 503);
    expect(await runCallVibePushJob(jobId!)).toBe("RETRY");
    expect(await runNow(jobId!)).toBe("SUCCESS");
    expect(server.leads.get(`91${contact.phone}`)!.assigned_to).toBe("Vikram Nair");
  });

  it("uses the default agent when the agent list can't be read", async () => {
    await setConfig({ pushDefaultAssignee: "Vikram Nair" });
    server.setAgentListBody({ unexpected: true });
    const contact = await makeContact({ ownerId: created.userId }); // owner isn't an agent
    expect(await runCallVibePushJob((await enqueueCallVibePush([contact.id], "manual"))[0]!)).toBe("SUCCESS");
    expect(server.leads.get(`91${contact.phone}`)!.assigned_to).toBe("Vikram Nair");
  });

  it("gives up a job whose worker keeps dying instead of reclaiming it forever", async () => {
    quietErrors();
    const contact = await makeContact();
    const [jobId] = await enqueueCallVibePush([contact.id], "manual");
    await prisma.callVibePushJob.update({
      where: { id: jobId! },
      data: { status: "RUNNING", attempts: 6, lockedUntil: new Date(Date.now() - 1000) },
    });
    expect(await runCallVibePushJob(jobId!)).toBe("FAILED");
    expect(server.requests.filter((r) => r.method === "PUT")).toHaveLength(0);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).callvibeLastPushError).toContain("given up");
  });

  it("auto-push skips a contact without a dialable phone", async () => {
    await setConfig({ pushEnabled: true });
    const contact = await makeContact({ phone: "12345" });
    await autoPushContactToCallVibe(contact.id);
    expect(await prisma.callVibePushJob.count({ where: { contactId: contact.id } })).toBe(0);
  });

  it("re-authenticates once when the session has expired", async () => {
    const one = await makeContact();
    const two = await makeContact();
    await runCallVibePushJob((await enqueueCallVibePush([one.id], "manual"))[0]!);
    server.validTokens.clear();
    expect(await runCallVibePushJob((await enqueueCallVibePush([two.id], "manual"))[0]!)).toBe("SUCCESS");
    expect(server.signIns).toBe(2);
  });

  it("backs off on a 429, honouring Retry-After, then succeeds on the fast lane", async () => {
    quietErrors();
    const contact = await makeContact();
    const [jobId] = await enqueueCallVibePush([contact.id], "manual");
    // The sign-in answers first, so throttle the lead request that follows it.
    await runCallVibePushJob((await enqueueCallVibePush([(await makeContact()).id], "manual"))[0]!);
    server.throttleNext(1, 120);

    const before = Date.now();
    expect(await runCallVibePushJob(jobId!)).toBe("RETRY");
    const waiting = await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: jobId! } });
    expect(waiting.nextRunAt.getTime() - before).toBeGreaterThanOrEqual(120_000);
    expect(waiting.dedupeKey).toBe(`contact:${contact.id}`);
    expect(waiting.lastStatus).toBe(429);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).callvibeLastPushStatus).toBe("PENDING");

    // Not due yet: the sweep leaves it alone.
    await processDueCallVibePushJobs();
    expect(await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: jobId! } })).toMatchObject({ status: "RETRY", attempts: 1 });
    await prisma.callVibePushJob.update({ where: { id: jobId! }, data: { nextRunAt: new Date(Date.now() - 1000) } });
    const swept = await processDueCallVibePushJobs();
    expect(swept.success).toBeGreaterThanOrEqual(1);
    expect(await prisma.callVibePushJob.findUniqueOrThrow({ where: { id: jobId! } })).toMatchObject({ status: "SUCCESS", attempts: 2 });
  });

  it("gives up after maxAttempts when CallVibe keeps failing", async () => {
    quietErrors();
    const contact = await makeContact();
    const [jobId] = await enqueueCallVibePush([contact.id], "manual");
    await prisma.callVibePushJob.update({ where: { id: jobId! }, data: { maxAttempts: 2 } });
    await runCallVibePushJob((await enqueueCallVibePush([(await makeContact()).id], "manual"))[0]!); // sign in first
    server.failNext(10, 503);
    expect(await runNow(jobId!)).toBe("RETRY");
    expect(await runNow(jobId!)).toBe("FAILED");
    const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(c.callvibeLastPushStatus).toBe("FAILED");
    expect(c.callvibeLastPushError).toMatch(/CallVibe/);
  });

  it("fails an invalid phone with a readable reason, without calling CallVibe", async () => {
    quietErrors();
    const contact = await makeContact({ phone: "12345" });
    const [jobId] = await enqueueCallVibePush([contact.id], "manual");
    expect(await runCallVibePushJob(jobId!)).toBe("FAILED");
    expect(server.requests.filter((r) => r.path.startsWith("/api/leads"))).toHaveLength(0);
    const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(c.callvibeLastPushError).toContain("isn't a phone number CallVibe can dial");
  });

  it("fails on an unknown default agent, and falls back to the default when the owner isn't an agent", async () => {
    quietErrors();
    await setConfig({ pushDefaultAssignee: "Nobody Here" });
    const bad = await makeContact({ ownerId: created.userId }); // "CallVibe Test Admin" isn't an agent
    expect(await runCallVibePushJob((await enqueueCallVibePush([bad.id], "manual"))[0]!)).toBe("FAILED");
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: bad.id } })).callvibeLastPushError).toContain(
      'The default assignee "Nobody Here" isn\'t an agent in CallVibe'
    );

    await setConfig({ pushDefaultAssignee: "vikram nair" });
    resetCallVibeAgentCache();
    const good = await makeContact({ ownerId: created.userId });
    expect(await runCallVibePushJob((await enqueueCallVibePush([good.id], "manual"))[0]!)).toBe("SUCCESS");
    expect(server.leads.get(`91${good.phone}`)!.assigned_to).toBe("Vikram Nair");
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: good.id } })).callvibeLastPushError).toContain(
      "isn't a CallVibe agent, so the lead went to Vikram Nair"
    );
  });

  it("on a phone change pushes the new number and leaves a note on the old lead", async () => {
    const contact = await makeContact();
    const oldPhone = contact.phone!;
    await runCallVibePushJob((await enqueueCallVibePush([contact.id], "manual"))[0]!);
    const newPhone = mobile();
    await prisma.contact.update({ where: { id: contact.id }, data: { phone: newPhone } });
    expect(await runCallVibePushJob((await enqueueCallVibePush([contact.id], "manual"))[0]!)).toBe("SUCCESS");

    expect(server.leads.size).toBe(2);
    expect(server.leads.get(`91${oldPhone}`)!.notes.at(-1)).toContain(`changed to +91${newPhone}`);
    expect(server.requests.some((r) => r.method === "DELETE")).toBe(false);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).callvibePushedPhone).toBe(`+91${newPhone}`);
  });

  it("fails cleanly when CallVibe isn't connected", async () => {
    quietErrors();
    await setConfig({ isActive: false });
    const contact = await makeContact();
    expect(await runCallVibePushJob((await enqueueCallVibePush([contact.id], "manual"))[0]!)).toBe("FAILED");
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).callvibeLastPushError).toContain("isn't connected");
  });

  it("auto-push does nothing while the toggle is off", async () => {
    const contact = await makeContact();
    await autoPushContactToCallVibe(contact.id);
    expect(await prisma.callVibePushJob.count({ where: { contactId: contact.id } })).toBe(0);
  });

  it("a new lead is saved even when CallVibe is down, and its push waits to retry", async () => {
    quietErrors();
    await setConfig({ pushEnabled: true });
    await server.close(); // CallVibe unreachable
    const phone = mobile();
    const result = await captureLeadFromExternal({
      name: `Priya Push${U}`,
      phone,
      email: `down-${U}@test.local`,
      source: "WEBSITE",
      eventType: "WEDDING",
    } as Parameters<typeof captureLeadFromExternal>[0]);
    expect(result, JSON.stringify(result)).toMatchObject({ success: true });
    const contactId = (result as { contactId: string }).contactId;
    expect(await prisma.lead.count({ where: { contactId } })).toBe(1);

    // The auto-push runs after the capture returns.
    let job = null;
    for (let i = 0; i < 40 && job?.status !== "RETRY"; i++) {
      await new Promise((r) => setTimeout(r, 250));
      job = await prisma.callVibePushJob.findFirst({ where: { contactId } });
    }
    expect(job).toMatchObject({ trigger: "auto", status: "RETRY" });
    server = await startMockCallVibe(); // afterAll closes it
  });

  it("backoff grows exponentially, is capped, and never undercuts Retry-After", () => {
    const mid = () => 0.5;
    expect(retryDelayMs(1, undefined, mid)).toBe(30_000);
    expect(retryDelayMs(2, undefined, mid)).toBe(60_000);
    expect(retryDelayMs(5, undefined, mid)).toBe(480_000);
    expect(retryDelayMs(20, undefined, mid)).toBe(3_600_000);
    expect(retryDelayMs(1, 300_000, mid)).toBe(300_000);
  });
});
