import { differenceInDays, differenceInMonths } from "date-fns";

// ============================================================
// Lead Scoring Types
// ============================================================

interface LeadData {
  estimatedValue?: number | string | null;
  eventDate?: Date | string | null;
  followUpDate?: Date | string | null;
  source?: string | null;
  guestCount?: number | null;
  status?: string | null;
  createdAt?: Date | string | null;
}

interface ScoreBreakdown {
  total: number;
  factors: {
    label: string;
    points: number;
    applied: boolean;
  }[];
}

// Closed leads (Won/Lost) are no longer in the nurture funnel. They must not
// earn early-stage/"event soon" points or take the "stale NEW" penalty — those
// factors only describe an open lead that still needs working (S-3).
function isClosedStatus(status?: string | null): boolean {
  return status === "WON" || status === "LOST";
}

// True only when an event date is set AND lies in the future, within `months`
// from now. `differenceInMonths` truncates toward zero, so a date a few days in
// the past would return 0 and be mistakenly credited — guard with an explicit
// future check so only genuinely upcoming events score (S-5).
function isEventWithinMonths(
  eventDate: Date | string | null | undefined,
  now: Date,
  months: number
): boolean {
  if (!eventDate) return false;
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return false;
  if (d.getTime() <= now.getTime()) return false; // past/now never counts
  return differenceInMonths(d, now) <= months;
}

// ============================================================
// Lead Scoring Algorithm
// ============================================================

/**
 * Calculate a lead score from 0-100 based on multiple weighted factors.
 *
 * Scoring rules:
 *   +20  if budget (estimatedValue) >= 200,000 (2 lakh)
 *   +15  if event date is within 3 months from now
 *   +10  if the lead has a followUpDate set (responded to follow-up)
 *   +25  if the lead source is REFERRAL
 *   +10  if guestCount > 100
 *   -10  if no eventDate is set
 *   -20  if status is still NEW and lead was created more than 7 days ago
 */
export function calculateLeadScore(lead: LeadData): number {
  let score = 0;
  const now = new Date();
  const closed = isClosedStatus(lead.status);

  // +20 if budget >= 2,00,000
  const budget = lead.estimatedValue ? Number(lead.estimatedValue) : 0;
  if (budget >= 200000) {
    score += 20;
  }

  // +15 if event date is within 3 months (future only). A closed lead's event
  // proximity is no longer a buying signal, so skip it for Won/Lost.
  if (!closed && isEventWithinMonths(lead.eventDate, now, 3)) {
    score += 15;
  }

  // +10 if responded to follow-up (has followUpDate)
  if (lead.followUpDate) {
    score += 10;
  }

  // +25 if source is REFERRAL
  if (lead.source === "REFERRAL") {
    score += 25;
  }

  // +10 if guestCount > 100
  if (lead.guestCount && lead.guestCount > 100) {
    score += 10;
  }

  // -10 if no eventDate (skip for closed leads — not a follow-up signal anymore)
  if (!closed && !lead.eventDate) {
    score -= 10;
  }

  // -20 if status is still NEW and created > 7 days ago. By definition this only
  // applies to NEW leads, so closed leads are never penalised here.
  if (lead.status === "NEW" && lead.createdAt) {
    const createdDate = new Date(lead.createdAt);
    const daysSinceCreation = differenceInDays(now, createdDate);
    if (daysSinceCreation > 7) {
      score -= 20;
    }
  }

  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate lead score with a detailed breakdown of each factor.
 * Useful for displaying scoring rationale in the UI.
 */
export function calculateLeadScoreWithBreakdown(
  lead: LeadData
): ScoreBreakdown {
  const now = new Date();
  const closed = isClosedStatus(lead.status);
  const factors: ScoreBreakdown["factors"] = [];

  // Budget check
  const budget = lead.estimatedValue ? Number(lead.estimatedValue) : 0;
  const hasBudget = budget >= 200000;
  factors.push({
    label: "High budget (>= 2 lakh)",
    points: 20,
    applied: hasBudget,
  });

  // Event date proximity check (future only; not credited for closed leads)
  const eventDateNear = !closed && isEventWithinMonths(lead.eventDate, now, 3);
  factors.push({
    label: "Event within 3 months",
    points: 15,
    applied: eventDateNear,
  });

  // Follow-up response check
  const hasFollowUp = !!lead.followUpDate;
  factors.push({
    label: "Responded to follow-up",
    points: 10,
    applied: hasFollowUp,
  });

  // Referral source check
  const isReferral = lead.source === "REFERRAL";
  factors.push({
    label: "Source is Referral",
    points: 25,
    applied: isReferral,
  });

  // Guest count check
  const hasLargeGuestCount =
    !!lead.guestCount && lead.guestCount > 100;
  factors.push({
    label: "Guest count > 100",
    points: 10,
    applied: hasLargeGuestCount,
  });

  // No event date penalty (skip for closed leads)
  const noEventDate = !closed && !lead.eventDate;
  factors.push({
    label: "No event date set (penalty)",
    points: -10,
    applied: noEventDate,
  });

  // Stale NEW lead penalty (only ever applies while status is NEW)
  let isStaleNew = false;
  if (lead.status === "NEW" && lead.createdAt) {
    const createdDate = new Date(lead.createdAt);
    const daysSinceCreation = differenceInDays(now, createdDate);
    isStaleNew = daysSinceCreation > 7;
  }
  factors.push({
    label: "Stale NEW lead (> 7 days, penalty)",
    points: -20,
    applied: isStaleNew,
  });

  // Calculate total
  const rawTotal = factors.reduce(
    (sum, factor) => sum + (factor.applied ? factor.points : 0),
    0
  );
  const total = Math.max(0, Math.min(100, rawTotal));

  return { total, factors };
}
