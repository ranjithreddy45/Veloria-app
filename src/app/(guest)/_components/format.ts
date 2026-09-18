import { SLOT_NAME, TIME_SLOTS, slotTimeText, toTimeSlot } from "@/lib/sales/slot";

const IST = "Asia/Kolkata";

/** Compact Indian-currency formatter (₹2.40 L, ₹65K) for dense cards. */
export function formatPrice(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Full Indian grouping (₹2,40,000) — used wherever a figure is a commitment. */
export function inr(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

/** "PS" from "Priya Sharma"; falls back to "V" so the avatar is never blank. */
export function initials(name?: string | null): string {
  const parts = (name ?? "").split(/[\s&×]+/).filter(Boolean);
  const s = parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return s || "V";
}

/** YYYY-MM-DD of a moment on the Indian calendar. */
export function toISODateIST(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function istDayIndex(d: Date): number {
  const [y, m, day] = toISODateIST(d).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, day) / 86400000);
}

/** Whole days from today to a date, counted on the Indian calendar; negative when it has passed (NaN for an invalid date). */
export function daysUntil(date: Date | string): number {
  const t = new Date(date);
  if (Number.isNaN(t.getTime())) return Number.NaN;
  return istDayIndex(t) - istDayIndex(new Date());
}

/**
 * A date for customers, on the Indian calendar. @db.Date values arrive as UTC
 * midnight and DateTimes as instants; both render as the Indian day whether the
 * page renders on the server (UTC) or on a phone in any timezone. Pass
 * `timeZone` in opts to override.
 */
export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return new Date(d).toLocaleDateString("en-IN", { timeZone: IST, ...opts });
}

/** Local YYYY-MM-DD (never toISOString — that is UTC and drifts in IST). */
export function toISODateLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Customer-facing slot names and hours for the guest app, read from the team's
 * one slot definition (src/lib/sales/slot.ts), so the customer sees the hours
 * the team's booking pages, e-mails and calendar file show. `time` is null for
 * a slot the team has set no hours for (Morning, Full Day): show the name alone.
 */
export const SLOT_SHORT: Record<string, { label: string; time: string | null }> = Object.fromEntries(
  TIME_SLOTS.map((s) => [s, { label: SLOT_NAME[s], time: slotTimeText(s) }])
);

/** "Evening · 5pm–10pm"; the name alone ("Morning") for a slot without hours; null for a missing or unknown slot. */
export function slotShortText(value: string | null | undefined): string | null {
  const slot = toTimeSlot(value);
  if (!slot) return null;
  const { label, time } = SLOT_SHORT[slot];
  return time ? `${label} · ${time}` : label;
}

export interface HallPriceText {
  /** "₹1.50 L", or null when there is no price to show. */
  amount: string | null;
  /** "from ₹1.50 L" or "Price on request". */
  main: string;
  /** "per slot" / "per slot + ₹350 per guest"; null without a price. */
  sub: string | null;
  /** "+ ₹350 per guest" when the team's rate plan charges per guest. */
  perGuest: string | null;
}

/**
 * Customer wording for a hall's "from" price. Pass what getGuestHallPrices
 * returns — the lowest slot price from the team's hall pricing engine. Never
 * prints ₹0: a hall without a usable price reads "Price on request".
 */
export function hallPriceText(p: { fromSlotPrice: number | null; perGuestRate: number } | null | undefined): HallPriceText {
  if (!p || p.fromSlotPrice == null || !(p.fromSlotPrice > 0)) return { amount: null, main: "Price on request", sub: null, perGuest: null };
  const amount = formatPrice(p.fromSlotPrice);
  const perGuest = p.perGuestRate > 0 ? `+ ${inr(p.perGuestRate)} per guest` : null;
  return { amount, main: `from ${amount}`, sub: perGuest ? `per slot ${perGuest}` : "per slot", perGuest };
}
