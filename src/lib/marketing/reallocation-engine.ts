import { Prisma } from "@prisma/client";

// ============================================================
// Channel ROI Reallocator — PURE prescriptive engine.
// ------------------------------------------------------------
// No IO, no "use server", no prisma. Takes per-channel (optionally
// per-(channel, segment)) buckets — computed identically to
// attribution-analytics.actions.finalize() — and emits rupee-precise
// "shift Rs X from <low-ROAS channel> to <high-ROAS channel> -> +N bookings"
// recommendations.
//
// Money stays Prisma.Decimal end-to-end; only the headline projectedRoasLift
// is rounded to 2dp at the boundary. Divide-by-zero / null-CAC / null-ROAS
// are guarded: a channel with no computable CAC can't be a recipient (no
// booking-delta math), a channel with no computable ROAS can't be ranked as
// a donor. Small-sample channels are filtered by minimum spend / won floors
// so 1–2-lead noise never triggers an "shift everything" recommendation, and
// each donor's outflow is capped at MAX_SHIFT_FRACTION of its spend so we
// never recommend zeroing a working channel.
// ============================================================

const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
const D0 = () => new Prisma.Decimal(0);

// Tunables — conservative defaults so advice stays sane.
export const MAX_SHIFT_FRACTION = 0.4; // never move >40% of a donor's spend
const MIN_DONOR_SPEND = 5000; // ₹ — ignore trivially-funded channels
const MIN_RECIPIENT_WON = 2; // recipient CAC must rest on ≥2 wins
const MIN_ROAS_GAP = 1.25; // recipient ROAS must beat donor's by ≥25%

// ------------------------------------------------------------
// Input bucket — mirrors AttributionBucket's money math but keeps the
// Decimal originals (spend/bookedRevenue) so the engine sums without drift.
// `cac`/`roas`/`avgLtv` are the same nullable Numbers finalize() emits.
// ------------------------------------------------------------
export interface ChannelBucket {
  channel: string; // channel label (e.g. "META", "JUSTDIAL")
  segment: string | null; // Lead.eventType bucket, or null when un-segmented
  spend: Prisma.Decimal; // total spend for the bucket
  bookedRevenue: Prisma.Decimal; // attributed won revenue
  leadCount: number;
  wonCount: number;
  cac: number | null; // spend / wonCount  (null if spend or won is 0)
  roas: number | null; // bookedRevenue / spend (null if spend is 0)
  avgLtv: number | null;
}

export interface ReallocationRec {
  fromChannel: string;
  toChannel: string;
  segment: string | null;
  shiftAmount: Prisma.Decimal; // rupees to move
  expectedBookingDelta: number; // floor(shiftAmount / recipientCac)
  rationale: string;
}

export interface ReallocationPlan {
  recommendations: ReallocationRec[];
  projectedBookingLift: number; // sum of expectedBookingDelta
  projectedRoasLift: Prisma.Decimal; // blended ROAS(after) − ROAS(before), 2dp
  totalSpend: Prisma.Decimal; // total spend across eligible buckets
}

export interface ReallocationOpts {
  maxShiftFraction?: number;
  minDonorSpend?: number;
  minRecipientWon?: number;
  minRoasGap?: number;
}

// Donor: a real, non-trivially-funded channel with a (low) computable ROAS.
function isDonorEligible(b: ChannelBucket, minSpend: number): boolean {
  return (
    b.roas !== null &&
    b.spend.greaterThanOrEqualTo(D(minSpend)) &&
    b.spend.greaterThan(0)
  );
}

// Recipient: a channel with a computable CAC resting on enough wins, so the
// booking-delta math (shift ÷ CAC) is meaningful.
function isRecipientEligible(b: ChannelBucket, minWon: number): boolean {
  return b.cac !== null && b.cac > 0 && b.roas !== null && b.wonCount >= minWon;
}

// Group buckets by segment so we never recommend cross-segment shifts
// (moving wedding spend to a corporate channel would be nonsense).
function bySegment(buckets: ChannelBucket[]): Map<string, ChannelBucket[]> {
  const groups = new Map<string, ChannelBucket[]>();
  for (const b of buckets) {
    const key = b.segment ?? "__all__";
    const arr = groups.get(key);
    if (arr) arr.push(b);
    else groups.set(key, [b]);
  }
  return groups;
}

export function computeReallocationPlan(
  buckets: ChannelBucket[],
  opts?: ReallocationOpts
): ReallocationPlan {
  const maxShiftFraction = opts?.maxShiftFraction ?? MAX_SHIFT_FRACTION;
  const minDonorSpend = opts?.minDonorSpend ?? MIN_DONOR_SPEND;
  const minRecipientWon = opts?.minRecipientWon ?? MIN_RECIPIENT_WON;
  const minRoasGap = opts?.minRoasGap ?? MIN_ROAS_GAP;

  const recommendations: ReallocationRec[] = [];

  // Pre-shift blended figures (whole dataset, in Decimal).
  let totalSpend = D0();
  let totalRevenue = D0();
  for (const b of buckets) {
    totalSpend = totalSpend.add(b.spend);
    totalRevenue = totalRevenue.add(b.bookedRevenue);
  }

  // Track per-channel projected extra revenue from the recipient side so the
  // post-shift ROAS lift is grounded in the same money the recs move.
  let projectedExtraRevenue = D0();

  for (const [, group] of bySegment(buckets)) {
    const donors = group
      .filter((b) => isDonorEligible(b, minDonorSpend))
      .sort((a, b) => (a.roas ?? 0) - (b.roas ?? 0)); // worst ROAS first
    const recipients = group
      .filter((b) => isRecipientEligible(b, minRecipientWon))
      .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0)); // best ROAS first

    if (donors.length === 0 || recipients.length === 0) continue;

    // Track how much we've already pulled from each donor so multiple recs
    // against one donor never exceed its cap.
    const pulled = new Map<string, Prisma.Decimal>();

    for (const recipient of recipients) {
      const recipientRoas = recipient.roas ?? 0;
      const recipientCac = D(recipient.cac ?? 0);
      if (recipientCac.lessThanOrEqualTo(0)) continue;

      for (const donor of donors) {
        if (donor.channel === recipient.channel) continue;
        const donorRoas = donor.roas ?? 0;
        // Only shift toward a materially better channel.
        if (recipientRoas < donorRoas * minRoasGap) continue;

        const cap = donor.spend.mul(D(maxShiftFraction));
        const already = pulled.get(donor.channel) ?? D0();
        const remaining = cap.sub(already);
        if (remaining.lessThanOrEqualTo(0)) continue;

        // Move the donor's available headroom in this rec; round to whole
        // rupees so advice reads cleanly.
        const shiftAmount = remaining.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
        if (shiftAmount.lessThanOrEqualTo(0)) continue;

        const expectedBookingDelta = Math.floor(
          shiftAmount.div(recipientCac).toNumber()
        );
        if (expectedBookingDelta < 1) continue; // not worth recommending

        pulled.set(donor.channel, already.add(shiftAmount));

        const segLabel = recipient.segment ? ` · ${recipient.segment}` : "";
        const rationale =
          `${donor.channel} ROAS ${donorRoas.toFixed(2)}× vs ` +
          `${recipient.channel} ROAS ${recipientRoas.toFixed(2)}×` +
          (recipient.cac !== null
            ? ` (CAC ₹${recipient.cac.toLocaleString("en-IN")})`
            : "") +
          `${segLabel}. Capped at ${Math.round(maxShiftFraction * 100)}% of ` +
          `${donor.channel} spend.`;

        recommendations.push({
          fromChannel: donor.channel,
          toChannel: recipient.channel,
          segment: recipient.segment,
          shiftAmount,
          expectedBookingDelta,
          rationale,
        });

        // Extra revenue the moved rupees should earn at the recipient's ROAS.
        projectedExtraRevenue = projectedExtraRevenue.add(
          shiftAmount.mul(D(recipientRoas))
        );
      }
    }
  }

  const projectedBookingLift = recommendations.reduce(
    (s, r) => s + r.expectedBookingDelta,
    0
  );

  // ROAS lift = blended ROAS with the projected extra revenue, minus the
  // current blended ROAS. Spend total is unchanged (rupees only move).
  let projectedRoasLift = D0();
  if (totalSpend.greaterThan(0)) {
    const before = totalRevenue.div(totalSpend);
    const after = totalRevenue.add(projectedExtraRevenue).div(totalSpend);
    projectedRoasLift = after.sub(before).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  return {
    recommendations,
    projectedBookingLift,
    projectedRoasLift,
    totalSpend,
  };
}
