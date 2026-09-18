import { describe, expect, it } from "vitest";
import { helpLine, helpRoute, nextSteps } from "./event-copy";

const STATUSES = ["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

describe("nextSteps — the note says the date is locked in only when it is", () => {
  it("says 'Your date is locked in' for CONFIRMED and IN_PROGRESS, and for nothing else", () => {
    for (const s of [...STATUSES, "A_STATUS_ADDED_LATER", null, undefined]) {
      const confirmed = s === "CONFIRMED" || s === "IN_PROGRESS";
      for (const route of ["coordinator", "team", null] as const) {
        expect(nextSteps(s, route).body.includes("Your date is locked in"), `${s} / ${route}`).toBe(confirmed);
      }
    }
  });

  it("a held or tentative booking says it isn't confirmed yet", () => {
    expect(nextSteps("HOLD", null).body).toMatch(/on hold.*isn't confirmed yet/);
    expect(nextSteps("TENTATIVE", null).body).toMatch(/awaiting confirmation.*isn't locked in yet/);
  });

  it("a completed event isn't told the team is preparing", () => {
    const s = nextSteps("COMPLETED", "team");
    expect(s.heading).toBe("Thank you");
    expect(s.body).not.toMatch(/preparing|locked in|as we get closer/);
  });

  it("a status that couldn't be read promises nothing about the date", () => {
    expect(nextSteps(null, null)).toEqual({ heading: "Your event plan", body: "Here's your event plan as it stands." });
  });

  it("points to a way to get in touch only when the page shows one", () => {
    expect(nextSteps("CONFIRMED", "coordinator").body).toMatch(/call your event coordinator below\.$/);
    expect(nextSteps("CONFIRMED", "team").body).toMatch(/get in touch with our team below\.$/);
    expect(nextSteps("CONFIRMED", null).body).toBe(
      "Your date is locked in and our team is already preparing everything for your big day. We'll confirm the final details with you as we get closer."
    );
    for (const s of STATUSES) expect(nextSteps(s, null).body, s).not.toMatch(/below|coordinator|message away/);
  });
});

describe("helpRoute", () => {
  it("offers the coordinator's own number first, then the business's published channels", () => {
    expect(helpRoute("+919876543210", true)).toBe("coordinator");
    expect(helpRoute("+919876543210", false)).toBe("coordinator");
    expect(helpRoute(null, true)).toBe("team");
    expect(helpRoute("   ", true)).toBe("team");
    expect(helpRoute(undefined, false)).toBeNull();
  });
});

describe("helpLine — no round-the-clock promise", () => {
  it("gives the published support hours when they are set", () => {
    expect(helpLine("Mon–Sat, 10 am – 7 pm")).toBe("Here to help · Support hours: Mon–Sat, 10 am – 7 pm");
    expect(helpLine("  10am–7pm  ")).toBe("Here to help · Support hours: 10am–7pm");
  });

  it("otherwise says just 'Here to help'", () => {
    for (const hours of [null, undefined, "", "   "]) expect(helpLine(hours)).toBe("Here to help");
  });
});
