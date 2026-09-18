"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHostScope, isStaffUser, staffCan, type HostBooking, type HostScope } from "@/lib/guest/host-scope";
import { getPublicInvoiceForPayment } from "@/actions/payment.actions";
import {
  agreementStatusLabel,
  bookingRecordsWhere,
  isCustomerVisibleContract,
  isCustomerVisibleInvoice,
  isCustomerVisiblePayment,
  isInvitedBooking,
  isIssuedInvoice,
  isLiveShareLink,
  isPayableInvoice,
  mayView,
  money,
  quotationLink,
  selectedBookingId,
  shapeInvoice,
  shapeReceipt,
  sortReceipts,
  sumMoney,
  summarizeInvoices,
  unlinkedRecordWhere,
  type GuestInvoice,
  type GuestReceipt,
  type MoneySummary,
} from "@/app/api/guest/receipt/guest-money";

// ============================================================
// Customer app: payments, receipts and documents, all signed-in reads.
// ------------------------------------------------------------
// ONE SOURCE OF TRUTH: these read the SAME Invoice / Installment / Payment /
// Contract / SignatureRequest / SalesQuotation rows the team works on and pass
// the team's stored figures through unchanged (guest-money.ts). A booking's
// balance due is bookingBalance(): the overview's figure and the booking
// page's "Pending". The "due now" amount is what /pay itself pre-selects
// (getPublicInvoiceForPayment), so the app and the pay page never disagree.
//
// Scope comes only from getHostScope: a customer's own bookings and contacts,
// or a staff preview of one booking in which each section needs the permission
// its team-side screen checks. Money and documents belong to the booking's own
// customer, so a booking the viewer was only invited to (collaboratorRoles)
// shows nothing here. Nothing here writes. Downloads go through
// /api/guest/invoice and /api/guest/receipt, which re-check the same rules.
// ============================================================

export interface GuestBookingOption {
  id: string;
  eventName: string;
  date: string;
}

type WithDownload<T> = T & { downloadUrl: string | null };

export interface GuestPaymentsScreen {
  preview: boolean;
  /** Staff preview without the team's finance access: nothing below is loaded. */
  hiddenInPreview: boolean;
  /** The viewer's own bookings to switch between (never ones they were invited to). */
  bookings: GuestBookingOption[];
  /** The booking this screen shows. */
  booking: GuestBookingOption | null;
  /** Set when the requested booking is one the viewer was invited to: its payments are the host's. */
  invitedBooking: GuestBookingOption | null;
  /** The booking's money: invoiced and paid over its billed invoices; balance due is bookingBalance(), the balanceDue of the ones still owed (SENT, PARTIALLY_PAID, OVERDUE). */
  summary: MoneySummary;
  invoices: WithDownload<GuestInvoice>[];
  /** The customer's own invoices not tied to a booking yet, kept out of the booking's balance. */
  unlinked: { summary: MoneySummary; invoices: WithDownload<GuestInvoice>[] } | null;
  /** Payments on every invoice above, newest first. */
  receipts: WithDownload<GuestReceipt>[];
  /** Line items of the most recent issued invoice: "what am I paying for". */
  breakdown: { invoiceNumber: string; lines: { k: string; v: number }[]; discount: number; gst: number; total: number } | null;
}

export interface GuestAgreement {
  id: string;
  kind: "esign" | "contract";
  title: string;
  eventName: string | null;
  status: string;
  statusLabel: string;
  /** Signed, else sent. ISO. */
  date: string | null;
  href: string | null;
  hrefLabel: string | null;
}

export type DocumentSection = "signatures" | "contracts" | "invoices" | "receipts" | "quotations";

export interface GuestDocumentsScreen {
  preview: boolean;
  /** Sections a staff preview leaves out because this role can't open them on the team side. */
  hiddenInPreview: DocumentSection[];
  bookings: GuestBookingOption[];
  booking: GuestBookingOption | null;
  /** Set when the requested booking is one the viewer was invited to: its documents are the host's. */
  invitedBooking: GuestBookingOption | null;
  /** Booking confirmations waiting for the host's e-signature. token is null when this viewer may not sign. */
  toSign: { id: string; token: string | null; title: string; eventName: string | null; sentAt: string | null }[];
  agreements: GuestAgreement[];
  invoices: { id: string; number: string; status: string; statusLabel: string; eventName: string | null; issued: string; total: number; balanceDue: number; downloadUrl: string | null }[];
  receipts: WithDownload<GuestReceipt>[];
  quotations: { id: string; number: string; occasion: string | null; total: number; sentAt: string | null; href: string }[];
}

// ------------------------------------------------------------ shared helpers

/**
 * The viewer's EFFECTIVE team permissions (staffCan: role overrides count, admins pass).
 * Preview is a staff-only view: fail closed for anyone else.
 */
function permissionCheck(scope: HostScope): (permission: string) => boolean {
  return (permission) => isStaffUser(scope.user) && staffCan(scope.user, permission);
}

const toOption = (b: HostBooking): GuestBookingOption => ({ id: b.id, eventName: b.eventName, date: b.date.toISOString() });

/** The bookings whose money and documents this viewer owns (or the one a staff member previews). */
function bookingOptions(scope: HostScope): GuestBookingOption[] {
  const rows: HostBooking[] = scope.preview
    ? scope.booking
      ? [scope.booking]
      : []
    : scope.bookings.filter((b) => !isInvitedBooking(scope, b.id));
  return rows.map(toOption);
}

/** The requested booking when the viewer was only invited to it, so the screen can say whose it is. */
function invitedOption(scope: HostScope, requestedBookingId?: string): GuestBookingOption | null {
  if (!requestedBookingId || !isInvitedBooking(scope, requestedBookingId)) return null;
  const b = scope.bookings.find((x) => x.id === requestedBookingId);
  return b ? toOption(b) : null;
}

async function loadInvoices(where: Prisma.InvoiceWhereInput) {
  return prisma.invoice.findMany({
    where: { AND: [where, { status: { not: "DRAFT" } }] },
    orderBy: { issueDate: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      issueDate: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      balanceDue: true,
      discountAmount: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
      bookingId: true,
      booking: { select: { eventName: true } },
      installments: { select: { id: true, label: true, amount: true, dueDate: true, status: true, paidAt: true, order: true } },
      lineItems: { orderBy: { order: "asc" }, select: { description: true, amount: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          receiptNumber: true,
          paidAt: true,
          createdAt: true,
          receiptUploadedAt: true,
          cancelledAt: true,
        },
      },
    },
  });
}

type InvoiceRows = Awaited<ReturnType<typeof loadInvoices>>;

function receiptsOf(invoices: InvoiceRows, canDownload: boolean): WithDownload<GuestReceipt>[] {
  const rows = invoices.flatMap((i) =>
    i.payments
      .filter((p) => isCustomerVisiblePayment(p))
      .map((p) => shapeReceipt({ ...p, invoice: { id: i.id, invoiceNumber: i.invoiceNumber } }))
  );
  return sortReceipts(rows).map((r) => ({
    ...r,
    downloadUrl: r.downloadable && canDownload ? `/api/guest/receipt/${encodeURIComponent(r.id)}` : null,
  }));
}

/** What /pay pre-selects for each payable invoice: the pay page's own reader, so the amounts cannot drift. */
async function nextDueFor(invoices: InvoiceRows): Promise<Map<string, { label: string; amount: number } | null>> {
  const out = new Map<string, { label: string; amount: number } | null>();
  await Promise.all(
    invoices
      .filter((i) => isPayableInvoice(i))
      .map(async (i) => {
        const res = await getPublicInvoiceForPayment(i.id);
        out.set(i.id, res.success ? res.data.nextDue : null);
      })
  );
  return out;
}

// ------------------------------------------------------------ payments screen

export async function getGuestPaymentsScreen(requestedBookingId?: string): Promise<GuestPaymentsScreen | null> {
  const scope = await getHostScope(requestedBookingId);
  if (!scope) return null;
  const can = permissionCheck(scope);
  const bookings = bookingOptions(scope);
  const bookingId = selectedBookingId(scope, requestedBookingId);
  const screen: GuestPaymentsScreen = {
    preview: scope.preview,
    hiddenInPreview: false,
    bookings,
    booking: bookings.find((b) => b.id === bookingId) ?? null,
    invitedBooking: invitedOption(scope, requestedBookingId),
    summary: summarizeInvoices([]),
    invoices: [],
    unlinked: null,
    receipts: [],
    breakdown: null,
  };
  // Invoices, instalments and receipts sit on the team's finance screens.
  if (!mayView(scope, "payments", can)) return { ...screen, hiddenInPreview: true };

  const unlinkedWhere = unlinkedRecordWhere(scope);
  const [bookingRows, unlinkedRows] = await Promise.all([
    bookingId ? loadInvoices({ bookingId }) : Promise.resolve([] as InvoiceRows),
    unlinkedWhere ? loadInvoices(unlinkedWhere) : Promise.resolve([] as InvoiceRows),
  ]);
  const bookingIssued = bookingRows.filter((i) => isIssuedInvoice(i.status));
  const unlinkedIssued = unlinkedRows.filter((i) => isIssuedInvoice(i.status));
  const nextDue = await nextDueFor([...bookingIssued, ...unlinkedIssued]);
  const shape = (rows: InvoiceRows): WithDownload<GuestInvoice>[] =>
    rows.map((i) => ({
      ...shapeInvoice({ ...i, eventName: i.booking?.eventName ?? null }, nextDue.get(i.id) ?? null),
      downloadUrl: `/api/guest/invoice/${encodeURIComponent(i.id)}`,
    }));
  const latest = bookingIssued.find((i) => i.lineItems.length > 0) ?? unlinkedIssued.find((i) => i.lineItems.length > 0);

  return {
    ...screen,
    summary: summarizeInvoices(bookingRows),
    invoices: shape(bookingIssued),
    unlinked: unlinkedIssued.length > 0 ? { summary: summarizeInvoices(unlinkedRows), invoices: shape(unlinkedIssued) } : null,
    receipts: receiptsOf([...bookingRows, ...unlinkedRows], true),
    breakdown: latest
      ? {
          invoiceNumber: latest.invoiceNumber,
          lines: latest.lineItems.map((l) => ({ k: l.description, v: money(l.amount) })),
          discount: money(latest.discountAmount),
          gst: sumMoney(latest.cgstAmount, latest.sgstAmount, latest.igstAmount),
          total: money(latest.totalAmount),
        }
      : null,
  };
}

/**
 * The booking's money summary by the payments screen's rule (balance due =
 * bookingBalance: the balanceDue of its owed invoices, SENT, PARTIALLY_PAID or
 * OVERDUE), for any other screen that shows a money figure, so no two customer
 * screens can disagree. Booking-level balance sits on the booking page
 * (bookings:read), so preview is not gated further.
 */
export async function getGuestMoneySummary(
  requestedBookingId?: string
): Promise<(MoneySummary & { bookingId: string | null; preview: boolean }) | null> {
  const scope = await getHostScope(requestedBookingId);
  if (!scope) return null;
  if (scope.preview && !isStaffUser(scope.user)) return null;
  const bookingId = selectedBookingId(scope, requestedBookingId);
  const rows = bookingId
    ? await prisma.invoice.findMany({ where: { bookingId }, select: { status: true, totalAmount: true, paidAmount: true, balanceDue: true } })
    : [];
  return { ...summarizeInvoices(rows), bookingId, preview: scope.preview };
}

// ------------------------------------------------------------ documents screen

/** The contract page lives in the customer portal, which admits these roles and only a login's own contacts. */
const PORTAL_ROLES = new Set(["CLIENT", "ADMIN", "SUPER_ADMIN"]);

export async function getGuestDocumentsScreen(requestedBookingId?: string): Promise<GuestDocumentsScreen | null> {
  const scope = await getHostScope(requestedBookingId);
  if (!scope) return null;
  const can = permissionCheck(scope);
  const bookings = bookingOptions(scope);
  const bookingId = selectedBookingId(scope, requestedBookingId);
  const see: Record<DocumentSection, boolean> = {
    signatures: mayView(scope, "signatures", can),
    contracts: mayView(scope, "contracts", can),
    invoices: mayView(scope, "invoices", can),
    receipts: mayView(scope, "payments", can),
    quotations: mayView(scope, "quotations", can),
  };
  const recordsWhere = bookingRecordsWhere(scope, bookingId);
  const now = new Date();

  const [signatures, contracts, invoices, quotations] = await Promise.all([
    see.signatures && bookingId
      ? prisma.signatureRequest.findMany({
          where: { bookingId, status: { in: ["SENT", "VIEWED", "SIGNED", "EXPIRED"] } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            token: true,
            documentTitle: true,
            status: true,
            sentAt: true,
            signedAt: true,
            expiresAt: true,
            booking: { select: { eventName: true, contactId: true } },
          },
        })
      : Promise.resolve([]),
    see.contracts && recordsWhere
      ? prisma.contract.findMany({
          where: { AND: [recordsWhere, { status: { not: "DRAFT" } }] },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, status: true, sentAt: true, signedAt: true, contactId: true, booking: { select: { eventName: true } } },
        })
      : Promise.resolve([]),
    (see.invoices || see.receipts) && recordsWhere ? loadInvoices(recordsWhere) : Promise.resolve([] as InvoiceRows),
    see.quotations && recordsWhere
      ? prisma.salesQuotation.findMany({
          where: { AND: [recordsWhere, { status: { in: ["APPROVED", "SENT", "CONVERTED"] } }] },
          orderBy: { createdAt: "desc" },
          select: { id: true, quoteNumber: true, version: true, status: true, occasion: true, grandTotal: true, sentAt: true, shareLinkToken: true },
        })
      : Promise.resolve([]),
  ]);

  const tokens = quotations.map((q) => q.shareLinkToken).filter((t): t is string => !!t);
  const links = tokens.length
    ? await prisma.quoteShareLink.findMany({ where: { token: { in: tokens } }, select: { token: true, status: true, expiresAt: true } })
    : [];
  const liveTokens = new Set(links.filter((l) => isLiveShareLink(l, now)).map((l) => l.token));

  // Signing is the host's own act: never in staff preview, never for an invited collaborator.
  const ownContacts = new Set(scope.contactIds);
  const maySign = (contactId: string) => !scope.preview && ownContacts.has(contactId);
  const expired = (s: { status: string; expiresAt: Date | null }) =>
    s.status === "EXPIRED" || (!!s.expiresAt && s.expiresAt.getTime() < now.getTime() && s.status !== "SIGNED");

  const toSign: GuestDocumentsScreen["toSign"] = [];
  const agreements: GuestAgreement[] = [];
  for (const s of signatures) {
    if ((s.status === "SENT" || s.status === "VIEWED") && !expired(s)) {
      toSign.push({
        id: s.id,
        token: maySign(s.booking.contactId) ? s.token : null,
        title: s.documentTitle,
        eventName: s.booking.eventName,
        sentAt: s.sentAt?.toISOString() ?? null,
      });
      continue;
    }
    const signed = s.status === "SIGNED";
    const open = signed && !scope.preview; // the /sign page shows the signed copy, locked
    agreements.push({
      id: s.id,
      kind: "esign",
      title: s.documentTitle,
      eventName: s.booking.eventName,
      status: signed ? "SIGNED" : "EXPIRED",
      statusLabel: agreementStatusLabel(signed ? "SIGNED" : "EXPIRED"),
      date: (s.signedAt ?? s.sentAt)?.toISOString() ?? null,
      href: open ? `/sign/${encodeURIComponent(s.token)}` : null,
      hrefLabel: open ? "View signed copy" : null,
    });
  }

  const portalAccess = !scope.preview && PORTAL_ROLES.has(scope.user.role ?? "");
  for (const c of contracts) {
    if (!isCustomerVisibleContract(c.status)) continue;
    const canOpen = portalAccess && ownContacts.has(c.contactId);
    agreements.push({
      id: c.id,
      kind: "contract",
      title: c.title,
      eventName: c.booking?.eventName ?? null,
      status: c.status,
      statusLabel: agreementStatusLabel(c.status),
      date: (c.signedAt ?? c.sentAt)?.toISOString() ?? null,
      href: canOpen ? `/portal/contracts/${encodeURIComponent(c.id)}` : null,
      hrefLabel: canOpen ? (c.status === "SENT" || c.status === "VIEWED" ? "Review & sign" : "View") : null,
    });
  }

  return {
    preview: scope.preview,
    hiddenInPreview: scope.preview ? (Object.keys(see) as DocumentSection[]).filter((k) => !see[k]) : [],
    bookings,
    booking: bookings.find((b) => b.id === bookingId) ?? null,
    invitedBooking: invitedOption(scope, requestedBookingId),
    toSign,
    agreements,
    invoices: see.invoices
      ? invoices
          .filter((i) => isCustomerVisibleInvoice(i.status))
          .map((i) => {
            const g = shapeInvoice({ ...i, eventName: i.booking?.eventName ?? null }, null);
            return {
              id: g.id,
              number: g.number,
              status: g.status,
              statusLabel: g.statusLabel,
              eventName: g.eventName,
              issued: g.issueDate,
              total: g.total,
              balanceDue: g.balanceDue,
              downloadUrl: `/api/guest/invoice/${encodeURIComponent(i.id)}`,
            };
          })
      : [],
    receipts: see.receipts ? receiptsOf(invoices, true) : [],
    quotations: quotations.flatMap((q) => {
      const href = quotationLink(q, liveTokens);
      return href
        ? [
            {
              id: q.id,
              number: q.version > 1 ? `${q.quoteNumber} (v${q.version})` : q.quoteNumber,
              occasion: q.occasion,
              total: money(q.grandTotal),
              sentAt: q.sentAt?.toISOString() ?? null,
              href,
            },
          ]
        : [];
    }),
  };
}
