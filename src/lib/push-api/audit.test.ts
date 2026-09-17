import { describe, expect, it } from "vitest";
import { structuredLogLine } from "./audit";

describe("structuredLogLine", () => {
  const line = structuredLogLine({
    requestId: "req_01J8ZQ4X7B5N2K9M3P6R8T0V1W",
    endpoint: "/api/v1/push/leads",
    method: "POST",
    apiKeyId: "key_1",
    apiKeyPrefix: "vg_live_abcdefgh",
    source: "meta_ads",
    ip: "203.0.113.9",
    userAgent: "curl/8.0",
    outcome: "created",
    responseStatus: 201,
    leadId: "lead_1",
    externalId: "META-987654",
    durationMs: 42,
  });
  const parsed = JSON.parse(line);

  it("carries every tracing field", () => {
    expect(parsed).toMatchObject({
      event: "push_api_request",
      request_id: "req_01J8ZQ4X7B5N2K9M3P6R8T0V1W",
      api_key_id: "key_1",
      lead_id: "lead_1",
      external_id: "META-987654",
      source: "meta_ads",
      duration_ms: 42,
      status_code: 201,
      outcome: "created",
      level: "info",
    });
  });

  it("never carries the key, the IP or the user agent", () => {
    expect(line).not.toContain("vg_live_");
    expect(line).not.toContain("203.0.113.9");
    expect(line).not.toContain("curl/8.0");
  });

  it("levels by status", () => {
    const at = (responseStatus: number) =>
      JSON.parse(structuredLogLine({ requestId: "r", endpoint: "/", method: "POST", outcome: "error", responseStatus, durationMs: 1 })).level;
    expect(at(422)).toBe("warn");
    expect(at(500)).toBe("error");
  });
});
