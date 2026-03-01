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

  // +20 if budget >= 2,00,000
  const budget = lead.estimatedValue ? Number(lead.estimatedValue) : 0;
  if (budget >= 200000) {
    score += 20;
  }

  // +15 if event date is within 3 months
  if (lead.eventDate) {
    const eventDate = new Date(lead.eventDate);
    const monthsUntilEvent = differenceInMonths(eventDate, now);
    if (monthsUntilEvent >= 0 && monthsUntilEvent <= 3) {
      score += 15;
    }
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

  // -10 if no eventDate
  if (!lead.eventDate) {
    score -= 10;
  }

  // -20 if status is still NEW and created > 7 days ago
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
  const factors: ScoreBreakdown["factors"] = [];

  // Budget check
  const budget = lead.estimatedValue ? Number(lead.estimatedValue) : 0;
  const hasBudget = budget >= 200000;
  factors.push({
    label: "High budget (>= 2 lakh)",
    points: 20,
    applied: hasBudget,
  });

  // Event date proximity check
  let eventDateNear = false;
  if (lead.eventDate) {
    const eventDate = new Date(lead.eventDate);
    const monthsUntilEvent = differenceInMonths(eventDate, now);
    eventDateNear = monthsUntilEvent >= 0 && monthsUntilEvent <= 3;
  }
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

  // No event date penalty
  const noEventDate = !lead.eventDate;
  factors.push({
    label: "No event date set (penalty)",
    points: -10,
    applied: noEventDate,
  });

  // Stale NEW lead penalty
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
