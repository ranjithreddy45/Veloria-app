import { describe, expect, it } from "vitest";
import { parsePushCall } from "./schema";

// Relative to now: call_date must be within the last year and not in the future.
const anHourAgo = new Date(Math.floor((Date.now() - 3_600_000) / 60_000) * 60_000);
const utc = anHourAgo.toISOString().replace(".000Z", "Z");
const ist = new Date(anHourAgo.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 19) + "+05:30";

const base = { external_call_id: "cv_1", phone: "9876543210", call_summary: "Asked about Saturday; wants a site visit.", call_date: utc };

describe("call activity validation", () => {
  it("accepts the documented example and normalises it", () => {
    const r = parsePushCall({
      ...base,
      external_call_id: "cv_9f31ab2e",
      sentiment: "Positive",
      ai_score: 82,
      ai_insights: { objections: ["Price"], budget_signal: "250000" },
      recording_url: "https://storage.callvibe.ai/rec/9f31ab2e.mp3",
      agent_name: "Riya Sharma",
      call_duration_seconds: 246,
      action_items: ["Schedule site visit", "  "],
      call_date: ist,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.call).toMatchObject({
      phone: "+919876543210",
      sentiment: "positive",
      aiScore: 82,
      callDate: anHourAgo.toISOString(),
      durationSeconds: 246,
      actionItems: ["Schedule site visit"],
      direction: "outbound",
      status: "completed",
    });
  });

  it("needs lead_id or phone, a summary and a zoned call_date", () => {
    const r = parsePushCall({ call_summary: " ", call_date: "2026-09-17T10:04:00" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fields).sort()).toEqual(["call_date", "call_summary", "external_call_id"]);
    // The lead_id-or-phone rule is reported once the fields themselves are valid.
    const noTarget = parsePushCall({ external_call_id: "cv_3", call_summary: "x", call_date: utc });
    expect(!noTarget.ok && noTarget.fields).toEqual({ phone: "Send lead_id or phone" });
    expect(parsePushCall({ lead_id: "cmabc", external_call_id: "cv_2", call_summary: "x", call_date: new Date(Date.now() - 60_000).toISOString() }).ok).toBe(true);
  });

  it("rejects bad values with field-level messages", () => {
    const r = parsePushCall({
      ...base,
      phone: "12345",
      sentiment: "ecstatic",
      ai_score: 101,
      recording_url: "http://insecure.example/rec.mp3",
      call_duration_seconds: -1,
      external_call_id: "has spaces",
      direction: "sideways",
      call_status: "maybe",
      action_items: "call back",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fields).sort()).toEqual(
      ["action_items", "ai_score", "call_duration_seconds", "call_status", "direction", "external_call_id", "phone", "recording_url", "sentiment"].sort()
    );
  });

  it("refuses a call in the future and oversized or deep insights", () => {
    const future = new Date(Date.now() + 60 * 60_000).toISOString();
    expect(parsePushCall({ ...base, call_date: future }).ok).toBe(false);
    const deep = { a: { b: { c: { d: 1 } } } };
    const r = parsePushCall({ ...base, ai_insights: deep });
    expect(!r.ok && r.fields.ai_insights).toBeTruthy();
    const big = parsePushCall({ ...base, ai_insights: { blob: "x".repeat(9000) } });
    expect(!big.ok && big.fields.ai_insights).toContain("8 KB");
  });
});
