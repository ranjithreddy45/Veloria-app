import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// POST /api/webhooks/google-ads — do the lead form's custom answers actually
// reach the lead?
//
// The mapper is unit-tested on its own; this is the wiring around it, which is
// where the answers were being lost. Prisma, capture and attribution are mocked;
// the payload is the real shape Google posts.
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

const KEY = "veloria_google_verify";

function post(body: Record<string, unknown>): Request {
  return new Request("https://app.theveloriagrand.com/api/webhooks/google-ads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function payload(columns: { column_id: string; string_value: string }[]) {
  return {
    lead_id: "lead-abc",
    api_version: "1.0",
    form_id: 123,
    campaign_id: 456,
    gcl_id: "Cj0KCQ-click",
    google_key: KEY,
    user_column_data: columns,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_ADS_WEBHOOK_TOKEN = KEY;
  db.leadCaptureConfig.findFirst.mockResolvedValue(null);
  db.leadCaptureConfig.update.mockResolvedValue({});
  captureMock.mockResolvedValue({ leadId: "lead-1", contactId: "c1" });
  attributionMock.mockResolvedValue({});
});

describe("the custom answers", () => {
  it("become the event date, guest count and event type on the lead", async () => {
    const res = await POST(post(
      payload([
        { column_id: "FULL_NAME", string_value: "Asha Rao" },
        { column_id: "PHONE_NUMBER", string_value: "9611360491" },
        { column_id: "WHAT_IS_YOUR_EVENT_DATE", string_value: "14/11/2026" },
        { column_id: "NUMBER_OF_GUESTS", string_value: "250" },
        { column_id: "EVENT_TYPE", string_value: "wedding_ceremony_/_reception" },
      ])
    ) as never);

    expect(res.status).toBe(200);
    expect(captureMock).toHaveBeenCalledTimes(1);
    const arg = captureMock.mock.calls[0][0];
    expect(arg.name).toBe("Asha Rao");
    expect(arg.phone).toBe("9611360491");
    expect(arg.eventDate?.slice(0, 10)).toBe("2026-11-14");
    expect(arg.guestCount).toBe(250);
    expect(arg.eventType).toBe("Wedding Ceremony / Reception");
  });

  it("keeps an answer it cannot place in the lead's notes instead of dropping it", async () => {
    await POST(post(
      payload([
        { column_id: "FULL_NAME", string_value: "Asha Rao" },
        { column_id: "PHONE_NUMBER", string_value: "9611360491" },
        { column_id: "BUDGET_RANGE", string_value: "5-7 lakh" },
      ])
    ) as never);

    const arg = captureMock.mock.calls[0][0];
    expect(arg.message).toContain("5-7 lakh");
    expect(arg.eventType).toBeUndefined();
  });

  it("still captures a lead that answered nothing beyond its phone number", async () => {
    await POST(post(
      payload([{ column_id: "PHONE_NUMBER", string_value: "9611360491" }])
    ) as never);

    const arg = captureMock.mock.calls[0][0];
    expect(arg.phone).toBe("9611360491");
    expect(arg.eventDate).toBeUndefined();
    expect(arg.guestCount).toBeUndefined();
  });

  it("carries the click id through, which is what the whole loop depends on", async () => {
    await POST(post(
      payload([{ column_id: "PHONE_NUMBER", string_value: "9611360491" }])
    ) as never);

    expect(captureMock.mock.calls[0][0].attribution.gclid).toBe("Cj0KCQ-click");
  });

  it("refuses a payload with the wrong key", async () => {
    const res = await POST(post({ ...payload([]), google_key: "not-the-key" }) as never);
    expect(res.status).toBe(401);
    expect(captureMock).not.toHaveBeenCalled();
  });
});
