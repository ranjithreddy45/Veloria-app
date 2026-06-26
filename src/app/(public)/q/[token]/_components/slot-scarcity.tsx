"use client";

import { useEffect, useState } from "react";
import { Flame, Check, Lock } from "lucide-react";
// Backend (quote-onetap agent) PUBLIC action — FREE/BUSY per slot, no identities.
import { getPublicSlotScarcity } from "@/actions/quote-onetap.actions";
import type { PublicSlotScarcity } from "./public-quote-types";

// ============================================================
// SlotScarcity — live per-slot availability + urgency banner.
// ------------------------------------------------------------
// Presentational, pure-props seeded with server-rendered scarcity, then
// optionally refreshes getPublicSlotScarcity(token) every ~45s so the chips
// stay fresh while the customer deliberates ("Only Evening left — book now").
// Carries NO booking identities — only FREE/BUSY booleans + a scarcity string.
// ============================================================

export function SlotScarcity({
  token,
  initial,
}: {
  token: string;
  initial: PublicSlotScarcity;
}) {
  const [data, setData] = useState<PublicSlotScarcity>(initial);

  useEffect(() => {
    let active = true;
    const id = setInterval(() => {
      getPublicSlotScarcity(token)
        .then((res) => {
          // The backend action returns Result<PublicSlotScarcity>.
          if (!active) return;
          if (res && res.success) setData(res.data);
        })
        .catch(() => {
          /* best-effort — keep last good chips */
        });
    }, 45_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);

  if (!data || data.chips.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      {data.message && (
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-800 dark:text-amber-300">
          <Flame className="size-4" />
          {data.message}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {data.chips.map((c) => (
          <span
            key={c.slot}
            className={
              c.free
                ? "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-400 line-through dark:border-zinc-800 dark:bg-zinc-800/50"
            }
          >
            {c.free ? <Check className="size-3" /> : <Lock className="size-3" />}
            {c.slotLabel}
          </span>
        ))}
      </div>
    </div>
  );
}
