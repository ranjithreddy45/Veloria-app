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

/** Whole days from today (local) to a date; negative when it has passed. */
export function daysUntil(date: Date | string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const t = new Date(date); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86400000);
}

export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return new Date(d).toLocaleDateString("en-IN", opts);
}

/** Local YYYY-MM-DD (never toISOString — that is UTC and drifts in IST). */
export function toISODateLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Short, customer-facing slot labels for the guest app. */
export const SLOT_SHORT: Record<string, { label: string; time: string }> = {
  MORNING: { label: "Morning", time: "8 am – 12 pm" },
  AFTERNOON: { label: "Afternoon", time: "12 – 5 pm" },
  EVENING: { label: "Evening", time: "5 – 11 pm" },
  FULL_DAY: { label: "Full day", time: "8 am – 11 pm" },
};
