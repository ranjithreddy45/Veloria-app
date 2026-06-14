// Small display helpers shared by the KRA list + detail views.

export function inrL(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// Format a gate / auto-metric value according to its unit.
export function fmtUnit(value: number | null | undefined, unit: "INR" | "COUNT" | "PCT"): string {
  if (value === null || value === undefined) return "—";
  if (unit === "INR") return inrL(value);
  if (unit === "PCT") return `${Math.round(value * 10) / 10}%`;
  return Number.isInteger(value) ? `${value}` : `${Math.round(value * 10) / 10}`;
}

export function fmtPeriod(period: string): string {
  // period = "YYYY-MM"
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export type Hue =
  | "slate" | "indigo" | "blue" | "emerald" | "amber" | "rose" | "violet" | "cyan" | "teal";

// Grade → hue for the chip.
export function gradeHue(grade: string | null | undefined): Hue {
  switch (grade) {
    case "A+": return "emerald";
    case "A": return "teal";
    case "B": return "blue";
    case "C": return "amber";
    case "D": return "rose";
    default: return "slate";
  }
}

export function statusHue(status: string): Hue {
  switch (status) {
    case "DRAFT": return "slate";
    case "SUBMITTED": return "amber";
    case "ACKNOWLEDGED": return "emerald";
    default: return "slate";
  }
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
};
