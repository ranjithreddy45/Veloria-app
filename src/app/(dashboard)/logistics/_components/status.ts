import type { Hue } from "@/components/shared/status-pill";
import type { DispatchStatus } from "@/actions/logistics.actions";

// Single source of truth for how dispatch lifecycle states are shown.
export const STATUS_HUE: Record<DispatchStatus, Hue> = {
  PLANNED: "slate",
  DISPATCHED: "blue",
  DELIVERED: "violet",
  RETURNED: "emerald",
  CANCELLED: "rose",
};

export const STATUS_LABEL: Record<DispatchStatus, string> = {
  PLANNED: "Planned",
  DISPATCHED: "In transit",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

export function statusLabel(s: string): string {
  return (STATUS_LABEL as Record<string, string>)[s] ?? s;
}

export function statusHue(s: string): Hue {
  return (STATUS_HUE as Record<string, Hue>)[s] ?? "slate";
}
