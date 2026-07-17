"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { contactSchema, type ContactInput } from "@/schemas/contact.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { coarseContactWhere, matchesContactKey } from "@/lib/dedup";

// ============================================================
// Enquiry status (Sales CRM) — the pipeline state of an enquiry (Contact).
// Null = new/untouched. Mirrors the lead status pill.
// ============================================================

const ENQUIRY_STATUSES = [
  "LEAD_CREATED",
  "INTERESTED",
  "NO_RESPONSE",
  "DROPPED",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/** Server-side whitelist — enquiryStatus is a free String column, so an
 *  unvalidated value would persist straight through Prisma. */
function isEnquiryStatus(v: unknown): v is EnquiryStatus {
  return typeof v === "string" && (ENQUIRY_STATUSES as readonly string[]).includes(v);
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // India has no DST — fixed +5:30.

/** Parse a "yyyy-MM-dd" filter bound into a true **IST** day boundary instant.
 *  Server-local boundaries are wrong here: prod runs in UTC, so an enquiry
 *  created 01:00 IST (= 19:30 UTC the previous day) would fall outside its own
 *  day. Matches the IST windows the rest of the app filters on. Malformed or
 *  impossible dates (2026-02-31, 2026-13-01) return undefined → no filter,
 *  rather than a silently-wrong window from Date rollover. */
function dayBound(value: string | undefined, edge: "start" | "end"): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const utcMidnight = Date.UTC(y, mo - 1, d);
  const chk = new Date(utcMidnight);
  // Reject rollover (Date.UTC(2026, 1, 31) silently becomes 3 Mar).
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return undefined;
  const startOfIstDay = utcMidnight - IST_OFFSET_MS; // 00:00:00.000 IST as an instant
  return edge === "start"
    ? new Date(startOfIstDay)
    : new Date(startOfIstDay + 24 * 60 * 60 * 1000 - 1); // 23:59:59.999 IST
}

// ============================================================
// Get Contacts (Paginated + Search + Enquiry filters)
// ============================================================

export async function getContacts(params?: {
  search?: string;
  page?: number;
  limit?: number;
  /** Enquiry creation date range (inclusive), "yyyy-MM-dd" or ISO. */
  createdFrom?: string;
  createdTo?: string;
  /** Enquiry status filter. "NEW" matches untouched (null) enquiries. */
  enquiryStatus?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contacts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // Exclude soft-deleted contacts; combine with any search filter.
    const where: Record<string, unknown> = { deletedAt: null };

    // Enquiry creation-date range (inclusive on both ends).
    const from = dayBound(params?.createdFrom, "start");
    const to = dayBound(params?.createdTo, "end");
    if (from || to) {
      where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }

    // Enquiry status. "NEW" is the untouched (null) bucket, not a stored value.
    const status = params?.enquiryStatus?.trim();
    if (status === "NEW") {
      where.enquiryStatus = null;
    } else if (isEnquiryStatus(status)) {
      where.enquiryStatus = status;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search, mode: "insensitive" as const } },
        { company: { contains: search, mode: "insensitive" as const } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(contacts),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_CONTACTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch contacts" };
  }
}

// ============================================================
// Get Single Contact
// ============================================================

export async function getContact(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contacts:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const contact = await prisma.contact.findFirst({
      where: { id, deletedAt: null },
      include: {
        leads: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        bookings: {
          orderBy: { createdAt: "desc" },
          include: {
            venue: { select: { id: true, name: true } },
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            balanceDue: true,
            issueDate: true,
            dueDate: true,
          },
        },
      },
    });

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    return { success: true as const, data: serialize(contact) };
  } catch (error) {
    console.error("[GET_CONTACT_ERROR]", error);
    return { success: false as const, error: "Failed to fetch contact" };
  }
}

// ============================================================
// Create Contact
// ============================================================

export async function createContact(data: ContactInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contacts:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = contactSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const contactData = parsed.data;

    // Check for duplicates
    if (contactData.email || contactData.phone) {
      const duplicateResult = await checkDuplicates(
        contactData.email || undefined,
        contactData.phone || undefined
      );
      if (duplicateResult.success && duplicateResult.data.length > 0) {
        return {
          success: false as const,
          error: `A contact with this ${contactData.email ? "email" : "phone"} already exists`,
        };
      }
    }

    const contact = await prisma.contact.create({
      data: {
        firstName: contactData.firstName,
        lastName: contactData.lastName || "",
        email: contactData.email || null,
        phone: contactData.phone || null,
        company: contactData.company || null,
        designation: contactData.designation || null,
        type: contactData.type,
        address: contactData.address || null,
        city: contactData.city || null,
        state: contactData.state || null,
        pincode: contactData.pincode || null,
        notes: contactData.notes || null,
        tags: contactData.tags,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Contact",
      entityId: contact.id,
    });

    revalidatePath("/contacts");
    return { success: true as const, data: serialize(contact) };
  } catch (error) {
    console.error("[CREATE_CONTACT_ERROR]", error);
    return { success: false as const, error: "Failed to create contact" };
  }
}

// ============================================================
// Update Contact
// ============================================================

export async function updateContact(id: string, data: ContactInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contacts:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = contactSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Contact not found" };
    }

    const contactData = parsed.data;

    // Check duplicates excluding current contact
    if (contactData.email && contactData.email !== existing.email) {
      const emailDup = await prisma.contact.findFirst({
        where: { email: contactData.email, id: { not: id }, deletedAt: null },
      });
      if (emailDup) {
        return {
          success: false as const,
          error: "Another contact with this email already exists",
        };
      }
    }

    if (contactData.phone && contactData.phone !== existing.phone) {
      const phoneDup = await prisma.contact.findFirst({
        where: { phone: contactData.phone, id: { not: id }, deletedAt: null },
      });
      if (phoneDup) {
        return {
          success: false as const,
          error: "Another contact with this phone already exists",
        };
      }
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email || null,
        phone: contactData.phone || null,
        company: contactData.company || null,
        designation: contactData.designation || null,
        type: contactData.type,
        address: contactData.address || null,
        city: contactData.city || null,
        state: contactData.state || null,
        pincode: contactData.pincode || null,
        notes: contactData.notes || null,
        tags: contactData.tags,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Contact",
      entityId: contact.id,
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
    return { success: true as const, data: serialize(contact) };
  } catch (error) {
    console.error("[UPDATE_CONTACT_ERROR]", error);
    return { success: false as const, error: "Failed to update contact" };
  }
}

// ============================================================
// Set Enquiry Status
// ============================================================

/** Move an enquiry (Contact) along the pipeline. Pass null to reset to "New".
 *  Stamps enquiryStatusAt so the list can show how long it's been sitting. */
export async function setEnquiryStatus(contactId: string, status: string | null) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Gated like every other contact write.
    if (!hasPermission(session.user.role, "contacts:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!contactId || typeof contactId !== "string") {
      return { success: false as const, error: "Invalid enquiry" };
    }
    if (status !== null && !isEnquiryStatus(status)) {
      return { success: false as const, error: "Invalid enquiry status" };
    }

    const existing = await prisma.contact.findFirst({
      where: { id: contactId, deletedAt: null },
      select: { id: true, enquiryStatus: true },
    });
    if (!existing) {
      return { success: false as const, error: "Contact not found" };
    }

    // No-op guard: don't churn the timestamp when nothing changed.
    if (existing.enquiryStatus === status) {
      return { success: true as const, data: { id: contactId, enquiryStatus: status } };
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: { enquiryStatus: status, enquiryStatusAt: status ? new Date() : null },
      select: { id: true, enquiryStatus: true, enquiryStatusAt: true },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Contact",
      entityId: contactId,
      changes: { enquiryStatus: { from: existing.enquiryStatus, to: status } },
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
    return { success: true as const, data: serialize(contact) };
  } catch (error) {
    console.error("[SET_ENQUIRY_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update enquiry status" };
  }
}

// ============================================================
// Delete Contact
// ============================================================

export async function deleteContact(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "contacts:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        _count: { select: { leads: true, bookings: true, invoices: true } },
      },
    });

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    // Prevent deleting contacts with related records
    if (
      contact._count.leads > 0 ||
      contact._count.bookings > 0 ||
      contact._count.invoices > 0
    ) {
      return {
        success: false as const,
        error:
          "Cannot delete contact with associated leads, bookings, or invoices. Remove those first.",
      };
    }

    // Soft-delete: set deletedAt instead of removing the row.
    await prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Contact",
      entityId: id,
    });

    revalidatePath("/contacts");
    revalidatePath("/settings/trash");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_CONTACT_ERROR]", error);
    return { success: false as const, error: "Failed to delete contact" };
  }
}

// ============================================================
// Restore Contact (from trash)
// ============================================================

export async function restoreContact(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "contacts:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    await prisma.contact.update({
      where: { id },
      data: { deletedAt: null },
    });
    await logActivity({
      userId: session.user.id as string,
      action: "restored",
      entityType: "Contact",
      entityId: id,
    });
    revalidatePath("/contacts");
    revalidatePath("/settings/trash");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[RESTORE_CONTACT_ERROR]", error);
    return { success: false as const, error: "Failed to restore contact" };
  }
}

// ============================================================
// Permanently delete contact (admin only)
// ============================================================

export async function purgeContact(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    const role = (session.user as { role?: string }).role ?? "";
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // FK safety: refuse purge if the contact still has related records.
    const existing = await prisma.contact.findUnique({
      where: { id },
      include: {
        _count: { select: { leads: true, bookings: true, invoices: true } },
      },
    });
    if (!existing) {
      return { success: false as const, error: "Contact not found" };
    }
    if (
      existing._count.leads > 0 ||
      existing._count.bookings > 0 ||
      existing._count.invoices > 0
    ) {
      return {
        success: false as const,
        error:
          "Cannot permanently delete a contact with associated leads, bookings, or invoices.",
      };
    }

    await prisma.contact.delete({ where: { id } });
    await logActivity({
      userId: session.user.id as string,
      action: "purged",
      entityType: "Contact",
      entityId: id,
    });
    revalidatePath("/settings/trash");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[PURGE_CONTACT_ERROR]", error);
    return { success: false as const, error: "Failed to purge contact" };
  }
}

// ============================================================
// Check Duplicates
// ============================================================

export async function checkDuplicates(email?: string, phone?: string) {
  try {
    // Normalised, format-insensitive match: "+91 98765 43210" == "9876543210",
    // "A@B.com" == "a@b.com". A coarse DB filter narrows the set, then
    // matchesContactKey does the exact comparison the DB cannot.
    const where = coarseContactWhere(email, phone);
    if (!where) {
      return { success: true as const, data: [] };
    }

    const candidates = await prisma.contact.findMany({
      // Ignore trashed contacts so a soft-deleted record can't block re-creation.
      where: { AND: [{ deletedAt: null }, where] },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    const duplicates = matchesContactKey(candidates, email, phone);
    return { success: true as const, data: serialize(duplicates) };
  } catch (error) {
    console.error("[CHECK_DUPLICATES_ERROR]", error);
    return { success: false as const, error: "Failed to check duplicates" };
  }
}
