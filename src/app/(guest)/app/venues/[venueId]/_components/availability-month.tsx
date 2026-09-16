"use client";

import * as React from "react";
import { NavLink } from "../../../../_components/nav-transition";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPublicAvailabilityMonth } from "@/actions/public-hold.actions";
import { getGuestPeakDates } from "@/actions/guest-public.actions";
import { toISODateLocal } from "../../../../_components/format";

// Month grid: booked days grey + struck, auspicious days carry a gold dot,
// picking a free day arms the sticky "Hold this date" bar. Availability and
// peak dates come from the same sources the staff calendar uses. priceLabel is
// the hall's "from" price from the team's pricing engine, or null (no price).
//
// `title` renames the heading only ("Check a date · October 2026"). `onPick`
// hands the chosen day to a parent that owns the sticky bar instead (see
// hall-booking.tsx); without it this component still renders its own, exactly
// as before. Nothing else about the grid changes either way.

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function AvailabilityMonth({ venueId, venueName, priceLabel, title = "Availability", onPick }: {
  venueId: string;
  venueName: string;
  priceLabel: string | null;
  title?: string;
  onPick?: (dateISO: string | null) => void;
}) {
  const today = React.useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [offset, setOffset] = React.useState(0);
  const [busy, setBusy] = React.useState<Record<string, "busy" | "full">>({});
  const [peak, setPeak] = React.useState<Record<string, string>>({});
  const [pick, setPick] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const y = base.getFullYear(), m = base.getMonth() + 1;
  const first = base.getDay();
  const dim = new Date(y, m, 0).getDate();
  const fromISO = `${y}-${String(m).padStart(2, "0")}-01`;
  const toISO = `${y}-${String(m).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([getPublicAvailabilityMonth(y, m, venueId), getGuestPeakDates(fromISO, toISO, venueId)]).then(([avail, peaks]) => {
      if (!alive) return;
      const b: Record<string, "busy" | "full"> = {};
      if (avail.success) {
        const row = avail.data.rows.find((r) => r.venueId === venueId) ?? avail.data.rows[0];
        for (const d of row?.days ?? []) {
          if (d.full) b[d.day] = "full"; else if (d.busy) b[d.day] = "busy";
        }
      }
      setBusy(b);
      setPeak(Object.fromEntries(peaks.map((p) => [String(Number(p.dateISO.slice(8, 10))), p.label])));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [y, m, venueId, fromISO, toISO]);

  // Keep a parent-owned sticky bar in step with the day on screen.
  React.useEffect(() => { onPick?.(pick); }, [pick, onPick]);

  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const pickLabel = pick ? new Date(pick + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : null;
  // Day status is only known for the month on screen.
  const pickDay = pick && pick.startsWith(fromISO.slice(0, 8)) ? Number(pick.slice(8, 10)) : null;
  const pickStatus = pickDay == null ? "" : `${peak[pickDay] ? " · auspicious" : ""} · ${busy[pickDay] === "busy" ? "some slots taken" : "available"}`;
  const bookHref = pick ? `/app/book?venueId=${venueId}&date=${pick}` : `/app/book?venueId=${venueId}`;

  return (
    <>
      <div>
        <div className="flex items-baseline justify-between">
          <div className="text-copy font-semibold">{title} · {base.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous month" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))} className="flex size-[30px] items-center justify-center rounded-full border border-black/[.08] bg-white disabled:opacity-40"><ChevronLeft className="size-4" /></button>
            <button type="button" aria-label="Next month" disabled={offset >= 11} onClick={() => setOffset((o) => Math.min(11, o + 1))} className="flex size-[30px] items-center justify-center rounded-full border border-black/[.08] bg-white disabled:opacity-40"><ChevronRight className="size-4" /></button>
          </div>
        </div>
        <div className={`vg-card mt-2.5 rounded-2xl p-3 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-[.06em] text-[#8a8a8e]">{DOW.map((d, i) => <div key={i}>{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((n, i) => {
              if (n === null) return <div key={`e${i}`} className="h-9" />;
              const d = new Date(y, m - 1, n);
              const iso = toISODateLocal(d);
              const past = d < today;
              const state = busy[n];
              const taken = state === "full";
              const disabled = past || taken;
              const sel = pick === iso;
              const gold = !past && !taken && !!peak[n];
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => setPick(sel ? null : iso)}
                  title={peak[n] || (state === "busy" ? "Some slots taken" : undefined)}
                  className={[
                    "numeric relative h-9 rounded-[10px] text-detail",
                    sel ? "bg-[#6d1b52] font-semibold text-[#fdf5f3]" : taken ? "bg-[#e9e9ec] text-[#a1a1a6] line-through" : past ? "text-[#c7c7cc]" : state === "busy" ? "bg-[#faf3e1] text-[#1d1d1f]" : "text-[#1d1d1f]",
                    gold && !sel ? "font-semibold" : "",
                  ].join(" ")}
                >
                  {n}
                  {gold && <span className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${sel ? "bg-[#e8b631]" : "bg-[#b88513]"}`} />}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-3.5 text-meta text-[#6e6e73]">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#e9e9ec]" />Booked</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#faf3e1]" />Some slots taken</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#b88513]" />Auspicious</span>
          </div>
        </div>
      </div>

      {/* Sticky CTA — bottom:0 because the tab bar is hidden on inner screens.
          Suppressed when a parent owns the bar (onPick), so only one shows. */}
      {!onPick && (
        <div className="vg-glass fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center gap-2.5 px-5 pb-[calc(var(--sab)+12px)] pt-3">
          <div className="min-w-0 flex-1">
            <div className="text-meta text-[#6e6e73]">{pickLabel ? `${pickLabel}${pickStatus}` : "Pick a date above"}</div>
            {priceLabel ? (
              <div className="numeric text-copy font-semibold text-[#6d1b52]">{priceLabel} <span className="text-meta font-medium text-[#8a8a8e]">/ slot</span></div>
            ) : (
              <div className="text-copy font-semibold text-[#6d1b52]">Price on request</div>
            )}
          </div>
          <NavLink href={bookHref} kind="push" className="vg-primary vg-press rounded-[14px] px-5 py-[15px] text-body font-semibold" aria-label={pick ? `Hold ${pickLabel} at ${venueName}` : `Check availability at ${venueName}`}>
            {pick ? "Hold this date" : "Reserve a date"}
          </NavLink>
        </div>
      )}
    </>
  );
}
