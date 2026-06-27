"use client";

import { Flame, CalendarDays, TrendingUp, AlertTriangle } from "lucide-react";
import type { DateDemandResult } from "@/actions/date-demand.actions";
import { recommendedFloorPreTax } from "@/lib/pricing/date-demand";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * Tells the rep, right in the quote builder, how much to charge for the chosen
 * date: the demand tier, the recommended premium, the price floor, and a loud
 * warning if their current price is below it (or they're discounting a peak
 * date). Advisory — never blocks the quote.
 */
export function DateDemandBanner({
  demand,
  subtotal,
  taxableAmount,
  discountPct,
}: {
  demand: DateDemandResult | null;
  subtotal: number;
  taxableAmount: number; // rep's pre-tax value (subtotal − discount)
  discountPct: number;
}) {
  if (!demand) return null;

  // Regular date — a gentle nudge that they can be flexible.
  if (demand.premiumPct <= 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5 shrink-0" />
        {demand.tier === "WEEKEND" ? "Weekend date" : "Standard date"} — no demand premium. Price competitively to win the booking.
      </div>
    );
  }

  const floor = recommendedFloorPreTax(subtotal, demand.premiumPct);
  const belowFloor = subtotal > 0 && taxableAmount < floor - 1;
  const shortfall = belowFloor ? floor - taxableAmount : 0;
  const discountingPeak = demand.noDiscount && discountPct > 0;
  const hot = demand.tier === "MUHURTHAM";

  return (
    <div
      className={`space-y-2 rounded-xl border p-3 ${
        belowFloor || discountingPeak
          ? "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30"
          : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
      }`}
    >
      <div className="flex items-center gap-2">
        {hot ? <Flame className="size-4 text-rose-600" /> : <TrendingUp className="size-4 text-amber-600" />}
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {demand.label} — charge a +{demand.premiumPct}% premium
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white/60 px-2.5 py-1.5 dark:bg-black/20">
          <p className="text-muted-foreground">Recommended floor</p>
          <p className="font-semibold tabular-nums">{inr(floor)} <span className="font-normal text-muted-foreground">+ taxes</span></p>
        </div>
        <div className="rounded-lg bg-white/60 px-2.5 py-1.5 dark:bg-black/20">
          <p className="text-muted-foreground">Your price (pre-tax)</p>
          <p className={`font-semibold tabular-nums ${belowFloor ? "text-rose-600" : "text-emerald-600"}`}>{inr(taxableAmount)}</p>
        </div>
      </div>

      {belowFloor && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Below the recommended floor for this date — you're leaving about {inr(shortfall)} on the table. Raise the price.
        </p>
      )}
      {discountingPeak && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          You&apos;re applying a {discountPct}% discount on a high-demand date — remove it. Peak dates should not be discounted or early-birded.
        </p>
      )}
      {!belowFloor && !discountingPeak && (
        <p className="text-xs text-muted-foreground">{demand.advice}</p>
      )}
    </div>
  );
}
