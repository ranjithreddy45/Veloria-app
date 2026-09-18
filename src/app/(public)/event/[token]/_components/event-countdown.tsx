"use client";

import { useEffect, useState } from "react";
import { dayCountHeadline, daysUntilEventDay, diffParts, timedHeadline } from "./countdown";

// ============================================================
// Live countdown for the client event-plan hero. Renders on the client so the
// copy stays fresh without a reload. Pure presentation: receives only the
// (already client-safe) event day, start instant, whether the slot has hours,
// and a friendly noun. The wording lives in ./countdown.ts.
//
// A slot without hours (Morning, Full Day) counts whole days only: its
// eventAtISO is a planning anchor, never a time to show.
// ============================================================

export function EventCountdown({
  eventAtISO,
  eventDateISO,
  hasHours,
  occasion,
}: {
  eventAtISO: string;
  eventDateISO: string;
  /** The slot has hours set by the team (Afternoon, Evening). */
  hasHours: boolean;
  occasion: string;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!hasHours) {
    const daysAway = daysUntilEventDay(eventDateISO, now);
    const headline = dayCountHeadline(occasion, daysAway);
    if (!headline) return <HereMessage occasion={occasion} />;
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium text-white/90">{headline}</p>
        {daysAway > 1 && (
          <div className="flex items-center gap-2">
            <Unit value={daysAway} label="days" />
          </div>
        )}
      </div>
    );
  }

  const parts = diffParts(new Date(eventAtISO).getTime(), now);
  const headline = timedHeadline(occasion, parts);
  if (!headline) return <HereMessage occasion={occasion} />;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-medium text-white/90">{headline}</p>
      <div className="flex items-center gap-2">
        <Unit value={parts.days} label="days" />
        <Sep />
        <Unit value={parts.hours} label="hrs" />
        <Sep />
        <Unit value={parts.minutes} label="min" />
      </div>
    </div>
  );
}

function HereMessage({ occasion }: { occasion: string }) {
  return (
    <p className="text-sm font-medium text-white/90">
      Your {occasion} is here — enjoy every moment! ✨
    </p>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[3.25rem] flex-col items-center rounded-xl bg-white/15 px-3 py-2 backdrop-blur-sm">
      <span className="text-xl font-bold tabular-nums text-white">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-meta font-medium uppercase tracking-wide text-white/70">
        {label}
      </span>
    </div>
  );
}

function Sep() {
  return <span className="text-lg font-bold text-white/40">:</span>;
}
