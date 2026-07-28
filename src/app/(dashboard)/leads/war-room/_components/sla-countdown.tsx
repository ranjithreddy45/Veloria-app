"use client";

// ============================================================
// SlaCountdown — a live, client-side countdown to a target ISO timestamp.
//
// Ticks every second off the server-provided firstContactDue ISO (no server
// round-trips). Formats mm:ss while time remains, and "-mm:ss BREACHED" once
// past due. Exposes the live risk band so the parent row can recolor without a
// server fetch. The authoritative breach decision stays server-side (cron +
// getSlaWarRoomBoard recompute); this is a cosmetic ticker that may drift
// slightly with client clock skew.
// ============================================================

import * as React from "react";
import { cn } from "@/lib/utils";

export type LiveRiskBand = "OK" | "WARN" | "BREACHED";

interface SlaCountdownProps {
  /** Target ISO timestamp (firstContactDue). */
  targetIso: string | null;
  /** Minutes-before-due that flips the band to WARN. */
  warnMinutes: number;
  /** Called whenever the live band changes, so the row can recolor. */
  onBandChange?: (band: LiveRiskBand) => void;
  className?: string;
}

const BAND_TEXT: Record<LiveRiskBand, string> = {
  OK: "text-success",
  WARN: "text-warning",
  BREACHED: "text-destructive",
};

function computeBand(remainingMs: number, warnMs: number): LiveRiskBand {
  if (remainingMs <= 0) return "BREACHED";
  if (remainingMs <= warnMs) return "WARN";
  return "OK";
}

function formatRemaining(remainingMs: number): string {
  const breached = remainingMs <= 0;
  const totalSec = Math.floor(Math.abs(remainingMs) / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const body = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return breached ? `-${body}` : body;
}

export function SlaCountdown({
  targetIso,
  warnMinutes,
  onBandChange,
  className,
}: SlaCountdownProps) {
  const targetMs = React.useMemo(
    () => (targetIso ? new Date(targetIso).getTime() : null),
    [targetIso]
  );
  const warnMs = warnMinutes * 60_000;

  const [remainingMs, setRemainingMs] = React.useState<number>(() =>
    targetMs != null ? targetMs - Date.now() : 0
  );

  React.useEffect(() => {
    if (targetMs == null) return;
    // Sync immediately, then tick every second.
    setRemainingMs(targetMs - Date.now());
    const id = setInterval(() => {
      setRemainingMs(targetMs - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const band = computeBand(remainingMs, warnMs);

  // Notify the parent of band changes (after render to avoid setState-in-render).
  const lastBand = React.useRef<LiveRiskBand | null>(null);
  React.useEffect(() => {
    if (lastBand.current !== band) {
      lastBand.current = band;
      onBandChange?.(band);
    }
  }, [band, onBandChange]);

  if (targetMs == null) {
    return <span className={cn("numeric text-muted-foreground", className)}>—</span>;
  }

  return (
    <span
      className={cn("font-semibold numeric", BAND_TEXT[band], className)}
      title={band === "BREACHED" ? "Past first-contact SLA" : "Time to first-contact SLA"}
    >
      {formatRemaining(remainingMs)}
      {band === "BREACHED" && (
        <span className="ml-1 text-[10px] font-bold uppercase tracking-wide">
          Breached
        </span>
      )}
    </span>
  );
}
