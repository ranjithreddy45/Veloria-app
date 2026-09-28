import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// POST /api/webhooks/facebook-leads — the Meta half of the same question.
//
// Meta sends only a leadgen id; the route fetches the answers from the Graph
// API and used to keep just name, email and phone, putting nothing else even in
// the note. This checks the answers now land on the lead. The HMAC signature is
// real (computed over the body), Prisma, capture and fetch are mocked.
// ============================================================

const { db, captureMock, attributionMock } = vi.hoisted(() => ({
  db: { leadCaptureConfig: { findFirst: vi.fn(), update: vi.fn() } },
  captureMock: vi.fn(),
  attributionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/lead-capture", () => ({ captureLeadFromExternal: captureMock }));
vi.mock("@/lib/attribution", () => ({ parseAttributionFromRequest: attributionMock }));

import { POST } from "./route";

const APP_SECRET = "fb-app-secret";
const LEADGEN_ID = "leadgen-42";

function signedRequest(body: unknown): Request {
  const raw = JSON.stringify(body);
  const signature =
    "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  return new Request("https://app.theveloriagrand.com/api/webhooks/facebook-leads", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": signature },
    body: raw,
  });
}

const WEBHOOK_BODY = {
  object: "page",
  entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: LEADGEN_ID } }] }],
};

function graphReturns(fieldData: { name: string; values: string[] }[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ field_data: fieldData }) }))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FACEBOOK_APP_SECRET = APP_SECRET;
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "page-token";
  db.leadCaptureConfig.findFirst.mockResolvedValue(null);
  db.leadCaptureConfig.update.mockResolvedValue({});
  captureMock.mockResolvedValue({ leadId: "lead-1" });
  attributionMock.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.FACEBOOK_APP_SECRET;
  delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
});

describe("Meta lead form answers", () => {
  it("become the event date, guest count and event type on the lead", async () => {
    graphReturns([
      { name: "full_name", values: ["Rahul K"] },
      { name: "phone_number", values: ["9611360491"] },
      { name: "event_date", values: ["2026-11-14"] },
      { name: "how_many_guests", values: ["180"] },
      { name: "type_of_event", values: ["birthday_party"] },
    ]);

    const res = await POST(signedRequest(WEBHOOK_BODY) as never);
    expect(res.status).toBe(200);

    const arg = captureMock.mock.calls[0][0];
    expect(arg.name).toBe("Rahul K");
    expect(arg.eventDate?.slice(0, 10)).toBe("2026-11-14");
    expect(arg.guestCount).toBe(180);
    expect(arg.eventType).toBe("Birthday Party");
  });

  it("puts an answer it cannot place into the note rather than dropping it", async () => {
    graphReturns([
      { name: "phone_number", values: ["9611360491"] },
      { name: "preferred_cuisine", values: ["north indian"] },
    ]);

    await POST(signedRequest(WEBHOOK_BODY) as never);
    expect(captureMock.mock.calls[0][0].message).toContain("north indian");
  });

  it("refuses a body whose signature does not match", async () => {
    graphReturns([{ name: "phone_number", values: ["9611360491"] }]);
    const bad = new Request("https://app.theveloriagrand.com/api/webhooks/facebook-leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=deadbeef" },
      body: JSON.stringify(WEBHOOK_BODY),
    });

    const res = await POST(bad as never);
    expect(res.status).toBe(403);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("still skips a lead with no way to contact anyone", async () => {
    graphReturns([{ name: "event_date", values: ["2026-11-14"] }]);
    const res = await POST(signedRequest(WEBHOOK_BODY) as never);
    expect(res.status).toBe(200);
    expect(captureMock).not.toHaveBeenCalled();
  });
});
