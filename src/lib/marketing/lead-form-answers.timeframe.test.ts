import { describe, it, expect } from "vitest";
import { mapLeadFormAnswers, unmappedNote } from "./lead-form-answers";

// The Google Ads form's "What date are you looking to book?" is answered with
// a timeframe, not a date (every one of 78 answers: "1-3 months", "In less
// than 15 days", "Within 30 Days", "Date not fixed yet"). It was logged as an
// unrecognised column on every lead.
describe("mapLeadFormAnswers — a timeframe answer to the date question", () => {
  it("keeps it as the booking timeframe, not an unknown column", () => {
    const m = mapLeadFormAnswers([{ key: "what_date_are_you_looking_to_book?", value: "In less than 15 days" }]);
    expect(m.eventDate).toBeNull();
    expect(m.timeframe).toBe("In Less Than 15 Days");
    expect(m.unmapped).toEqual([]);
    expect(unmappedNote(m.unmapped, m.timeframe)).toBe("Booking timeframe: In Less Than 15 Days");
  });

  it("still reads a real date as the event date", () => {
    const m = mapLeadFormAnswers([{ key: "what_date_are_you_looking_to_book?", value: "14/11/2026" }]);
    expect(m.eventDate?.toISOString()).toBe("2026-11-14T00:00:00.000Z");
    expect(m.timeframe).toBeNull();
  });

  it("leaves a genuinely unknown column unmapped (and warned about)", () => {
    const m = mapLeadFormAnswers([{ key: "favourite_colour", value: "blue" }]);
    expect(m.unmapped).toEqual([{ key: "favourite_colour", value: "blue" }]);
    expect(unmappedNote(m.unmapped, null)).toBe("Favourite Colour: blue");
  });
});
