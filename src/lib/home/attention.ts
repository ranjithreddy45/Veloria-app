// ============================================================
// "Needs you now": turning facts into a short, ranked list.
//
// Every item is a LINK to the screen where the work is actually done. The
// home screen never marks anything "done" itself, so an item only leaves the
// feed when the underlying record changes, which is what keeps it honest.
//
// Ranking is severity first, then the kind of thing, then how late it is.
// Lateness alone cannot rank across kinds: an invoice nine days overdue and a
// lead forty minutes past its response deadline are not on the same clock,
// and the lead is the one that goes cold this hour.
// Pure: `now` is injected.
// ============================================================

import { formatINR } from "@/lib/utils";
import type { HomeLens } from "./lens";
import type { HomeFacts, KitchenPlanFact } from "./facts";
import { formatDateOnly, formatIstDay, formatIstTime } from "./ist";

/** urgent = already late or about to cost something; today = due today; heads-up = worth knowing. */
export type Severity = "urgent" | "today" | "heads-up";

export type AttentionKind =
  | "sla"
  | "kitchen"
  | "invoice"
  | "hold"
  | "followup"
  | "visit"
  | "task"
  | "quote-approval"
  | "cancel-approval"
  | "payment-proof"
  | "quote-viewed";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: Severity;
  title: string;
  detail: string;
  /** The ONE thing to do, worded as the destination's action. */
  actionLabel: string;
  href: string;
  /** Higher is more pressing, compared only within the same severity and kind. */
  urgency: number;
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  urgent: "Urgent",
  today: "Today",
  "heads-up": "Heads-up",
};

const SEVERITY_RANK: Record<Severity, number> = { urgent: 0, today: 1, "heads-up": 2 };

// Within one severity: customer-facing clocks first (a waiting lead, a catered
// event with no kitchen plan, money owed, a date about to be released), then
// the rep's own diary, then approvals, then nudges.
const KIND_WEIGHT: Record<AttentionKind, number> = {
  sla: 100,
  kitchen: 95,
  invoice: 90,
  hold: 85,
  followup: 80,
  visit: 75,
  task: 70,
  "quote-approval": 65,
  "cancel-approval": 60,
  "payment-proof": 55,
  "quote-viewed": 50,
};

export const MAX_ATTENTION_ITEMS = 8;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "47 min", "3 h", "2 days": coarse on purpose, the feed is not a stopwatch. */
export function formatElapsed(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < HOUR) return `${Math.max(1, Math.round(abs / MIN))} min`;
  if (abs < DAY) return `${Math.round(abs / HOUR)} h`;
  const days = Math.round(abs / DAY);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

const SLOT_LABEL: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  FULL_DAY: "Full day",
};

export function slotLabel(slot: string): string {
  return SLOT_LABEL[slot] ?? slot;
}

function joinDetail(parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(" · ");
}

/**
 * A booking can (rarely) carry more than one kitchen plan. For "has the
 * kitchen started?" the most advanced plan answers the question.
 */
export function leadingPlan(plans: KitchenPlanFact[]): KitchenPlanFact | null {
  const order = ["COMPLETED", "IN_PROGRESS", "PLANNED"];
  return (
    [...plans].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))[0] ?? null
  );
}

/** Every candidate item the facts support, unranked and uncapped. */
export function collectAttention(facts: HomeFacts, now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];
  const t = now.getTime();
  const showOwner = facts.teamScope;

  for (const r of facts.sla?.rows ?? []) {
    const late = t - r.dueAt.getTime();
    items.push({
      id: `sla-${r.leadId}`,
      kind: "sla",
      severity: "urgent",
      title: `${r.contactName} has waited ${formatElapsed(late)} past the first-response deadline`,
      detail: joinDetail([
        r.title,
        showOwner && (r.assignedToName ? `assigned to ${r.assignedToName}` : "unassigned"),
      ]),
      actionLabel: "Respond now",
      href: `/leads/${r.leadId}`,
      urgency: late,
    });
  }

  for (const r of facts.followups?.rows ?? []) {
    const late = t - r.followUpAt.getTime();
    const overdue = late > 0;
    items.push({
      id: `followup-${r.leadId}`,
      kind: "followup",
      severity: overdue ? "urgent" : "today",
      title: overdue
        ? `Follow-up with ${r.contactName} is ${formatElapsed(late)} late`
        : `Follow up with ${r.contactName} at ${formatIstTime(r.followUpAt)}`,
      detail: joinDetail([r.title, showOwner && r.assignedToName]),
      actionLabel: "Open lead",
      href: `/leads/${r.leadId}`,
      urgency: late,
    });
  }

  for (const r of facts.tasks?.rows ?? []) {
    const late = t - r.dueAt.getTime();
    const overdue = late > 0;
    items.push({
      id: `task-${r.id}`,
      kind: "task",
      severity: overdue ? "urgent" : "today",
      title: r.title,
      detail: joinDetail([
        overdue ? `Due ${formatElapsed(late)} ago` : `Due ${formatIstTime(r.dueAt)}`,
        r.related,
      ]),
      actionLabel: "Open task",
      href: `/tasks/${r.id}`,
      urgency: late,
    });
  }

  for (const r of facts.holds?.rows ?? []) {
    const left = r.holdExpiresAt.getTime() - t;
    items.push({
      id: `hold-${r.bookingId}`,
      kind: "hold",
      // Inside three hours there is no slack left to reach the customer.
      severity: left <= 3 * HOUR ? "urgent" : "today",
      title: `Hold on ${r.eventName} ends at ${formatIstTime(r.holdExpiresAt)}`,
      detail: joinDetail([r.contactName, r.venueName]),
      actionLabel: "Open booking",
      href: `/bookings/${r.bookingId}`,
      urgency: -left,
    });
  }

  for (const r of facts.visits?.rows ?? []) {
    const until = r.scheduledAt.getTime() - t;
    const kind = r.kind === "MENU_TASTING" ? "Menu tasting" : "Site visit";
    items.push({
      id: `visit-${r.id}`,
      kind: "visit",
      severity: until <= HOUR ? "today" : "heads-up",
      title:
        until >= 0
          ? `${kind} with ${r.customerName} at ${formatIstTime(r.scheduledAt)}`
          : `${kind} with ${r.customerName} was at ${formatIstTime(r.scheduledAt)} and is still open`,
      detail: joinDetail([
        r.venueName,
        r.status === "REQUESTED" && "not yet confirmed",
        r.unassigned && "no host assigned",
      ]),
      actionLabel: "Open site visits",
      href: "/site-visits",
      urgency: -until,
    });
  }

  for (const r of facts.quotes?.rows ?? []) {
    items.push({
      id: `quote-${r.linkId}`,
      kind: "quote-viewed",
      severity: "today",
      title: `${r.clientName ?? "A customer"} opened the quotation ${r.viewCount} ${
        r.viewCount === 1 ? "time" : "times"
      } and has not paid`,
      detail: joinDetail([
        r.occasion,
        r.grandTotal > 0 && formatINR(r.grandTotal),
        `last opened ${formatIstDay(r.lastViewedAt)}, ${formatIstTime(r.lastViewedAt)}`,
      ]),
      actionLabel: "Open quotation",
      href: r.quotationId ? `/quotations/${r.quotationId}` : "/quotations",
      urgency: r.lastViewedAt.getTime(),
    });
  }

  for (const r of facts.quoteApprovals?.rows ?? []) {
    items.push({
      id: `quote-approval-${r.id}`,
      kind: "quote-approval",
      severity: "today",
      title: `Quotation ${r.quoteNumber} is waiting for your approval`,
      detail: joinDetail([
        r.clientName,
        formatINR(r.grandTotal),
        r.submittedByName && `raised by ${r.submittedByName}`,
      ]),
      actionLabel: "Review",
      href: "/approvals",
      urgency: r.submittedAt ? t - r.submittedAt.getTime() : 0,
    });
  }

  for (const r of facts.receivables?.rows ?? []) {
    const late = t - r.dueAt.getTime();
    items.push({
      id: `invoice-${r.invoiceId}`,
      kind: "invoice",
      severity: "urgent",
      title: `${formatINR(r.balanceDue)} overdue from ${r.contactName}`,
      detail: joinDetail([
        r.invoiceNumber,
        `due ${formatIstDay(r.dueAt)}`,
        r.eventDate && `event on ${formatDateOnly(r.eventDate)}`,
      ]),
      actionLabel: "Open invoice",
      href: `/invoices/${r.invoiceId}`,
      urgency: late,
    });
  }

  for (const r of facts.invoiceCancels?.rows ?? []) {
    items.push({
      id: `invoice-cancel-${r.id}`,
      kind: "cancel-approval",
      severity: "today",
      title: `Cancellation of invoice ${r.reference} is waiting for approval`,
      detail: joinDetail([formatINR(r.amount), r.reason]),
      actionLabel: "Review",
      href: `/invoices/${r.id}`,
      urgency: r.requestedAt ? t - r.requestedAt.getTime() : 0,
    });
  }

  for (const r of facts.paymentCancels?.rows ?? []) {
    items.push({
      id: `payment-cancel-${r.id}`,
      kind: "cancel-approval",
      severity: "today",
      title: `Cancellation of payment ${r.reference} is waiting for approval`,
      detail: joinDetail([formatINR(r.amount), r.reason]),
      actionLabel: "Review",
      href: "/payments",
      urgency: r.requestedAt ? t - r.requestedAt.getTime() : 0,
    });
  }

  const proofs = facts.paymentProofs?.count ?? 0;
  if (proofs > 0) {
    items.push({
      id: "payment-proofs",
      kind: "payment-proof",
      severity: "today",
      title:
        proofs === 1
          ? "1 payment proof is waiting to be verified"
          : `${proofs} payment proofs are waiting to be verified`,
      detail: "Customers uploaded these; the money is not counted until someone checks it",
      actionLabel: "Open payments",
      href: "/payments",
      urgency: proofs,
    });
  }

  if (facts.kitchen && facts.events) {
    const byBooking = new Map<string, KitchenPlanFact[]>();
    for (const p of facts.kitchen.plans) {
      byBooking.set(p.bookingId, [...(byBooking.get(p.bookingId) ?? []), p]);
    }
    const days = [
      { rows: facts.events.today.rows, isToday: true, word: "today" },
      { rows: facts.events.tomorrow.rows, isToday: false, word: "tomorrow" },
    ];
    for (const day of days) {
      for (const e of day.rows) {
        const plan = leadingPlan(byBooking.get(e.bookingId) ?? []);
        const where = joinDetail([e.venueName, e.hall, slotLabel(e.timeSlot)]);
        if (!plan) {
          // Only a booking with a menu needs cooking. A hall-only hire with no
          // plan is normal and must not raise an alarm.
          if (!e.catered) continue;
          items.push({
            id: `kitchen-missing-${e.bookingId}`,
            kind: "kitchen",
            severity: day.isToday ? "urgent" : "today",
            title: `${e.eventName} is ${day.word} and has no kitchen plan`,
            detail: joinDetail([where, `${e.guestCount} guests booked`]),
            actionLabel: "Create kitchen plan",
            href: "/kitchen",
            urgency: day.isToday ? 2 : 1,
          });
        } else if (plan.status === "PLANNED") {
          items.push({
            id: `kitchen-planned-${plan.id}`,
            kind: "kitchen",
            severity: day.isToday ? "today" : "heads-up",
            title: `Kitchen plan for ${e.eventName} (${day.word}) has not been started`,
            detail: joinDetail([
              where,
              `${e.guestCount} guests booked`,
              `plan covers ${plan.covers}`,
            ]),
            actionLabel: "Open kitchen plan",
            href: `/kitchen/${plan.id}`,
            urgency: day.isToday ? 2 : 1,
          });
        }
      }
    }
  }

  return items;
}

/**
 * Rank and cap. `perKind` stops one busy queue (say, twelve overdue invoices)
 * from pushing everything else off an eight-row list; the owner lens uses a
 * tighter cap because it is meant to be a cross-cut of every department.
 */
export function rankAttention(
  items: AttentionItem[],
  opts: { perKind?: number; max?: number } = {}
): AttentionItem[] {
  const perKind = opts.perKind ?? 3;
  const max = opts.max ?? MAX_ATTENTION_ITEMS;
  const sorted = [...items].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind] ||
      b.urgency - a.urgency ||
      a.id.localeCompare(b.id)
  );
  const seen = new Map<AttentionKind, number>();
  const out: AttentionItem[] = [];
  for (const item of sorted) {
    const n = seen.get(item.kind) ?? 0;
    if (n >= perKind) continue;
    seen.set(item.kind, n + 1);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

export function buildAttention(lens: HomeLens, facts: HomeFacts, now: Date): AttentionItem[] {
  return rankAttention(collectAttention(facts, now), { perKind: lens === "owner" ? 2 : 3 });
}
