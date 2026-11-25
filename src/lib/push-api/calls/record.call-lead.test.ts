import { beforeEach, describe, expect, it, vi } from "vitest";

// A call from a number we hold no lead for creates a lead. It is quiet (no
// staff alerts) only if someone handled the call: a rep dialled out, or it
// connected. A missed inbound ring keeps every alert.

const m = vi.hoisted(() => ({
  ingest: vi.fn(async () => ({ leadId: "l1", contactId: "c1", created: true, status: "NEW", duplicate: false, matchedBy: null, updatedFields: [] })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    callLog: { findFirst: vi.fn(async () => null) },
    $queryRaw: vi.fn(async () => []),
    user: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
  },
}));
// No admin to credit the call to: recording stops right after the lead is resolved,
// which is all these tests need.
vi.mock("@/lib/lead-capture", () => ({ getSystemUserId: vi.fn(async () => null) }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/crm/first-contact", () => ({ recordFirstContact: vi.fn() }));
vi.mock("@/lib/telephony/call-dedupe", () => ({ insertCallOnce: vi.fn() }));
vi.mock("../leads/ingest-lock", () => ({ withIngestLocks: (_k: unknown, fn: () => unknown) => fn() }));
vi.mock("../leads/ingest", () => ({ ingestPushLead: m.ingest, samePhone: () => true }));

import { recordPushCall } from "./record";
import type { PushCall } from "./schema";

const ctx = { apiKeyId: "k", lineageId: "lin", scopes: ["leads:create"], requestId: "r", dedupWindowHours: 24, maxNewLeadsPerDay: 1000 };
const call = (direction: "inbound" | "outbound", status: string) =>
  ({ externalCallId: `x-${direction}-${status}`, phone: "+919000000001", direction, status, callDate: new Date().toISOString(), summary: "", actionItems: [] }) as unknown as PushCall;

async function fromCallFor(direction: "inbound" | "outbound", status: string) {
  await recordPushCall(call(direction, status), ctx).catch(() => {});
  return ((m.ingest.mock.calls.at(-1) as unknown[])[2] as { fromCall?: boolean }).fromCall;
}

beforeEach(() => vi.clearAllMocks());

describe("call-activity push: new lead from a call", () => {
  it("is quiet when the call connected or a rep dialled out", async () => {
    expect(await fromCallFor("inbound", "completed")).toBe(true);
    expect(await fromCallFor("outbound", "completed")).toBe(true);
    expect(await fromCallFor("outbound", "no_answer")).toBe(true);
  });
  it("is quiet when a rep logged the inbound call as a wrong number or a call-back", async () => {
    expect(await fromCallFor("inbound", "wrong_number")).toBe(true);
    expect(await fromCallFor("inbound", "callback_requested")).toBe(true);
  });
  it("alerts as usual for a missed inbound ring", async () => {
    expect(await fromCallFor("inbound", "no_answer")).toBe(false);
    expect(await fromCallFor("inbound", "busy")).toBe(false);
    expect(await fromCallFor("inbound", "voicemail")).toBe(false);
  });
});
