"use client";

import { useEffect, useState } from "react";

// ============================================================
// Live countdown for the client event-plan hero. Renders on the client so the
// "in N days" copy stays fresh without a reload. Pure presentation — receives
// only the (already client-safe) event datetime + a friendly noun.
// ============================================================

function diffParts(targetMs: number, nowMs: number) {
  const ms = Math.max(0, targetMs - nowMs);
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { ms, days, hours, minutes };
}

export function EventCountdown({
  eventAtISO,
  occasion,
}: {
  eventAtISO: string;
  occasion: string;
}) {
  const target = new Date(eventAtISO).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { ms, days, hours, minutes } = diffParts(target, now);
  const isPast = ms <= 0;

  if (isPast) {
    return (
      <p className="text-sm font-medium text-white/90">
        Your {occasion} is here — enjoy every moment! ✨
      </p>
    );
  }

  const headline =
    days > 0
      ? `Your ${occasion} is in ${days} ${days === 1 ? "day" : "days"}`
      : hours > 0
        ? `Your ${occasion} is in ${hours} ${hours === 1 ? "hour" : "hours"}`
        : `Your ${occasion} starts in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-medium text-white/90">{headline}</p>
      <div className="flex items-center gap-2">
        <Unit value={days} label="days" />
        <Sep />
        <Unit value={hours} label="hrs" />
        <Sep />
        <Unit value={minutes} label="min" />
      </div>
    </div>
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
