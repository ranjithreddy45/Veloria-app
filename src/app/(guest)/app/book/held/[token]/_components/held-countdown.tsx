"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

// ============================================================
// Live countdown to the moment the hold lapses. When it reaches zero the page
// refreshes once, so the server re-reads the team's booking and shows what
// really happened: lapsed, or kept because a payment just landed.
// ============================================================

const pad = (n: number) => String(n).padStart(2, "0");

export function HeldCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const target = React.useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const expired = Number.isFinite(target) && target - now <= 0;
  React.useEffect(() => {
    if (!expired) return;
    const t = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(t);
  }, [expired, router]);

  if (!Number.isFinite(target)) return null;

  if (expired) {
    return (
      <p role="status" className="rounded-2xl bg-[#faf3e1] px-4 py-3 text-center text-detail font-semibold text-[#6e4f0e]">
        The hold time is up. Checking your hold…
      </p>
    );
  }

  const totalSec = Math.floor((target - now) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  return (
    <div role="timer" aria-live="off" className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#faf3e1] px-4 py-3 text-left">
      <span className="text-detail font-semibold text-[#6e4f0e]">Time left on your hold</span>
      <span suppressHydrationWarning className="numeric text-copy font-semibold tabular-nums text-[#b88513]">
        {h > 0 ? `${h}h ` : ""}
        {pad(m)}m {pad(s)}s
      </span>
    </div>
  );
}
