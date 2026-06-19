/**
 * Six Sigma quality math — pure, no prisma/react.
 *
 * Conventions:
 * - "units" = opportunities for a defect (1 opportunity per unit).
 * - dpmo = defects per million opportunities = (defects / units) * 1e6.
 * - Sigma level uses the standard long-term DPMO -> sigma mapping that
 *   already bakes in the conventional 1.5-sigma process shift.
 */

/** Clamp a number into [min, max]. */
function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Compute DPMO, sigma level and yield% from a defect/unit count.
 * Guards against zero/negative units.
 */
export function computeSigma(
  defects: number,
  units: number
): { dpmo: number; sigma: number; yieldPct: number } {
  const safeUnits = Number.isFinite(units) && units > 0 ? units : 0;
  const safeDefects =
    Number.isFinite(defects) && defects > 0 ? defects : 0;

  if (safeUnits === 0) {
    // No opportunities measured -> treat as perfect (no defects observed).
    return { dpmo: 0, sigma: 6, yieldPct: 100 };
  }

  const rate = Math.min(safeDefects / safeUnits, 1);
  const dpmo = rate * 1e6;
  const yieldPct = (1 - rate) * 100;
  const sigma = dpmoToSigma(dpmo);

  return { dpmo, sigma, yieldPct };
}

/**
 * Reference DPMO -> sigma anchor points (long-term, with 1.5-sigma shift).
 * Ordered by descending DPMO so we can interpolate in log space.
 */
const SIGMA_TABLE: { dpmo: number; sigma: number }[] = [
  { dpmo: 933200, sigma: 0 },
  { dpmo: 690000, sigma: 1 },
  { dpmo: 308000, sigma: 2 },
  { dpmo: 66800, sigma: 3 },
  { dpmo: 6210, sigma: 4 },
  { dpmo: 233, sigma: 5 },
  { dpmo: 3.4, sigma: 6 },
];

/**
 * Convert DPMO to a sigma level using lookup + log-linear interpolation
 * between the standard anchor points. Clamped to [0, 6].
 *
 * Edge cases:
 *   dpmo <= 0   -> 6 (perfect)
 *   dpmo >= 1e6 -> 0 (every opportunity defective)
 */
export function dpmoToSigma(dpmo: number): number {
  if (!Number.isFinite(dpmo) || dpmo <= 0) return 6;
  if (dpmo >= 1e6) return 0;

  // Above the worst anchor -> floor at 0.
  if (dpmo >= SIGMA_TABLE[0].dpmo) return 0;
  // Below the best anchor -> cap at 6.
  if (dpmo <= SIGMA_TABLE[SIGMA_TABLE.length - 1].dpmo) return 6;

  for (let i = 0; i < SIGMA_TABLE.length - 1; i++) {
    const hi = SIGMA_TABLE[i]; // higher dpmo, lower sigma
    const lo = SIGMA_TABLE[i + 1]; // lower dpmo, higher sigma
    if (dpmo <= hi.dpmo && dpmo >= lo.dpmo) {
      // Interpolate in log(dpmo) space for a smooth, accurate curve.
      const t =
        (Math.log(dpmo) - Math.log(hi.dpmo)) /
        (Math.log(lo.dpmo) - Math.log(hi.dpmo));
      const sigma = hi.sigma + t * (lo.sigma - hi.sigma);
      return clamp(sigma, 0, 6);
    }
  }

  return clamp(0, 0, 6);
}

/**
 * Statistical process control limits: mean +/- 3*stddev (population).
 * LCL is floored at 0 (defect counts/rates can't be negative).
 */
export function controlLimits(
  values: number[]
): { mean: number; ucl: number; lcl: number } {
  const nums = Array.isArray(values)
    ? values.filter((v) => Number.isFinite(v))
    : [];

  if (nums.length === 0) {
    return { mean: 0, ucl: 0, lcl: 0 };
  }

  const mean = nums.reduce((sum, v) => sum + v, 0) / nums.length;
  const variance =
    nums.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / nums.length;
  const stddev = Math.sqrt(variance);

  const ucl = mean + 3 * stddev;
  const lcl = Math.max(0, mean - 3 * stddev);

  return { mean, ucl, lcl };
}
