"use client";

import * as React from "react";

// ============================================================
// CountUp — animates a number from 0 (or a previous value) to the target on
// mount and whenever the value changes. Used to make KPIs/StatTiles feel alive.
// Honours prefers-reduced-motion (renders the final value instantly).
// Formatting is delegated to `format` so currency/compact values still work.
// ============================================================

type CountUpProps = {
  value: number;
  /** Animation duration in ms. Default 900. */
  durationMs?: number;
  /** Format the (rounded) intermediate + final number for display. */
  format?: (n: number) => string;
  className?: string;
  /** Decimal places to animate/display when no custom format is given. */
  decimals?: number;
};

export function CountUp({
  value,
  durationMs = 900,
  format,
  className,
  decimals = 0,
}: CountUpProps) {
  const [display, setDisplay] = React.useState(value);
  const fromRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutExpo — fast then settle, feels premium
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value; // next change animates from here
    };
  }, [value, durationMs]);

  const factor = Math.pow(10, decimals);
  const rounded = Math.round(display * factor) / factor;
  const text = format
    ? format(rounded)
    : rounded.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
