"use client";

// ============================================================
// Donut — a compact SVG progress ring with the percentage in the center.
// The arc uses currentColor, so callers set the health-band color via a
// text-* class (e.g. healthTextClass(pct)). The arc length animates on value
// change (300ms ease-out), gated by prefers-reduced-motion at the CSS layer.
// ============================================================

import * as React from "react";
import { cn } from "@/lib/utils";

interface DonutProps {
  value: number; // 0–100
  size?: number; // px
  thickness?: number; // stroke width px
  /** Tailwind text-* class driving the arc color (currentColor). */
  colorClass?: string;
  /** Hide the centered % label (e.g. very small donuts). */
  hideLabel?: boolean;
  label?: string; // override center text
  className?: string;
  ariaLabel?: string;
}

export function Donut({
  value,
  size = 48,
  thickness = 5,
  colorClass = "text-primary",
  hideLabel,
  label,
  className,
  ariaLabel,
}: DonutProps) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel ?? `${pct}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={thickness}
          className="stroke-muted"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={cn("transition-[stroke-dasharray] duration-300 ease-out", colorClass)}
          stroke="currentColor"
        />
      </svg>
      {!hideLabel && (
        <span
          className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
          style={{ fontSize: Math.max(9, size * 0.26) }}
        >
          {label ?? `${pct}%`}
        </span>
      )}
    </div>
  );
}
