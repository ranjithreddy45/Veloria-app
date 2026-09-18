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
//
// Accessibility rules this sheet:
//   * it is a real modal dialog — named, focus moves in on open and back to
//     the pill on close, Tab is trapped, Escape closes, everything behind it
//     is `inert` (so a screen reader cannot wander into the page underneath)
//     and the page behind does not scroll;
//   * every day button SAYS its date and its state ("all booked", "some halls
//     are taken", auspicious) in its accessible name — the tint and the
//     strike-through are never the only carrier, and each state also has a
//     visible outline so colour alone never encodes it;
//   * arrow keys walk the month, Home/End jump to its ends and PageUp/PageDown
//     change month, with one tab stop for the whole grid;
//   * every colour here meets WCAG AA (4.5:1) against what sits behind it.
// ============================================================

const DOW = [
  { short: "S", full: "Sunday" },
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
] as const;
/** Twelve months ahead, like the hall page's calendar. */
const MAX_MONTH_OFFSET = 11;
const GUEST_STEP = 50;
const GUEST_START = 100;

// Secondary ink. #6e6e73 measured 4.46:1 on the sheet's #f3f0ec — a hair under
// AA for the 11-13px type used here, so the whole sheet shares one grey that
// clears 4.5:1 on the sheet, on white and on the grey day chip.
const MUTED = "text-[#636368]";

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
  const wasOpen = React.useRef(false);
  const pill = hallSearchPill(search);
  const filters = hallSearchCount(search);

  const close = React.useCallback(() => setOpen(false), []);

  // Focus goes back to the pill — but only after the sheet has unmounted and
  // undone the `inert` it put on the page. Focusing inside an inert subtree
  // does nothing at all, so doing this inside close() would silently drop
  // focus to the body and lose a keyboard user's place.
  React.useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

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
          <span className={cn("font-semibold", pill.datesSet ? "text-[#1d1d1f]" : MUTED)}>{pill.dates}</span>
          <span aria-hidden className="px-1.5 text-[#c7c7cc]">·</span>
          <span className={cn(pill.guestsSet ? "font-semibold text-[#1d1d1f]" : MUTED)}>{pill.guests}</span>
        </span>
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f7eef2]">
          <SlidersHorizontal className="size-4 text-[#6d1b52]" strokeWidth={2} aria-hidden />
          {filters > 0 && (
            <span aria-hidden className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#6d1b52] text-[9px] font-semibold text-[#fdf5f3]">
              {filters}
            </span>
          )}
        </span>
        <span className="sr-only">
          Change the date, guest count and filters
          {filters > 0 ? `. ${filters} ${filters === 1 ? "filter" : "filters"} applied.` : ""}
        </span>
      </button>

      {open && <SearchSheet search={search} amenityOptions={amenityOptions} basePath={basePath} onClose={close} />}
    </div>
  );
}

// ------------------------------------------------------------ the sheet

/**
 * Everything on the page except the sheet is made `inert` while the sheet is
 * open: no clicks, no tab stops, and — the part a focus trap alone cannot do —
 * nothing for a screen reader's virtual cursor to read underneath. Whatever
 * each element carried is restored exactly on close.
 */
function useInertBackground(host: HTMLElement | null): void {
  React.useEffect(() => {
    if (!host) return;
    const changed: { el: Element; inert: string | null; hidden: string | null }[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === host) continue;
      changed.push({ el, inert: el.getAttribute("inert"), hidden: el.getAttribute("aria-hidden") });
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    }
    return () => {
      for (const { el, inert, hidden } of changed) {
        if (inert === null) el.removeAttribute("inert");
        else el.setAttribute("inert", inert);
        if (hidden === null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", hidden);
      }
    };
  }, [host]);
}

/** Tab stops inside the sheet, in document order. */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => el.getClientRects().length > 0);
}

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
  const [host, setHost] = React.useState<HTMLElement | null>(null);
  const [draft, setDraft] = React.useState<HallSearch>(search);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const noteId = React.useId();
  const guestsLabelId = React.useId();
  const guestsHintId = React.useId();

  // Our own portal host, so the "everything else is inert" pass has something
  // unambiguous to skip.
  React.useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    setHost(el);
    return () => {
      el.remove();
    };
  }, []);

  useInertBackground(host);

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

  // Focus moves into the dialog as soon as it exists, which is what makes a
  // screen reader announce its name; close() puts focus back on the pill.
  React.useEffect(() => {
    if (host) sheetRef.current?.focus();
  }, [host]);

  /** Keep Tab inside the sheet while it is modal. */
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const root = sheetRef.current;
    if (!root) return;
    const items = focusables(root);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = active instanceof Node && root.contains(active);
    if (e.shiftKey && (active === first || active === root || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  };

  const setGuests = (next: number | null) => setDraft((d) => ({ ...d, guests: next && next > 0 ? Math.min(Math.floor(next), MAX_SEARCH_GUESTS) : null }));

  const apply = () => {
    router.push(hallSearchHref(basePath, draft));
    onClose();
  };

  if (!host) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ colorScheme: "light" }}>
      {/* Backdrop: a tap closes the sheet. Keyboard users close it with Escape or the X, so it stays out of the tab order. */}
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-[#1d1d1f]/45" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={noteId}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="vg-rise relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#f3f0ec] text-[#1d1d1f] shadow-[0_-24px_60px_-30px_rgba(29,29,31,.7)] outline-none"
      >
        <div className="flex items-center gap-3 border-b border-black/[.06] px-5 pb-3 pt-3.5">
          <div className="flex-1">
            <h2 id={titleId} className="text-copy font-semibold">
              Find a hall
            </h2>
            <p id={noteId} className={cn("text-meta", MUTED)}>
              Availability is live — dates others hold are struck out.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close, without changing the search"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-black/[.08] bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <MonthPicker value={draft.dateISO} onPick={(iso) => setDraft((d) => ({ ...d, dateISO: iso, slot: iso ? d.slot : null }))} />

          <Section title="Time of day" sub={draft.dateISO ? null : "Pick a date first — a slot only means something against a day."}>
            {({ labelledBy, describedBy }) => (
              <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="vg-scroll-x vg-bleed">
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
            )}
          </Section>

          <Section title="Guests" sub="We only show halls that seat your party." titleId={guestsLabelId}>
            {() => (
              <div role="group" aria-labelledby={guestsLabelId} className="flex items-center justify-between rounded-2xl border border-black/[.06] bg-white px-4 py-3">
                <span className={cn("text-body", MUTED)}>{draft.guests ? "Guests expected" : "Any number"}</span>
                <span className="flex items-center gap-3">
                  <StepButton label="Fewer guests" disabled={!draft.guests} onClick={() => setGuests((draft.guests ?? 0) - GUEST_STEP)}>
                    <Minus className="size-4" aria-hidden />
                  </StepButton>
                  {/* A real <label>, not a placeholder: the visible text beside the
                      field reads "Any number" when it is empty, which is a state,
                      not the name of the field. */}
                  <label htmlFor={guestsHintId + "-input"} className="sr-only">
                    Number of guests
                  </label>
                  <input
                    id={guestsHintId + "-input"}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    enterKeyHint="done"
                    aria-describedby={guestsHintId}
                    value={draft.guests ?? ""}
                    placeholder="Any"
                    onChange={(e) => {
                      // Digits only, and never more than the search itself accepts:
                      // a typo of 999,999 becomes 20,000 rather than a search that
                      // quietly matches nothing.
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setGuests(digits ? Number(digits) : null);
                    }}
                    className="numeric w-[74px] rounded-xl border border-black/[.08] bg-white px-2 py-1.5 text-center text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6d1b52]"
                  />
                  <StepButton label="More guests" disabled={(draft.guests ?? 0) >= MAX_SEARCH_GUESTS} onClick={() => setGuests(draft.guests ? draft.guests + GUEST_STEP : GUEST_START)}>
                    <Plus className="size-4" aria-hidden />
                  </StepButton>
                </span>
                <span id={guestsHintId} className="sr-only">
                  Whole numbers up to {MAX_SEARCH_GUESTS.toLocaleString("en-IN")}. Leave it empty for halls of any size.
                </span>
                {/* The +/- buttons change a value the reader is not focused on, so it is spoken here. */}
                <span aria-live="polite" className="sr-only">
                  {draft.guests ? `${draft.guests.toLocaleString("en-IN")} guests` : "Any number of guests"}
                </span>
              </div>
            )}
          </Section>

          {amenityOptions.length > 0 && (
            <Section title="What the hall has" sub="Straight from what each hall lists.">
              {({ labelledBy, describedBy }) => (
                <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex flex-wrap gap-2">
                  {amenityOptions.map((a) => (
                    <SheetChip key={a} active={draft.amenity === a} onClick={() => setDraft((d) => ({ ...d, amenity: d.amenity === a ? null : a }))}>
                      {a}
                    </SheetChip>
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-black/[.06] bg-white px-5 pb-[calc(var(--sab)+0.875rem)] pt-3.5">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_HALL_SEARCH)}
            className="rounded-lg px-1 py-2 text-detail font-semibold text-[#1d1d1f] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
          >
            Clear all<span className="sr-only"> filters</span>
          </button>
          <button type="button" onClick={apply} className="vg-primary vg-press rounded-[14px] px-6 py-3.5 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]">
            Show halls
          </button>
        </div>
      </div>
    </div>,
    host
  );
}

// ------------------------------------------------------------ sheet parts

/**
 * A titled block. The children get the ids of the title and the helper line so
 * the control group inside can name and describe itself with them — the helper
 * text ("pick a date first") is then heard, not just seen.
 */
function Section({
  title,
  sub,
  titleId,
  children,
}: {
  title: string;
  sub?: string | null;
  titleId?: string;
  children: (ids: { labelledBy: string; describedBy: string | undefined }) => React.ReactNode;
}) {
  const auto = React.useId();
  const headingId = titleId ?? auto;
  const subId = `${auto}-sub`;
  return (
    <section className="mt-5 first:mt-0" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-body font-semibold">
        {title}
      </h3>
      {sub && (
        <p id={subId} className={cn("mb-2 mt-0.5 text-meta", MUTED)}>
          {sub}
        </p>
      )}
      <div className={sub ? "" : "mt-2"}>{children({ labelledBy: headingId, describedBy: sub ? subId : undefined })}</div>
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

type DayState = "some" | "all";

/** What a day button SAYS — the same facts the tint and the strike-through show. */
function dayAccessibleName(day: Date, state: DayState | undefined, past: boolean, peakLabel: string | undefined): string {
  const date = day.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const parts: string[] = [date];
  if (past) parts.push("in the past");
  else if (state === "all") parts.push("all booked");
  else if (state === "some") parts.push("some halls are taken");
  else parts.push("halls available");
  if (peakLabel && !past) parts.push(`auspicious date, ${peakLabel}`);
  return parts.join(", ");
}

function MonthPicker({ value, onPick }: { value: string | null; onPick: (iso: string | null) => void }) {
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [offset, setOffset] = React.useState(() => monthOffsetOf(value, today));
  const [state, setState] = React.useState<Record<number, DayState>>({});
  const [peak, setPeak] = React.useState<Record<number, string>>({});
  const [loading, setLoading] = React.useState(true);
  const dayRefs = React.useRef(new Map<number, HTMLButtonElement | null>());
  const monthHeadingId = React.useId();

  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const y = base.getFullYear();
  const m = base.getMonth() + 1;
  const first = base.getDay();
  const dim = new Date(y, m, 0).getDate();
  const fromISO = `${y}-${String(m).padStart(2, "0")}-01`;
  const toISO = `${y}-${String(m).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
  const monthLabel = base.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    // The same sources the hall page's calendar reads — here across every hall.
    Promise.all([getPublicAvailabilityMonth(y, m), getGuestPeakDates(fromISO, toISO)])
      .then(([avail, peaks]) => {
        if (!alive) return;
        const next: Record<number, DayState> = {};
        if (avail.success && avail.data.rows.length > 0) {
          // Index each hall's month once rather than scanning it per day.
          const byHall = avail.data.rows.map((r) => new Map(r.days.map((d) => [d.day, d])));
          for (let d = 1; d <= avail.data.days; d++) {
            const cells = byHall.map((days) => days.get(d));
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

  const isPast = React.useCallback((n: number) => new Date(y, m - 1, n) < today, [y, m, today]);
  const pickable = React.useCallback((n: number) => n >= 1 && n <= dim && !isPast(n) && state[n] !== "all", [dim, isPast, state]);

  // One tab stop for the whole grid: the day the arrow keys last left off on,
  // corrected to a day that can actually take focus.
  const [focusDay, setFocusDay] = React.useState<number | null>(null);
  const selectedDay = value && value.startsWith(`${y}-${String(m).padStart(2, "0")}-`) ? Number(value.slice(8, 10)) : null;
  const firstPickable = React.useMemo(() => {
    for (let n = 1; n <= dim; n++) if (pickable(n)) return n;
    return null;
  }, [dim, pickable]);
  const tabDay =
    focusDay !== null && pickable(focusDay) ? focusDay : selectedDay !== null && pickable(selectedDay) ? selectedDay : firstPickable;

  // A new month starts its own roving focus.
  React.useEffect(() => setFocusDay(null), [y, m]);

  const focusDayNumber = (n: number) => {
    setFocusDay(n);
    dayRefs.current.get(n)?.focus();
  };

  /** Move to the next day that can take focus in `step`'s direction. */
  const step = (from: number, delta: number) => {
    for (let n = from + delta; n >= 1 && n <= dim; n += delta) {
      if (pickable(n)) {
        focusDayNumber(n);
        return true;
      }
    }
    return false;
  };

  const onGridKeyDown = (e: React.KeyboardEvent, n: number) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    if (e.key in moves) {
      e.preventDefault();
      step(n, moves[e.key]);
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const order = e.key === "Home" ? [...Array(dim).keys()].map((i) => i + 1) : [...Array(dim).keys()].map((i) => dim - i);
      const target = order.find(pickable);
      if (target) focusDayNumber(target);
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      setOffset((o) => Math.max(0, Math.min(MAX_MONTH_OFFSET, o + (e.key === "PageUp" ? -1 : 1))));
    }
  };

  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  return (
    <section aria-labelledby={monthHeadingId}>
      <div className="flex items-center justify-between">
        <h3 id={monthHeadingId} className="text-body font-semibold">
          {monthLabel}
        </h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label={offset === 0 ? "Previous month, not available" : "Previous month"}
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

      {/* Whether the live availability has landed yet, spoken once it settles. */}
      <span aria-live="polite" className="sr-only">
        {loading ? "" : `${monthLabel} availability loaded.`}
      </span>

      <div className={cn("vg-card mt-2.5 rounded-2xl p-3", loading && "opacity-60")} aria-busy={loading}>
        <div className={cn("mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-[.06em]", MUTED)}>
          {DOW.map((d, i) => (
            <div key={`${d.full}-${i}`}>
              <span aria-hidden>{d.short}</span>
              <span className="sr-only">{d.full}</span>
            </div>
          ))}
        </div>
        <div role="group" aria-label={`Days in ${monthLabel}. Use the arrow keys to move between days.`} className="grid grid-cols-7 gap-1">
          {cells.map((n, i) => {
            if (n === null) return <div key={`e${i}`} className="h-9" />;
            const day = new Date(y, m - 1, n);
            const iso = toISODateLocal(day);
            const past = day < today;
            const taken = state[n] === "all";
            const some = state[n] === "some";
            const selected = value === iso;
            const gold = !past && !taken && Boolean(peak[n]);
            const disabled = past || taken;
            return (
              <button
                key={iso}
                ref={(el) => {
                  dayRefs.current.set(n, el);
                }}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={dayAccessibleName(day, state[n], past, peak[n])}
                tabIndex={disabled ? -1 : n === tabDay ? 0 : -1}
                onFocus={() => setFocusDay(n)}
                onKeyDown={(e) => onGridKeyDown(e, n)}
                onClick={() => onPick(selected ? null : iso)}
                className={cn(
                  "numeric relative h-9 rounded-[10px] text-detail focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#6d1b52]",
                  selected
                    ? "bg-[#6d1b52] font-semibold text-[#fdf5f3]"
                    : taken
                      ? // Struck out AND outlined AND named "all booked": three carriers, not one colour.
                        "bg-[#e9e9ec] text-[#636368] line-through ring-1 ring-inset ring-[#8e8e93]"
                      : past
                        ? "text-[#76767c]"
                        : some
                          ? "bg-[#faf3e1] text-[#1d1d1f] ring-1 ring-inset ring-[#a3760f]"
                          : "text-[#1d1d1f]",
                  gold && !selected && "font-semibold"
                )}
              >
                <span aria-hidden>{n}</span>
                {gold && <span aria-hidden className={cn("absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full", selected ? "bg-[#e8b631]" : "bg-[#8a620c]")} />}
              </button>
            );
          })}
        </div>
        <div className={cn("mt-2.5 flex flex-wrap gap-3.5 text-meta", MUTED)}>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-sm bg-[#faf3e1] ring-1 ring-[#a3760f]" />
            Some halls taken
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-sm bg-[#e9e9ec] ring-1 ring-[#8e8e93]" />
            All booked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-[#8a620c]" />
            Auspicious
          </span>
        </div>
      </div>
    </section>
  );
}
