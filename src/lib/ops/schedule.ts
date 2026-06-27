// ============================================================
// Event-day task scheduling — turn SOP phases into real clock times.
// ------------------------------------------------------------
// Execution tasks carry a phase (PRE_EVENT…HANDOVER) and an order, but no
// times — so the live control dashboard's countdowns are blank. This anchors
// every task to an absolute instant relative to the event's actual start
// (booking date + slot, in IST), so the day-of cockpit shows "AV check in
// 25 min" and the reminder cron can nudge owners before their task is due.
// ============================================================

import type { EventPhaseType } from "@prisma/client";

// The venue operates in IST (UTC+5:30). Slot start times are local; convert to
// the absolute UTC instant so stored slaStartBy/slaFinishBy compare correctly
// against `now` regardless of server timezone.
const IST_OFFSET_MIN = 330;
const SLOT_START_LOCAL_MIN: Record<string, number> = {
  MORNING: 9 * 60,
  AFTERNOON: 12 * 60,
  EVENING: 18 * 60,
  FULL_DAY: 10 * 60,
};

/** Absolute UTC instant the event starts, from the @db.Date (UTC midnight) booking date + slot. */
export function eventStartUtc(bookingDate: Date, timeSlot?: string | null): Date {
  const localMin = SLOT_START_LOCAL_MIN[(timeSlot || "EVENING").toUpperCase()] ?? SLOT_START_LOCAL_MIN.EVENING;
  // bookingDate is UTC midnight of the local calendar day; local slot time minus
  // the IST offset gives the true UTC instant.
  return new Date(bookingDate.getTime() + (localMin - IST_OFFSET_MIN) * 60_000);
}

// Each phase's working window, in MINUTES relative to event start (negative =
// before guests arrive). Setup happens in the hours before; the event runs from
// 0; wrap-up + handover after.
const PHASE_WINDOW: Record<EventPhaseType, [number, number]> = {
  PRE_EVENT: [-1440, -360], // day-before prep → 6h before
  SETUP: [-360, -30], // 6h before → 30 min before
  GUEST_ARRIVAL: [-30, 30],
  LIVE_EVENT: [0, 240],
  WRAP_UP: [240, 330],
  HANDOVER: [330, 420],
};

export interface TaskSchedule { slaStartBy: Date; slaFinishBy: Date }

/**
 * Schedule task at index `idx` of `count` tasks in a phase, spread evenly across
 * the phase window. slaFinishBy honours the task's own estimate when shorter
 * than its slice. Returns absolute instants.
 */
export function scheduleTask(
  eventStart: Date,
  phase: EventPhaseType,
  idx: number,
  count: number,
  estimatedMinutes?: number | null
): TaskSchedule {
  const [winStart, winEnd] = PHASE_WINDOW[phase] ?? PHASE_WINDOW.SETUP;
  const span = winEnd - winStart;
  const step = span / Math.max(1, count);
  const startOff = winStart + idx * step;
  const est = estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : step;
  const finishOff = Math.min(winEnd, startOff + Math.min(step, est));
  return {
    slaStartBy: new Date(eventStart.getTime() + startOff * 60_000),
    slaFinishBy: new Date(eventStart.getTime() + finishOff * 60_000),
  };
}
