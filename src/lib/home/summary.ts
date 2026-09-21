// ============================================================
// The words and tiles on the home screen, per lens.
//
// Rule for everything here: a sentence or tile is only produced from a fact
// block that is present. When the block is missing (the role may not see that
// module) the tile is LEFT OUT rather than shown as zero, and the headline
// falls back to something that is still true. Nothing is estimated.
// Pure: `now` is injected.
// ============================================================

import { formatINR } from "@/lib/utils";
import { MONEY_METRIC } from "@/lib/metrics/revenue";
import type { HomeLens } from "./lens";
import type { DayValue, EventRow, HomeFacts } from "./facts";
import { istHour } from "./ist";
import { leadingPlan, slotLabel } from "./attention";

// ------------------------------------------------------------
// Greeting
// ------------------------------------------------------------

/** Same cut-offs the old dashboard used; tests/e2e/smoke-routes matches on these words. */
export function timeOfDayGreeting(now: Date): string {
  const hour = istHour(now);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}

function isAre(n: number): string {
  return n === 1 ? "is" : "are";
}

export interface Greeting {
  /** "Good evening, Nayana." */
  salutation: string;
  /** The specific, true sentence that follows it inside the h1. */
  headline: string;
  lede: string;
}

function sentence(parts: string[], fallback: string): string {
  return parts.length ? parts.join(" ") : fallback;
}

export function buildGreeting(
  lens: HomeLens,
  facts: HomeFacts,
  firstName: string,
  now: Date
): Greeting {
  const salutation = `${timeOfDayGreeting(now)}, ${firstName}.`;
  const lede: string[] = [];
  let headline = "Here is where things stand.";

  const { sla, followups, tasks, events, receivables, quotes, holds, kitchen } = facts;

  if (lens === "sales") {
    if (followups) {
      const due = followups.overdue + followups.today;
      headline =
        due === 0
          ? "No follow-ups are due today."
          : followups.overdue > 0
            ? `${plural(due, "follow-up")} ${isAre(due)} due, ${followups.overdue} of them overdue.`
            : `${plural(due, "follow-up")} ${isAre(due)} due today.`;
    }
    if (sla && sla.breached > 0) {
      lede.push(
        `${plural(sla.breached, "lead")} ${sla.breached === 1 ? "has" : "have"} gone past the first-response deadline.`
      );
    }
    if (quotes && quotes.openedToday > 0) {
      lede.push(`${plural(quotes.openedToday, "quotation")} ${quotes.openedToday === 1 ? "was" : "were"} opened by customers today.`);
    }
    if (holds && holds.rows.length > 0) {
      lede.push(`${plural(holds.rows.length, "hold")} ${holds.rows.length === 1 ? "ends" : "end"} today.`);
    }
  } else if (lens === "ops") {
    if (events) {
      headline =
        events.today.count === 0
          ? "No events are on today."
          : `${plural(events.today.count, "event")} today, ${events.today.guests.toLocaleString("en-IN")} guests booked.`;
      lede.push(
        events.tomorrow.count === 0
          ? "Nothing is booked for tomorrow."
          : `Tomorrow: ${plural(events.tomorrow.count, "event")}, ${events.tomorrow.guests.toLocaleString("en-IN")} guests booked.`
      );
    }
    if (kitchen) {
      const notStarted = kitchenNotStarted(facts);
      if (notStarted > 0) lede.push(`${plural(notStarted, "kitchen plan")} ${notStarted === 1 ? "has" : "have"} not been started.`);
    }
  } else if (lens === "finance") {
    if (receivables) {
      headline =
        receivables.overdueCount === 0
          ? "No invoices are overdue."
          : `${formatINR(receivables.overdueAmount)} is overdue across ${plural(receivables.overdueCount, "invoice")}.`;
      lede.push(`${formatINR(receivables.outstanding)} is owed in total on sent invoices.`);
    }
    const approvals = (facts.invoiceCancels?.count ?? 0) + (facts.paymentCancels?.count ?? 0);
    if (approvals > 0) lede.push(`${plural(approvals, "cancellation request")} ${approvals === 1 ? "waits" : "wait"} for approval.`);
  } else if (lens === "owner") {
    if (events) {
      headline =
        events.today.count === 0
          ? "No events are on today."
          : `${plural(events.today.count, "event")} ${isAre(events.today.count)} on today.`;
    }
    if (receivables && receivables.overdueCount > 0) {
      lede.push(`${formatINR(receivables.overdueAmount)} is overdue across ${plural(receivables.overdueCount, "invoice")}.`);
    }
    if (sla && sla.breached > 0) {
      lede.push(`${plural(sla.breached, "lead")} ${sla.breached === 1 ? "has" : "have"} waited past the first-response deadline.`);
    }
    if (lede.length === 0 && receivables && sla) {
      lede.push("No invoice is overdue and no lead is past its response deadline.");
    }
  }

  if (lens === "staff" || headline === "Here is where things stand.") {
    if (tasks) {
      const due = tasks.overdue + tasks.laterToday;
      headline =
        due === 0
          ? "None of your tasks are due today."
          : tasks.overdue > 0
            ? `${plural(due, "task")} ${isAre(due)} due, ${tasks.overdue} of them overdue.`
            : `${plural(due, "task")} ${isAre(due)} due today.`;
    }
    if (lens === "staff" && events) {
      lede.push(
        events.today.count === 0
          ? "No events are on today."
          : `${plural(events.today.count, "event")} ${isAre(events.today.count)} on today.`
      );
    }
  } else if (tasks && tasks.overdue > 0) {
    lede.push(`You also have ${plural(tasks.overdue, "overdue task")} of your own.`);
  }

  return {
    salutation,
    headline,
    lede: sentence(lede, "Everything below is read live from the workspace each time this page loads."),
  };
}

// ------------------------------------------------------------
// KPI tiles
// ------------------------------------------------------------

export type KpiTone = "good" | "bad" | "neutral";

export interface HomeKpi {
  id: string;
  label: string;
  value: string;
  sub: string;
  /** Tone of the SUB line only. Always paired with words, never colour alone. */
  tone: KpiTone;
  href: string;
}

/** PLANNED plans attached to today's or tomorrow's events. */
export function kitchenNotStarted(facts: HomeFacts): number {
  if (!facts.kitchen || !facts.events) return 0;
  const ids = new Set(
    [...facts.events.today.rows, ...facts.events.tomorrow.rows].map((e) => e.bookingId)
  );
  const byBooking = new Map<string, typeof facts.kitchen.plans>();
  for (const p of facts.kitchen.plans) {
    if (!ids.has(p.bookingId)) continue;
    byBooking.set(p.bookingId, [...(byBooking.get(p.bookingId) ?? []), p]);
  }
  let n = 0;
  for (const plans of byBooking.values()) if (leadingPlan(plans)?.status === "PLANNED") n++;
  return n;
}

/** Catered events today or tomorrow with no kitchen plan at all. */
export function cateredWithoutPlan(facts: HomeFacts): number {
  if (!facts.kitchen || !facts.events) return 0;
  const planned = new Set(facts.kitchen.plans.map((p) => p.bookingId));
  return [...facts.events.today.rows, ...facts.events.tomorrow.rows].filter(
    (e) => e.catered && !planned.has(e.bookingId)
  ).length;
}

/**
 * Month-on-month change, or null when last month was zero: "up 100%" from
 * nothing is noise, so the tile says what last month was instead.
 */
export function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function monthName(now: Date): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "Asia/Kolkata" }).format(now);
}

export function buildKpis(lens: HomeLens, facts: HomeFacts, now: Date): HomeKpi[] {
  const month = monthName(now);
  const scope = facts.teamScope ? "Team" : "My";
  const tiles: Record<string, HomeKpi | undefined> = {};

  if (facts.cash) {
    const change = changePercent(facts.cash.thisMonth, facts.cash.lastMonth);
    tiles.cashMonth = {
      id: "cashMonth",
      label: `${MONEY_METRIC.CASH_COLLECTED.label} · ${month}`,
      value: formatINR(facts.cash.thisMonth),
      sub:
        change === null
          ? `Last month: ${formatINR(facts.cash.lastMonth)}`
          : `${change >= 0 ? "Up" : "Down"} ${Math.abs(change)}% on last month so far`,
      tone: change === null ? "neutral" : change >= 0 ? "good" : "bad",
      href: "/payments",
    };
    tiles.cashWeek = {
      id: "cashWeek",
      label: `${MONEY_METRIC.CASH_COLLECTED.label} · this week`,
      value: formatINR(facts.cash.thisWeek),
      sub: `${MONEY_METRIC.CASH_COLLECTED.sub}, Monday to today`,
      tone: "neutral",
      href: "/payments",
    };
  }

  if (facts.receivables) {
    const r = facts.receivables;
    tiles.overdue = {
      id: "overdue",
      label: "Overdue",
      value: formatINR(r.overdueAmount),
      sub: r.overdueCount === 0 ? "No invoices overdue" : `${plural(r.overdueCount, "invoice")} overdue`,
      tone: r.overdueCount === 0 ? "good" : "bad",
      href: "/invoices",
    };
    tiles.outstanding = {
      id: "outstanding",
      label: "Outstanding",
      value: formatINR(r.outstanding),
      sub: "Owed on sent, part-paid and overdue invoices",
      tone: "neutral",
      href: "/invoices",
    };
  }

  if (facts.invoiceCancels || facts.paymentCancels || facts.paymentProofs) {
    const cancels = (facts.invoiceCancels?.count ?? 0) + (facts.paymentCancels?.count ?? 0);
    const proofs = facts.paymentProofs?.count ?? 0;
    const parts: string[] = [];
    if (facts.invoiceCancels || facts.paymentCancels) parts.push(plural(cancels, "cancellation"));
    if (facts.paymentProofs) parts.push(plural(proofs, "payment proof"));
    tiles.approvals = {
      id: "approvals",
      label: "Waiting for a decision",
      value: (cancels + proofs).toLocaleString("en-IN"),
      sub: parts.join(" · "),
      tone: cancels + proofs === 0 ? "good" : "bad",
      href: "/payments",
    };
  }

  if (facts.sla) {
    tiles.sla = {
      id: "sla",
      label: "Leads past response deadline",
      value: facts.sla.breached.toLocaleString("en-IN"),
      sub:
        facts.sla.pending === 0
          ? "None still inside the window"
          : `${facts.sla.pending} more still inside the window`,
      tone: facts.sla.breached === 0 ? "good" : "bad",
      href: "/leads/sla",
    };
  }

  if (facts.leads) {
    tiles.openLeads = {
      id: "openLeads",
      label: `${scope} open leads`,
      value: facts.leads.open.toLocaleString("en-IN"),
      sub: facts.leads.newToday === 0 ? "None new today" : `${facts.leads.newToday} new today`,
      tone: "neutral",
      href: "/leads",
    };
  }

  if (facts.followups) {
    const f = facts.followups;
    tiles.followups = {
      id: "followups",
      label: "Follow-ups due today",
      value: f.today.toLocaleString("en-IN"),
      sub: f.overdue === 0 ? "None overdue" : `${f.overdue} more overdue from earlier days`,
      tone: f.overdue === 0 ? "good" : "bad",
      href: "/leads/followups",
    };
  }

  if (facts.quotes) {
    tiles.quotesOpened = {
      id: "quotesOpened",
      label: "Quotations opened today",
      value: facts.quotes.openedToday.toLocaleString("en-IN"),
      sub: "Shared links a customer opened today",
      tone: "neutral",
      href: "/quotations",
    };
  }

  if (facts.booked) {
    tiles.bookedMonth = {
      id: "bookedMonth",
      label: `${MONEY_METRIC.BOOKED_VALUE.label} · ${month}`,
      value: formatINR(facts.booked.monthValue),
      sub: `${plural(facts.booked.monthCount, "confirmed booking")} · ${MONEY_METRIC.BOOKED_VALUE.sub.toLowerCase()}`,
      tone: "neutral",
      href: "/bookings",
    };
  }

  if (facts.events) {
    const e = facts.events;
    tiles.eventsToday = {
      id: "eventsToday",
      label: "Events today",
      value: e.today.count.toLocaleString("en-IN"),
      sub: e.today.count === 0 ? "Nothing on today" : `${e.today.guests.toLocaleString("en-IN")} guests booked`,
      tone: "neutral",
      href: "/calendar",
    };
    tiles.eventsTomorrow = {
      id: "eventsTomorrow",
      label: "Events tomorrow",
      value: e.tomorrow.count.toLocaleString("en-IN"),
      sub:
        e.tomorrow.count === 0
          ? "Nothing booked"
          : `${e.tomorrow.guests.toLocaleString("en-IN")} guests booked`,
      tone: "neutral",
      href: "/calendar",
    };
    tiles.eventsWeek = {
      id: "eventsWeek",
      label: "Events this week",
      value: e.thisWeek.toLocaleString("en-IN"),
      sub: "Confirmed, Monday to Sunday",
      tone: "neutral",
      href: "/calendar",
    };
  }

  if (facts.kitchen && facts.events) {
    const notStarted = kitchenNotStarted(facts);
    const missing = cateredWithoutPlan(facts);
    tiles.kitchen = {
      id: "kitchen",
      label: "Kitchen plans not started",
      value: notStarted.toLocaleString("en-IN"),
      sub:
        missing === 0
          ? "For today's and tomorrow's events"
          : `${plural(missing, "catered event")} ${missing === 1 ? "has" : "have"} no plan yet`,
      tone: notStarted + missing === 0 ? "good" : "bad",
      href: "/kitchen",
    };
  }

  if (facts.tasks) {
    const due = facts.tasks.overdue + facts.tasks.laterToday;
    tiles.tasks = {
      id: "tasks",
      label: "My tasks due today",
      value: due.toLocaleString("en-IN"),
      sub: facts.tasks.overdue === 0 ? "None overdue" : `${facts.tasks.overdue} already overdue`,
      tone: facts.tasks.overdue === 0 ? "good" : "bad",
      href: "/my-work",
    };
  }

  if (facts.notifications) {
    tiles.notifications = {
      id: "notifications",
      label: "Unread notifications",
      value: facts.notifications.unread.toLocaleString("en-IN"),
      sub: facts.notifications.unread === 0 ? "You are up to date" : "Waiting in your inbox",
      tone: "neutral",
      href: "/notifications",
    };
  }

  // Preference order per lens. The first four tiles that EXIST win, so a role
  // missing a permission gets the next most relevant tile instead of a gap.
  const ORDER: Record<HomeLens, string[]> = {
    owner: ["cashMonth", "eventsWeek", "overdue", "sla", "bookedMonth", "tasks"],
    sales: ["openLeads", "followups", "quotesOpened", "bookedMonth", "sla", "tasks"],
    ops: ["eventsToday", "eventsTomorrow", "kitchen", "tasks", "eventsWeek", "notifications"],
    finance: ["overdue", "outstanding", "cashMonth", "approvals", "cashWeek", "tasks"],
    staff: ["tasks", "eventsToday", "eventsTomorrow", "notifications", "eventsWeek"],
  };
  return ORDER[lens]
    .map((id) => tiles[id])
    .filter((k): k is HomeKpi => Boolean(k))
    .slice(0, 4);
}

// ------------------------------------------------------------
// Side card
// ------------------------------------------------------------

export interface SideEvent {
  bookingId: string;
  eventName: string;
  where: string;
  guests: number;
  /** Kitchen plan state in words, or null when the role cannot see the kitchen. */
  kitchen: string | null;
}

export type SideCard =
  | { kind: "bars"; title: string; caption: string; total: number; days: DayValue[]; href: string; linkLabel: string }
  | { kind: "stages"; title: string; caption: string; rows: { label: string; count: number }[]; href: string; linkLabel: string }
  | { kind: "events"; title: string; caption: string; events: SideEvent[]; href: string; linkLabel: string };

// Open statuses only, in funnel order. WON and LOST are outcomes, not pipeline.
const OPEN_STATUS_LABEL: [string, string][] = [
  ["NEW", "New"],
  ["NOT_CONNECTED", "Not connected"],
  ["CONTACTED", "Contacted"],
  ["QUALIFIED", "Qualified"],
  ["PROPOSAL_SENT", "Proposal sent"],
  ["NEGOTIATION", "Negotiation"],
];

function sideEvents(facts: HomeFacts, rows: EventRow[]): SideEvent[] {
  return rows.map((e) => {
    let kitchen: string | null = null;
    if (facts.kitchen) {
      const plan = leadingPlan(facts.kitchen.plans.filter((p) => p.bookingId === e.bookingId));
      kitchen = plan
        ? plan.status === "PLANNED"
          ? "Kitchen plan not started"
          : plan.status === "IN_PROGRESS"
            ? "Kitchen plan in progress"
            : "Kitchen plan completed"
        : e.catered
          ? "No kitchen plan"
          : null;
    }
    return {
      bookingId: e.bookingId,
      eventName: e.eventName,
      where: [e.venueName, e.hall, slotLabel(e.timeSlot)].filter(Boolean).join(" · "),
      guests: e.guestCount,
      kitchen,
    };
  });
}

export function buildSideCard(lens: HomeLens, facts: HomeFacts): SideCard | null {
  const events: SideCard | null = facts.events
    ? {
        kind: "events",
        title: "Today's events",
        caption:
          facts.events.today.count === 0
            ? "Nothing is on today"
            : `${facts.events.today.guests.toLocaleString("en-IN")} guests booked across ${plural(facts.events.today.count, "event")}`,
        events: sideEvents(facts, facts.events.today.rows),
        href: "/calendar",
        linkLabel: "Open the calendar",
      }
    : null;

  const booked: SideCard | null = facts.booked
    ? {
        kind: "bars",
        title: `${MONEY_METRIC.BOOKED_VALUE.label} · this week`,
        caption: `${facts.teamScope ? "" : "My bookings. "}By the day the booking was made. ${MONEY_METRIC.BOOKED_VALUE.sub}.`,
        total: facts.booked.weekValue,
        days: facts.booked.week,
        href: "/bookings",
        linkLabel: "Open bookings",
      }
    : null;

  const cash: SideCard | null = facts.cash
    ? {
        kind: "bars",
        title: `${MONEY_METRIC.CASH_COLLECTED.label} · this week`,
        caption: `${MONEY_METRIC.CASH_COLLECTED.sub}, by the day they were paid.`,
        total: facts.cash.thisWeek,
        days: facts.cash.week,
        href: "/payments",
        linkLabel: "Open payments",
      }
    : null;

  const stages: SideCard | null = facts.leads
    ? {
        kind: "stages",
        title: facts.teamScope ? "Open leads by status" : "My open leads by status",
        caption: `${facts.leads.open.toLocaleString("en-IN")} open in total`,
        rows: OPEN_STATUS_LABEL.map(([status, label]) => ({
          label,
          count: facts.leads?.byStatus.find((s) => s.status === status)?.count ?? 0,
        })),
        href: "/leads",
        linkLabel: "Open leads",
      }
    : null;

  const ORDER: Record<HomeLens, (SideCard | null)[]> = {
    owner: [booked, cash, events],
    sales: [stages, booked],
    ops: [events],
    finance: [cash],
    staff: [events],
  };
  return ORDER[lens].find((c) => c !== null) ?? null;
}
