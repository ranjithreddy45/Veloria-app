// ============================================================
// Sales CRM — slot helpers.
// Bridges the quotation/planner time-slot labels ("11am to 3pm",
// "5pm to 10pm", "Full Day") to the booking TimeSlot enum
// (MORNING / AFTERNOON / EVENING / FULL_DAY), and provides the
// canonical slot list + display labels used across the UI.
// ============================================================

export type TimeSlotEnum = "MORNING" | "AFTERNOON" | "EVENING" | "FULL_DAY";

export const BOOKABLE_SLOTS: { value: TimeSlotEnum; label: string; planner: string }[] = [
  { value: "MORNING", label: "Morning", planner: "Before noon" },
  { value: "AFTERNOON", label: "Afternoon (11am–3pm)", planner: "11am to 3pm" },
  { value: "EVENING", label: "Evening (5pm–10pm)", planner: "5pm to 10pm" },
  { value: "FULL_DAY", label: "Full Day", planner: "Full Day" },
];

export const SLOT_LABEL: Record<TimeSlotEnum, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon (11am–3pm)",
  EVENING: "Evening (5pm–10pm)",
  FULL_DAY: "Full Day",
};

/**
 * Map a planner/quotation time-slot label to the booking TimeSlot enum.
 * Falls back to AFTERNOON (the planner's default lunch slot) when the
 * label is empty or unrecognised — the user can always override.
 */
export function plannerSlotToEnum(label?: string | null): TimeSlotEnum {
  if (!label) return "AFTERNOON";
  const l = label.toLowerCase();
  if (l.includes("full")) return "FULL_DAY";
  if (l.includes("5pm") || l.includes("dinner") || l.includes("evening") || l.includes("night")) return "EVENING";
  if (l.includes("11am") || l.includes("lunch") || l.includes("afternoon") || l.includes("noon")) return "AFTERNOON";
  if (l.includes("morning")) return "MORNING";
  return "AFTERNOON";
}
