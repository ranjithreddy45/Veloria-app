// ============================================================
// Enquiry status vocabulary — shared by the enquiry list (filters + column)
// and the detail page (select + pill). Plain module, not a server action, so
// both client and server components can import the constants.
// ============================================================

import type { Hue } from "@/components/shared/status-pill";

/** Sentinel for "no status stored yet". The DB column is null for these. */
export const NEW_ENQUIRY_VALUE = "NEW";

export interface EnquiryStatusOption {
  value: string;
  label: string;
  hue: Hue;
}

/** Order matches the pipeline: new → engaged → stalled → dead. */
export const ENQUIRY_STATUS_OPTIONS: EnquiryStatusOption[] = [
  { value: NEW_ENQUIRY_VALUE, label: "New", hue: "slate" },
  { value: "LEAD_CREATED", label: "Lead created", hue: "blue" },
  { value: "INTERESTED", label: "Interested", hue: "emerald" },
  { value: "NO_RESPONSE", label: "No response", hue: "amber" },
  { value: "DROPPED", label: "Dropped", hue: "rose" },
];

/** Resolve a stored enquiryStatus (possibly null) to its display option. */
export function enquiryStatusOption(status: string | null | undefined): EnquiryStatusOption {
  if (!status) return ENQUIRY_STATUS_OPTIONS[0];
  return (
    ENQUIRY_STATUS_OPTIONS.find((o) => o.value === status) ?? {
      value: status,
      label: status,
      hue: "neutral",
    }
  );
}
