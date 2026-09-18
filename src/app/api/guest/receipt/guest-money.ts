// ============================================================
// Customer money & documents: the rules, pure and unit-tested.
// ------------------------------------------------------------
// ONE SOURCE OF TRUTH. Every figure a customer sees is the team's own field,
// passed through unchanged:
//   Invoice.totalAmount / paidAmount / balanceDue / status
//   Installment.amount / dueDate / status   (kept current by allocatePaidAmountToInstallments)
//   Payment.amount / status / receiptNumber / paidAt
// The only arithmetic is adding those fields up in integer paise. A booking's
// balance due is bookingBalance() (finance's rule, src/lib/finance/issued-invoices.ts):
// the sum of Invoice.balanceDue over the booking's OWED invoices (SENT,
// PARTIALLY_PAID, OVERDUE). A fully refunded invoice is closed, so its restored
// balance isn't due. Invoiced and paid totals count BILLED invoices (not DRAFT,
// not CANCELLED). That is the overview's figure and the booking page's "Pending".
//
// SCOPE. Money and documents are shown per booking (the one the event hub
// shows, or the one picked in the switcher), plus the customer's own invoices
// and contracts not tied to a booking yet. They belong to the booking's own
// customer: a booking the viewer was only INVITED to (getHostScope's
// collaboratorRoles) shows nothing and allows nothing here. Staff preview sees
// only the previewed booking, and each section only with the permission its
// team-side screen checks (the same gates as guest-host.actions.ts).
// ============================================================

import { bookingBalance } from "@/app/(guest)/app/event/_components/event-view";
import { COLLECTIBLE_INVOICE_STATUSES, isCollectibleInvoice, isIssuedInvoice } from "@/lib/finance/issued-invoices";
import {
  INSTALLMENT_STATUS_LABEL,
  INVOICE_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  customerLabel,
} from "@/lib/customer-app/status-labels";

export type MoneyValue = number | string | { toString(): string } | null | undefined;

/** Prisma Decimal / number / string → number, exactly as the team's screens read it (Number()). */
export function money(v: MoneyValue): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

const toPaise = (n: number) => Math.round(n * 100);

/** Add stored money fields to the paisa (e.g. CGST + SGST + IGST as the invoice holds them). */
export function sumMoney(...values: MoneyValue[]): number {
  return values.reduce<number>((acc, v) => acc + toPaise(money(v)), 0) / 100;
}

// ------------------------------------------------------------ scope

export interface ViewerScope {
  preview: boolean;
  contactIds: string[];
  bookings: { id: string }[];
  booking: { id: string } | null;
  /** Bookings the viewer reaches only as an invited collaborator (getHostScope). */
  collaboratorRoles?: Record<string, string>;
}

/** A booking the viewer was invited to rather than booked: its money and documents are the host's. */
export function isInvitedBooking(scope: ViewerScope, bookingId: string | null | undefined): boolean {
  return !!bookingId && !scope.preview && !!scope.collaboratorRoles && Object.hasOwn(scope.collaboratorRoles, bookingId);
}

/** Bookings whose money and documents this viewer may see: their own, or the one a staff member previews. */
export function visibleBookingIds(scope: ViewerScope): string[] {
  if (scope.preview) return scope.booking ? [scope.booking.id] : [];
  return scope.bookings.map((b) => b.id).filter((id) => !isInvitedBooking(scope, id));
}

/**
 * The booking a money or documents screen shows: the requested one when this
 * viewer may see it, else the booking the event hub shows (getHostScope's
 * `booking`: the next upcoming one), else the first visible one.
 */
export function selectedBookingId(scope: ViewerScope, requested?: string | null): string | null {
  const ids = visibleBookingIds(scope);
  if (requested && ids.includes(requested)) return requested;
  if (scope.booking && ids.includes(scope.booking.id)) return scope.booking.id;
  return ids[0] ?? null;
}

export type UnlinkedRecordWhere = { bookingId: null; contactId: { in: string[] } };

/**
 * The customer's own invoices / contracts not tied to a booking yet (e.g. an
 * advance paid before the team attached the booking). Never for staff preview,
 * and never a host's records for an invited collaborator (their contact is not
 * in contactIds).
 */
export function unlinkedRecordWhere(scope: ViewerScope): UnlinkedRecordWhere | null {
  return !scope.preview && scope.contactIds.length > 0 ? { bookingId: null, contactId: { in: scope.contactIds } } : null;
}

export type BookingRecordsWhere = { OR: ({ bookingId: string } | UnlinkedRecordWhere)[] };

/** Prisma `where` for one booking's records plus the unlinked ones. null = nothing is visible. */
export function bookingRecordsWhere(scope: ViewerScope, bookingId: string | null): BookingRecordsWhere | null {
  const or: BookingRecordsWhere["OR"] = [];
  if (bookingId && visibleBookingIds(scope).includes(bookingId)) or.push({ bookingId });
  const unlinked = unlinkedRecordWhere(scope);
  if (unlinked) or.push(unlinked);
  return or.length > 0 ? { OR: or } : null;
}

/** An invoice or contract: always a contact's, optionally a booking's. */
export interface OwnedRecord {
  bookingId: string | null;
  contactId: string;
}

/** May this viewer see this record at all (any visible booking, or their own unlinked record)? */
export function canSeeOwnedRecord(scope: ViewerScope, rec: OwnedRecord): boolean {
  if (rec.bookingId) return visibleBookingIds(scope).includes(rec.bookingId);
  return !scope.preview && scope.contactIds.includes(rec.contactId);
}

// ------------------------------------------------------------ staff preview gates

/**
 * A team member previewing the customer view never sees more than their role
 * opens on the team side. Each gate lists the permissions of the team screen
 * for that data (routePermission: /invoices, /payments, /contracts,
 * /quotations; signature requests: esign:read), the same gates as
 * guest-host.actions.ts. Customers are never gated.
 */
export const PREVIEW_GATES = {
  invoices: ["invoices:read"],
  /** Instalments and receipts sit on the finance screens. */
  payments: ["invoices:read", "payments:read"],
  contracts: ["contracts:read"],
  signatures: ["esign:read"],
  quotations: ["quotes:read"],
} as const satisfies Record<string, readonly string[]>;

export type PreviewGate = keyof typeof PREVIEW_GATES;

export function mayView(scope: { preview: boolean }, gate: PreviewGate, can: (permission: string) => boolean): boolean {
  return !scope.preview || PREVIEW_GATES[gate].every((p) => can(p));
}

export type DocumentKind = "invoice" | "receipt";

export type AccessDecision =
  | { allow: true; viewer: "customer" | "staff" }
  | { allow: false; status: 401 | 403 | 404; message: string };

/**
 * May this viewer download an invoice, or the receipt for one payment?
 * Unknown, draft, not-yet-received and out-of-scope documents all answer 404,
 * so a guessed id reveals nothing.
 */
export function decideDocumentAccess(input: {
  /** null = nobody is signed in. */
  scope: ViewerScope | null;
  kind: DocumentKind;
  record: (OwnedRecord & { invoiceStatus: string; paymentStatus?: string | null }) | null;
  /** The viewer's team permissions (only consulted for staff preview). */
  can: (permission: string) => boolean;
}): AccessDecision {
  if (!input.scope) {
    return { allow: false, status: 401, message: "Please sign in to the Veloria Grand app to download this." };
  }
  const notFound: AccessDecision = { allow: false, status: 404, message: "We couldn't find that document." };
  const r = input.record;
  if (!r || r.invoiceStatus === "DRAFT") return notFound;
  if (input.kind === "receipt" && r.paymentStatus !== "COMPLETED") return notFound;
  if (!canSeeOwnedRecord(input.scope, r)) return notFound;
  if (input.scope.preview) {
    return mayView(input.scope, input.kind === "invoice" ? "invoices" : "payments", input.can)
      ? { allow: true, viewer: "staff" }
      : {
          allow: false,
          status: 403,
          message: "Staff preview: this download needs the same access the team's invoice and payment screens need.",
        };
  }
  return { allow: true, viewer: "customer" };
}

// ------------------------------------------------------------ invoices & instalments

/** Billed to the customer: not an unsent DRAFT and not a void CANCELLED invoice (finance's BILLED rule). */
export { isIssuedInvoice };

/** A DRAFT is still being prepared by the team, so it is never listed (the portal's rule). */
export function isCustomerVisibleInvoice(status: string): boolean {
  return status !== "DRAFT";
}

/** Owed: the statuses money can still be collected in (finance's OWED rule; recordPayment takes money in these). */
export const PAYABLE_INVOICE_STATUSES: readonly string[] = COLLECTIBLE_INVOICE_STATUSES;

export function isPayableInvoice(inv: { status: string; balanceDue: MoneyValue }): boolean {
  return isCollectibleInvoice(inv.status) && money(inv.balanceDue) > 0;
}

export interface MoneySummary {
  /** Σ Invoice.totalAmount over billed invoices (not DRAFT, not CANCELLED) */
  invoiced: number;
  /** Σ Invoice.paidAmount over billed invoices */
  paid: number;
  /** bookingBalance(): Σ Invoice.balanceDue over owed invoices (SENT, PARTIALLY_PAID, OVERDUE) */
  balanceDue: number;
  /** Billed invoices. 0 means nothing is billed yet, so a zero balance is not "settled". */
  invoiceCount: number;
}

export function summarizeInvoices(
  rows: readonly { status: string; totalAmount: MoneyValue; paidAmount: MoneyValue; balanceDue: MoneyValue }[]
): MoneySummary {
  const issued = rows.filter((r) => isIssuedInvoice(r.status));
  const balance = bookingBalance(rows.map((r) => ({ status: r.status, balanceDue: money(r.balanceDue) })));
  return {
    invoiced: sumMoney(...issued.map((r) => r.totalAmount)),
    paid: sumMoney(...issued.map((r) => r.paidAmount)),
    balanceDue: balance.balanceDue,
    invoiceCount: balance.issued,
  };
}

export interface InstallmentSource {
  id: string;
  label: string;
  amount: MoneyValue;
  dueDate: Date;
  status: string;
  paidAt: Date | null;
  order: number;
}

export interface InvoiceSource {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  totalAmount: MoneyValue;
  paidAmount: MoneyValue;
  balanceDue: MoneyValue;
  bookingId: string | null;
  eventName: string | null;
  installments: InstallmentSource[];
}

export interface GuestInstallment {
  id: string;
  label: string;
  /** Installment.amount */
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: string;
  statusLabel: string;
}

export interface GuestInvoice {
  id: string;
  number: string;
  status: string;
  statusLabel: string;
  bookingId: string | null;
  eventName: string | null;
  issueDate: string;
  dueDate: string;
  /** Invoice.totalAmount */
  total: number;
  /** Invoice.paidAmount */
  paid: number;
  /** Invoice.balanceDue */
  balanceDue: number;
  payable: boolean;
  /** What /pay pre-selects (getPublicInvoiceForPayment().nextDue), passed through. */
  nextDue: { label: string; amount: number } | null;
  installments: GuestInstallment[];
}

/** Oldest due first: the order allocatePaidAmountToInstallments and /pay use. */
export function sortInstallments<T extends { dueDate: Date; order: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.order - b.order);
}

export function shapeInvoice(src: InvoiceSource, nextDue: { label: string; amount: number } | null): GuestInvoice {
  const payable = isPayableInvoice(src);
  return {
    id: src.id,
    number: src.invoiceNumber,
    status: src.status,
    statusLabel: customerLabel(INVOICE_STATUS_LABEL, src.status),
    bookingId: src.bookingId,
    eventName: src.eventName,
    issueDate: src.issueDate.toISOString(),
    dueDate: src.dueDate.toISOString(),
    total: money(src.totalAmount),
    paid: money(src.paidAmount),
    balanceDue: money(src.balanceDue),
    payable,
    nextDue: payable ? nextDue : null,
    installments: sortInstallments(src.installments).map((i) => ({
      id: i.id,
      label: i.label,
      amount: money(i.amount),
      dueDate: i.dueDate.toISOString(),
      paidAt: i.paidAt ? i.paidAt.toISOString() : null,
      status: i.status,
      statusLabel: customerLabel(INSTALLMENT_STATUS_LABEL, i.status),
    })),
  };
}

// ------------------------------------------------------------ payments & receipts

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  RAZORPAY: "Online payment",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
};

export function paymentMethodLabel(method: string): string {
  return customerLabel(PAYMENT_METHOD_LABEL, method);
}

export interface PaymentSource {
  id: string;
  amount: MoneyValue;
  status: string;
  method: string;
  receiptNumber: string | null;
  paidAt: Date | null;
  createdAt: Date;
  receiptUploadedAt: Date | null;
  cancelledAt: Date | null;
  invoice: { id: string; invoiceNumber: string };
}

/**
 * Payments the customer should see: money the team recorded (received, later
 * refunded, or cancelled after being recorded) and proofs the customer sent
 * that the team is still verifying. Checkout attempts that never captured
 * (PENDING without a proof, FAILED) are noise and stay hidden.
 */
export function isCustomerVisiblePayment(p: {
  status: string;
  receiptNumber: string | null;
  receiptUploadedAt: Date | null;
  cancelledAt: Date | null;
}): boolean {
  if (p.status === "COMPLETED" || p.status === "REFUNDED") return true;
  if (p.status === "CANCELLED") return !!p.receiptNumber || !!p.cancelledAt;
  if (p.status === "PENDING") return !!p.receiptUploadedAt;
  return false;
}

export interface GuestReceipt {
  id: string;
  receiptNumber: string | null;
  /** Payment.amount */
  amount: number;
  method: string;
  methodLabel: string;
  status: string;
  statusLabel: string;
  date: string;
  invoiceId: string;
  invoiceNumber: string;
  /** Only money actually received has a receipt to download. */
  downloadable: boolean;
}

export function shapeReceipt(p: PaymentSource): GuestReceipt {
  return {
    id: p.id,
    receiptNumber: p.receiptNumber,
    amount: money(p.amount),
    method: p.method,
    methodLabel: paymentMethodLabel(p.method),
    status: p.status,
    statusLabel: customerLabel(PAYMENT_STATUS_LABEL, p.status),
    date: (p.paidAt ?? p.createdAt).toISOString(),
    invoiceId: p.invoice.id,
    invoiceNumber: p.invoice.invoiceNumber,
    downloadable: p.status === "COMPLETED",
  };
}

/** Newest first, by when the money moved. */
export function sortReceipts(rows: readonly GuestReceipt[]): GuestReceipt[] {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date));
}

// ------------------------------------------------------------ agreements & quotations

/**
 * Contract.status and SignatureRequest.status as customers read them.
 * TODO(integration): move into src/lib/customer-app/status-labels.ts
 * (CONTRACT_STATUS_LABEL / SIGNATURE_STATUS_LABEL); it has no map for these yet.
 */
const AGREEMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Being prepared",
  SENT: "Waiting for signature",
  VIEWED: "Waiting for signature",
  SIGNED: "Signed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  DECLINED: "Declined",
  VOIDED: "Withdrawn",
};

export function agreementStatusLabel(status: string): string {
  return customerLabel(AGREEMENT_STATUS_LABEL, status);
}

/** Same rule as the portal's contract list: everything except a DRAFT. */
export function isCustomerVisibleContract(status: string): boolean {
  return status !== "DRAFT";
}

export function isLiveShareLink(link: { status: string; expiresAt: Date | null }, now: Date): boolean {
  return link.status === "ACTIVE" && (!link.expiresAt || link.expiresAt.getTime() >= now.getTime());
}

/** Quotations the team sent the customer: SENT, or CONVERTED (sent, accepted and turned into a booking). */
const SENT_QUOTATION_STATUSES: ReadonlySet<string> = new Set(["SENT", "CONVERTED"]);

/**
 * Where a customer can open a quotation the team actually shared with them:
 * the live /q share page when one exists, else the PDF of a quotation the team
 * sent (SENT or CONVERTED). /api/quotations/<id>/pdf also serves APPROVED, but
 * an approved quotation that was never sent is not listed. Anything else was
 * never shared, or has no page that would open, so it is not listed either.
 */
export function quotationLink(
  q: { id: string; status: string; shareLinkToken: string | null },
  liveShareTokens: ReadonlySet<string>
): string | null {
  if (q.shareLinkToken && liveShareTokens.has(q.shareLinkToken)) return `/q/${encodeURIComponent(q.shareLinkToken)}`;
  if (SENT_QUOTATION_STATUSES.has(q.status)) return `/api/quotations/${encodeURIComponent(q.id)}/pdf`;
  return null;
}

// ------------------------------------------------------------ dates

/** Customer-facing date in IST (@db.Date columns are UTC midnight). */
export function formatIstDate(
  d: Date | string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  return new Date(d).toLocaleDateString("en-IN", { ...opts, timeZone: "Asia/Kolkata" });
}
