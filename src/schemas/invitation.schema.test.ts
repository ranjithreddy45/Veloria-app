import { describe, expect, it } from "vitest";
import { rsvpResponseSchema } from "./invitation.schema";

// The RSVP page has no note box and processRsvpResponse reads none: nothing stores one.
describe("rsvpResponseSchema", () => {
  const reply = { token: "abc123token", response: "ACCEPTED" as const, consent: true };

  it("has no reply message field", () => {
    expect(Object.keys(rsvpResponseSchema.shape)).not.toContain("message");
  });

  it("drops a message sent by an old copy of the page instead of refusing the reply", () => {
    const parsed = rsvpResponseSchema.safeParse({ ...reply, message: "See you there!" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty("message");
  });

  it("still reads the reply itself", () => {
    expect(rsvpResponseSchema.parse({ ...reply, plusOnes: "2", dietaryRestrictions: "Vegetarian" })).toEqual({
      ...reply,
      plusOnes: 2,
      dietaryRestrictions: "Vegetarian",
    });
  });
});
