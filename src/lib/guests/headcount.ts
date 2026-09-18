// ============================================================
// Two guest numbers, kept apart on purpose.
//
//   CONTRACTED — Booking.guestCount. Agreed at enquiry, it is what the customer
//                is billed against and what the BEO and the kitchen plan are
//                stamped with when they are created (at confirmation, long
//                before a single RSVP exists).
//   CONFIRMED  — heads that actually replied yes: the guest plus their
//                plus-ones, summed over accepted rows.
//
// Both are true. Neither may silently overwrite the other: catering to a
// contract you no longer believe wastes food, and re-cutting a contract to
// match replies changes what someone owes. So this module only ever REPORTS —
// every write is an explicit action a person takes, carrying coversSource.
//
// The same discipline applies to meals. A party that has not answered is
// `unknownHeads`, never folded into non-veg, because a guess presented as a
// count is how a kitchen under-caters a wedding.
// ============================================================

/** RSVP states we count on. Mirrors the RSVPStatus enum without importing Prisma. */
export type RsvpState = "PENDING" | "ACCEPTED" | "DECLINED";

/** The per-guest fields this module needs — a subset of Guest. */
export interface HeadcountGuest {
  rsvpStatus: RsvpState;
  /** Additional people this guest brings. The guest themselves is not included. */
  plusOnes: number;
  mealVeg?: number | null;
  mealNonVeg?: number | null;
  mealJain?: number | null;
}

export interface MealSplit {
  veg: number;
  nonVeg: number;
  jain: number;
  /** Heads on accepted rows whose party never answered the meal question. */
  unknown: number;
}

export interface Headcount {
  /** Booking.guestCount — null when the booking has none. */
  contractedHeads: number | null;
  /** Heads that said yes: Σ(1 + plusOnes) over ACCEPTED rows. */
  confirmedHeads: number;
  /** Heads on rows that have not replied — the number still in play. */
  awaitingHeads: number;
  /** Heads that said no. Reported so "invited" always reconciles. */
  declinedHeads: number;
  /** Row counts, which are what the guest screens list. */
  acceptedGuests: number;
  declinedGuests: number;
  awaitingGuests: number;
  meals: MealSplit;
  /**
   * confirmedHeads − contractedHeads. Positive means more people said yes than
   * were contracted for. Null when the booking has no contracted count.
   */
  varianceVsContract: number | null;
}

/** One party: the guest plus the people they bring. Never below 1. */
export function partySize(guest: Pick<HeadcountGuest, "plusOnes">): number {
  const extra = Number.isFinite(guest.plusOnes) ? Math.max(0, Math.trunc(guest.plusOnes)) : 0;
  return 1 + extra;
}

/** A non-negative whole number, or 0 — used to make a stored count safe to add. */
function count(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** True when this party answered the meal question at all. */
export function hasMealAnswer(guest: HeadcountGuest): boolean {
  return guest.mealVeg != null || guest.mealNonVeg != null || guest.mealJain != null;
}

/**
 * The meal counts for ONE accepted party, and whether they can be trusted.
 *
 * A stored split that does not add up to the party — because the guest later
 * changed their plus-ones, or a staff edit moved the number — is reported as
 * unknown rather than scaled or truncated. Inventing a distribution for a party
 * we cannot account for is exactly the failure this module exists to prevent.
 */
export function partyMeals(guest: HeadcountGuest): MealSplit {
  const heads = partySize(guest);
  if (guest.rsvpStatus !== "ACCEPTED") return { veg: 0, nonVeg: 0, jain: 0, unknown: 0 };
  if (!hasMealAnswer(guest)) return { veg: 0, nonVeg: 0, jain: 0, unknown: heads };

  const veg = count(guest.mealVeg);
  const nonVeg = count(guest.mealNonVeg);
  const jain = count(guest.mealJain);
  if (veg + nonVeg + jain !== heads) return { veg: 0, nonVeg: 0, jain: 0, unknown: heads };
  return { veg, nonVeg, jain, unknown: 0 };
}

/** Roll a guest list up into the two numbers and the meal split. */
export function summariseHeadcount(
  guests: readonly HeadcountGuest[],
  contractedHeads: number | null | undefined
): Headcount {
  const out: Headcount = {
    contractedHeads:
      typeof contractedHeads === "number" && Number.isFinite(contractedHeads)
        ? Math.max(0, Math.trunc(contractedHeads))
        : null,
    confirmedHeads: 0,
    awaitingHeads: 0,
    declinedHeads: 0,
    acceptedGuests: 0,
    declinedGuests: 0,
    awaitingGuests: 0,
    meals: { veg: 0, nonVeg: 0, jain: 0, unknown: 0 },
    varianceVsContract: null,
  };

  for (const guest of guests) {
    const heads = partySize(guest);
    if (guest.rsvpStatus === "ACCEPTED") {
      out.acceptedGuests++;
      out.confirmedHeads += heads;
      const meals = partyMeals(guest);
      out.meals.veg += meals.veg;
      out.meals.nonVeg += meals.nonVeg;
      out.meals.jain += meals.jain;
      out.meals.unknown += meals.unknown;
    } else if (guest.rsvpStatus === "DECLINED") {
      out.declinedGuests++;
      out.declinedHeads += heads;
    } else {
      out.awaitingGuests++;
      out.awaitingHeads += heads;
    }
  }

  out.varianceVsContract =
    out.contractedHeads == null ? null : out.confirmedHeads - out.contractedHeads;
  return out;
}

/** Where a sheet's `covers` figure came from. */
export const COVERS_SOURCE = {
  CONTRACTED: "CONTRACTED",
  RSVP_CONFIRMED: "RSVP_CONFIRMED",
  MANUAL: "MANUAL",
} as const;
export type CoversSource = (typeof COVERS_SOURCE)[keyof typeof COVERS_SOURCE];

/** How a covers figure should be described wherever it is shown. */
export function coversSourceLabel(source: string | null | undefined): string {
  if (source === COVERS_SOURCE.RSVP_CONFIRMED) return "From confirmed RSVPs";
  if (source === COVERS_SOURCE.MANUAL) return "Set by the team";
  // Null is the pre-existing state of every sheet created before this existed;
  // they were all stamped from the booking's contracted count.
  return "From the contracted guest count";
}
