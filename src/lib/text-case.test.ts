import { describe, it, expect } from "vitest";
import { sentenceCase } from "./text-case";

describe("sentenceCase", () => {
  it("lowers every word after the first", () => {
    expect(sentenceCase("Event Name")).toBe("Event name");
    expect(sentenceCase("All Bookings")).toBe("All bookings");
    expect(sentenceCase("Sell-Down Board")).toBe("Sell-down board");
    expect(sentenceCase("Kitchen & F&B")).toBe("Kitchen & F&B");
  });

  it("leaves acronyms, inner capitals and proper nouns alone", () => {
    expect(sentenceCase("BD CRM")).toBe("BD CRM");
    expect(sentenceCase("Sales CRM")).toBe("Sales CRM");
    expect(sentenceCase("WhatsApp Console")).toBe("WhatsApp console");
    expect(sentenceCase("CapEx Rate Card")).toBe("CapEx rate card");
    expect(sentenceCase("Google Ads")).toBe("Google Ads");
    expect(sentenceCase("Quality & Six Sigma")).toBe("Quality & Six Sigma");
    expect(sentenceCase("Function Sheets (BEO)")).toBe("Function sheets (BEO)");
    expect(sentenceCase("Security & 2FA")).toBe("Security & 2FA");
  });

  it("keeps the first word as written", () => {
    expect(sentenceCase("my Work")).toBe("my work");
    expect(sentenceCase("Dashboard")).toBe("Dashboard");
  });
});
