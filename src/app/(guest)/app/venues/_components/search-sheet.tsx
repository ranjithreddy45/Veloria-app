"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Minus, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLOT_NAME, TIME_SLOTS } from "@/lib/sales/slot";
import { getPublicAvailabilityMonth } from "@/actions/public-hold.actions";
import { getGuestPeakDates } from "@/actions/guest-public.actions";
import { toISODateLocal } from "../../../_components/format";
import {
  EMPTY_HALL_SEARCH,
  MAX_SEARCH_GUESTS,
  hallSearchCount,
  hallSearchHref,
  hallSearchPill,
  type HallSearch,
} from "../_lib/hall-search";

// ============================================================
// The search pill and its sheet.
//
// The pill sits under the status bar and always says what is actually being
// searched. Tapping it opens a sheet with a month calendar, a slot row, a
// guest stepper and the amenity chips; "Show halls" writes the search into the
// URL, so the screen someone shares is the screen they saw and the back button
// undoes one search at a time.
//
// The calendar reads the SAME public availability the hall page and the hold
// flow read (getPublicAvailabilityMonth) — across every hall here — so a day
// struck out on this screen is genuinely a day with nothing left anywhere.
// ============================================================

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
/** Twelve months ahead, like the hall page's calendar. */
const MAX_MONTH_OFFSET = 11;
const GUEST_STEP = 50;
const GUEST_START = 100;

export function HallSearchPill({
  search,
  amenityOptions,
  basePath = "/app/venues",
  className,
}: {
  search: HallSearch;
  amenityOptions: readonly string[];
  basePath?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const pill = hallSearchPill(search);
  const filters = hallSearchCount(search);

  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    // The app's frosted material, but bordered along the BOTTOM — this is a header, not a tab bar.
    <div
      className={cn(
        "sticky top-0 z-30 border-b border-black/[.06] bg-[#f3f0ec]/[.86] px-5 pb-3 pt-[calc(var(--sat)+0.625rem)] backdrop-blur-[20px] backdrop-saturate-150",
        className
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="vg-press flex w-full items-center gap-3 rounded-full border border-black/[.07] bg-white px-4 py-2.5 text-left shadow-[0_2px_10px_-4px_rgba(29,29,31,.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
      >
        <Search className="size-[18px] shrink-0 text-[#6d1b52]" strokeWidth={2.1} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-body">
          <span className={cn("font-semibold", pill.datesSet ? "text-[#1d1d1f]" : "text-[#6e6e73]")}>{pill.dates}</span>
          <span aria-hidden className="px-1.5 text-[#c7c7cc]">·</span>
          <span className={cn(pill.guestsSet ? "font-semibold text-[#1d1d1f]" : "text-[#6e6e73]")}>{pill.guests}</span>
        </span>
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f7eef2]">
          <SlidersHorizontal className="size-4 text-[#6d1b52]" strokeWidth={2} aria-hidden />
          {filters > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#6d1b52] text-[9px] font-semibold text-[#fdf5f3]">
              {filters}
            </span>
          )}
        </span>
        <span className="sr-only">Change the date, guest count and filters</span>
      </button>

      {open && <SearchSheet search={search} amenityOptions={amenityOptions} basePath={basePath} onClose={close} />}
    </div>
  );
}

// ------------------------------------------------------------ the sheet

function SearchSheet({
  search,
  amenityOptions,
  basePath,
  onClose,
}: {
  search: HallSearch;
  amenityOptions: readonly string[];
  basePath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [draft, setDraft] = React.useState<HallSearch>(search);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  React.useEffect(() => {
    if (mounted) sheetRef.current?.focus();
  }, [mounted]);

  /** Keep Tab inside the sheet while it is modal. */
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const root = sheetRef.current;
    if (!root) return;
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')
    ).filter((el) => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const setGuests = (next: number | null) => setDraft((d) => ({ ...d, guests: next && next > 0 ? Math.min(next, MAX_SEARCH_GUESTS) : null }));

  const apply = () => {
    router.push(hallSearchHref(basePath, draft));
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ colorScheme: "light" }}>
      {/* Backdrop: a tap closes the sheet. Keyboard users close it with Escape or the X, so it stays out of the tab order. */}
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-[#1d1d1f]/45" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Find a hall"
        tabIndex={-1}
        onKeyDown={trapTab}
        className="vg-rise relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#f3f0ec] text-[#1d1d1f] shadow-[0_-24px_60px_-30px_rgba(29,29,31,.7)] outline-none"
      >
        <div className="flex items-center gap-3 border-b border-black/[.06] px-5 pb-3 pt-3.5">
          <div className="flex-1">
            <div className="text-copy font-semibold">Find a hall</div>
            <div className="text-meta text-[#6e6e73]">Availability is live — dates others hold are struck out.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-black/[.08] bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <MonthPicker value={draft.dateISO} onPick={(iso) => setDraft((d) => ({ ...d, dateISO: iso, slot: iso ? d.slot : null }))} />

          <Section title="Time of day" sub={draft.dateISO ? null : "Pick a date first — a slot only means something against a day."}>
            <div className="vg-scroll-x vg-bleed">
              <SheetChip active={!draft.slot} disabled={!draft.dateISO} onClick={() => setDraft((d) => ({ ...d, slot: null }))}>
                Any time
              </SheetChip>
              {TIME_SLOTS.map((s) => (
                <SheetChip
                  key={s}
                  active={draft.slot === s}
                  disabled={!draft.dateISO}
                  onClick={() => setDraft((d) => ({ ...d, slot: d.slot === s ? null : s }))}
                >
                  {SLOT_NAME[s]}
                </SheetChip>
              ))}
            </div>
          </Section>

          <Section title="Guests" sub="We only show halls that seat your party.">
            <div className="flex items-center justify-between rounded-2xl border border-black/[.06] bg-white px-4 py-3">
              <span className="text-body text-[#6e6e73]">{draft.guests ? "Guests expected" : "Any number"}</span>
              <span className="flex items-center gap-3">
                <StepButton label="Fewer guests" disabled={!draft.guests} onClick={() => setGuests((draft.guests ?? 0) - GUEST_STEP)}>
                  <Minus className="size-4" aria-hidden />
                </StepButton>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Number of guests"
                  value={draft.guests ?? ""}
                  placeholder="Any"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setGuests(digits ? Number(digits) : null);
                  }}
                  className="numeric w-[74px] rounded-xl border border-black/[.08] bg-white px-2 py-1.5 text-center text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6d1b52]"
                />
                <StepButton label="More guests" disabled={(draft.guests ?? 0) >= MAX_SEARCH_GUESTS} onClick={() => setGuests(draft.guests ? draft.guests + GUEST_STEP : GUEST_START)}>
                  <Plus className="size-4" aria-hidden />
                </StepButton>
              </span>
            </div>
          </Section>

          {amenityOptions.length > 0 && (
            <Section title="What the hall has" sub="Straight from what each hall lists.">
              <div className="flex flex-wrap gap-2">
                {amenityOptions.map((a) => (
                  <SheetChip key={a} active={draft.amenity === a} onClick={() => setDraft((d) => ({ ...d, amenity: d.amenity === a ? null : a }))}>
                    {a}
                  </SheetChip>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-black/[.06] bg-white px-5 pb-[calc(var(--sab)+0.875rem)] pt-3.5">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_HALL_SEARCH)}
            className="rounded-lg px-1 py-2 text-detail font-semibold text-[#1d1d1f] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
          >
            Clear all
          </button>
          <button type="button" onClick={apply} className="vg-primary vg-press rounded-[14px] px-6 py-3.5 text-body font-semibold">
            Show halls
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------ sheet parts

function Section({ title, sub, children }: { title: string; sub?: string | null; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="text-body font-semibold">{title}</h3>
      {sub && <p className="mb-2 mt-0.5 text-meta text-[#6e6e73]">{sub}</p>}
      <div className={sub ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

function SheetChip({ children, active, disabled, onClick }: { children: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 py-2 text-detail font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]",
        active ? "border-[#6d1b52] bg-[#6d1b52] text-[#fdf5f3]" : "border-black/[.08] bg-white text-[#1d1d1f]",
        disabled && "opacity-40"
      )}
    >
      {children}
    </button>
  );
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full border border-black/[.12] bg-white text-[#1d1d1f] disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------ the month calendar

/** Whole months from today's month to the picked date's month, inside the window. */
function monthOffsetOf(dateISO: string | null, today: Date): number {
  if (!dateISO) return 0;
  const [y, m] = dateISO.split("-").map(Number);
  const diff = (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth());
  return Math.max(0, Math.min(MAX_MONTH_OFFSET, diff));
}

function MonthPicker({ value, onPick }: { value: string | null; onPick: (iso: string | null) => void }) {
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [offset, setOffset] = React.useState(() => monthOffsetOf(value, today));
  const [state, setState] = React.useState<Record<number, "some" | "all">>({});
  const [peak, setPeak] = React.useState<Record<number, string>>({});
  const [loading, setLoading] = React.useState(true);

  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const y = base.getFullYear();
  const m = base.getMonth() + 1;
  const first = base.getDay();
  const dim = new Date(y, m, 0).getDate();
  const fromISO = `${y}-${String(m).padStart(2, "0")}-01`;
  const toISO = `${y}-${String(m).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    // The same sources the hall page's calendar reads — here across every hall.
    Promise.all([getPublicAvailabilityMonth(y, m), getGuestPeakDates(fromISO, toISO)])
      .then(([avail, peaks]) => {
        if (!alive) return;
        const next: Record<number, "some" | "all"> = {};
        if (avail.success && avail.data.rows.length > 0) {
          for (let d = 1; d <= avail.data.days; d++) {
            const cells = avail.data.rows.map((r) => r.days.find((x) => x.day === d));
            // "all" only when no hall has a slot left — that is the only honest strike-out.
            if (cells.every((c) => c?.full)) next[d] = "all";
            else if (cells.some((c) => c?.busy)) next[d] = "some";
          }
        }
        setState(next);
        setPeak(Object.fromEntries(peaks.map((p) => [Number(p.dateISO.slice(8, 10)), p.label])));
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        // Availability could not be read: offer every future day rather than strike days out wrongly.
        setState({});
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [y, m, fromISO, toISO]);

  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-body font-semibold">{base.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Previous month"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            className="flex size-8 items-center justify-center rounded-full border border-black/[.08] bg-white disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={offset >= MAX_MONTH_OFFSET}
            onClick={() => setOffset((o) => Math.min(MAX_MONTH_OFFSET, o + 1))}
            className="flex size-8 items-center justify-center rounded-full border border-black/[.08] bg-white disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className={cn("vg-card mt-2.5 rounded-2xl p-3", loading && "opacity-60")} aria-busy={loading}>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-[.06em] text-[#8a8a8e]">
          {DOW.map((d, i) => (
            <div key={`${d}-${i}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((n, i) => {
            if (n === null) return <div key={`e${i}`} className="h-9" />;
            const day = new Date(y, m - 1, n);
            const iso = toISODateLocal(day);
            const past = day < today;
            const taken = state[n] === "all";
            const some = state[n] === "some";
            const selected = value === iso;
            const gold = !past && !taken && Boolean(peak[n]);
            return (
              <button
                key={iso}
                type="button"
                disabled={past || taken}
                aria-pressed={selected}
                title={peak[n] || (taken ? "Every hall is booked" : some ? "Some halls are taken" : undefined)}
                onClick={() => onPick(selected ? null : iso)}
                className={cn(
                  "numeric relative h-9 rounded-[10px] text-detail focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6d1b52]",
                  selected
                    ? "bg-[#6d1b52] font-semibold text-[#fdf5f3]"
                    : taken
                      ? "bg-[#e9e9ec] text-[#a1a1a6] line-through"
                      : past
                        ? "text-[#c7c7cc]"
                        : some
                          ? "bg-[#faf3e1] text-[#1d1d1f]"
                          : "text-[#1d1d1f]",
                  gold && !selected && "font-semibold"
                )}
              >
                {n}
                {gold && <span aria-hidden className={cn("absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full", selected ? "bg-[#e8b631]" : "bg-[#b88513]")} />}
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-3.5 text-meta text-[#6e6e73]">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-sm bg-[#faf3e1]" />
            Some halls taken
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-sm bg-[#e9e9ec]" />
            All booked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-[#b88513]" />
            Auspicious
          </span>
        </div>
      </div>
    </section>
  );
}
