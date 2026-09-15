// ============================================================
// Customer-facing wording for internal statuses — ONE place, used by every
// customer screen, notification and message, so the customer and the team
// always describe the same record the same way. Never show raw enum values
// to customers. Extend here; do not re-map statuses inside components.
//
// Keys are the exact values stored on the team's records (Prisma enums, or
// the documented string values for String columns). status-labels.test.ts
// checks every enum value in prisma/schema.prisma has a label here.
// ============================================================

/** Booking.status (BookingStatus). */
export const BOOKING_STATUS_LABEL: Record<string, string> = {
  HOLD: "Date on hold",
  TENTATIVE: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "Happening now",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Guest.rsvpStatus (RSVPStatus). */
export const RSVP_STATUS_LABEL: Record<string, string> = {
  PENDING: "Not replied",
  ACCEPTED: "Attending",
  DECLINED: "Not attending",
};

/** A customer's request as the team works it: MenuSelectionRequest.status, or a CLIENT_REQUEST Task's TaskStatus. */
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

/** Invoice.status (InvoiceStatus). Customers normally never see a DRAFT; it is labelled so nothing raw leaks. */
export const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Being prepared",
  SENT: "Awaiting payment",
  PARTIALLY_PAID: "Partly paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

/** Payment.status (PaymentStatus) — one payment the customer made or started. */
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting confirmation",
  PROCESSING: "Processing",
  COMPLETED: "Received",
  FAILED: "Didn't go through",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

/** Installment.status — the same PaymentStatus enum, but on a scheduled instalment PENDING means "still to pay". */
export const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Due",
  PROCESSING: "Processing",
  COMPLETED: "Paid",
  FAILED: "Due",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

/** SiteVisit.status (SiteVisitStatus). */
export const SITE_VISIT_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  COMPLETED: "Visited",
  CANCELLED: "Cancelled",
  NO_SHOW: "Missed",
  RESCHEDULED: "Rescheduled",
};

/**
 * PublicHold.status (PublicHoldStatus). Worded so nothing promises more than
 * the record says: a claimed slot is held, not secured, until the token is paid.
 */
export const PUBLIC_HOLD_STATUS_LABEL: Record<string, string> = {
  INITIATED: "Hold not placed yet",
  SLOT_CLAIMED: "Date held · token payment pending",
  PAID: "Token received",
  CONFIRMED: "With our team",
  EXPIRED: "Hold expired",
  RELEASED: "Hold released",
};

/** BookingCollaborator.status (String: INVITED | ACTIVE | REVOKED). */
export const COLLABORATOR_STATUS_LABEL: Record<string, string> = {
  INVITED: "Invited",
  ACTIVE: "Has access",
  REVOKED: "Access removed",
};

/** BookingCollaborator.role (String: CO_HOST | VIEWER). */
export const COLLABORATOR_ROLE_LABEL: Record<string, string> = {
  CO_HOST: "Co-host",
  VIEWER: "Can view",
};

/** ConciergeThread.status (String: OPEN | CLOSED). */
export const CONCIERGE_THREAD_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
};

/**
 * A run-of-show row: TimelineItem.status (TimelineItemStatus) from the team's
 * day-of timeline, plus PLANNED for rows from a plan that carries no live status
 * (the operations run of show or a published function sheet).
 */
export const TIMELINE_ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Planned",
  IN_PROGRESS: "Now",
  DONE: "Done",
  SKIPPED: "Skipped",
  PLANNED: "Planned",
};

/** ExecutionTask.status (ExecutionTaskStatus) — a task in the team's execution plan. */
export const EXECUTION_TASK_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "On hold",
  COMPLETED: "Done",
  DELAYED: "Running late",
};

/** Task.status (TaskStatus) on the host's own to-dos (CLIENT_TODO), as the team's task board moves them. */
export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

export function customerLabel(map: Record<string, string>, status: string | null | undefined): string {
  if (!status) return "";
  return map[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}
