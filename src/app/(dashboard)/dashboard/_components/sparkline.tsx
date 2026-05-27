"use client";

import * as React from "react";

interface SparklineProps {
  series: number[];
  height?: number;
  className?: string;
  /** Used as a stable id seed when there are multiple sparklines on the page */
  id: string;
  /** Stroke + fill color — defaults to var(--primary) */
  color?: string;
}

/**
 * Tiny dependency-free sparkline. Draws a smooth area chart from `series` values.
 * Renders a faint indigo gradient under a 1.5px stroke line.
 */
export function Sparkline({ series, height = 36, id, color, className }: SparklineProps) {
  if (!series.length) return null;
  // Pad min/max so a flat series still renders a visible line
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  // Build path coordinates in 0..100 space, then we'll preserveAspectRatio="none"
  const step = w / (series.length - 1 || 1);
  const pts = series.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2; // 2px top/bottom padding
    return [x, y] as const;
  });

  // Smooth Catmull-Rom-ish path via cubic curves
  const d = pts
    .map(([x, y], i) => {
      if (i === 0) return `M ${x} ${y}`;
      const [px, py] = pts[i - 1];
      const cx1 = px + step / 2;
      const cy1 = py;
      const cx2 = x - step / 2;
      const cy2 = y;
      return `C ${cx1} ${cy1} ${cx2} ${cy2} ${x} ${y}`;
    })
    .join(" ");

  const areaD = `${d} L ${w} ${h} L 0 ${h} Z`;
  const stroke = color ?? "var(--primary)";
  const gradId = `spark-grad-${id}`;

  return (
    <svg
      className={className}
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Deterministic pseudo-trend generator for KPIs without backing time series.
 * Uses the current value + change percent to synthesize a believable 12-point
 * shape so the sparkline reads as "trending up/down" correctly.
 *
 * NOTE: This is presentational fallback. For production, back each KPI with a
 * real monthly series query and pass it directly instead of using this helper.
 */
export function synthesizeSeries(current: number, changePercent: number, points = 12): number[] {
  const target = Math.max(0, current);
  // Reverse-engineer "last period" from changePercent
  const last = changePercent === 0 ? target : target / (1 + changePercent / 100);
  // Smoothly interpolate from `last` to `target` with a touch of noise (seeded)
  const out: number[] = [];
  let seed = Math.floor(target + Math.abs(changePercent) * 7) || 1;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    // ease-in-out
    const eased = t * t * (3 - 2 * t);
    const base = last + (target - last) * eased;
    const jitter = (rand() - 0.5) * Math.max(target, last) * 0.08;
    out.push(Math.max(0, base + jitter));
  }
  return out;
}
