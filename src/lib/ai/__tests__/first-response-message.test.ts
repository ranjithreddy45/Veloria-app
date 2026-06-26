// Unit tests for the AI first-response message builder. The LLM client is
// mocked so we can drive every branch deterministically:
//   - STATIC fallback when getAIProvider() === 'none',
//   - LLM output always sanitized (URLs / rupee figures / over-length / template
//     leak → fall back to STATIC),
//   - event/date naming in the static template,
//   - slotLikelyFree true/false/null render sensible, never-overpromising copy.
import { describe, it, expect, beforeEach, vi } from "vitest";

const { ai } = vi.hoisted(() => ({
  ai: {
    getAIProvider: vi.fn(() => "none" as "none" | "openai" | "groq" | "gemini"),
    chatCompletionWithSystem: vi.fn(async () => "AI not configured"),
    getDefaultModel: vi.fn(() => "test-model"),
  },
}));

vi.mock("@/lib/ai/openai-client", () => ({
  getAIProvider: ai.getAIProvider,
  chatCompletionWithSystem: ai.chatCompletionWithSystem,
  getDefaultModel: ai.getDefaultModel,
}));

import {
  buildAiFirstResponse,
  buildStaticFirstResponse,
} from "@/lib/ai/first-response-message";

const FEB_14_2026 = new Date("2026-02-14T06:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  ai.getAIProvider.mockReturnValue("none");
  ai.chatCompletionWithSystem.mockResolvedValue("AI not configured");
  ai.getDefaultModel.mockReturnValue("test-model");
});

describe("buildStaticFirstResponse", () => {
  it("greets by first name and names event + date", () => {
    const text = buildStaticFirstResponse({
      firstName: "Priya",
      eventType: "Wedding",
      eventDate: FEB_14_2026,
    });
    expect(text).toContain("Hi Priya");
    expect(text).toContain("Wedding");
    expect(text).toContain("14 Feb 2026");
    expect(text).toContain("Veloria Grand");
  });

  it("falls back to a neutral greeting when no name", () => {
    const text = buildStaticFirstResponse({ eventType: "Birthday" });
    expect(text).toContain("Hello");
    expect(text).toContain("Birthday");
  });

  it("renders soft 'looks open' copy without promising", () => {
    const text = buildStaticFirstResponse({
      firstName: "Ravi",
      eventType: "Reception",
      eventDate: FEB_14_2026,
      slotLikelyFree: true,
    });
    expect(text.toLowerCase()).toContain("looks open");
    expect(text.toLowerCase()).toContain("confirm");
    // Never an outright booking promise.
    expect(text.toLowerCase()).not.toContain("booked");
    expect(text.toLowerCase()).not.toContain("guaranteed");
  });

  it("renders 'double-check' copy when slot is not free", () => {
    const text = buildStaticFirstResponse({
      firstName: "Ravi",
      slotLikelyFree: false,
    });
    expect(text.toLowerCase()).toContain("double-check");
  });

  it("omits any availability claim when slotLikelyFree is null", () => {
    const text = buildStaticFirstResponse({
      firstName: "Ravi",
      eventType: "Sangeet",
      eventDate: FEB_14_2026,
      slotLikelyFree: null,
    });
    expect(text.toLowerCase()).not.toContain("looks open");
    expect(text.toLowerCase()).not.toContain("double-check");
  });

  it("never leaks template markers, URLs, or prices", () => {
    const text = buildStaticFirstResponse({
      firstName: "Ana",
      eventType: "Corporate offsite",
      eventDate: FEB_14_2026,
      slotLikelyFree: true,
    });
    expect(text).not.toMatch(/\[Template/i);
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(/₹|Rs\.?|INR|rupees?/i);
  });
});

describe("buildAiFirstResponse — provider gating", () => {
  it("returns STATIC when no AI provider is configured", async () => {
    ai.getAIProvider.mockReturnValue("none");
    const res = await buildAiFirstResponse({
      firstName: "Priya",
      eventType: "Wedding",
      eventDate: FEB_14_2026,
      slotLikelyFree: true,
    });
    expect(res.method).toBe("STATIC");
    expect(res.slotLikelyFree).toBe(true);
    expect(res.text).toContain("Priya");
    expect(res.text).toContain("Wedding");
    expect(ai.chatCompletionWithSystem).not.toHaveBeenCalled();
  });

  it("normalizes undefined slotLikelyFree to null", async () => {
    ai.getAIProvider.mockReturnValue("none");
    const res = await buildAiFirstResponse({ firstName: "Sam" });
    expect(res.slotLikelyFree).toBeNull();
  });
});

describe("buildAiFirstResponse — LLM path + sanity guard", () => {
  it("uses clean LLM output as method LLM", async () => {
    ai.getAIProvider.mockReturnValue("groq");
    ai.chatCompletionWithSystem.mockResolvedValue(
      "Hi Priya, lovely to hear about your Wedding on 14 Feb 2026! That date looks open — our team will confirm shortly. Reply here for anything urgent."
    );
    const res = await buildAiFirstResponse({
      firstName: "Priya",
      eventType: "Wedding",
      eventDate: FEB_14_2026,
      slotLikelyFree: true,
    });
    expect(res.method).toBe("LLM");
    expect(res.text).toContain("Priya");
  });

  it("falls back to STATIC when LLM output contains a URL", async () => {
    ai.getAIProvider.mockReturnValue("groq");
    ai.chatCompletionWithSystem.mockResolvedValue(
      "Hi Priya, visit https://veloria.example to book your Wedding!"
    );
    const res = await buildAiFirstResponse({
      firstName: "Priya",
      eventType: "Wedding",
      eventDate: FEB_14_2026,
    });
    expect(res.method).toBe("STATIC");
    expect(res.text).not.toMatch(/https?:\/\//i);
  });

  it("falls back to STATIC when LLM output contains a rupee figure", async () => {
    ai.getAIProvider.mockReturnValue("groq");
    ai.chatCompletionWithSystem.mockResolvedValue(
      "Hi Priya, your Wedding starts at just ₹50,000 — book now!"
    );
    const res = await buildAiFirstResponse({
      firstName: "Priya",
      eventType: "Wedding",
    });
    expect(res.method).toBe("STATIC");
  });

  it("falls back to STATIC when LLM output is over length", async () => {
    ai.getAIProvider.mockReturnValue("groq");
    ai.chatCompletionWithSystem.mockResolvedValue("word ".repeat(200));
    const res = await buildAiFirstResponse({ firstName: "Priya" });
    expect(res.method).toBe("STATIC");
  });

  it("falls back to STATIC when LLM output leaks a template marker", async () => {
    ai.getAIProvider.mockReturnValue("groq");
    ai.chatCompletionWithSystem.mockResolvedValue(
      "Hi [FirstName], thanks for your enquiry!"
    );
    const res = await buildAiFirstResponse({ firstName: "Priya" });
    expect(res.method).toBe("STATIC");
  });

  it("falls back to STATIC when the LLM call throws", async () => {
    ai.getAIProvider.mockReturnValue("groq");
    ai.chatCompletionWithSystem.mockRejectedValue(new Error("boom"));
    const res = await buildAiFirstResponse({
      firstName: "Priya",
      eventType: "Wedding",
      eventDate: FEB_14_2026,
    });
    expect(res.method).toBe("STATIC");
    expect(res.text).toContain("Priya");
  });

  it("falls back to STATIC when the LLM returns empty output", async () => {
    ai.getAIProvider.mockReturnValue("groq");
    ai.chatCompletionWithSystem.mockResolvedValue("   ");
    const res = await buildAiFirstResponse({ firstName: "Priya" });
    expect(res.method).toBe("STATIC");
  });
});
