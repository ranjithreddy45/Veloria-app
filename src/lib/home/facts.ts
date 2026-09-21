// ============================================================
// The facts the home screen is built from.
//
// home.actions loads these from the database; everything in this folder then
// turns them into words, tiles and a ranked feed WITHOUT touching the database
// again, which is what makes the wording and ranking unit-testable.
//
// A block that is `undefined` means "this role may not see that module" (or
// the lens never asks for it). Builders must treat undefined as ABSENT, never
// as zero: a missing block produces no tile and no sentence, so the screen
// cannot imply "0 overdue invoices" to someone who simply is not allowed to
// know.
// ============================================================

export interface SlaRow {
  leadId: string;
  title: string;
  contactName: string;
  assignedToName: string | null;
  dueAt: Date;
}

export interface FollowupRow {
  leadId: string;
  title: string;
  contactName: string;
  assignedToName: string | null;
  followUpAt: Date;
}

export interface TaskRow {
  id: string;
  title: string;
  dueAt: Date;
  related: string | null;
}

export interface QuoteRow {
  linkId: string;
  quotationId: string | null;
  clientName: string | null;
  occasion: string | null;
  grandTotal: number;
  viewCount: number;
  lastViewedAt: Date;
}

export interface QuoteApprovalRow {
  id: string;
  quoteNumber: string;
  clientName: string | null;
  grandTotal: number;
  submittedByName: string | null;
  submittedAt: Date | null;
}

export interface HoldRow {
  bookingId: string;
  eventName: string;
  venueName: string;
  contactName: string;
  holdExpiresAt: Date;
}

export interface VisitRow {
  id: string;
  customerName: string;
  kind: string;
  status: string;
  venueName: string | null;
  scheduledAt: Date;
  unassigned: boolean;
}

export interface EventRow {
  bookingId: string;
  bookingNumber: string;
  eventName: string;
  venueName: string;
  hall: string | null;
  timeSlot: string;
  guestCount: number;
  /** The booking carries a menu, so the kitchen is expected to cook for it. */
  catered: boolean;
}

export interface DayEvents {
  count: number;
  guests: number;
  rows: EventRow[];
}

export interface KitchenPlanFact {
  id: string;
  bookingId: string;
  status: string;
  covers: number;
}

export interface InvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  contactName: string;
  balanceDue: number;
  dueAt: Date;
  /** Booking.date (@db.Date) of the event the invoice belongs to, if any. */
  eventDate: Date | null;
}

export interface CancelRequestRow {
  id: string;
  /** Invoice number, or the receipt number of a payment. */
  reference: string;
  amount: number;
  reason: string | null;
  requestedAt: Date | null;
  /** For a payment: the invoice it sits on (payments have no page of their own). */
  invoiceId?: string;
}

export interface DayValue {
  /** Single-letter weekday for the axis. */
  label: string;
  /** Full weekday, for the text alternative. */
  name: string;
  value: number;
  isToday: boolean;
}

export interface HomeFacts {
  /** Lead / quote / hold figures cover the whole team (true) or only this rep. */
  teamScope: boolean;
  sla?: { breached: number; pending: number; rows: SlaRow[] };
  followups?: { overdue: number; today: number; rows: FollowupRow[] };
  leads?: { open: number; newToday: number; byStatus: { status: string; count: number }[] };
  tasks?: { overdue: number; laterToday: number; rows: TaskRow[] };
  quotes?: { openedToday: number; rows: QuoteRow[] };
  quoteApprovals?: { count: number; rows: QuoteApprovalRow[] };
  holds?: { rows: HoldRow[] };
  visits?: { rows: VisitRow[] };
  events?: { today: DayEvents; tomorrow: DayEvents; thisWeek: number };
  kitchen?: { plans: KitchenPlanFact[] };
  receivables?: {
    overdueAmount: number;
    overdueCount: number;
    outstanding: number;
    rows: InvoiceRow[];
  };
  invoiceCancels?: { count: number; rows: CancelRequestRow[] };
  paymentCancels?: { count: number; rows: CancelRequestRow[] };
  paymentProofs?: { count: number };
  cash?: { thisMonth: number; lastMonth: number; thisWeek: number; week: DayValue[] };
  booked?: { monthValue: number; monthCount: number; weekValue: number; week: DayValue[] };
  notifications?: { unread: number };
}
