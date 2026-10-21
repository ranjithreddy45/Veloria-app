import { describe, it, expect } from "vitest";
import { formatIstDateTime, formatTalkTime, scoreOf, summariseLeadCalls, type LeadCallRow } from "./call-insights";

const row = (over: Partial<LeadCallRow> & { at: string }): LeadCallRow => ({
  id: over.id ?? over.at,
  createdAt: over.at,
  disposition: "COMPLETED",
  durationSeconds: 60,
  recordingUrl: null,
  notes: null,
  agentName: "Nayana",
  direction: "OUTBOUND",
  content: null,
  metadata: null,
  ...over,
});

describe("summariseLeadCalls", () => {
  it("headlines the calls: counts, talk time, last call, newest first", () => {
    const s = summariseLeadCalls([
      row({ at: "2026-10-18T05:00:00Z", disposition: "NO_ANSWER", durationSeconds: 0 }),
      row({ at: "2026-10-20T06:00:00Z", durationSeconds: 245 }),
      row({ at: "2026-10-19T06:00:00Z", disposition: "CALLBACK_REQUESTED", durationSeconds: 30 }),
      row({ at: "2026-10-17T06:00:00Z", disposition: "VOICEMAIL", durationSeconds: 20 }),
    ]);
    expect(s).toMatchObject({ total: 4, connected: 2, notConnected: 2, talkSeconds: 295 });
    expect(s.calls.map((c) => c.at.slice(0, 10))).toEqual(["2026-10-20", "2026-10-19", "2026-10-18", "2026-10-17"]);
    expect(s.lastCallAt).toBe("2026-10-20T06:00:00.000Z");
    expect(s.lastConnectedAt).toBe("2026-10-20T06:00:00.000Z");
  });

  it("keeps the newest REAL answer per insight — 'Not discussed' never hides an older one", () => {
    const s = summariseLeadCalls([
      row({
        at: "2026-10-20T06:00:00Z",
        metadata: { aiInsights: { booking_stage: "Negotiating", guest_count: "Not discussed", budget_classification: "Need to review" } },
      }),
      row({
        at: "2026-10-15T06:00:00Z",
        metadata: { aiInsights: { booking_stage: "New Enquiry", guest_count: "300", category: "Quotation & Package Enquiry" } },
      }),
    ]);
    const facts = Object.fromEntries(s.facts.map((f) => [f.key, [f.value, f.at.slice(0, 10)]]));
    expect(facts.booking_stage).toEqual(["Negotiating", "2026-10-20"]);
    expect(facts.guest_count).toEqual(["300", "2026-10-15"]);
    expect(facts.category).toEqual(["Quotation & Package Enquiry", "2026-10-15"]);
    expect(facts.budget_classification).toEqual(["Need to review", "2026-10-20"]);
  });

  it("lays out each call's AI read: summary, score on its real scale, actions, insights", () => {
    const s = summariseLeadCalls([
      row({
        at: "2026-10-20T06:00:00Z",
        content: "Customer wants 15 Nov for 300 guests.",
        metadata: {
          aiScore: 4,
          actionItems: ["Share quotation", "Hold 15 Nov"],
          aiInsights: { booking_stage: "Negotiating", opening_quality: 4, quality_fields_counted: 1, quality_max: 10, mood: "warm" },
        },
      }),
    ]);
    const c = s.calls[0];
    expect(c.summary).toBe("Customer wants 15 Nov for 300 guests.");
    expect(c.score).toEqual({ value: 4, outOf: 10 });
    expect(c.actionItems).toEqual(["Share quotation", "Hold 15 Nov"]);
    expect(c.insights).toEqual([
      { label: "Booking stage", value: "Negotiating" },
      { label: "Call quality", value: "1 of 10 details captured" },
      { label: "Mood", value: "warm" },
    ]);
    expect(s.latestScore).toMatchObject({ value: 4, outOf: 10 });
    expect(s.openActionItems).toEqual({ items: ["Share quotation", "Hold 15 Nov"], at: "2026-10-20T06:00:00.000Z" });
  });

  it("falls back to the metadata summary, then the notes; tolerates junk metadata", () => {
    expect(summariseLeadCalls([row({ at: "2026-10-20T06:00:00Z", metadata: { summary: "From meta" } })]).calls[0].summary).toBe("From meta");
    expect(summariseLeadCalls([row({ at: "2026-10-20T06:00:00Z", notes: "From notes" })]).calls[0].summary).toBe("From notes");
    const junk = summariseLeadCalls([row({ at: "2026-10-20T06:00:00Z", metadata: "nonsense" })]);
    expect(junk.calls[0]).toMatchObject({ score: null, actionItems: [], insights: [] });
    expect(junk.facts).toEqual([]);
  });

  it("is empty-safe", () => {
    expect(summariseLeadCalls([])).toMatchObject({ total: 0, lastCallAt: null, latestScore: null, openActionItems: null, calls: [] });
  });
});

describe("helpers", () => {
  it("scores: 0–10 is out of 10, above 10 out of 100, junk is none", () => {
    expect(scoreOf({ aiScore: 0 })).toEqual({ value: 0, outOf: 10 });
    expect(scoreOf({ aiScore: 82 })).toEqual({ value: 82, outOf: 100 });
    expect(scoreOf({ aiScore: null })).toBeNull();
    expect(scoreOf({ aiScore: "x" })).toBeNull();
  });

  it("formats talk time and India time", () => {
    expect(formatTalkTime(45)).toBe("45s");
    expect(formatTalkTime(245)).toBe("4m 05s");
    expect(formatTalkTime(3725)).toBe("1h 02m");
    // 06:04 UTC is 11:34 in India.
    expect(formatIstDateTime("2026-10-21T06:04:00Z")).toMatch(/21 Oct.*11:34/);
  });
});
