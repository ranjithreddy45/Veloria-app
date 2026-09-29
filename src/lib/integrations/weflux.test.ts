// Regression guard for the recipient key on Weflux template sends.
// The live API rejected `to` with 400 "Provide `phone` or `contact_id`" on every
// template send for a week; only `phone` works, as the text path always used.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { wefluxSendTemplate, wefluxSendText } from "./weflux";

let body: Record<string, unknown>;

beforeEach(() => {
  body = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "m1" }), { status: 200 });
    })
  );
});

const creds = { endpoint: null, token: "wfx_live_x" };

describe("weflux recipient field", () => {
  it("template send addresses the recipient with `phone`, never `to`", async () => {
    await wefluxSendTemplate(creds, "919876543210", "booking_update", { a: "1" }, "en");
    expect(body.phone).toBe("919876543210");
    expect(body.to).toBeUndefined();
    expect(body.template).toBe("booking_update");
  });

  it("text send uses the same key", async () => {
    await wefluxSendText(creds, "919876543210", "hello");
    expect(body.phone).toBe("919876543210");
    expect(body.to).toBeUndefined();
  });
});
