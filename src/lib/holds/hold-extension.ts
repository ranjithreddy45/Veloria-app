// ============================================================
// Placing or extending a hold on a team booking — pure.
// ------------------------------------------------------------
// placeHold (src/actions/booking.actions.ts) serves the booking page's "Place
// Hold" (a TENTATIVE booking) and "Extend hold" (a HOLD booking). Both set the
// hold to end a whole number of hours from now, 1 to 168 (seven days): the
// limits the dialogs offer, checked again on the server.
//
// Extending must end the hold LATER than it ends now. A hold with no end time
// never lapses, so giving it one would shorten it: refused too. The server adds
// what needs the database: a hold whose window has passed gets its date back
// only if the slot is still free, and the write is pinned to the hold as read.
//
// Pure and client-safe.
// ============================================================

/** The booking page's menu item, named in the team's checkout refusal (checkout-guard.ts). */
export const EXTEND_HOLD_LABEL = "Extend hold";

export const HOLD_HOURS_MIN = 1;
/** Seven days. */
export const HOLD_HOURS_MAX = 168;

/** Quick picks in the Extend hold dialog. */
export const EXTEND_HOLD_PRESET_HOURS: readonly number[] = [4, 24, 48, 72, 168];

type Dateish = Date | string | null | undefined;

function time(d: Dateish): number {
  if (d === null || d === undefined) return Number.NaN;
  return (d instanceof Date ? d : new Date(d)).getTime();
}

/** A whole number of hours from 1 to 168. */
export function isValidHoldHours(hours: unknown): hours is number {
  return typeof hours === "number" && Number.isInteger(hours) && hours >= HOLD_HOURS_MIN && hours <= HOLD_HOURS_MAX;
}

/** When a hold set at `now` for `hours` ends. */
export function holdExpiryAfter(hours: number, now: Date): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export type HoldChangeRefusal = "INVALID_HOURS" | "NOT_HOLDABLE" | "NO_END_TIME" | "NOT_LATER";

/**
 * Why this booking's hold can't be set to end `hours` from now; null when it
 * can. A TENTATIVE booking is placed on hold. A HOLD is extended, which must
 * move its existing end time later.
 */
export function holdChangeRefusal(
  b: { status: string; holdExpiresAt: Dateish },
  hours: unknown,
  now: Date = new Date()
): HoldChangeRefusal | null {
  if (!isValidHoldHours(hours)) return "INVALID_HOURS";
  if (b.status === "TENTATIVE") return null;
  if (b.status !== "HOLD") return "NOT_HOLDABLE";
  const current = time(b.holdExpiresAt);
  if (!Number.isFinite(current)) return "NO_END_TIME";
  return holdExpiryAfter(hours, now).getTime() > current ? null : "NOT_LATER";
}

/** "17 Sept, 3:40 pm IST": the team works in India time. */
function holdEndLabel(d: Dateish): string {
  const t = time(d);
  if (!Number.isFinite(t)) return "its current end time";
  const label = new Date(t).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${label} IST`;
}

/** What the team is told. `currentEnd` is the hold's end time as read (used for NOT_LATER). */
export function holdChangeError(refusal: HoldChangeRefusal, currentEnd?: Dateish): string {
  switch (refusal) {
    case "INVALID_HOURS":
      return `A hold can last from ${HOLD_HOURS_MIN} to ${HOLD_HOURS_MAX} hours (7 days), in whole hours.`;
    case "NOT_HOLDABLE":
      return "Only a tentative/held booking can be placed on hold";
    case "NO_END_TIME":
      return "This hold has no end time, so it doesn't lapse and there is nothing to extend.";
    case "NOT_LATER":
      return `This hold already runs until ${holdEndLabel(currentEnd)}. Choose a longer time so it ends later than that.`;
  }
}

/** A hold past its window whose date and slot have since been taken or blacked out. */
export const HOLD_SLOT_TAKEN_ERROR =
  "This hold's window has passed and its date and slot are no longer free: another booking or a blackout now covers them. The hold can't be extended; start a new booking on a free date or slot.";

/** The booking changed between reading it and writing the hold. */
export const HOLD_CHANGED_ERROR = "This booking changed while the hold was being updated. Refresh the page and try again.";
