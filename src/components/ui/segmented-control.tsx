"use client";

// ============================================================
// SegmentedControl — a row of mutually-exclusive pills (radiogroup).
// Active option fills with its tone; inactive are ghost/outline. Fully
// keyboard-operable (arrow keys move + select, Home/End jump). Used for the
// readiness/ops-audit status control and the readiness filter toggle.
// ============================================================

import * as React from "react";
import { cn } from "@/lib/utils";

export type SegmentTone = "done" | "pending" | "na" | "neutral" | "danger";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  tone?: SegmentTone;
  icon?: React.ReactNode;
  /** Accessible label if the visible label needs more context. */
  ariaLabel?: string;
}

const ACTIVE_TONE: Record<SegmentTone, string> = {
  done: "bg-emerald-500 text-white shadow-card",
  pending: "bg-amber-500 text-white shadow-card",
  na: "bg-zinc-400 text-white shadow-card dark:bg-zinc-500",
  neutral: "bg-primary text-primary-foreground shadow-card",
  danger: "bg-rose-500 text-white shadow-card",
};

const INACTIVE_TONE: Record<SegmentTone, string> = {
  done: "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40",
  pending: "text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40",
  na: "text-muted-foreground hover:bg-muted",
  neutral: "text-muted-foreground hover:bg-muted",
  danger: "text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40",
};

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  disabled,
  className,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function focusIndex(i: number) {
    const n = options.length;
    const idx = ((i % n) + n) % n;
    refs.current[idx]?.focus();
    onChange(options[idx].value);
  }

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); focusIndex(i + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); focusIndex(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusIndex(0); }
    else if (e.key === "End") { e.preventDefault(); focusIndex(options.length - 1); }
  }

  const pad = size === "sm" ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-xs";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      {options.map((opt, i) => {
        const tone = opt.tone ?? "neutral";
        const active = opt.value === value;
        // For the canonical neutral tone, the selected segment is an Apple
        // white pill with a soft shadow; tinted tones keep their fill.
        const neutralActive = active && tone === "neutral";
        return (
          <button
            key={opt.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel ?? opt.label}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-full font-medium tracking-[-0.01em] transition-premium focus-ring active:scale-[0.97]",
              pad,
              neutralActive
                ? "bg-card text-foreground shadow-card"
                : active
                  ? ACTIVE_TONE[tone]
                  : INACTIVE_TONE[tone],
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
