import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// GET|POST /api/meta/leadgen — Meta's handshake and lead notifications.
//
// The endpoint's whole job is to verify, record and get out of the way inside
// Meta's two-second budget, so these tests are about the gate and the queue,
// not about Graph. Credentials and the queue are mocked.
// ============================================================

const { credsMock, enqueueMock, drainMock, afterMock } = vi.hoisted(() => ({
  credsMock: vi.fn(),
  enqueueMock: vi.fn(),
  drainMock: vi.fn(),
  afterMock: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock("@/lib/meta/graph", () => ({ getMetaCredentials: credsMock }));
vi.mock("@/lib/meta/queue", () => ({
  enqueueMetaLead: enqueueMock,
  drainMetaLeadJobs: drainMock,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: afterMock,
}));

import { GET, POST } from "./route";

const APP_SECRET = "app-secret";
const VERIFY_TOKEN = "verify-me";
const PAGE_ID = "802807212921032";

const CREDS = {
  pageAccessToken: "token",
  appId: "app",
  appSecret: APP_SECRET,
  verifyToken: VERIFY_TOKEN,
  pageId: PAGE_ID,
  graphVersion: "v21.0",
  tokenSource: "settings" as const,
};

function leadgenBody(overrides: Record<string, unknown> = {}) {
  return {
    object: "page",
    entry: [
      {
        changes: [
          {
            field: "leadgen",
            value: {
              leadgen_id: "9876543210",
              form_id: "2162479238008631",
              page_id: PAGE_ID,
              ad_id: "111",
              created_time: 1790000000,
              ...overrides,
            },
          },
        ],
      },
    ],
  };
}

function signedPost(body: unknown, secret = APP_SECRET): Request {
  const raw = JSON.stringify(body);
  return new Request("https://app.theveloriagrand.com/api/meta/leadgen", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": "sha256=" + createHmac("sha256", secret).update(raw).digest("hex"),
    },
    body: raw,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  credsMock.mockResolvedValue(CREDS);
  enqueueMock.mockResolvedValue(undefined);
  drainMock.mockResolvedValue({ claimed: 1, captured: 1 });
  afterMock.mockImplementation((fn: () => unknown) => fn());
});

describe("the subscription handshake", () => {
  function verifyRequest(params: Record<string, string>): Request {
    const url = new URL("https://app.theveloriagrand.com/api/meta/leadgen");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return new Request(url);
  }

  it("echoes the challenge when the token matches", async () => {
    const res = await GET(
      verifyRequest({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "42" })
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("42");
  });

  it("refuses a wrong token", async () => {
    const res = await GET(
      verifyRequest({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42" })
    );
    expect(res.status).toBe(403);
  });

  it("refuses when no verify token is configured, rather than letting anyone subscribe", async () => {
    credsMock.mockResolvedValue({ ...CREDS, verifyToken: "" });
    const res = await GET(
      verifyRequest({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "42" })
    );
    expect(res.status).toBe(403);
  });
});

describe("lead notifications", () => {
  it("records the lead and answers immediately", async () => {
    const res = await POST(signedPost(leadgenBody()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, queued: 1 });
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls[0][0]).toMatchObject({
      leadgenId: "9876543210",
      formId: "2162479238008631",
      pageId: PAGE_ID,
      source: "webhook",
    });
  });

  it("fetches the lead after answering, not before", async () => {
    await POST(signedPost(leadgenBody()));
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(drainMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a body whose signature does not match", async () => {
    const res = await POST(signedPost(leadgenBody(), "the-wrong-secret"));
    expect(res.status).toBe(401);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("refuses a body with no signature at all", async () => {
    const res = await POST(
      new Request("https://app.theveloriagrand.com/api/meta/leadgen", {
        method: "POST",
        body: JSON.stringify(leadgenBody()),
      })
    );
    expect(res.status).toBe(401);
  });

  it("refuses everything when no app secret is configured", async () => {
    credsMock.mockResolvedValue({ ...CREDS, appSecret: "" });
    const res = await POST(signedPost(leadgenBody()));
    expect(res.status).toBe(503);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("ignores another page's leads", async () => {
    const res = await POST(signedPost(leadgenBody({ page_id: "999999" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, queued: 0 });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("ignores changes that are not leadgen", async () => {
    const body = leadgenBody();
    body.entry[0].changes[0].field = "feed";
    const res = await POST(signedPost(body));
    expect(await res.json()).toEqual({ ok: true, queued: 0 });
  });

  it("records every lead in a batched delivery", async () => {
    const body = leadgenBody();
    body.entry[0].changes.push({
      field: "leadgen",
      value: { leadgen_id: "222", page_id: PAGE_ID } as never,
    });
    const res = await POST(signedPost(body));
    expect(await res.json()).toEqual({ ok: true, queued: 2 });
    expect(enqueueMock).toHaveBeenCalledTimes(2);
  });

  it("answers 400 on a body that is not JSON", async () => {
    const raw = "not json";
    const res = await POST(
      new Request("https://app.theveloriagrand.com/api/meta/leadgen", {
        method: "POST",
        headers: {
          "x-hub-signature-256": "sha256=" + createHmac("sha256", APP_SECRET).update(raw).digest("hex"),
        },
        body: raw,
      })
    );
    expect(res.status).toBe(400);
  });

  it("still answers 200 when the follow-up fetch throws", async () => {
    drainMock.mockRejectedValue(new Error("graph down"));
    const res = await POST(signedPost(leadgenBody()));
    expect(res.status).toBe(200);
  });
});
