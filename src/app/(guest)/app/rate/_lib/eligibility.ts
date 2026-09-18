// ============================================================
// Rating eligibility for the customer app. The rule is the team's own:
// submitReview() in review.actions.ts accepts a review only for a COMPLETED
// booking, and only one per booking. These helpers say where a booking
// stands, instead of letting the customer run into that refusal.
// ============================================================

export const RATING_STATES = [
  "OPEN",
  "ALREADY_REVIEWED",
  "UPCOMING",
  "TODAY",
  "IN_PROGRESS",
  "AWAITING_COMPLETION",
  "NOT_CONFIRMED",
  "CANCELLED",
  "NO_BOOKING",
] as const;

export type RatingState = (typeof RATING_STATES)[number];

export interface RatableBooking {
  id: string;
  status: string;
  date: Date | string;
}

/** Calendar day of a booking. Booking.date is @db.Date, which arrives as UTC midnight. */
export function bookingDayKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

const IST_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar day in India, as YYYY-MM-DD. */
export function istDayKey(now: Date): string {
  const parts = IST_DAY.formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function ratingState(
  booking: { status: string; date: Date | string } | null,
  hasReview: boolean,
  now: Date
): RatingState {
  if (!booking) return "NO_BOOKING";
  if (hasReview) return "ALREADY_REVIEWED";
  if (booking.status === "COMPLETED") return "OPEN";
  if (booking.status === "CANCELLED") return "CANCELLED";
  if (booking.status === "IN_PROGRESS") return "IN_PROGRESS";
  if (booking.status === "HOLD" || booking.status === "TENTATIVE") return "NOT_CONFIRMED";
  const day = bookingDayKey(booking.date);
  const today = istDayKey(now);
  if (day > today) return "UPCOMING";
  if (day === today) return "TODAY";
  return "AWAITING_COMPLETION";
}

const BLOCKED_MESSAGE: Record<RatingState, string | null> = {
  OPEN: null,
  ALREADY_REVIEWED: "You've already rated this event. Thank you.",
  UPCOMING: "Your event is still ahead. You can rate it once the team marks it completed after the day.",
  TODAY: "Your event is today. You can rate it once the team marks it completed.",
  IN_PROGRESS: "Your event is under way. You can rate it once the team marks it completed.",
  AWAITING_COMPLETION: "Your event day has passed, but the team hasn't marked it completed yet. You can rate it as soon as they do.",
  NOT_CONFIRMED: "This booking isn't confirmed, so there's no event to rate yet.",
  CANCELLED: "This booking was cancelled, so there's no event to rate.",
  NO_BOOKING: "There's no booking linked to this sign-in yet.",
};

/** Why a booking can't be rated right now, in the customer's words; null when it can. */
export function ratingBlockedMessage(state: RatingState): string | null {
  return BLOCKED_MESSAGE[state];
}

/**
 * Which booking the rate screen opens on: the latest completed booking still
 * waiting for a review, else the latest completed one, else the latest past
 * booking, else the soonest upcoming one.
 */
export function pickBookingToRate<T extends RatableBooking>(
  bookings: readonly T[],
  reviewedBookingIds: ReadonlySet<string>,
  now: Date
): T | null {
  if (bookings.length === 0) return null;
  const newestFirst = [...bookings].sort((a, b) => bookingDayKey(b.date).localeCompare(bookingDayKey(a.date)));
  const completed = newestFirst.filter((b) => b.status === "COMPLETED");
  const unrated = completed.find((b) => !reviewedBookingIds.has(b.id));
  if (unrated) return unrated;
  if (completed.length > 0) return completed[0];
  const today = istDayKey(now);
  const latestPast = newestFirst.find((b) => b.status !== "CANCELLED" && bookingDayKey(b.date) <= today);
  if (latestPast) return latestPast;
  const soonestFirst = [...bookings].sort((a, b) => bookingDayKey(a.date).localeCompare(bookingDayKey(b.date)));
  return soonestFirst[0] ?? null;
}

export type ReviewState = "PUBLISHED" | "APPROVED_PRIVATE" | "WITH_TEAM";

/**
 * Moderation state of a Review as the team's /reviews screen sets it. A review
 * the team rejected is stored exactly like one not yet looked at
 * (isApproved false), so the customer wording never promises publication.
 */
export function reviewState(review: { isApproved: boolean; isPublic: boolean }): ReviewState {
  if (!review.isApproved) return "WITH_TEAM";
  return review.isPublic ? "PUBLISHED" : "APPROVED_PRIVATE";
}

// Not yet in status-labels.ts; move there when that file is next opened.
export const REVIEW_STATE_WORDS: Record<ReviewState, { label: string; detail: string }> = {
  WITH_TEAM: { label: "With the team", detail: "Your review has reached the team. It isn't shown publicly." },
  APPROVED_PRIVATE: { label: "Approved", detail: "Approved by the team and kept private." },
  PUBLISHED: { label: "Approved", detail: "Approved by the team. It can appear on our hall pages." },
};

export const RATING_TAGS = ["Coordinator", "Food", "Decor", "Parking", "Value", "Cleanliness"] as const;

export type ComposedReview = { ok: true; rating: number; content: string } | { ok: false; error: string };

/** The review as submitReview() needs it: a whole 1 to 5 rating and at least 10 characters of content. */
export function composeReview(input: { rating: unknown; tags: readonly unknown[]; text: unknown }): ComposedReview {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Choose between 1 and 5 stars." };
  const known = RATING_TAGS as readonly string[];
  const tags = [...new Set((input.tags ?? []).map((t) => String(t)).filter((t) => known.includes(t)))];
  const text = String(input.text ?? "").trim().slice(0, 2000);
  let content = [tags.length > 0 ? `Highlights: ${tags.join(", ")}.` : "", text].filter(Boolean).join(" ");
  if (content.length < 10) content = [content, `Rated ${rating} out of 5.`].filter(Boolean).join(" ");
  return { ok: true, rating, content };
}
