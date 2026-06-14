import type { Hue } from "@/components/shared/status-pill";

export const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export function statusHue(status: string): Hue {
  switch (status) {
    case "PLANNED":
      return "slate";
    case "IN_PROGRESS":
      return "amber";
    case "COMPLETED":
      return "emerald";
    default:
      return "neutral";
  }
}

export function fmtEventDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
