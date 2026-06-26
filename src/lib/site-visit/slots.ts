// ============================================================
// Site-visit slot catalog — PURE helpers (NOT "use server").
// ------------------------------------------------------------
// Single source of truth for the self-serve /visit scheduler. Imported by both
// the public page (slot preview) and the public/internal actions (validation),
// mirroring src/lib/sales/slot.ts. Generalises the BD AcqSiteVisit
// agenda/time concept into a public, identity-free appointment catalog.
//
// A site-visit slot is a plain wall-clock APPOINTMENT (a DateTime), NOT a
// @db.Date venue booking slot — multiple visits per window are allowed (soft
// capacity), so there is no @@unique slot guard here (see spec CONCURRENCY).
// ============================================================

import type { SiteVisitKind } from "@prisma/client";

/** Default appointment length for a visit/tasting. Matches SiteVisitBooking.durationMin default. */
export const SITE_VISIT_DEFAULT_DURATION_MIN = 60;

/** Human labels for the two visit kinds (customer-facing copy). */
export const SITE_VISIT_KIND_LABEL: Record<SiteVisitKind, string> = {
  SITE_VISIT: "Venue tour",
  MENU_TASTING: "Menu tasting",
};

/** Short tagline shown under each kind on the public scheduler. */
export const SITE_VISIT_KIND_TAGLINE: Record<SiteVisitKind, string> = {
  SITE_VISIT: "Walk the spaces, meet the team, picture your day.",
  MENU_TASTING: "Sample signature menus and finalise your spread.",
};

/**
 * Bookable wall-clock windows, expressed as 24h start times (IST wall-clock).
 * Weekends open earlier and run later than weekdays. These are the ONLY times
 * a prospect may self-book; any scheduledAt is validated back against this set.
 */
export const VISIT_SLOTS = {
  // 0 = Sunday … 6 = Saturday
  weekday: ["11:00", "12:00", "16:00", "17:00", "18:00"] as const,
  weekend: ["10:00", "11:00", "12:00", "16:00", "17:00", "18:00", "19:00"] as const,
} as const;

/** The latest a prospect may book on the SAME day (need lead time to prep). */
const MIN_LEAD_TIME_MIN = 90;

/** How far ahead the scheduler allows booking. */
export const VISIT_MAX_DAYS_AHEAD = 60;

export interface VisitSlotOption {
  /** "HH:MM" 24h start time (IST wall-clock). */
  time: string;
  /** Friendly label, e.g. "4:00 PM". */
  label: string;
  /** Full ISO timestamp for this slot on the given date (IST → UTC). */
  iso: string;
  /** false when the slot is in the past / inside the lead-time window. */
  available: boolean;
}

// ------------------------------------------------------------
// IST helpers — the venue operates in Asia/Kolkata. We keep slot math in IST
// wall-clock and convert to a real UTC instant for storage (no TZ drift).
// IST is a fixed +05:30 offset (no DST), so a constant offset is exact.
// ------------------------------------------------------------
const IST_OFFSET_MIN = 5 * 60 + 30;

/** Parse "YYYY-MM-DD" → its UTC components (calendar day, no time). */
function parseDayParts(dateISO: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * Combine a YYYY-MM-DD (interpreted as an IST calendar day) and an "HH:MM" IST
 * wall-clock time into the exact UTC Date instant it represents.
 */
export function istWallClockToUTC(dateISO: string, time: string): Date | null {
  const day = parseDayParts(dateISO);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!day || !tm) return null;
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if (hh > 23 || mm > 59) return null;
  // IST minutes since UTC midnight of that calendar day, minus the IST offset
  // gives the UTC instant.
  const utcMs =
    Date.UTC(day.y, day.m - 1, day.d, 0, 0, 0, 0) +
    (hh * 60 + mm - IST_OFFSET_MIN) * 60 * 1000;
  const out = new Date(utcMs);
  return Number.isNaN(out.getTime()) ? null : out;
}

/** Day-of-week (0=Sun..6=Sat) for an IST calendar day. */
function istDayOfWeek(dateISO: string): number | null {
  const day = parseDayParts(dateISO);
  if (!day) return null;
  // Noon UTC avoids any edge where the +5:30 shift would roll the date.
  return new Date(Date.UTC(day.y, day.m - 1, day.d, 12)).getUTCDay();
}

/** 24h "HH:MM" → "4:00 PM". */
function prettyTime(time: string): string {
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!tm) return time;
  let hh = Number(tm[1]);
  const mm = tm[2];
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${hh}:${mm} ${ampm}`;
}

/** Slot start times available for a given IST calendar day (weekday vs weekend). */
function slotsForDay(dateISO: string): readonly string[] {
  const dow = istDayOfWeek(dateISO);
  if (dow === null) return [];
  return dow === 0 || dow === 6 ? VISIT_SLOTS.weekend : VISIT_SLOTS.weekday;
}

/**
 * Build the bookable slot options for a date (preview + picker). Past slots and
 * slots inside the minimum lead-time window are returned with available:false
 * so the UI can grey them out rather than hiding them silently.
 */
export function buildVisitSlotOptions(dateISO: string): VisitSlotOption[] {
  const now = Date.now();
  const cutoff = now + MIN_LEAD_TIME_MIN * 60 * 1000;
  return slotsForDay(dateISO).map((time) => {
    const at = istWallClockToUTC(dateISO, time);
    const iso = at ? at.toISOString() : "";
    const available = !!at && at.getTime() >= cutoff;
    return { time, label: prettyTime(time), iso, available };
  });
}

/**
 * Validate that a scheduledAt instant lands exactly on one of the bookable
 * wall-clock slots for its IST day, is in the future (with lead time), and is
 * within the booking horizon. The single guard used by every write path.
 */
export function isValidVisitSlot(scheduledAt: Date): boolean {
  if (Number.isNaN(scheduledAt.getTime())) return false;

  const now = Date.now();
  // Future + lead-time.
  if (scheduledAt.getTime() < now + MIN_LEAD_TIME_MIN * 60 * 1000) return false;
  // Horizon.
  if (scheduledAt.getTime() > now + VISIT_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    return false;
  }

  // Re-derive the IST calendar day + wall-clock time of this instant and check
  // it is one of the catalog windows for that day.
  const istMs = scheduledAt.getTime() + IST_OFFSET_MIN * 60 * 1000;
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  const dateISO = `${y}-${m}-${d}`;
  const time = `${hh}:${mm}`;
  return slotsForDay(dateISO).includes(time);
}

/** Friendly IST date label, e.g. "Sat, 14 Feb 2026". */
export function formatVisitDateLabel(scheduledAt: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(scheduledAt);
}

/** Friendly IST time label, e.g. "4:00 PM". */
export function formatVisitTimeLabel(scheduledAt: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(scheduledAt);
}
