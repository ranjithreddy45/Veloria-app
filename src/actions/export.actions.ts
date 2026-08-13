"use server";

import { auth } from "@/../auth";
import { phoneForExport } from "@/lib/phone";
import { buildLeadListWhere, type LeadListFilters } from "@/lib/crm/lead-filters";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { ENQUIRY_STATUS_LABEL, type EnquiryStatus } from "@/lib/enquiry-status";
import { enquirySourceLabel } from "@/lib/enquiry-source";

// ============================================================
// Export Actions — Fetch ALL data (no pagination) for CSV export
// ============================================================

/** yyyy-mm-dd for a timeline entry (kept short so CSV cells stay readable). */
function d(dt: Date | null | undefined): string {
  return dt ? dt.toISOString().split("T")[0] : "";
}

/** Human label for a Contact-side enquiry status (null = untouched "New"). */
function enquiryStatusLabel(status: string | null): string {
  if (!status) return "New";
  return ENQUIRY_STATUS_LABEL[status as EnquiryStatus] ?? status;
}

/** "4m12s" / "45s" from a duration in seconds. Blank for 0/absent. */
function dur(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

/** One CallLog row as it appears in the Calls cell. */
type CallLogRow = {
  disposition: string;
  durationSeconds: number;
  notes: string | null;
  createdAt: Date;
};

/**
 * Flatten the activity timeline of a lead or enquiry into three CSV cells:
 * notes, calls, and meetings. Every argument is the pre-fetched, already-scoped
 * set for ONE record; entries are joined with " | " so each cell stays single.
 *
 *   notes    — CrmNote kind=NOTE, oldest first (reads as the story)
 *   calls    — CrmNote kind=CALL **merged with** telephony CallLog, NEWEST first,
 *              so the most recent contact attempt leads. Both sources are included
 *              because a rep may log a call either in the CRM panel or through the
 *              phone integration; taking only one silently drops the other's calls.
 *   meetings — Task with taskType MEETING/SHOW_AROUND, by due date
 */
function formatTimeline(
  notes: { kind: string; body: string; callOutcome: string | null; createdAt: Date }[],
  meetings: { taskType: string | null; title: string; dueDate: Date | null; status: string }[],
  callLogs: CallLogRow[] = []
): { notes: string; calls: string; meetings: string } {
  const noteCell = notes
    .filter((n) => n.kind === "NOTE")
    .map((n) => `[${d(n.createdAt)}] ${n.body}`)
    .join(" | ");

  // Merge both call sources on a common shape, then sort newest-first.
  const merged: { at: Date; text: string }[] = [
    ...notes
      .filter((n) => n.kind === "CALL")
      .map((n) => ({
        at: n.createdAt,
        text: `[${d(n.createdAt)}]${n.callOutcome ? ` ${n.callOutcome}` : ""}: ${n.body}`,
      })),
    ...callLogs.map((c) => {
      const length = dur(c.durationSeconds);
      return {
        at: c.createdAt,
        text: `[${d(c.createdAt)}] ${c.disposition}${length ? ` (${length})` : ""}${
          c.notes ? `: ${c.notes}` : ""
        }`,
      };
    }),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const meetingCell = meetings
    .map((m) => `[${d(m.dueDate)}] ${m.taskType ?? "MEETING"} (${m.status}): ${m.title}`)
    .join(" | ");

  return { notes: noteCell, calls: merged.map((c) => c.text).join(" | "), meetings: meetingCell };
}

export async function exportContacts() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contacts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const contacts = await prisma.contact.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10000,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        city: true,
        state: true,
        type: true,
        enquiryStatus: true,
        enquiryVenue: { select: { name: true } },
        enquirySource: true,
        createdAt: true,
      },
    });

    // Pull the notes/calls (CrmNote) and meetings (Task) for the exported set in
    // two batched queries, then group by contact — avoids an N+1 per row.
    const contactIds = contacts.map((c) => c.id);
    const [crmNotes, meetings, callLogs] = await Promise.all([
      contactIds.length
        ? prisma.crmNote.findMany({
            where: { contactId: { in: contactIds } },
            orderBy: { createdAt: "asc" },
            select: { contactId: true, kind: true, body: true, callOutcome: true, createdAt: true },
          })
        : Promise.resolve([]),
      contactIds.length
        ? prisma.task.findMany({
            where: { contactId: { in: contactIds }, taskType: { in: ["MEETING", "SHOW_AROUND"] } },
            orderBy: { dueDate: "asc" },
            select: { contactId: true, taskType: true, title: true, dueDate: true, status: true },
          })
        : Promise.resolve([]),
      // Telephony calls — merged into the same Calls cell as CrmNote CALL rows.
      contactIds.length
        ? prisma.callLog.findMany({
            where: { contactId: { in: contactIds } },
            orderBy: { createdAt: "desc" },
            select: {
              contactId: true,
              disposition: true,
              durationSeconds: true,
              notes: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const notesByContact = new Map<string, typeof crmNotes>();
    for (const n of crmNotes) {
      if (!n.contactId) continue;
      (notesByContact.get(n.contactId) ?? notesByContact.set(n.contactId, []).get(n.contactId)!).push(n);
    }
    const meetingsByContact = new Map<string, typeof meetings>();
    for (const m of meetings) {
      if (!m.contactId) continue;
      (meetingsByContact.get(m.contactId) ?? meetingsByContact.set(m.contactId, []).get(m.contactId)!).push(m);
    }
    const callsByContact = new Map<string, typeof callLogs>();
    for (const c of callLogs) {
      (callsByContact.get(c.contactId) ?? callsByContact.set(c.contactId, []).get(c.contactId)!).push(c);
    }

    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Company",
      "City",
      "State",
      "Type",
      "Hall / Property",
      "Lead Source",
      "Enquiry Status",
      "Notes",
      "Calls",
      "Meetings",
      "Created At",
    ];

    const rows = contacts.map((c) => {
      const t = formatTimeline(
        notesByContact.get(c.id) ?? [],
        meetingsByContact.get(c.id) ?? [],
        callsByContact.get(c.id) ?? []
      );
      return [
        c.firstName,
        c.lastName,
        c.email || "",
        c.phone || "",
        c.company || "",
        c.city || "",
        c.state || "",
        c.type || "",
        c.enquiryVenue?.name || "",
        enquirySourceLabel(c.enquirySource),
        enquiryStatusLabel(c.enquiryStatus),
        t.notes,
        t.calls,
        t.meetings,
        c.createdAt.toISOString().split("T")[0],
      ];
    });

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_CONTACTS_ERROR]", error);
    return { success: false as const, error: "Failed to export contacts" };
  }
}

/**
 * CSV of the leads the caller is looking at.
 *
 * `filters` is the SAME shape the list uses, run through the SAME
 * buildLeadListWhere — not a copy. This took no arguments at all before, so a
 * user who filtered to Google Ads in August and pressed Export silently got
 * their entire book. Nothing on screen said the filters had been dropped, which
 * made a wrong file look like a right one.
 */
export async function exportLeads(filters?: LeadListFilters) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Mirror the leads LIST scoping: reps see (and therefore export) only their
    // own book; managers with leads:assign export org-wide. Without this, an
    // own-book-only rep could CSV-download every lead in the company.
    // Scope AND filters both come from the shared builder, so the file can
    // never contain a different set of rows than the screen that asked for it.
    // buildLeadListWhere already downgrades scope to "mine" for anyone without
    // the manager permission, so the own-book guard is inherited rather than
    // re-implemented here.
    const { where } = buildLeadListWhere(filters, {
      id: session.user.id as string,
      role: session.user.role,
    });
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: {
        contact: { select: { firstName: true, lastName: true, phone: true } },
        assignedTo: { select: { name: true } },
        preferredVenue: { select: { name: true } },
      },
    });

    // Batch the timeline (notes/calls from CrmNote, meetings from Task) for the
    // whole exported set, then group by lead — one query each, no N+1.
    const leadIds = leads.map((l) => l.id);
    // CallLog hangs off Contact, not Lead, so a lead's telephony calls are its
    // contact's calls. Two leads for the same person therefore show the same call
    // history — that is the most faithful read of a contact-scoped call record.
    const leadContactIds = [...new Set(leads.map((l) => l.contactId))];
    const [crmNotes, meetings, callLogs] = await Promise.all([
      leadIds.length
        ? prisma.crmNote.findMany({
            where: { leadId: { in: leadIds } },
            orderBy: { createdAt: "asc" },
            select: { leadId: true, kind: true, body: true, callOutcome: true, createdAt: true },
          })
        : Promise.resolve([]),
      leadIds.length
        ? prisma.task.findMany({
            where: { leadId: { in: leadIds }, taskType: { in: ["MEETING", "SHOW_AROUND"] } },
            orderBy: { dueDate: "asc" },
            select: { leadId: true, taskType: true, title: true, dueDate: true, status: true },
          })
        : Promise.resolve([]),
      leadContactIds.length
        ? prisma.callLog.findMany({
            where: { contactId: { in: leadContactIds } },
            orderBy: { createdAt: "desc" },
            select: {
              contactId: true,
              disposition: true,
              durationSeconds: true,
              notes: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const notesByLead = new Map<string, typeof crmNotes>();
    for (const n of crmNotes) {
      if (!n.leadId) continue;
      (notesByLead.get(n.leadId) ?? notesByLead.set(n.leadId, []).get(n.leadId)!).push(n);
    }
    const meetingsByLead = new Map<string, typeof meetings>();
    for (const m of meetings) {
      if (!m.leadId) continue;
      (meetingsByLead.get(m.leadId) ?? meetingsByLead.set(m.leadId, []).get(m.leadId)!).push(m);
    }
    // Keyed by CONTACT id (see the leadContactIds note above), then looked up per
    // lead through l.contactId.
    const callsByContact = new Map<string, typeof callLogs>();
    for (const c of callLogs) {
      (callsByContact.get(c.contactId) ?? callsByContact.set(c.contactId, []).get(c.contactId)!).push(c);
    }

    const headers = [
      "Title",
      "Contact",
      // The number the rep actually calls. Absent until now, which made a
      // "leads export" useless for the one thing an exported lead list is for.
      "Phone",
      "Hall / Property",
      "Status",
      "Source",
      "Event Type",
      // The date the customer is asking about. It was simply never in the file:
      // "Event Type" was, "Event Date" was not, so every export lost the one
      // field the sales team sorts and plans by.
      "Event Date",
      "Est. Value",
      "Assigned To",
      "Notes",
      "Calls",
      "Meetings",
      "Created At",
    ];

    const rows = leads.map((l) => {
      const t = formatTimeline(
        notesByLead.get(l.id) ?? [],
        meetingsByLead.get(l.id) ?? [],
        callsByContact.get(l.contactId) ?? []
      );
      return [
        l.title,
        `${l.contact.firstName} ${l.contact.lastName}`,
        // Normalised, NOT verbatim. Only capture and CSV import canonicalise on
        // write; manual entry, the configurator, the public hold flow and the
        // widget all store whatever was typed. So the column held a mixture,
        // and a spreadsheet TYPES each cell — "+91…" stays text while a bare
        // run of digits becomes a number, loses a leading zero, and past eleven
        // digits renders as 9.19008E+11.
        //
        // Deliberately NOT wrapped in ="…": that survives Excel and breaks
        // Google Sheets and every plain CSV parser.
        phoneForExport(l.contact.phone),
        l.preferredVenue?.name || "",
        l.status,
        l.source,
        l.eventType || "",
        // ISO yyyy-mm-dd: unambiguous in a spreadsheet, and sorts correctly as
        // text. A localised "12/08/2026" is read as December by half of Excel.
        l.eventDate ? l.eventDate.toISOString().split("T")[0] : "",
        l.estimatedValue ? Number(l.estimatedValue) : "",
        l.assignedTo?.name || "",
        t.notes,
        t.calls,
        t.meetings,
        l.createdAt.toISOString().split("T")[0],
      ];
    });

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_LEADS_ERROR]", error);
    return { success: false as const, error: "Failed to export leads" };
  }
}

export async function exportBookings() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const bookings = await prisma.booking.findMany({
      orderBy: { date: "desc" },
      take: 10000,
      include: {
        contact: { select: { firstName: true, lastName: true } },
        venue: { select: { name: true } },
      },
    });

    const headers = [
      "Booking #",
      "Event Name",
      "Event Type",
      "Status",
      "Date",
      "Time Slot",
      "Venue",
      "Contact",
      "Guests",
      "Total Amount",
    ];

    const rows = bookings.map((b) => [
      b.bookingNumber,
      b.eventName,
      b.eventType,
      b.status,
      b.date.toISOString().split("T")[0],
      b.timeSlot,
      b.venue.name,
      `${b.contact.firstName} ${b.contact.lastName}`,
      b.guestCount,
      Number(b.totalAmount),
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_BOOKINGS_ERROR]", error);
    return { success: false as const, error: "Failed to export bookings" };
  }
}

export async function exportInvoices() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "invoices:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Bound the export to a sane maximum to avoid loading an unbounded
    // result set into memory. If the dataset exceeds the cap, fail loudly
    // with guidance rather than silently truncating the export.
    const EXPORT_MAX_ROWS = 5000;

    const totalCount = await prisma.invoice.count();
    if (totalCount > EXPORT_MAX_ROWS) {
      return {
        success: false as const,
        error: `Too many records to export (${totalCount}). The export is limited to ${EXPORT_MAX_ROWS} invoices. Please filter the data before exporting.`,
      };
    }

    const invoices = await prisma.invoice.findMany({
      orderBy: { issueDate: "desc" },
      take: EXPORT_MAX_ROWS,
      include: {
        contact: { select: { firstName: true, lastName: true } },
      },
    });

    const headers = [
      "Invoice #",
      "Contact",
      "Status",
      "Issue Date",
      "Due Date",
      "Subtotal",
      "Tax",
      "Total",
      "Paid",
      "Balance Due",
    ];

    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      `${inv.contact.firstName} ${inv.contact.lastName}`,
      inv.status,
      inv.issueDate.toISOString().split("T")[0],
      inv.dueDate.toISOString().split("T")[0],
      Number(inv.subtotal),
      Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount),
      Number(inv.totalAmount),
      Number(inv.paidAmount),
      Number(inv.balanceDue),
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_INVOICES_ERROR]", error);
    return { success: false as const, error: "Failed to export invoices" };
  }
}

export async function exportQuotes() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "quotes:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: {
        contact: { select: { firstName: true, lastName: true } },
      },
    });

    const headers = [
      "Quote #",
      "Title",
      "Contact",
      "Status",
      "Valid Until",
      "Subtotal",
      "Tax",
      "Total",
      "Created At",
    ];

    const rows = quotes.map((q) => [
      q.quoteNumber,
      q.title,
      `${q.contact.firstName} ${q.contact.lastName}`,
      q.status,
      q.validUntil.toISOString().split("T")[0],
      Number(q.subtotal),
      Number(q.taxAmount),
      Number(q.totalAmount),
      q.createdAt.toISOString().split("T")[0],
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_QUOTES_ERROR]", error);
    return { success: false as const, error: "Failed to export quotes" };
  }
}

export async function exportVendors() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "vendors:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const vendors = await prisma.vendor.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
      take: 10000,
    });

    const headers = [
      "Name",
      "Category",
      "Status",
      "Email",
      "Phone",
      "Company",
      "GSTIN",
      "Rating",
      "Total Bookings",
    ];

    const rows = vendors.map((v) => [
      v.name,
      v.category,
      v.status,
      v.email || "",
      v.phone || "",
      v.company || "",
      v.gstin || "",
      v.rating,
      v.totalBookings,
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_VENDORS_ERROR]", error);
    return { success: false as const, error: "Failed to export vendors" };
  }
}

export async function exportPayments() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "payments:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 10000,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            contact: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const headers = [
      "Receipt #",
      "Invoice #",
      "Contact",
      "Amount",
      "Method",
      "Status",
      "Transaction ID",
      "Paid At",
    ];

    const rows = payments.map((p) => [
      p.receiptNumber || "",
      p.invoice.invoiceNumber,
      `${p.invoice.contact.firstName} ${p.invoice.contact.lastName}`,
      Number(p.amount),
      p.method,
      p.status,
      p.transactionId || "",
      p.paidAt ? p.paidAt.toISOString().split("T")[0] : "",
    ]);

    return serialize({ success: true as const, data: { headers, rows } });
  } catch (error) {
    console.error("[EXPORT_PAYMENTS_ERROR]", error);
    return { success: false as const, error: "Failed to export payments" };
  }
}
