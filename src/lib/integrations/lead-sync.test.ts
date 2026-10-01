import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const pushLeadToWeflux = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { whatsAppConfig: { findFirst: () => findFirst() } } }));
vi.mock("@/lib/integrations/weflux-crm", () => ({ pushLeadToWeflux: (...a: unknown[]) => pushLeadToWeflux(...a) }));

import { syncLeadToWhatsAppProvider } from "./lead-sync";

const LEAD = { id: "lead-1", name: "Asha Rao", phone: "919876543210", email: null };
let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(status: number, body: unknown) {
  fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  findFirst.mockReset();
  pushLeadToWeflux.mockReset().mockResolvedValue({ ok: true });
  stubFetch(200, { id: "c1" });
});

describe("syncLeadToWhatsAppProvider", () => {
  it("pushes to Weflux only when Weflux is the active provider", async () => {
    findFirst.mockResolvedValue({ provider: "WEFLUX", aisensyProjectId: null, aisensyApiPassword: null, aisensyApiEndpoint: null });
    const res = await syncLeadToWhatsAppProvider("lead.created", LEAD);
    expect(pushLeadToWeflux).toHaveBeenCalledOnce();
    expect(res.provider).toBe("WEFLUX");
  });

  it("does NOT touch Weflux when AiSensy is active — the whole point of the gate", async () => {
    findFirst.mockResolvedValue({ provider: "AISENSY", aisensyProjectId: "p1", aisensyApiPassword: "pw", aisensyApiEndpoint: null });
    const res = await syncLeadToWhatsAppProvider("lead.created", LEAD);
    expect(pushLeadToWeflux).not.toHaveBeenCalled();
    expect(res).toMatchObject({ provider: "AISENSY", ok: true });
    // Contact lookup/creation hit AiSensy, and nothing was sent as a message.
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("aisensy.com"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/messages"))).toBe(false);
  });

  it("skips a stage change on AiSensy — only a new lead needs a contact", async () => {
    findFirst.mockResolvedValue({ provider: "AISENSY", aisensyProjectId: "p1", aisensyApiPassword: "pw", aisensyApiEndpoint: null });
    const res = await syncLeadToWhatsAppProvider("deal.stage_changed", LEAD);
    expect(res.skipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports, never throws, when AiSensy rejects the call", async () => {
    findFirst.mockResolvedValue({ provider: "AISENSY", aisensyProjectId: "p1", aisensyApiPassword: "pw", aisensyApiEndpoint: null });
    stubFetch(401, { name: "ERR401", message: "Invalid API Key!" });
    const res = await syncLeadToWhatsAppProvider("lead.created", LEAD);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Invalid API Key/);
  });

  it("does nothing for Meta, which has no contact book to mirror into", async () => {
    findFirst.mockResolvedValue({ provider: "META", aisensyProjectId: null, aisensyApiPassword: null, aisensyApiEndpoint: null });
    const res = await syncLeadToWhatsAppProvider("lead.created", LEAD);
    expect(res).toMatchObject({ provider: "META", skipped: true });
    expect(pushLeadToWeflux).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips quietly when AiSensy is active but its credentials are missing", async () => {
    findFirst.mockResolvedValue({ provider: "AISENSY", aisensyProjectId: null, aisensyApiPassword: null, aisensyApiEndpoint: null });
    const res = await syncLeadToWhatsAppProvider("lead.created", LEAD);
    expect(res.skipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
