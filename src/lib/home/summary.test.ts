import { describe, it, expect } from "vitest";
import type { HomeFacts } from "./facts";
import { buildGreeting, buildKpis, buildSideCard, changePercent, timeOfDayGreeting } from "./summary";

// Monday 21 Sep 2026, 18:30 IST.
const NOW = new Date("2026-09-21T13:00:00.000Z");
const GREETING_RE = /Good (morning|afternoon|evening)/;

const noEvents = { count: 0, guests: 0, rows: [] };

describe("timeOfDayGreeting", () => {
  it("follows the IST clock, not the server's", () => {
    expect(timeOfDayGreeting(new Date("2026-09-21T00:00:00.000Z"))).toBe("Good morning"); // 05:30 IST
    expect(timeOfDayGreeting(new Date("2026-09-21T07:00:00.000Z"))).toBe("Good afternoon"); // 12:30 IST
    expect(timeOfDayGreeting(new Date("2026-09-21T11:30:00.000Z"))).toBe("Good evening"); // 17:00 IST
    expect(timeOfDayGreeting(new Date("2026-09-21T20:00:00.000Z"))).toBe("Good morning"); // 01:30 IST
  });
});

describe("buildGreeting", () => {
  it("always opens with the time-of-day greeting the smoke test looks for", () => {
    for (const lens of ["owner", "sales", "ops", "finance", "staff"] as const) {
      expect(buildGreeting(lens, { teamScope: false }, "Nayana", NOW).salutation).toMatch(GREETING_RE);
    }
  });

  it("tells a rep how many follow-ups are due", () => {
    const g = buildGreeting("sales", { teamScope: false, followups: { overdue: 2, today: 4, rows: [] } }, "Nayana", NOW);
    expect(g.salutation).toBe("Good evening, Nayana.");
    expect(g.headline).toBe("6 follow-ups are due, 2 of them overdue.");
  });

  it("uses the singular", () => {
    const g = buildGreeting("sales", { teamScope: false, followups: { overdue: 0, today: 1, rows: [] } }, "N", NOW);
    expect(g.headline).toBe("1 follow-up is due today.");
  });

  it("says so plainly when nothing is due", () => {
    const g = buildGreeting("sales", { teamScope: false, followups: { overdue: 0, today: 0, rows: [] } }, "N", NOW);
    expect(g.headline).toBe("No follow-ups are due today.");
  });

  it("states the overdue total for finance from the receivables block", () => {
    const g = buildGreeting(
      "finance",
      { teamScope: false, receivables: { overdueAmount: 960000, overdueCount: 5, outstanding: 2000000, rows: [] } },
      "Venkat",
      NOW
    );
    expect(g.headline).toBe("₹9,60,000 is overdue across 5 invoices.");
    expect(g.lede).toContain("₹20,00,000");
  });

  it("counts today's events and guests for ops", () => {
    const g = buildGreeting(
      "ops",
      { teamScope: false, events: { today: { count: 3, guests: 1140, rows: [] }, tomorrow: noEvents, thisWeek: 9 } },
      "Imran",
      NOW
    );
    expect(g.headline).toBe("3 events today, 1,140 guests booked.");
    expect(g.lede).toContain("Nothing is booked for tomorrow.");
  });

  it("never claims a figure for a module the role cannot see", () => {
    const g = buildGreeting("finance", { teamScope: false }, "A", NOW);
    expect(g.headline).toBe("Here is where things stand.");
    expect(g.headline + g.lede).not.toMatch(/\d/);
  });

  it("falls back to the user's own tasks when the lens has nothing to say", () => {
    const g = buildGreeting("finance", { teamScope: false, tasks: { overdue: 1, laterToday: 1, rows: [] } }, "A", NOW);
    expect(g.headline).toBe("2 tasks are due, 1 of them overdue.");
  });

  it("only reports the all-clear for the owner when both blocks were actually read", () => {
    const clear = buildGreeting(
      "owner",
      {
        teamScope: true,
        sla: { breached: 0, pending: 0, rows: [] },
        receivables: { overdueAmount: 0, overdueCount: 0, outstanding: 0, rows: [] },
      },
      "R",
      NOW
    );
    expect(clear.lede).toContain("No invoice is overdue");
    const blind = buildGreeting("owner", { teamScope: true }, "R", NOW);
    expect(blind.lede).not.toContain("No invoice is overdue");
  });
});

describe("changePercent", () => {
  it("is null when there is no base to compare against", () => {
    expect(changePercent(5000, 0)).toBeNull();
    expect(changePercent(114, 100)).toBe(14);
    expect(changePercent(50, 100)).toBe(-50);
  });
});

describe("buildKpis", () => {
  it("shows no tiles at all when the role can see nothing", () => {
    expect(buildKpis("owner", { teamScope: true }, NOW)).toEqual([]);
  });

  it("leaves out a tile whose block is missing and promotes the next one", () => {
    const facts: HomeFacts = {
      teamScope: false,
      leads: { open: 23, newToday: 4, byStatus: [] },
      followups: { overdue: 2, today: 6, rows: [] },
      booked: { monthValue: 1140000, monthCount: 3, weekValue: 0, week: [] },
      tasks: { overdue: 0, laterToday: 1, rows: [] },
    };
    const ids = buildKpis("sales", facts, NOW).map((k) => k.id);
    // quotesOpened is absent (no quotes:read), so tasks takes the fourth slot.
    expect(ids).toEqual(["openLeads", "followups", "bookedMonth", "tasks"]);
  });

  it("never shows more than four", () => {
    const facts: HomeFacts = {
      teamScope: true,
      cash: { thisMonth: 100, lastMonth: 50, thisWeek: 10, week: [] },
      events: { today: noEvents, tomorrow: noEvents, thisWeek: 17 },
      receivables: { overdueAmount: 1, overdueCount: 1, outstanding: 2, rows: [] },
      sla: { breached: 2, pending: 1, rows: [] },
      booked: { monthValue: 1, monthCount: 1, weekValue: 0, week: [] },
      tasks: { overdue: 0, laterToday: 0, rows: [] },
    };
    const kpis = buildKpis("owner", facts, NOW);
    expect(kpis.map((k) => k.id)).toEqual(["cashMonth", "eventsWeek", "overdue", "sla"]);
    expect(kpis[0].label).toBe("Cash collected · September");
    expect(kpis[0].sub).toBe("Up 100% on last month so far");
  });

  it("labels money with the shared vocabulary, never a bare 'Revenue'", () => {
    const facts: HomeFacts = {
      teamScope: true,
      cash: { thisMonth: 1, lastMonth: 0, thisWeek: 0, week: [] },
      booked: { monthValue: 1, monthCount: 1, weekValue: 0, week: [] },
    };
    for (const k of buildKpis("owner", facts, NOW)) expect(k.label).not.toMatch(/revenue/i);
  });

  it("counts kitchen plans not started and catered events with no plan", () => {
    const ev = (id: string, catered: boolean) => ({
      bookingId: id, bookingNumber: id, eventName: id, venueName: "v", hall: null, timeSlot: "EVENING", guestCount: 100, catered,
    });
    const facts: HomeFacts = {
      teamScope: false,
      events: { today: { count: 3, guests: 300, rows: [ev("a", true), ev("b", true), ev("c", false)] }, tomorrow: noEvents, thisWeek: 3 },
      kitchen: { plans: [{ id: "k", bookingId: "a", status: "PLANNED", covers: 90 }] },
    };
    const tile = buildKpis("ops", facts, NOW).find((k) => k.id === "kitchen")!;
    expect(tile.value).toBe("1");
    expect(tile.sub).toBe("1 catered event has no plan yet");
    expect(tile.tone).toBe("bad");
  });
});

describe("buildSideCard", () => {
  it("draws the rep's pipeline from the same groups as the open-leads tile", () => {
    const side = buildSideCard("sales", {
      teamScope: false,
      leads: { open: 12, newToday: 0, byStatus: [{ status: "NEW", count: 9 }, { status: "QUALIFIED", count: 3 }] },
    });
    expect(side?.kind).toBe("stages");
    if (side?.kind !== "stages") return;
    expect(side.title).toBe("My open leads by status");
    expect(side.rows.find((r) => r.label === "New")!.count).toBe(9);
    expect(side.rows.find((r) => r.label === "Negotiation")!.count).toBe(0);
    expect(side.rows.reduce((s, r) => s + r.count, 0)).toBe(12);
  });

  it("falls through to the next card the role is allowed, or none", () => {
    expect(buildSideCard("owner", { teamScope: true, cash: { thisMonth: 0, lastMonth: 0, thisWeek: 0, week: [] } })?.kind).toBe("bars");
    expect(buildSideCard("finance", { teamScope: false })).toBeNull();
  });

  it("hides kitchen state from a role that cannot read the kitchen", () => {
    const row = { bookingId: "a", bookingNumber: "a", eventName: "A", venueName: "v", hall: null, timeSlot: "MORNING", guestCount: 50, catered: true };
    const events = { today: { count: 1, guests: 50, rows: [row] }, tomorrow: noEvents, thisWeek: 1 };
    const staff = buildSideCard("staff", { teamScope: false, events });
    const ops = buildSideCard("ops", { teamScope: false, events, kitchen: { plans: [] } });
    if (staff?.kind !== "events" || ops?.kind !== "events") throw new Error("expected events cards");
    expect(staff.events[0].kitchen).toBeNull();
    expect(ops.events[0].kitchen).toBe("No kitchen plan");
    expect(ops.events[0].where).toBe("v · Morning");
  });
});
