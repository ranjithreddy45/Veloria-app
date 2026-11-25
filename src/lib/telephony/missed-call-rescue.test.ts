import { beforeEach, describe, expect, it, vi } from "vitest";

// An unknown number's call becomes a lead. If it was ANSWERED a rep has already
// spoken to them, so the lead is made quietly; a MISSED ring keeps every alert.

const db = vi.hoisted(() => ({
  missedCallRescue: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: "r1" })) },
  contact: { findFirst: vi.fn(async () => null) },
  leadFirstResponse: { findUnique: vi.fn(async () => ({ status: "FAILED", failReason: "provider down", whatsappMessageId: null })) },
}));
const m = vi.hoisted(() => ({
  capture: vi.fn(async () => ({ success: true, leadId: "lead-1", contactId: "c1" })),
  stl: vi.fn(async () => ({ ok: false, status: "FAILED", reason: "provider down" })),
  notify: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/notify", () => ({ notify: m.notify }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/lead-capture", () => ({ captureLeadFromExternal: m.capture, getSystemUserId: vi.fn(async () => "admin") }));
vi.mock("@/lib/lead-first-response", () => ({ runSpeedToLead: m.stl }));
vi.mock("@/lib/crm/default-lead-owner", () => ({ getDefaultLeadOwnerId: vi.fn(async () => "rajitha") }));

import { handleMissedCallRescue } from "./missed-call-rescue";

beforeEach(() => vi.clearAllMocks());

describe("handleMissedCallRescue", () => {
  it("an answered call from a new number: quiet lead, no staff alert even if the WhatsApp fails", async () => {
    const res = await handleMissedCallRescue({ provider: "CALLVIBE", externalCallId: "callvibe:1", callerPhone: "+919000000001", rawStatus: "ANSWERED" });
    expect(res.outcome).toBe("UNKNOWN_RESCUED");
    expect(m.capture).toHaveBeenCalledWith(expect.objectContaining({ fromCall: true }));
    expect(m.stl).toHaveBeenCalledWith(expect.objectContaining({ quiet: true }));
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("a missed ring keeps the clock and the alerts", async () => {
    await handleMissedCallRescue({ provider: "CALLVIBE", externalCallId: "callvibe:2", callerPhone: "+919000000002", rawStatus: "MISSED" });
    expect(m.capture).toHaveBeenCalledWith(expect.objectContaining({ fromCall: false }));
    expect(m.stl).toHaveBeenCalledWith(expect.objectContaining({ quiet: false }));
    expect(m.notify).toHaveBeenCalledTimes(1); // "message failed" backstop to the admin
  });

  it("a missed ring whose WhatsApp already went out at capture is not reported as failed", async () => {
    m.stl.mockResolvedValueOnce({ ok: true, status: "ALREADY" } as never);
    db.leadFirstResponse.findUnique.mockResolvedValueOnce({ status: "SENT", failReason: null, whatsappMessageId: "wamid.1" } as never);
    await handleMissedCallRescue({ provider: "CALLVIBE", externalCallId: "callvibe:5", callerPhone: "+919000000005", rawStatus: "MISSED" });
    expect((db.missedCallRescue.create.mock.calls as unknown as Array<[{ data: unknown }]>)[0][0].data).toMatchObject({ whatsappSent: true, failReason: null, whatsappMessageId: "wamid.1" });
    expect(m.notify).not.toHaveBeenCalled();
  });

  it("the 'message failed' backstop goes to the default lead owner", async () => {
    await handleMissedCallRescue({ provider: "CALLVIBE", externalCallId: "callvibe:6", callerPhone: "+919000000006", rawStatus: "MISSED" });
    expect(m.notify.mock.calls[0][0].userId).toBe("rajitha");
  });

  it("an IVR provider's 'answered' is not a rep handling the call", async () => {
    await handleMissedCallRescue({ provider: "KNOWLARITY", externalCallId: "k:4", callerPhone: "+919000000004", rawStatus: "answered" });
    expect(m.capture).toHaveBeenCalledWith(expect.objectContaining({ fromCall: false }));
    expect(m.notify).toHaveBeenCalledTimes(1);
  });

  it("an IVR ping with no status is treated as missed", async () => {
    await handleMissedCallRescue({ provider: "EXOTEL", externalCallId: "x:3", callerPhone: "+919000000003" });
    expect(m.capture).toHaveBeenCalledWith(expect.objectContaining({ fromCall: false }));
  });
});
