import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// GET /api/exports/gads-conversions.csv — the file Google Ads fetches.
//
// Basic Auth is the whole security boundary here: the URL is public and the
// body is customer conversion data. Prisma is mocked; the auth and the exact
// bytes of the file are real, because a format Google silently rejects is
// indistinguishable from one it accepts.
// ============================================================

const { db } = vi.hoisted(() => ({
  db: {
    lead: { findMany: vi.fn() },
    conversionExportLog: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));

import { GET } from "./route";

const USER = "google";
const PASS = "s3cret-feed-pass";

function basic(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

function request(auth?: string): Request {
  return new Request("https://app.theveloriagrand.com/api/exports/gads-conversions.csv", {
    headers: auth ? { authorization: auth } : {},
  });
}

const NOW = new Date();
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GADS_FEED_USER = USER;
  process.env.GADS_FEED_PASS = PASS;
  db.lead.findMany.mockResolvedValue([]);
  db.conversionExportLog.createMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  delete process.env.GADS_FEED_USER;
  delete process.env.GADS_FEED_PASS;
});

describe("authentication", () => {
  it("refuses a request with no credentials, and asks for them", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
    expect(db.lead.findMany).not.toHaveBeenCalled();
  });

  it("refuses the wrong password", async () => {
    expect((await GET(request(basic(USER, "wrong")))).status).toBe(401);
  });

  it("refuses the wrong username", async () => {
    expect((await GET(request(basic("someone", PASS)))).status).toBe(401);
  });

  it("refuses a Bearer token — this endpoint is Basic only", async () => {
    expect((await GET(request(`Bearer ${PASS}`))).status).toBe(401);
  });

  it("refuses everyone when the server has no credentials configured", async () => {
    delete process.env.GADS_FEED_USER;
    delete process.env.GADS_FEED_PASS;
    expect((await GET(request(basic(USER, PASS)))).status).toBe(401);
    expect((await GET(request())).status).toBe(401);
  });

  it("lets the right credentials through", async () => {
    const res = await GET(request(basic(USER, PASS)));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });
});

describe("the file Google receives", () => {
  it("is exactly the documented format", async () => {
    const qualifiedAt = new Date(NOW.getTime() - 2 * DAY);
    const wonAt = new Date(NOW.getTime() - 1 * DAY);
    db.lead.findMany.mockResolvedValue([
      {
        id: "lead-1",
        createdAt: new Date(NOW.getTime() - 10 * DAY),
        qualifiedAt,
        wonAt,
        bookingValue: 145000,
        attribution: { gclid: "Cj0KCQ-test" },
      },
    ]);

    const body = await (await GET(request(basic(USER, PASS)))).text();
    const lines = body.trimEnd().split("\n");

    expect(lines[0]).toBe("Parameters:TimeZone=Asia/Calcutta");
    expect(lines[1]).toBe(
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency"
    );
    expect(lines).toHaveLength(4); // parameters + header + two conversions
    expect(lines[2]).toMatch(/^Cj0KCQ-test,CRM - Qualified lead,\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},5000,INR$/);
    expect(lines[3]).toMatch(/^Cj0KCQ-test,CRM - Booking \(Won\),\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},145000,INR$/);
    expect(body.includes("\n\n")).toBe(false);
    expect(body.endsWith("\n")).toBe(true);
  });

  it("is still a valid file when nothing qualifies", async () => {
    const body = await (await GET(request(basic(USER, PASS)))).text();
    expect(body.trimEnd().split("\n")).toHaveLength(2);
    expect(db.conversionExportLog.createMany).not.toHaveBeenCalled();
  });

  it("records each conversion the first time it is published", async () => {
    db.lead.findMany.mockResolvedValue([
      {
        id: "lead-1",
        createdAt: new Date(NOW.getTime() - 5 * DAY),
        qualifiedAt: new Date(NOW.getTime() - DAY),
        wonAt: null,
        bookingValue: null,
        attribution: { gclid: "abc" },
      },
    ]);

    await GET(request(basic(USER, PASS)));

    expect(db.conversionExportLog.createMany).toHaveBeenCalledTimes(1);
    const arg = db.conversionExportLog.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true); // a second fetch must not re-log
    expect(arg.data[0]).toMatchObject({
      leadId: "lead-1",
      conversionName: "CRM - Qualified lead",
      value: 5000,
      currency: "INR",
      clickId: "abc",
    });
  });

  it("asks the database only for leads that could produce a row", async () => {
    await GET(request(basic(USER, PASS)));
    const where = db.lead.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.attribution).toEqual({ gclid: { not: null } });
    expect(where.OR).toEqual([{ qualifiedAt: { not: null } }, { wonAt: { not: null } }]);
  });

  it("still answers when the audit write fails — the file is what matters", async () => {
    db.lead.findMany.mockResolvedValue([
      {
        id: "lead-1",
        createdAt: new Date(NOW.getTime() - 5 * DAY),
        qualifiedAt: new Date(NOW.getTime() - DAY),
        wonAt: null,
        bookingValue: null,
        attribution: { gclid: "abc" },
      },
    ]);
    db.conversionExportLog.createMany.mockRejectedValue(new Error("db down"));

    const res = await GET(request(basic(USER, PASS)));
    expect(res.status).toBe(200);
    expect((await res.text()).split("\n")[2]).toContain("CRM - Qualified lead");
  });

  it("answers 500 rather than a half-written file when the read fails", async () => {
    db.lead.findMany.mockRejectedValue(new Error("db down"));
    const res = await GET(request(basic(USER, PASS)));
    expect(res.status).toBe(500);
  });
});
