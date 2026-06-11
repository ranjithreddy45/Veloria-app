// ============================================================
// BD / Acquisition CRM — config loader.
// Reads AcqConfig rows and merges them over the spec defaults,
// so floors/SLAs are tunable without a redeploy (§5.4).
// ============================================================

import { prisma } from "@/lib/prisma";
import { ACQ_CONFIG_DEFAULTS, type AcqConfigKey } from "./constants";
import { PROJECTION_CONST, type ProjectionConfig } from "./projection-calc";

export type AcqConfig = Record<AcqConfigKey, number>;

export async function getAcqConfig(): Promise<AcqConfig> {
  const rows = await prisma.acqConfig.findMany();
  const merged: AcqConfig = { ...ACQ_CONFIG_DEFAULTS };
  for (const row of rows) {
    if (row.key in merged) {
      const n = Number(row.value);
      if (!Number.isNaN(n)) merged[row.key as AcqConfigKey] = n;
    }
  }
  return merged;
}

// ============================================================
// Projection config — tunable §3 assumptions via AcqConfig rows.
// Keys are PROJ_*; values are strings (numbers, "true"/"false", or a
// comma-separated ramp). Anything missing falls back to PROJECTION_CONST.
// ============================================================
export interface ResolvedProjectionConfig {
  config: ProjectionConfig;
  requireSecondApprover: boolean;
}

export const PROJECTION_CONFIG_DEFAULTS: Record<string, string> = {
  PROJ_EVENTS_RAMP: PROJECTION_CONST.EVENTS_RAMP.join(","),
  PROJ_BASE_FEE_PCT: String(PROJECTION_CONST.BASE_FEE_PCT),
  PROJ_INCENTIVE_PCT: String(PROJECTION_CONST.INCENTIVE_PCT),
  PROJ_OPEX_YOY_GROWTH: String(PROJECTION_CONST.OPEX_YOY_GROWTH),
  PROJ_WITHOUTFOOD_REV_YOY: String(PROJECTION_CONST.WITHOUTFOOD_REV_YOY),
  PROJ_WITHFOOD_PLATE_YOY: String(PROJECTION_CONST.WITHFOOD_PLATE_YOY),
  PROJ_FOOD_COST_PER_PLATE: String(PROJECTION_CONST.FOOD_COST_PER_PLATE),
  PROJ_HALL_CHARGE_DEFAULT: String(PROJECTION_CONST.HALL_CHARGE_DEFAULT),
  PROJ_HOURS_PER_EVENT_DEFAULT: String(PROJECTION_CONST.HOURS_PER_EVENT_DEFAULT),
  PROJ_BEST_CASE_PLATE_UPLIFT: String(PROJECTION_CONST.BEST_CASE_PLATE_UPLIFT_DEFAULT),
  PROJ_REQUIRE_SECOND_APPROVER: "true",
};

export async function getProjectionConfig(): Promise<ResolvedProjectionConfig> {
  const rows = await prisma.acqConfig.findMany({ where: { key: { startsWith: "PROJ_" } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const numOr = (key: string, fallback: number): number => {
    const v = map.get(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const ramp = (() => {
    const v = map.get("PROJ_EVENTS_RAMP");
    if (!v) return PROJECTION_CONST.EVENTS_RAMP;
    const parts = v.split(",").map((s) => Number(s.trim()));
    return parts.length === 5 && parts.every((n) => Number.isFinite(n)) ? parts : PROJECTION_CONST.EVENTS_RAMP;
  })();

  const config: ProjectionConfig = {
    EVENTS_RAMP: ramp,
    BASE_FEE_PCT: numOr("PROJ_BASE_FEE_PCT", PROJECTION_CONST.BASE_FEE_PCT),
    INCENTIVE_PCT: numOr("PROJ_INCENTIVE_PCT", PROJECTION_CONST.INCENTIVE_PCT),
    OPEX_YOY_GROWTH: numOr("PROJ_OPEX_YOY_GROWTH", PROJECTION_CONST.OPEX_YOY_GROWTH),
    WITHOUTFOOD_REV_YOY: numOr("PROJ_WITHOUTFOOD_REV_YOY", PROJECTION_CONST.WITHOUTFOOD_REV_YOY),
    WITHFOOD_PLATE_YOY: numOr("PROJ_WITHFOOD_PLATE_YOY", PROJECTION_CONST.WITHFOOD_PLATE_YOY),
    FOOD_COST_PER_PLATE: numOr("PROJ_FOOD_COST_PER_PLATE", PROJECTION_CONST.FOOD_COST_PER_PLATE),
    HALL_CHARGE_DEFAULT: numOr("PROJ_HALL_CHARGE_DEFAULT", PROJECTION_CONST.HALL_CHARGE_DEFAULT),
    HOURS_PER_EVENT_DEFAULT: numOr("PROJ_HOURS_PER_EVENT_DEFAULT", PROJECTION_CONST.HOURS_PER_EVENT_DEFAULT),
    BEST_CASE_PLATE_UPLIFT_DEFAULT: numOr("PROJ_BEST_CASE_PLATE_UPLIFT", PROJECTION_CONST.BEST_CASE_PLATE_UPLIFT_DEFAULT),
  };
  const requireSecondApprover = (map.get("PROJ_REQUIRE_SECOND_APPROVER") ?? "true") !== "false";
  return { config, requireSecondApprover };
}
