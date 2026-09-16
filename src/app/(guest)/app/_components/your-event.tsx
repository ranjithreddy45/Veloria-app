import { CalendarHeart, ChevronRight } from "lucide-react";
import { NavLink } from "../../_components/nav-transition";
import { ProgressBar } from "../../_components/ui";
import { daysUntilEvent, formatIstDate, type GuestBooking } from "../event/_components/event-view";
import { countdownFigure, countdownPhrase } from "./home-browse";

// ============================================================
// A host's own event on the browse-first home screen.
//
// The home screen leads with the halls, so a customer who already has a
// booking gets two things: a slim shortcut above the fold (EventStrip — one
// tap to /app/event without scrolling past the spaces) and the full summary
// below the browse block (EventSummary, NextTaskRow), which is the card the
// screen used to open with.
//
// Every figure is the team's own record: the day count is the event screen's
// daysUntilEvent, readiness is the Operations Readiness %, and the task is
// the next unfinished one in the team's execution plan. Nothing is shown
// that the records don't carry — a booking without readiness shows no bar.
// ============================================================

/** One-tap shortcut to the host's event, slim enough not to bury the halls. */
export function EventStrip({ booking, now }: { booking: GuestBooking; now: Date }) {
  const phrase = countdownPhrase(daysUntilEvent(booking.date, now));
  return (
    <NavLink
      href="/app/event"
      kind="push"
      aria-label={`Your event, ${booking.eventName}, ${phrase}`}
      className="vg-press flex min-h-11 items-center gap-2.5 rounded-full border border-[#6d1b52]/15 bg-[#f7eef2] py-2 pl-3 pr-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
    >
      <CalendarHeart className="size-4 shrink-0 text-[#6d1b52]" strokeWidth={2} aria-hidden />
      <span aria-hidden className="min-w-0 flex-1 truncate text-detail font-semibold text-[#1d1d1f]">
        Your event · {booking.eventName}
      </span>
      <span aria-hidden className="shrink-0 text-detail font-semibold text-[#6d1b52]">{phrase}</span>
      <ChevronRight className="size-4 shrink-0 text-[#6d1b52]/55" aria-hidden />
    </NavLink>
  );
}

/** The host's event at a glance: date, hall, the countdown and readiness. */
export function EventSummary({
  booking,
  readiness,
  now,
}: {
  booking: GuestBooking;
  /** Operations Readiness %, or null when the team has no operation yet. */
  readiness: number | null;
  now: Date;
}) {
  const { value, caption } = countdownFigure(daysUntilEvent(booking.date, now));
  return (
    <NavLink
      href="/app/event"
      kind="push"
      className="vg-hero vg-press block rounded-[22px] p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#e8b631]">Your event</div>
      <div className="mt-1.5 font-editorial text-[24px] font-semibold tracking-[-.01em]">{booking.eventName}</div>
      <div className="mt-1 text-detail text-[#fdf5f3]/75">
        {formatIstDate(booking.date)} · {booking.venueName}
      </div>
      <div className="mt-[18px] flex items-end justify-between gap-3">
        <div>
          <div className="numeric text-[42px] font-semibold leading-none tracking-[-.02em]">{value}</div>
          <div className="mt-1 text-meta text-[#fdf5f3]/75">{caption}</div>
        </div>
        {readiness != null && (
          <div className="w-[130px] text-right">
            <div className="text-meta text-[#fdf5f3]/75">Readiness {readiness}%</div>
            <ProgressBar pct={readiness} className="mt-1.5 h-1" track="bg-white/20" fill="bg-[#e8b631]" />
          </div>
        )}
      </div>
    </NavLink>
  );
}

/** The next unfinished task in the team's plan, with the count still open. */
export function NextTaskRow({
  task,
  openTasks,
}: {
  task: { title: string; dueDate: string | null };
  openTasks: number;
}) {
  return (
    <NavLink
      href="/app/event/checklist"
      kind="push"
      className="vg-card vg-press flex items-center gap-3.5 rounded-[18px] px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d1b52]"
    >
      <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-[14px] bg-[#faf3e1]">
        {task.dueDate ? (
          <>
            <span className="text-[10px] font-bold tracking-[.06em] text-[#b88513]">
              {formatIstDate(task.dueDate, { month: "short" }).toUpperCase()}
            </span>
            <span className="numeric text-[19px] font-semibold leading-none">
              {formatIstDate(task.dueDate, { day: "numeric" })}
            </span>
          </>
        ) : (
          <span className="text-[10px] font-bold text-[#b88513]">NEXT</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-meta font-semibold uppercase tracking-[.08em] text-[#b88513]">Next up</span>
        <span className="mt-0.5 block truncate text-body font-semibold">{task.title}</span>
        <span className="block text-meta text-[#6e6e73]">
          {openTasks} task{openTasks === 1 ? "" : "s"} still open
        </span>
      </span>
      <ChevronRight className="size-5 text-[#c7c7cc]" aria-hidden />
    </NavLink>
  );
}
