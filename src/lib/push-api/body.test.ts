import { describe, expect, it } from "vitest";
import { readJsonObject } from "./body";
import { PushApiError } from "./errors";

const MAX = 1024;

function req(body: BodyInit | null, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request("https://app.theveloriagrand.com/api/v1/push/leads", { method: "POST", body, headers });
}

async function errorOf(p: Promise<unknown>): Promise<PushApiError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof PushApiError) return e;
    throw e;
  }
  throw new Error("expected a PushApiError");
}

describe("readJsonObject", () => {
  it("reads a JSON object", async () => {
    expect(await readJsonObject(req(JSON.stringify({ source: "website" })), MAX)).toEqual({ source: "website" });
  });

  it("accepts a charset on the content type", async () => {
    const r = req("{}", { "content-type": "application/json; charset=utf-8" });
    expect(await readJsonObject(r, MAX)).toEqual({});
  });

  it("refuses a non-JSON content type with 415", async () => {
    const e = await errorOf(readJsonObject(req("{}", { "content-type": "text/plain" }), MAX));
    expect(e.status).toBe(415);
  });

  it("refuses malformed JSON with 400 INVALID_JSON", async () => {
    for (const body of ["{", "{'source':'x'}", "not json", "{\"a\":1,}"]) {
      const e = await errorOf(readJsonObject(req(body), MAX));
      expect(e.code).toBe("INVALID_JSON");
      expect(e.status).toBe(400);
    }
  });

  it("refuses an empty body, an array, null and a bare value", async () => {
    for (const body of ["", "   ", "[]", "[{\"source\":\"x\"}]", "null", "42", "\"x\""]) {
      expect((await errorOf(readJsonObject(req(body), MAX))).code).toBe("INVALID_JSON");
    }
  });

  it("refuses an oversized body declared by Content-Length before reading it", async () => {
    const r = req("{}", { "content-type": "application/json", "content-length": String(MAX + 1) });
    expect((await errorOf(readJsonObject(r, MAX))).status).toBe(413);
  });

  it("refuses an oversized body that doesn't declare its length", async () => {
    const big = JSON.stringify({ message: "x".repeat(MAX * 2) });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const r = new Request("https://app.theveloriagrand.com/api/v1/push/leads", {
      method: "POST",
      body: stream,
      headers: { "content-type": "application/json" },
      // @ts-expect-error — required by undici for a streamed request body
      duplex: "half",
    });
    const e = await errorOf(readJsonObject(r, MAX));
    expect(e.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
