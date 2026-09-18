import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startMockCallVibe, MOCK_CREDENTIALS, type MockCallVibe } from "./mock-callvibe-server";
import {
  addLeadNote,
  callVibePathPhone,
  describeValidationError,
  extractLeadId,
  getLeadByPhone,
  listAgentNames,
  parseRetryAfter,
  resetCallVibeThrottle,
  toE164,
  upsertLeadByPhone,
} from "./write-client";

let server: MockCallVibe;
const creds = () => ({ baseUrl: server.baseUrl, ...MOCK_CREDENTIALS });

beforeAll(async () => {
  process.env.CALLVIBE_PUSH_MIN_INTERVAL_MS = "0";
});

beforeEach(async () => {
  // A fresh server per test = a fresh base URL = a fresh token-cache key.
  server = await startMockCallVibe();
  resetCallVibeThrottle();
});

afterEach(async () => {
  await server.close();
});

afterAll(() => {
  delete process.env.CALLVIBE_PUSH_MIN_INTERVAL_MS;
});

describe("create, update and upsert by phone", () => {
  it("creates a lead keyed by the phone", async () => {
    const r = await upsertLeadByPhone(creds(), "+919876543210", {
      name: "Rahul Sharma",
      email: "rahul@example.com",
      assignedTo: "Asha Rao",
      source: "Veloria CRM",
      customFields: { veloria_contact_id: "c1", calling_list: "Weddings" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(server.leads.size).toBe(1);
    const lead = server.leads.get("919876543210")!;
    expect(lead).toMatchObject({ name: "Rahul Sharma", assigned_to: "Asha Rao", source: "Veloria CRM" });
    expect(lead.custom_fields).toEqual({ veloria_contact_id: "c1", calling_list: "Weddings" });
    expect(r.data.leadId).toBe(lead.id);
    expect(r.data.responseKeys).toContain("phone");
    // Only documented request fields, and only the ones we set.
    const put = server.requests.find((q) => q.method === "PUT")!;
    expect(Object.keys(put.body as object).sort()).toEqual(["assigned_to", "custom_fields", "email", "name", "source"]);
  });

  it("never blanks a field it didn't set (an agent's status survives a re-push)", async () => {
    await upsertLeadByPhone(creds(), "+919876543210", { name: "Rahul" });
    server.leads.get("919876543210")!.status = "Interested"; // set by an agent inside CallVibe
    await upsertLeadByPhone(creds(), "+919876543210", { name: "Rahul Sharma" });
    expect(server.leads.get("919876543210")).toMatchObject({ name: "Rahul Sharma", status: "Interested" });
  });

  it("updates the same lead when the phone is pushed again", async () => {
    const first = await upsertLeadByPhone(creds(), "+919876543210", { name: "Rahul" });
    const second = await upsertLeadByPhone(creds(), "+919876543210", { name: "Rahul Sharma", email: "r@example.com" });
    expect(first.ok && second.ok).toBe(true);
    expect(server.leads.size).toBe(1);
    expect(server.leads.get("919876543210")).toMatchObject({ name: "Rahul Sharma", email: "r@example.com" });
    if (first.ok && second.ok) expect(second.data.leadId).toBe(first.data.leadId);
  });

  it("never creates a duplicate however the same number is written", async () => {
    for (const phone of ["+919876543210", "9876543210", "+91 98765-43210", "098765 43210"]) {
      const e164 = toE164(phone);
      expect(e164).toBe("+919876543210");
      expect((await upsertLeadByPhone(creds(), e164!, { name: "Same person" })).ok).toBe(true);
    }
    expect(server.leads.size).toBe(1);
  });

  it("reads a lead back and adds a note to it", async () => {
    await upsertLeadByPhone(creds(), "+919876543210", { name: "Note test" });
    expect((await addLeadNote(creds(), "+919876543210", "Enquired about 20 Dec")).ok).toBe(true);
    const got = await getLeadByPhone(creds(), "+919876543210");
    expect(got.ok).toBe(true);
    expect(server.leads.get("919876543210")!.notes).toEqual(["Enquired about 20 Dec"]);
    const missing = await getLeadByPhone(creds(), "+919800000009");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.kind).toBe("not_found");
  });
});

describe("authentication", () => {
  it("signs in once and reuses the session", async () => {
    await upsertLeadByPhone(creds(), "+919876543210", { name: "A" });
    await upsertLeadByPhone(creds(), "+919876543211", { name: "B" });
    expect(server.signIns).toBe(1);
  });

  it("re-authenticates once on 401, then succeeds", async () => {
    await upsertLeadByPhone(creds(), "+919876543210", { name: "Before expiry" });
    server.validTokens.clear(); // the session expires on CallVibe's side
    const r = await upsertLeadByPhone(creds(), "+919876543210", { name: "After expiry" });
    expect(r.ok).toBe(true);
    expect(server.signIns).toBe(2);
    expect(server.leads.get("919876543210")!.name).toBe("After expiry");
  });

  it("gives up after one re-authentication and says why, without leaking credentials", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await upsertLeadByPhone({ ...creds(), password: "wrong-password" }, "+919876543210", { name: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("auth");
      expect(r.error.retryable).toBe(false);
      expect(r.error.message).not.toContain("wrong-password");
    }
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain("wrong-password");
    expect(logged).not.toContain("mock-token");
    spy.mockRestore();
  });
});

describe("rate limits and transient failures", () => {
  it("reports a 429 as retryable with CallVibe's Retry-After, and succeeds once it lifts", async () => {
    server.throttleNext(1, 7);
    const throttled = await upsertLeadByPhone(creds(), "+919876543210", { name: "Busy" });
    expect(throttled.ok).toBe(false);
    if (!throttled.ok) {
      expect(throttled.error).toMatchObject({ kind: "rate_limited", retryable: true, retryAfterMs: 7000 });
    }
    const retried = await upsertLeadByPhone(creds(), "+919876543210", { name: "Busy" });
    expect(retried.ok).toBe(true);
    expect(server.leads.size).toBe(1);
  });

  it("treats a 5xx as retryable", async () => {
    server.failNext(1, 503);
    const r = await upsertLeadByPhone(creds(), "+919876543210", { name: "x" });
    expect(!r.ok && r.error).toMatchObject({ kind: "server", retryable: true, status: 503 });
  });

  it("treats an unreachable CallVibe as a retryable network error", async () => {
    const closed = server.baseUrl;
    await server.close();
    const r = await upsertLeadByPhone({ baseUrl: closed, ...MOCK_CREDENTIALS }, "+919876543210", { name: "x" });
    expect(!r.ok && r.error.retryable).toBe(true);
    server = await startMockCallVibe(); // afterEach closes it
  });

  it("parses Retry-After as seconds or an HTTP date", () => {
    expect(parseRetryAfter("12")).toBe(12_000);
    const now = Date.UTC(2026, 8, 17, 10, 0, 0);
    expect(parseRetryAfter("Thu, 17 Sep 2026 10:00:30 GMT", now)).toBe(30_000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
  });
});

describe("validation failures are readable", () => {
  it("a phone CallVibe rejects", async () => {
    // Bypass our own E.164 check to prove CallVibe's rejection is described well.
    const r = await upsertLeadByPhone(creds(), "+1234", { name: "x" });
    expect(!r.ok && r.error).toMatchObject({ kind: "invalid_phone", retryable: false });
    if (!r.ok) expect(r.error.message).toMatch(/^CallVibe rejected the phone number: Phone must be 8-15 digits/);
  });

  it("an agent CallVibe doesn't know", async () => {
    const r = await upsertLeadByPhone(creds(), "+919876543210", { name: "x", assignedTo: "Nobody Here" });
    expect(!r.ok && r.error).toMatchObject({ kind: "unknown_agent", retryable: false });
    if (!r.ok) expect(r.error.message).toContain('"Nobody Here"');
  });

  it("a duplicate, and any other field error", () => {
    expect(describeValidationError(409, { detail: "Lead already exists" }).kind).toBe("duplicate");
    const other = describeValidationError(422, { detail: [{ loc: ["body", "scheduled_at"], msg: "invalid datetime format" }] });
    expect(other).toMatchObject({ kind: "validation", message: "CallVibe rejected the lead: scheduled at: invalid datetime format" });
  });
});

describe("agents and response parsing", () => {
  it("lists agent names from the documented [{ name, phone }] shape", async () => {
    const r = await listAgentNames(creds());
    expect(r.ok && r.data).toEqual(["Asha Rao", "Vikram Nair"]);
  });

  it("extracts a lead id only when a response has one", () => {
    expect(extractLeadId({ id: "abc" })).toBe("abc");
    expect(extractLeadId({ lead: { lead_id: 42 } })).toBe("42");
    expect(extractLeadId({ ok: true })).toBeNull();
    expect(extractLeadId(null)).toBeNull();
  });

  it("reads an agent list it can't find names in as unknown, not as 'no agents'", async () => {
    server.setAgentListBody([{ agent_name: "Asha Rao" }]);
    const r = await listAgentNames(creds());
    expect(r.ok && r.data).toBeNull();
  });

  it("sends a foreign number as its own digits, never re-guessed as Indian", async () => {
    expect(callVibePathPhone("+6591234567")).toBe("6591234567");
    expect(callVibePathPhone("+919876543210")).toBe("919876543210");
    await upsertLeadByPhone(creds(), "+6591234567", { name: "Singapore" });
    expect([...server.leads.keys()]).toEqual(["6591234567"]);
  });

  it("gives up on a sign-in that never answers, as a retryable timeout", async () => {
    process.env.CALLVIBE_PUSH_TIMEOUT_MS = "300";
    server.setDelay(2000);
    try {
      const r = await upsertLeadByPhone(creds(), "+919876543210", { name: "slow" });
      expect(!r.ok && r.error).toMatchObject({ kind: "timeout", retryable: true });
      if (!r.ok) expect(r.error.message).toContain("sign-in");
    } finally {
      delete process.env.CALLVIBE_PUSH_TIMEOUT_MS;
      server.setDelay(0);
    }
  });

  it("E.164: recognises Indian mobiles, requires a country code otherwise", () => {
    expect(toE164("9876543210")).toBe("+919876543210");
    expect(toE164("+971501234567")).toBe("+971501234567");
    expect(toE164("4155552671")).toBeNull();
    expect(toE164("+91 80 4123 4567")).toBe("+918041234567"); // a Bengaluru landline
    expect(toE164("+91 12345")).toBeNull();
    expect(toE164("12345")).toBeNull();
    expect(toE164(null)).toBeNull();
  });
});
