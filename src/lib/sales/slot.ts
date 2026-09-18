// ============================================================
// Booking time slots — the ONE definition of what each slot is called and
// when it runs.
// ------------------------------------------------------------
// Team screens, quotations and their PDFs, the customer app, calendar (.ics)
// files, e-mails, signature documents, WhatsApp/SMS confirmations, reminders
// and ops schedules read slot names and hours from here, so no two places can
// disagree.
//
// The hours are the team's own: the quotation planner's "11am to 3pm"
// (Afternoon) and "5pm to 10pm" (Evening). The team has set no hours for
// Morning or Full Day, so SLOT_HOURS is null for those two and nothing may show
// or export hours for them. To give a slot hours, set them here.
//
// Also bridges the quotation/planner time-slot labels ("11am to 3pm",
// "5pm to 10pm", "Full Day", "Lunch", "Dinner") to the booking TimeSlot enum.
// Pure: safe for server and client code.
// ============================================================

export type TimeSlotEnum = "MORNING" | "AFTERNOON" | "EVENING" | "FULL_DAY";

/** Every slot, in the order the team lists them. */
export const TIME_SLOTS: readonly TimeSlotEnum[] = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"];

/** A slot's hours in IST, as minutes after midnight. */
export interface SlotHours {
  startMin: number;
  /** Earlier than startMin when the slot runs past midnight. */
  endMin: number;
}

/** The slot's name, without hours. */
export const SLOT_NAME: Record<TimeSlotEnum, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  FULL_DAY: "Full Day",
};

/** When each slot runs, in IST. null: the team has set no hours for that slot. */
export const SLOT_HOURS: Record<TimeSlotEnum, SlotHours | null> = {
  MORNING: null,
  AFTERNOON: { startMin: 11 * 60, endMin: 15 * 60 },
  EVENING: { startMin: 17 * 60, endMin: 22 * 60 },
  FULL_DAY: null,
};

export function isTimeSlot(value: unknown): value is TimeSlotEnum {
  return typeof value === "string" && (TIME_SLOTS as readonly string[]).includes(value);
}

/** "EVENING" / "evening" → "EVENING"; anything else → null. */
export function toTimeSlot(value: string | null | undefined): TimeSlotEnum | null {
  const key = (value ?? "").trim().toUpperCase();
  return isTimeSlot(key) ? key : null;
}

/** Minutes after midnight → "11am", "5pm", "5:30pm", "12pm". */
export function formatSlotClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "am" : "pm";
  return mm ? `${h12}:${String(mm).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

/** "11am–3pm" for a slot with hours; null when the team has set none. */
export function slotTimeText(slot: TimeSlotEnum): string | null {
  const h = SLOT_HOURS[slot];
  return h ? `${formatSlotClock(h.startMin)}–${formatSlotClock(h.endMin)}` : null;
}

function labelFor(slot: TimeSlotEnum): string {
  const time = slotTimeText(slot);
  return time ? `${SLOT_NAME[slot]} (${time})` : SLOT_NAME[slot];
}

/** "Morning", "Afternoon (11am–3pm)", "Evening (5pm–10pm)", "Full Day". */
export const SLOT_LABEL: Record<TimeSlotEnum, string> = {
  MORNING: labelFor("MORNING"),
  AFTERNOON: labelFor("AFTERNOON"),
  EVENING: labelFor("EVENING"),
  FULL_DAY: labelFor("FULL_DAY"),
};

/** The quotation planner's wording: "11am to 3pm" for a slot with hours, else the planner's own words. */
function plannerFor(slot: TimeSlotEnum): string {
  const h = SLOT_HOURS[slot];
  if (h) return `${formatSlotClock(h.startMin)} to ${formatSlotClock(h.endMin)}`;
  return slot === "MORNING" ? "Before noon" : SLOT_NAME[slot];
}

export const BOOKABLE_SLOTS: { value: TimeSlotEnum; label: string; planner: string }[] = TIME_SLOTS.map((value) => ({
  value,
  label: SLOT_LABEL[value],
  planner: plannerFor(value),
}));

/** The label for a stored slot value ("EVENING" → "Evening (5pm–10pm)"); an unknown value comes back as it is. */
export function slotLabel(value: string | null | undefined): string {
  const slot = toTimeSlot(value);
  return slot ? SLOT_LABEL[slot] : (value ?? "");
}

// Planning anchors for schedules that need a clock time even for a slot the
// team has set no hours for. They are NOT the slot's hours: never show one to
// anyone as when a slot starts.
const PLANNING_ANCHOR_MIN: Partial<Record<TimeSlotEnum, number>> = { MORNING: 9 * 60, FULL_DAY: 10 * 60 };
const LAST_RESORT_ANCHOR_MIN = 10 * 60;

/**
 * Start time (IST minutes after midnight) for schedules that need one for every
 * slot: the function sheet's run of show, event-day task SLAs and pre-event
 * reminders. It is the slot's own start when the team has set its hours;
 * otherwise the planning anchor those schedules already used (Morning 9:00,
 * Full Day 10:00). A missing or unknown slot is treated as Evening.
 */
export function slotScheduleStartMin(value?: string | null): number {
  const slot = toTimeSlot(value) ?? "EVENING";
  return SLOT_HOURS[slot]?.startMin ?? PLANNING_ANCHOR_MIN[slot] ?? LAST_RESORT_ANCHOR_MIN;
}

/**
 * Map a planner/quotation time-slot label to the booking TimeSlot enum.
 * A slot's own value, name, label or planner wording maps directly; older
 * stored labels ("Lunch", "Dinner", "11am to 3pm") by keyword. Falls back to
 * AFTERNOON (the planner's default lunch slot) when the label is empty or
 * unrecognised — the user can always override.
 */
export function plannerSlotToEnum(label?: string | null): TimeSlotEnum {
  if (!label) return "AFTERNOON";
  const l = label.toLowerCase();
  const exact = BOOKABLE_SLOTS.find((s) =>
    [s.value, SLOT_NAME[s.value], s.label, s.planner].some((v) => v.toLowerCase() === l.trim())
  );
  if (exact) return exact.value;
  if (l.includes("full")) return "FULL_DAY";
  if (l.includes("5pm") || l.includes("dinner") || l.includes("evening") || l.includes("night")) return "EVENING";
  if (l.includes("11am") || l.includes("lunch") || l.includes("afternoon") || l.includes("noon")) return "AFTERNOON";
  if (l.includes("morning")) return "MORNING";
  return "AFTERNOON";
}
