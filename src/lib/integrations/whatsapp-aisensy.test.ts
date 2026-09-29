// ============================================================
// The AiSensy branch of sendWhatsApp(), exercised end-to-end through the real
// client with a stubbed fetch.
//
// The ordering assertions are the point of this file. Every caller in the app
// passes template values as a NAMED record ({ customerName, eventName, … }),
// while AiSensy — like Meta — wants them positionally for {{1}}, {{2}}, {{3}}.
// If that mapping ever changes, customers receive a message with the values in
// the wrong places (a name where the date belongs), which no type or lint can
// catch. So it is pinned here.
// ============================================================

import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { whatsAppConfig: { findFirst: () => findFirst() } } }));

import { sendWhatsApp, testWhatsAppConnection } from "./whatsapp";

const AISENSY_ROW = {
  provider: "AISENSY",
  accessToken: "",
  phoneNumberId: null,
  businessAccountId: null,
  appSecret: null,
  verifyToken: "tok",
  apiEndpoint: null,
  aisensyProjectId: "proj_1",
  aisensyApiPassword: "pwd_1",
  aisensyApiEndpoint: null,
};

type Call = { url: string; init: RequestInit };
let calls: Call[];

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const sentBody = () => JSON.parse(String(calls[0]!.init.body));

beforeEach(() => {
  calls = [];
  findFirst.mockReset().mockResolvedValue(AISENSY_ROW);
  stubFetch(200, { messages: [{ id: "wamid.AAA" }], contacts: [{ wa_id: "919876543210" }] });
});

describe("sendWhatsApp → AiSensy", () => {
  it("sends a template with named params in declaration order", async () => {
    const res = await sendWhatsApp({
      to: "9876543210",
      template: "review_request",
      // Exactly the shape src/lib/reputation/review-request.ts passes.
      params: { customerName: "Asha", eventName: "Reception", reviewLink: "https://x.test/r/1" },
      language: "en",
    });

    expect(res).toEqual({ success: true, messageId: "wamid.AAA" });
    const body = sentBody();
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("review_request");
    expect(body.template.language.code).toBe("en");
    expect(
      body.template.components
        .find((c: { type: string }) => c.type === "body")
        .parameters.map((p: { text: string }) => p.text)
    ).toEqual(["Asha", "Reception", "https://x.test/r/1"]);
  });

  it("keeps declaration order even when the keys sort differently", async () => {
    // "zeta" before "alpha" — an implementation that sorted keys, or relied on
    // the record being positionally keyed, would swap these two values.
    await sendWhatsApp({
      to: "9876543210",
      template: "t",
      params: { zeta: "first", alpha: "second" },
    });
    expect(
      sentBody()
        .template.components[0].parameters.map((p: { text: string }) => p.text)
    ).toEqual(["first", "second"]);
  });

  it("sends free text when no template is given, normalising the number", async () => {
    const res = await sendWhatsApp({ to: "+91 98765 43210", message: "Hello" });
    expect(res.success).toBe(true);
    const body = sentBody();
    expect(body.type).toBe("text");
    expect(body.text.body).toBe("Hello");
    expect(body.to).toBe("919876543210");
  });

  it("reports a missing credential instead of throwing", async () => {
    findFirst.mockResolvedValue({ ...AISENSY_ROW, aisensyApiPassword: null });
    const res = await sendWhatsApp({ to: "9876543210", message: "Hi" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Project ID or API password is missing/);
    expect(calls).toHaveLength(0);
  });

  it("turns an AiSensy API error into a failed result, not a throw", async () => {
    stubFetch(400, { name: "ERR400", message: "template not found" });
    const res = await sendWhatsApp({ to: "9876543210", template: "nope" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/template not found/);
  });
});

describe("testWhatsAppConnection → AiSensy", () => {
  it("reports how many templates are approved", async () => {
    stubFetch(200, [
      { name: "booking_update", status: "APPROVED" },
      { name: "winback_lost_lead", status: "PENDING" },
    ]);
    const res = await testWhatsAppConnection({
      provider: "AISENSY",
      accessToken: "",
      phoneNumberId: "",
      businessAccountId: "",
      aisensyProjectId: "proj_1",
      aisensyApiPassword: "pwd_1",
    });
    expect(res.success).toBe(true);
    expect(res.message).toContain("1 of 2 templates approved");
    expect(res.message).toContain("booking_update");
  });

  it("fails clearly when the credentials are absent", async () => {
    const res = await testWhatsAppConnection({
      provider: "AISENSY",
      accessToken: "",
      phoneNumberId: "",
      businessAccountId: "",
    });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Project ID and API password/);
  });
});
