"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ============================================================
// Per-Event Financial Control
// ------------------------------------------------------------
// A per-event ops budget-vs-actual so margin is protected:
//   revenue        = Booking.totalAmount
//   foodCost       = KitchenPlan actual (fallback to estimate)
//   procurement    = sum of non-REJECTED PurchaseRequisition totals
//   opsCostTotal   = foodCost + procurement
//   grossMargin    = revenue - opsCostTotal
// All money stays in Prisma.Decimal until the final serialize step;
// Number() is used only for display ratios / rounding.
// ============================================================

const D = (v: Prisma.Decimal.Value = 0) => new Prisma.Decimal(v);

// Variance thresholds (share of revenue). Tunable, conservative defaults.
const FOOD_COST_TARGET_PCT = 35; // food cost should sit at/under 35% of revenue
const OPS_COST_TARGET_PCT = 70; // total ops cost should sit at/under 70% of revenue

export type OpsVarianceLevel = "amber" | "red";

export interface OpsVariance {
  key: string;
  level: OpsVarianceLevel;
  label: string;
  detail: string;
}

export interface EventOpsFinancials {
  bookingId: string;
  hasKitchenPlan: boolean;
  usingActualFoodCost: boolean;
  procurementCount: number;

  // Serialized money (strings) for safe client transport.
  revenue: string;
  foodCostEst: string;
  foodCostActual: string;
  foodCost: string; // the effective food cost used (actual || est)
  procurementCost: string;
  opsCostTotal: string;
  grossMargin: string;

  // Display ratios (numbers, already rounded to 1dp).
  grossMarginPct: number;
  foodCostPct: number;
  opsCostPct: number;

  // Targets surfaced for the UI target lines.
  foodCostTargetPct: number;
  opsCostTargetPct: number;

  variances: OpsVariance[];
}

type OpsFinancialsResult =
  | { success: true; data: EventOpsFinancials }
  | { success: false; error: string };

// round a Decimal ratio (numerator/denominator * 100) to 1dp for display.
function pct(numerator: Prisma.Decimal, denominator: Prisma.Decimal): number {
  if (denominator.lessThanOrEqualTo(0)) return 0;
  return (
    Math.round(numerator.div(denominator).mul(100).toNumber() * 10) / 10
  );
}

export async function getEventOpsFinancials(
  bookingId: string
): Promise<OpsFinancialsResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "operations:read")) {
      return { success: false, error: "Forbidden" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, totalAmount: true },
    });
    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    // Kitchen plan(s) — schema allows several rows per booking; aggregate
    // defensively so a stray extra row never silently hides cost.
    const kitchenPlans = await prisma.kitchenPlan.findMany({
      where: { bookingId },
      select: { estFoodCost: true, actualFoodCost: true },
    });

    // Procurement — non-REJECTED requisitions raised for this event.
    const requisitions = await prisma.purchaseRequisition.findMany({
      where: { bookingId, status: { not: "REJECTED" } },
      select: { totalAmount: true },
    });

    const revenue = D(booking.totalAmount);

    const foodCostEst = kitchenPlans.reduce(
      (acc, k) => acc.add(D(k.estFoodCost)),
      D(0)
    );
    const foodCostActual = kitchenPlans.reduce(
      (acc, k) => acc.add(D(k.actualFoodCost)),
      D(0)
    );

    // Prefer actuals once they have been booked; otherwise fall back to est.
    const usingActualFoodCost = foodCostActual.greaterThan(0);
    const foodCost = usingActualFoodCost ? foodCostActual : foodCostEst;

    const procurementCost = requisitions.reduce(
      (acc, p) => acc.add(D(p.totalAmount)),
      D(0)
    );

    const opsCostTotal = foodCost.add(procurementCost);
    const grossMargin = revenue.sub(opsCostTotal);

    const foodCostPct = pct(foodCost, revenue);
    const opsCostPct = pct(opsCostTotal, revenue);
    const grossMarginPct = pct(grossMargin, revenue);

    // ---- Variance flags (concerns worth a rep's attention) ----
    const variances: OpsVariance[] = [];

    if (revenue.lessThanOrEqualTo(0)) {
      variances.push({
        key: "no-revenue",
        level: "amber",
        label: "No revenue recorded",
        detail:
          "Booking total is zero — margin cannot be computed until the value is set.",
      });
    }

    if (revenue.greaterThan(0) && foodCostPct > FOOD_COST_TARGET_PCT) {
      variances.push({
        key: "food-cost-high",
        level: "red",
        label: "Food cost over target",
        detail: `Food cost is ${foodCostPct}% of revenue (target ${FOOD_COST_TARGET_PCT}%).`,
      });
    }

    if (
      usingActualFoodCost &&
      foodCostEst.greaterThan(0) &&
      foodCostActual.greaterThan(foodCostEst)
    ) {
      const overByPct = pct(foodCostActual.sub(foodCostEst), foodCostEst);
      variances.push({
        key: "food-cost-overrun",
        level: "amber",
        label: "Actual food cost over estimate",
        detail: `Actual is ${overByPct}% above the kitchen estimate.`,
      });
    }

    if (revenue.greaterThan(0) && opsCostPct > OPS_COST_TARGET_PCT) {
      variances.push({
        key: "ops-cost-high",
        level: "red",
        label: "Ops cost eroding margin",
        detail: `Total ops cost is ${opsCostPct}% of revenue (target ${OPS_COST_TARGET_PCT}%).`,
      });
    }

    if (revenue.greaterThan(0) && grossMargin.lessThan(0)) {
      variances.push({
        key: "negative-margin",
        level: "red",
        label: "Event is running at a loss",
        detail: `Ops cost exceeds revenue by ${grossMargin.abs().toFixed(0)}.`,
      });
    }

    return {
      success: true,
      data: {
        bookingId,
        hasKitchenPlan: kitchenPlans.length > 0,
        usingActualFoodCost,
        procurementCount: requisitions.length,

        revenue: revenue.toFixed(2),
        foodCostEst: foodCostEst.toFixed(2),
        foodCostActual: foodCostActual.toFixed(2),
        foodCost: foodCost.toFixed(2),
        procurementCost: procurementCost.toFixed(2),
        opsCostTotal: opsCostTotal.toFixed(2),
        grossMargin: grossMargin.toFixed(2),

        grossMarginPct,
        foodCostPct,
        opsCostPct,

        foodCostTargetPct: FOOD_COST_TARGET_PCT,
        opsCostTargetPct: OPS_COST_TARGET_PCT,

        variances,
      },
    };
  } catch (error) {
    console.error("[GET_EVENT_OPS_FINANCIALS_ERROR]", error);
    return { success: false, error: "Failed to compute event financials" };
  }
}
