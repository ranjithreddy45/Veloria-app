// ============================================================
// Customer-facing wording for internal statuses — ONE place, used by every
// customer screen, notification and message, so the customer and the team
// always describe the same record the same way. Never show raw enum values
// to customers. Extend here; do not re-map statuses inside components.
// ============================================================

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  HOLD: "Date on hold",
  TENTATIVE: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "Happening now",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const RSVP_STATUS_LABEL: Record<string, string> = {
  PENDING: "Not replied",
  ACCEPTED: "Attending",
  DECLINED: "Not attending",
};

export const CUSTOMER_REQUEST_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Sent to the team",
  ACCEPTED: "Confirmed by the team",
  DECLINED: "Not possible",
  WITHDRAWN: "Withdrawn",
  TODO: "Sent to the team",
  IN_PROGRESS: "The team is on it",
  IN_REVIEW: "The team is on it",
  DONE: "Done",
};

export function customerLabel(map: Record<string, string>, status: string | null | undefined): string {
  if (!status) return "";
  return map[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}
