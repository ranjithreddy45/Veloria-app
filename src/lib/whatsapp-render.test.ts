import { describe, it, expect } from "vitest";
import { humanizeWhatsAppContent } from "./whatsapp-render";

describe("humanizeWhatsAppContent", () => {
  it("renders a raw template payload as a readable, brace-free line", () => {
    const raw = '[Template: day_of_welcome] {"guestName":"Ranjith","eventName":"Birthday","eventTime":"12:00PM","venueName":"Grand Hall","parkingInfo":"15 cars"}';
    const out = humanizeWhatsAppContent(raw);
    expect(out).toBe("Day Of Welcome — Ranjith · Birthday · 12:00PM · Grand Hall · 15 cars");
    expect(out).not.toContain("{");
    expect(out).not.toContain('"');
    expect(out).not.toContain("guestName");
  });

  it("leaves already-readable content untouched", () => {
    expect(humanizeWhatsAppContent("Hi, your event is confirmed!")).toBe("Hi, your event is confirmed!");
  });

  it("falls back to the label when params are empty", () => {
    expect(humanizeWhatsAppContent("[Template: reminder_24h] {}")).toBe("Reminder 24h");
  });

  it("handles null/garbage safely", () => {
    expect(humanizeWhatsAppContent(null)).toBe("");
    expect(humanizeWhatsAppContent("[Template: x] not-json")).toBe("[Template: x] not-json");
  });
});
