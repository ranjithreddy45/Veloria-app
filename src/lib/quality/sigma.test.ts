import { describe, it, expect } from "vitest";
import { computeSigma, dpmoToSigma, controlLimits } from "./sigma";

describe("computeSigma", () => {
  it("0 defects -> sigma 6 and yield 100%", () => {
    const r = computeSigma(0, 1000);
    expect(r.sigma).toBe(6);
    expect(r.yieldPct).toBe(100);
    expect(r.dpmo).toBe(0);
  });

  it("a 50% defect rate maps to ~1.5 sigma", () => {
    const r = computeSigma(50, 100);
    expect(r.dpmo).toBe(500000);
    expect(r.yieldPct).toBe(50);
    expect(r.sigma).toBeGreaterThan(1.3);
    expect(r.sigma).toBeLessThan(1.7);
  });

  it("guards zero/negative units -> perfect defaults", () => {
    expect(computeSigma(5, 0)).toEqual({ dpmo: 0, sigma: 6, yieldPct: 100 });
    expect(computeSigma(5, -10)).toEqual({ dpmo: 0, sigma: 6, yieldPct: 100 });
  });

  it("caps defect rate at 100% (defects >= units)", () => {
    const r = computeSigma(150, 100);
    expect(r.dpmo).toBe(1e6);
    expect(r.yieldPct).toBe(0);
    expect(r.sigma).toBe(0);
  });
});

describe("dpmoToSigma", () => {
  it("dpmo 66800 ~= 3.0 sigma (+/- 0.1)", () => {
    expect(dpmoToSigma(66800)).toBeCloseTo(3.0, 1);
  });

  it("matches standard anchor points", () => {
    expect(dpmoToSigma(690000)).toBeCloseTo(1, 1);
    expect(dpmoToSigma(308000)).toBeCloseTo(2, 1);
    expect(dpmoToSigma(6210)).toBeCloseTo(4, 1);
    expect(dpmoToSigma(233)).toBeCloseTo(5, 1);
    expect(dpmoToSigma(3.4)).toBeCloseTo(6, 1);
  });

  it("clamps edge cases to [0, 6]", () => {
    expect(dpmoToSigma(0)).toBe(6);
    expect(dpmoToSigma(-100)).toBe(6);
    expect(dpmoToSigma(1e6)).toBe(0);
    expect(dpmoToSigma(2e6)).toBe(0);
  });

  it("is monotonic decreasing in dpmo", () => {
    expect(dpmoToSigma(1000)).toBeGreaterThan(dpmoToSigma(10000));
    expect(dpmoToSigma(10000)).toBeGreaterThan(dpmoToSigma(100000));
  });
});

describe("controlLimits", () => {
  it("computes mean and symmetric limits for a basic series", () => {
    const { mean, ucl, lcl } = controlLimits([10, 12, 14, 12, 12]);
    expect(mean).toBeCloseTo(12, 5);
    expect(ucl).toBeGreaterThan(mean);
    expect(lcl).toBeLessThanOrEqual(mean);
    expect(ucl - mean).toBeCloseTo(mean - lcl, 5);
  });

  it("never returns a negative LCL", () => {
    const { lcl } = controlLimits([0, 1, 0, 2, 0, 8]);
    expect(lcl).toBeGreaterThanOrEqual(0);
  });

  it("handles an empty series with safe zeros", () => {
    expect(controlLimits([])).toEqual({ mean: 0, ucl: 0, lcl: 0 });
  });

  it("constant series has zero spread", () => {
    expect(controlLimits([5, 5, 5])).toEqual({ mean: 5, ucl: 5, lcl: 5 });
  });
});
