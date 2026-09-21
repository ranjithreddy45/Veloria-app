import { describe, it, expect } from "vitest";
import type { HomeFacts } from "./facts";
import {
  buildAttention,
  collectAttention,
  formatElapsed,
  leadingPlan,
  rankAttention,
  type AttentionItem,
} from "./attention";

// Monday 21 Sep 2026, 15:00 IST.
const NOW = new Date("2026-09-21T09:30:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const minutesAhead = (m: number) => new Date(NOW.getTime() + m * 60_000);

const event = (id: string, catered: boolean) => ({
  bookingId: id,
  bookingNumber: `VG-${id}`,
  eventName: `Event ${id}`,
  venueName: "Hebbal",
  hall: "Grand Hall",
  timeSlot: "EVENING",
  guestCount: 400,
  catered,
});

function item(over: Partial<AttentionItem>): AttentionItem {
  return {
    id: "x",
    kind: "task",
    severity: "today",
    title: "t",
    detail: "",
    actionLabel: "Open",
    href: "/",
    urgency: 0,
    ...over,
  };
}

describe("formatElapsed", () => {
  it("is coarse and never says zero", () => {
    expect(formatElapsed(10_000)).toBe("1 min");
    expect(formatElapsed(47 * 60_000)).toBe("47 min");
    expect(formatElapsed(3 * 3_600_000)).toBe("3 h");
    expect(formatElapsed(24 * 3_600_000)).toBe("1 day");
    expect(formatElapsed(9 * 24 * 3_600_000)).toBe("9 days");
  });
});

describe("collectAttention", () => {
  it("returns nothing when there are no facts, rather than placeholder rows", () => {
    expect(collectAttention({ teamScope: false }, NOW)).toEqual([]);
  });

  it("links every item to a real screen with one action", () => {
    const facts: HomeFacts = {
      teamScope: true,
      sla: {
        breached: 1,
        pending: 0,
        rows: [{ leadId: "L1", title: "Wedding", contactName: "Priya Menon", assignedToName: null, dueAt: minutesAgo(32) }],
      },
      receivables: {
        overdueAmount: 320000,
        overdueCount: 1,
        outstanding: 500000,
        rows: [
          {
            invoiceId: "I1",
            invoiceNumber: "INV-2214",
            contactName: "Sharma Iyer",
            balanceDue: 320000,
            dueAt: minutesAgo(9 * 24 * 60),
            eventDate: new Date("2026-09-27T00:00:00.000Z"),
          },
        ],
      },
    };
    const items = collectAttention(facts, NOW);
    const sla = items.find((i) => i.kind === "sla")!;
    expect(sla.href).toBe("/leads/L1");
    expect(sla.title).toContain("32 min");
    expect(sla.detail).toContain("unassigned");
    const inv = items.find((i) => i.kind === "invoice")!;
    expect(inv.href).toBe("/invoices/I1");
    expect(inv.detail).toMatch(/event on 27 Sep/);
    for (const i of items) {
      expect(i.href.startsWith("/")).toBe(true);
      expect(i.actionLabel.length).toBeGreaterThan(0);
    }
  });

  it("does not name the assignee on a rep's own list", () => {
    const items = collectAttention(
      {
        teamScope: false,
        sla: {
          breached: 1,
          pending: 0,
          rows: [{ leadId: "L1", title: "Wedding", contactName: "P", assignedToName: "Nayana", dueAt: minutesAgo(5) }],
        },
      },
      NOW
    );
    expect(items[0].detail).toBe("Wedding");
  });

  it("separates an overdue follow-up from one due later today", () => {
    const items = collectAttention(
      {
        teamScope: false,
        followups: {
          overdue: 1,
          today: 1,
          rows: [
            { leadId: "A", title: "a", contactName: "Arjun", assignedToName: null, followUpAt: minutesAgo(90) },
            { leadId: "B", title: "b", contactName: "Deepa", assignedToName: null, followUpAt: minutesAhead(120) },
          ],
        },
      },
      NOW
    );
    expect(items.map((i) => i.severity)).toEqual(["urgent", "today"]);
    expect(items[1].title).toContain("5:00 pm");
  });

  it("escalates a hold inside its last three hours", () => {
    const hold = (id: string, mins: number) => ({
      bookingId: id,
      eventName: "Engagement",
      venueName: "Indiranagar",
      contactName: "Fernandes",
      holdExpiresAt: minutesAhead(mins),
    });
    const items = collectAttention({ teamScope: true, holds: { rows: [hold("H1", 60), hold("H2", 400)] } }, NOW);
    expect(items.find((i) => i.id === "hold-H1")!.severity).toBe("urgent");
    expect(items.find((i) => i.id === "hold-H2")!.severity).toBe("today");
  });

  it("flags a catered event with no kitchen plan but never a hall-only hire", () => {
    const facts: HomeFacts = {
      teamScope: false,
      events: {
        today: { count: 2, guests: 800, rows: [event("E1", true), event("E2", false)] },
        tomorrow: { count: 1, guests: 400, rows: [event("E3", true)] },
        thisWeek: 3,
      },
      kitchen: { plans: [{ id: "K3", bookingId: "E3", status: "PLANNED", covers: 380 }] },
    };
    const items = collectAttention(facts, NOW);
    expect(items.map((i) => i.id).sort()).toEqual(["kitchen-missing-E1", "kitchen-planned-K3"]);
    expect(items.find((i) => i.id === "kitchen-missing-E1")!.severity).toBe("urgent");
    const planned = items.find((i) => i.id === "kitchen-planned-K3")!;
    expect(planned.severity).toBe("heads-up");
    expect(planned.href).toBe("/kitchen/K3");
    expect(planned.detail).toContain("plan covers 380");
  });

  it("says nothing about the kitchen to a role that cannot read it", () => {
    const facts: HomeFacts = {
      teamScope: false,
      events: { today: { count: 1, guests: 400, rows: [event("E1", true)] }, tomorrow: { count: 0, guests: 0, rows: [] }, thisWeek: 1 },
    };
    expect(collectAttention(facts, NOW)).toEqual([]);
  });

  it("reports a site visit that slipped past its time as still open", () => {
    const items = collectAttention(
      {
        teamScope: false,
        visits: {
          rows: [
            { id: "V1", customerName: "Karthik", kind: "SITE_VISIT", status: "REQUESTED", venueName: "Airport Road", scheduledAt: minutesAgo(30), unassigned: true },
          ],
        },
      },
      NOW
    );
    expect(items[0].title).toContain("still open");
    expect(items[0].detail).toContain("not yet confirmed");
    expect(items[0].detail).toContain("no host assigned");
  });
});

describe("leadingPlan", () => {
  it("lets the most advanced plan speak for the booking", () => {
    const plans = [
      { id: "a", bookingId: "b", status: "PLANNED", covers: 1 },
      { id: "c", bookingId: "b", status: "IN_PROGRESS", covers: 1 },
    ];
    expect(leadingPlan(plans)!.id).toBe("c");
    expect(leadingPlan([])).toBeNull();
  });
});

describe("rankAttention", () => {
  it("orders by severity, then kind, then lateness", () => {
    const ranked = rankAttention([
      item({ id: "quote", kind: "quote-viewed", severity: "today" }),
      item({ id: "invoice", kind: "invoice", severity: "urgent", urgency: 9_000_000 }),
      item({ id: "sla-new", kind: "sla", severity: "urgent", urgency: 10 }),
      item({ id: "sla-old", kind: "sla", severity: "urgent", urgency: 500 }),
      item({ id: "visit", kind: "visit", severity: "heads-up" }),
    ]);
    expect(ranked.map((i) => i.id)).toEqual(["sla-old", "sla-new", "invoice", "quote", "visit"]);
  });

  it("stops one busy queue from crowding out the rest", () => {
    const invoices = Array.from({ length: 12 }, (_, n) =>
      item({ id: `inv-${n}`, kind: "invoice", severity: "urgent", urgency: n })
    );
    const ranked = rankAttention([...invoices, item({ id: "task", kind: "task", severity: "today" })]);
    expect(ranked.filter((i) => i.kind === "invoice")).toHaveLength(3);
    expect(ranked.map((i) => i.id)).toContain("task");
  });

  it("never returns more than eight", () => {
    const kinds = ["sla", "invoice", "hold", "followup", "visit", "task"] as const;
    const many = kinds.flatMap((kind) =>
      [0, 1, 2].map((n) => item({ id: `${kind}-${n}`, kind, severity: "urgent", urgency: n }))
    );
    expect(rankAttention(many)).toHaveLength(8);
  });

  it("gives the owner a tighter per-kind cap so every department shows", () => {
    const rows = [1, 2, 3].map((n) => ({
      leadId: `L${n}`,
      title: "t",
      contactName: "c",
      assignedToName: null,
      dueAt: minutesAgo(n * 10),
    }));
    const facts: HomeFacts = { teamScope: true, sla: { breached: 3, pending: 0, rows } };
    expect(buildAttention("owner", facts, NOW)).toHaveLength(2);
    expect(buildAttention("sales", facts, NOW)).toHaveLength(3);
  });
});
