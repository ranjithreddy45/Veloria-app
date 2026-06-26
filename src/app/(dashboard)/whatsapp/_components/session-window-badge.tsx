"use client";

import { Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Session Window Badge — 24h Meta customer-service window indicator.
// ------------------------------------------------------------
// Pure presentational. Green "session open — Xh Ym left" when free-text is
// allowed; amber "session closed — template-only" otherwise. Driven by the
// session-window state returned from getConsoleThread.
// ============================================================

export interface SessionWindowBadgeState {
  sessionOpen: boolean;
  sessionExpiresAt: string | null;
  lastInboundAt: string | null;
  minutesRemaining: number;
}

function formatRemaining(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function SessionWindowBadge({
  state,
  className,
}: {
  state: SessionWindowBadgeState | null;
  className?: string;
}) {
  if (!state) return null;

  if (state.sessionOpen) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
          className
        )}
        title="The 24h WhatsApp window is open — free-text replies are allowed."
      >
        <Clock className="size-3" />
        24h session open — {formatRemaining(state.minutesRemaining)} left
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
        className
      )}
      title="The 24h WhatsApp window has closed — only approved templates can be sent."
    >
      <Lock className="size-3" />
      Session closed — template-only
    </span>
  );
}
