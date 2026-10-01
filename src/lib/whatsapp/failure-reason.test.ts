import { describe, expect, it } from "vitest";
import {
  formatWhatsAppFailure,
  WHATSAPP_FAILURE_FALLBACK,
  WHATSAPP_FAILURE_MAX_LENGTH,
} from "./failure-reason";

// ============================================================
// formatWhatsAppFailure: the text every failed WhatsApp send stores in
// WhatsAppMessage.failureReason. Pinned here: there is always a reason, it is
// one bounded line, and no credential survives into it.
// ============================================================

describe("formatWhatsAppFailure", () => {
  it("says the provider gave no reason when there is nothing to say", () => {
    for (const empty of [undefined, null, "", "  \n\t  ", new Error("")]) {
      expect(formatWhatsAppFailure(empty)).toBe(WHATSAPP_FAILURE_FALLBACK);
    }
  });

  it("keeps an ordinary provider message as it is, on one trimmed line", () => {
    expect(formatWhatsAppFailure("Template not approved")).toBe("Template not approved");
    expect(formatWhatsAppFailure("  AiSensy HTTP 400 [ERR400]:\n  template\tnot found ")).toBe(
      "AiSensy HTTP 400 [ERR400]: template not found"
    );
  });

  it("reads Errors and error-shaped objects", () => {
    expect(formatWhatsAppFailure(new Error("socket hang up"))).toBe("socket hang up");
    expect(formatWhatsAppFailure({ error: { message: "(#131047) Re-engagement message" } })).toBe(
      "(#131047) Re-engagement message"
    );
    expect(formatWhatsAppFailure({ code: 131047 })).toBe('{"code":131047}');
  });

  it(`caps the reason at ${WHATSAPP_FAILURE_MAX_LENGTH} characters`, () => {
    const long = `Upstream error: ${"x".repeat(2000)}`;
    const out = formatWhatsAppFailure(long);
    expect(out).toHaveLength(WHATSAPP_FAILURE_MAX_LENGTH);
    expect(out.startsWith("Upstream error: xxx")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
  });

  it("redacts before truncating, so a secret cut at the limit cannot leak in part", () => {
    const secret = "0123456789abcdef0123456789abcdef0123456789abcdef";
    const out = formatWhatsAppFailure(`${"y ".repeat(245)}key ${secret}`);
    expect(out.length).toBeLessThanOrEqual(WHATSAPP_FAILURE_MAX_LENGTH);
    expect(out).not.toMatch(/0123456789/);
  });

  it("redacts the AiSensy password header, raw or JSON", () => {
    expect(formatWhatsAppFailure("X-AiSensy-Project-API-Pwd: s3cr3t-Pa55 rejected")).toBe(
      "X-AiSensy-Project-API-Pwd: [REDACTED] rejected"
    );
    const json = formatWhatsAppFailure('headers {"X-AiSensy-Project-API-Pwd":"s3cr3t-Pa55","Accept":"application/json"}');
    expect(json).not.toContain("s3cr3t-Pa55");
    expect(json).toContain('"X-AiSensy-Project-API-Pwd":"[REDACTED]"');
    expect(json).toContain('"Accept":"application/json"');
  });

  it("redacts bearer tokens and credential query parameters", () => {
    expect(formatWhatsAppFailure("Authorization: Bearer EAAGm0PX4ZCpsBA1234xyz")).toBe("Authorization: Bearer [REDACTED]");
    expect(
      formatWhatsAppFailure("GET https://graph.facebook.com/v19.0/me?access_token=EAAGm0PX4ZCps&fields=id failed")
    ).toBe("GET https://graph.facebook.com/v19.0/me?access_token=[REDACTED]&fields=id failed");
    expect(formatWhatsAppFailure("token=abc123&password=hunter2&apiKey=xyz789&phone=919876543210")).toBe(
      "token=[REDACTED]&password=[REDACTED]&apiKey=[REDACTED]&phone=919876543210"
    );
    expect(formatWhatsAppFailure('{"apiPassword":"hunter2"}')).toBe('{"apiPassword":"[REDACTED]"}');
  });

  it("redacts long opaque secrets, JWTs, Weflux keys and URL credentials", () => {
    expect(formatWhatsAppFailure("secret 0123456789abcdef0123456789abcdef leaked")).toBe("secret [REDACTED] leaked");
    expect(formatWhatsAppFailure(`token EAAG${"a1B2".repeat(20)} is invalid`)).toBe("token [REDACTED] is invalid");
    expect(formatWhatsAppFailure("jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl")).toBe("jwt [REDACTED]");
    expect(formatWhatsAppFailure("Invalid key wfx_live_9f8e7d6c5b4a")).toBe("Invalid key [REDACTED]");
    expect(formatWhatsAppFailure("GET https://user:pa55word@apis.aisensy.com/x failed")).toBe(
      "GET https://[REDACTED]@apis.aisensy.com/x failed"
    );
  });

  it("redacts exact known secrets passed by the caller", () => {
    expect(formatWhatsAppFailure("Invalid password Pwd#2026 for project", { secrets: ["Pwd#2026", null] })).toBe(
      "Invalid password [REDACTED] for project"
    );
  });

  it("leaves the useful parts of real errors alone", () => {
    for (const keep of [
      "template booking_confirmation_reminder_v2_2026 not found",
      "AiSensy POST /project/6ab3d281ead0bf4ba64af375/messages failed (400): template not found",
      'Invalid phone number: "919876543210"',
      "Basic authentication failed",
      "Error validating access token: Session has expired on Friday",
      "(#131047) Re-engagement message",
    ]) {
      expect(formatWhatsAppFailure(keep)).toBe(keep);
    }
  });

  it("is idempotent", () => {
    for (const input of [
      "X-AiSensy-Project-API-Pwd: s3cr3t rejected",
      `oops ${"z".repeat(900)}`,
      undefined,
      "token=abc&x=1",
    ]) {
      const once = formatWhatsAppFailure(input);
      expect(formatWhatsAppFailure(once)).toBe(once);
    }
  });
});
