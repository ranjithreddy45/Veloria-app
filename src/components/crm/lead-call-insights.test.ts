import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadCallInsights } from "./lead-call-insights";
import { summariseLeadCalls } from "@/lib/crm/call-insights";

const calls = Array.from({ length: 7 }, (_, i) => ({
  id: `c${i}`,
  createdAt: new Date(Date.UTC(2026, 9, 20 - i, 6, 4)),
  disposition: i % 2 ? "NO_ANSWER" : "COMPLETED",
  durationSeconds: i % 2 ? 0 : 245,
  recordingUrl: i === 0 ? "https://storage.example/rec.mp3" : null,
  notes: null,
  agentName: "Nayana",
  direction: "OUTBOUND",
  content: i === 0 ? "Wants 15 Nov for 300 guests, asked for the package price." : null,
  metadata: {
    isAiTranscription: true,
    aiScore: i === 0 ? 4 : null,
    actionItems: i === 0 ? ["Send the wedding package quote"] : [],
    aiInsights: i === 0 ? { booking_stage: "Negotiating", guest_count: "300", category: "Quotation & Package Enquiry" } : {},
  },
}));

describe("LeadCallInsights (render)", () => {
  it("shows the headline, what was learned, next steps and the newest calls", () => {
    const html = renderToStaticMarkup(createElement(LeadCallInsights, { data: summariseLeadCalls(calls) }));
    expect(html).toContain("Calls &amp; insights");
    expect(html).toContain("4 connected · 3 not answered");
    expect(html).toContain("4/10");
    expect(html).toContain("What we learned on calls");
    expect(html).toContain("Negotiating");
    expect(html).toContain("Send the wedding package quote");
    expect(html).toContain("Wants 15 Nov for 300 guests");
    expect(html).toContain("<audio");
    expect(html).toContain("Show all 7 calls");
    expect(html).toContain("20 Oct");
    expect(html).toContain("11:34");
  });

  it("explains an empty or failed load instead of rendering nothing", () => {
    expect(renderToStaticMarkup(createElement(LeadCallInsights, { data: summariseLeadCalls([]) }))).toContain("No calls yet");
    expect(renderToStaticMarkup(createElement(LeadCallInsights, { data: null, error: "Lead not found" }))).toContain("Lead not found");
  });
});
