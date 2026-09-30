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

import { describeAiSensyTemplates, sendWhatsApp, sendWhatsAppInteractive, testWhatsAppConnection } from "./whatsapp";

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

// ------------------------------------------------------------
// One-time-code (AUTHENTICATION) templates. Meta requires the code on the
// copy-code button as the URL-button parameter at index 0 — the Meta branch
// has always sent it; the AiSensy branch used to drop it, so every OTP
// template send on AiSensy was rejected.
// ------------------------------------------------------------
describe("sendWhatsApp → AiSensy authentication templates", () => {
  it("forwards codeButton as the URL-button parameter at index 0", async () => {
    const res = await sendWhatsApp({
      to: "9876543210",
      template: "login_code",
      params: { code: "482913" },
      language: "en_US",
      // Exactly the shape src/lib/otp.ts passes.
      codeButton: "482913",
    });

    expect(res.success).toBe(true);
    const { components } = sentBody().template;
    expect(components).toContainEqual({ type: "body", parameters: [{ type: "text", text: "482913" }] });
    expect(components).toContainEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "482913" }],
    });
  });

  it("keeps the one-time code out of the failure reason", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(400, {
      error: { message: "(#131009) Parameter value is not valid", code: 131009, error_data: { details: "Button parameter 482913 is invalid" } },
    });
    const res = await sendWhatsApp({ to: "9876543210", template: "login_code", params: { code: "482913" }, codeButton: "482913" });
    expect(res.success).toBe(false);
    expect(res.error).toBe(
      "AiSensy HTTP 400 [131009]: (#131009) Parameter value is not valid — Button parameter [REDACTED] is invalid"
    );
  });

  it("adds no button component to an ordinary template", async () => {
    await sendWhatsApp({ to: "9876543210", template: "review_request", params: { customerName: "Asha" } });
    expect(sentBody().template.components.some((c: { type: string }) => c.type === "button")).toBe(false);
  });
});

// ------------------------------------------------------------
// The error string is what the console shows as the failure reason: it must
// say what went wrong (status, AiSensy/Meta code, message) and never carry the
// password or the project path.
// ------------------------------------------------------------
describe("sendWhatsApp → AiSensy failure reasons", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("names the HTTP status and AiSensy's error code, without the request path", async () => {
    stubFetch(400, { name: "ERR400", message: "template not found" });
    const res = await sendWhatsApp({ to: "9876543210", template: "nope" });
    expect(res).toEqual({ success: false, error: "AiSensy HTTP 400 [ERR400]: template not found" });
  });

  it("carries Meta's code and error_data.details through", async () => {
    stubFetch(400, {
      error: {
        message: "(#131047) Re-engagement message",
        code: 131047,
        error_data: { details: "Message failed to send because more than 24 hours have passed since the customer last replied to this number." },
      },
    });
    const res = await sendWhatsApp({ to: "9876543210", message: "Hi" });
    expect(res.error).toBe(
      "AiSensy HTTP 400 [131047]: (#131047) Re-engagement message — Message failed to send because more than 24 hours have passed since the customer last replied to this number."
    );
  });

  it("never returns or logs the API password, even when AiSensy echoes it", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    findFirst.mockResolvedValue({ ...AISENSY_ROW, aisensyApiPassword: "Sup3r-Secret!" });
    stubFetch(401, { name: "ERR401", message: "Invalid password Sup3r-Secret! for this project" });
    const res = await sendWhatsApp({ to: "9876543210", message: "Hi" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("AiSensy HTTP 401 [ERR401]: Invalid password [REDACTED] for this project");
    expect(JSON.stringify(logged.mock.calls)).not.toContain("Sup3r-Secret!");
  });

  it("reports a network failure as such", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const res = await sendWhatsApp({ to: "9876543210", message: "Hi" });
    expect(res).toEqual({ success: false, error: "AiSensy network error: fetch failed" });
  });

  it("reports a rejected number before any request is made", async () => {
    const res = await sendWhatsApp({ to: "12345", message: "Hi" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/^AiSensy: Invalid phone number/);
    expect(calls).toHaveLength(0);
  });

  it("returns a misconfigured base URL as a failed result instead of throwing", async () => {
    findFirst.mockResolvedValue({ ...AISENSY_ROW, aisensyApiEndpoint: "https://api.weflux.in/v2" });
    const res = await sendWhatsApp({ to: "9876543210", message: "Hi" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/AiSensy baseUrl must be/);
    expect(calls).toHaveLength(0);
  });
});

describe("sendWhatsAppInteractive → AiSensy", () => {
  it("degrades to a plain text message through AiSensy, never the Meta Graph API", async () => {
    const res = await sendWhatsAppInteractive({
      to: "9876543210",
      header: "Welcome to Veloria",
      body: "What are you planning?",
      footer: "Tap an option below",
      buttons: [{ id: "evt_wedding", title: "Wedding" }],
    });

    expect(res).toEqual({ success: true, messageId: "wamid.AAA" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toMatch(/^https:\/\/apis\.aisensy\.com\//);
    const body = sentBody();
    expect(body.type).toBe("text");
    expect(body.text.body).toBe("Welcome to Veloria\n\nWhat are you planning?\n\nTap an option below");
  });

  it("reports an AiSensy failure with its reason", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(400, { name: "ERR400", message: "session window closed" });
    const res = await sendWhatsAppInteractive({ to: "9876543210", body: "Pick one" });
    expect(res).toEqual({ success: false, error: "AiSensy HTTP 400 [ERR400]: session window closed" });
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

  it("checks the templates the app sends against the approved list (live { template: [...] } shape)", async () => {
    stubFetch(200, {
      template: [
        { name: "review_request", status: "APPROVED", language: "en" },
        { name: "booking_update", status: "APPROVED", language: "en_US" },
        { name: "login_code", status: "APPROVED", language: "en_US" },
        { name: "winback_lost_lead", status: "PENDING", language: "en" },
      ],
      size: 4,
      count: 4,
    });
    const res = await testWhatsAppConnection(
      {
        provider: "AISENSY",
        accessToken: "",
        phoneNumberId: "",
        businessAccountId: "",
        aisensyProjectId: "proj_1",
        aisensyApiPassword: "pwd_1",
      },
      [
        { name: "login_code", language: "en_US" },
        { name: "booking_update", language: "en" },
        { name: "review_request", language: "en" },
        { name: "winback_lost_lead", language: "en" },
      ]
    );
    expect(res).toEqual({
      success: true,
      message: [
        "Connected to AiSensy project proj_1. 3 of 4 templates approved: booking_update, login_code, review_request.",
        "Missing or not approved: winback_lost_lead.",
        "Language mismatch: booking_update (en_US, app sends en).",
      ].join("\n"),
    });
    expect(calls).toHaveLength(1); // the one template listing, no other AiSensy call
  });

  it("explains a rejected connection test without echoing the password", async () => {
    stubFetch(401, { name: "ERR401", message: "Invalid password pwd_1" });
    const res = await testWhatsAppConnection({
      provider: "AISENSY",
      accessToken: "",
      phoneNumberId: "",
      businessAccountId: "",
      aisensyProjectId: "proj_1",
      aisensyApiPassword: "pwd_1",
    });
    expect(res).toEqual({ success: false, message: "AiSensy HTTP 401 [ERR401]: Invalid password [REDACTED]" });
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

describe("describeAiSensyTemplates", () => {
  const approved = (name: string, language = "en") => ({ name, status: "APPROVED", language });

  it("lists every approved name once, sorted", () => {
    const msg = describeAiSensyTemplates("p", [approved("zeta"), approved("alpha"), approved("alpha", "hi"), { name: "beta", status: "REJECTED" }]);
    expect(msg).toBe("Connected to AiSensy project p. 3 of 4 templates approved: alpha, zeta.");
  });

  it("lists up to 60 names and counts the rest", () => {
    const many = Array.from({ length: 65 }, (_, i) => approved(`t_${String(i).padStart(2, "0")}`));
    const msg = describeAiSensyTemplates("p", many);
    expect(msg).toContain("t_00, t_01");
    expect(msg).toContain("t_59 and 5 more.");
    expect(msg).not.toContain("t_60");
  });

  it("accepts any approved language variant matching what the app sends, case- and dash-insensitively", () => {
    const msg = describeAiSensyTemplates("p", [approved("booking_update", "en_US"), approved("booking_update", "en"), approved("login_code", "EN-us")], [
      { name: "booking_update", language: "en" },
      { name: "login_code", language: "en_US" },
    ]);
    expect(msg).not.toMatch(/Missing|mismatch/);
  });

  it("does not flag a language AiSensy did not report", () => {
    const msg = describeAiSensyTemplates("p", [{ name: "booking_update", status: "APPROVED" }], [{ name: "booking_update", language: "en" }]);
    expect(msg).not.toMatch(/mismatch/);
  });

  it("says when nothing is approved", () => {
    expect(describeAiSensyTemplates("p", [], [{ name: "review_request", language: "en" }])).toBe(
      "Connected to AiSensy project p. 0 of 0 templates approved.\nMissing or not approved: review_request."
    );
  });
});
