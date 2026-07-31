"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { createLead } from "@/actions/lead.actions";

// ============================================================
// Get Widget Inquiries (Paginated + Filters)
// ============================================================

export async function getInquiries(params?: {
  search?: string;
  status?: "all" | "pending" | "processed";
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "widget:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
      ];
    }

    if (params?.status === "pending") {
      where.isProcessed = false;
    } else if (params?.status === "processed") {
      where.isProcessed = true;
    }

    const [inquiries, total] = await Promise.all([
      prisma.widgetInquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.widgetInquiry.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(inquiries),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_WIDGET_INQUIRIES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch inquiries" };
  }
}

// ============================================================
// Process Inquiry → Create Contact + Lead, Mark as Processed
// ============================================================

export async function processInquiry(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "widget:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Fetch the inquiry
    const inquiry = await prisma.widgetInquiry.findUnique({
      where: { id },
    });

    if (!inquiry) {
      return { success: false as const, error: "Inquiry not found" };
    }

    if (inquiry.isProcessed) {
      return { success: false as const, error: "Inquiry already processed" };
    }

    // Atomically claim the inquiry before doing any writes. The earlier
    // findUnique check is racy: two concurrent requests could both read
    // isProcessed=false and each create a duplicate contact + lead. This
    // conditional update only flips the flag if it is still false, and the
    // affected-row count tells us whether THIS request won the claim.
    const claim = await prisma.widgetInquiry.updateMany({
      where: { id, isProcessed: false },
      data: { isProcessed: true },
    });

    if (claim.count === 0) {
      // Another concurrent request already claimed/processed this inquiry.
      return { success: false as const, error: "Inquiry already processed" };
    }

    // Split name into firstName / lastName
    const nameParts = inquiry.name.trim().split(/\s+/);
    const firstName = nameParts[0] || inquiry.name;
    const lastName = nameParts.slice(1).join(" ") || "";

    // Check if contact already exists by email — exclude soft-deleted contacts
    // so we never attach a new lead to an invisible (trashed) contact.
    let contact = await prisma.contact.findFirst({
      where: { email: inquiry.email, deletedAt: null },
    });

    if (!contact) {
      // Create new contact
      contact = await prisma.contact.create({
        data: {
          firstName,
          lastName: lastName || firstName,
          email: inquiry.email,
          phone: inquiry.phone || null,
          type: "INDIVIDUAL",
          notes: `Created from widget inquiry: ${inquiry.message}`,
          enquirySource: "LEAD_FORM", // arrived through a form we host
        },
      }).catch(async (e) => {
        // Conversion failed before producing a lead — release our claim so the
        // inquiry can be retried instead of being stuck as processed-with-no-lead.
        await prisma.widgetInquiry
          .updateMany({ where: { id, isProcessed: true }, data: { isProcessed: false } })
          .catch(() => {});
        throw e;
      });
    }

    // Create the lead through the SAME path manual leads use (createLead) so a
    // web inquiry gets a real score, a 15-min SLA firstContactDue, a default
    // next-business-day followUpDate, assignment-rule evaluation, and the
    // LEAD_CREATED intake workflow — instead of becoming an invisible, unscored,
    // never-followed-up cold lead. Drop a past eventDate (createLead validates
    // it can't be in the past) rather than failing the whole conversion.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate =
      inquiry.eventDate && inquiry.eventDate.getTime() >= today.getTime()
        ? inquiry.eventDate
        : null;

    const leadResult = await createLead({
      title: `Widget Inquiry - ${inquiry.name}`,
      contactId: contact.id,
      source: "WEBSITE",
      eventType: inquiry.eventType || "",
      eventDate,
      guestCount: inquiry.guestCount ?? null,
      description: inquiry.message,
    });

    if (!leadResult.success) {
      // Lead creation failed — release the claim so this inquiry isn't left
      // marked processed without an associated lead (and can be retried).
      await prisma.widgetInquiry
        .updateMany({ where: { id, isProcessed: true }, data: { isProcessed: false } })
        .catch(() => {});
      return {
        success: false as const,
        error: leadResult.error || "Failed to create lead from inquiry",
      };
    }
    const lead = leadResult.data;

    // Inquiry was already atomically marked processed via the claim above.

    await logActivity({
      userId: session.user.id as string,
      action: "processed",
      entityType: "WidgetInquiry",
      entityId: id,
      changes: { contactId: contact.id, leadId: lead.id },
    });

    revalidatePath("/inquiries");
    revalidatePath("/leads");
    revalidatePath("/contacts");

    return {
      success: true as const,
      data: serialize({ inquiry: { id }, contact, lead }),
    };
  } catch (error) {
    console.error("[PROCESS_INQUIRY_ERROR]", error);
    return { success: false as const, error: "Failed to process inquiry" };
  }
}

// ============================================================
// Mark Inquiry as Processed (without creating Contact/Lead)
// ============================================================

export async function markInquiryProcessed(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "widget:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const inquiry = await prisma.widgetInquiry.findUnique({
      where: { id },
    });

    if (!inquiry) {
      return { success: false as const, error: "Inquiry not found" };
    }

    const updated = await prisma.widgetInquiry.update({
      where: { id },
      data: { isProcessed: true },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "marked_processed",
      entityType: "WidgetInquiry",
      entityId: id,
    });

    revalidatePath("/inquiries");

    return { success: true as const, data: serialize(updated) };
  } catch (error) {
    console.error("[MARK_INQUIRY_PROCESSED_ERROR]", error);
    return { success: false as const, error: "Failed to mark inquiry as processed" };
  }
}

// ============================================================
// Delete Inquiry
// ============================================================

export async function deleteInquiry(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "widget:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const inquiry = await prisma.widgetInquiry.findUnique({
      where: { id },
    });

    if (!inquiry) {
      return { success: false as const, error: "Inquiry not found" };
    }

    await prisma.widgetInquiry.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "WidgetInquiry",
      entityId: id,
    });

    revalidatePath("/inquiries");

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_INQUIRY_ERROR]", error);
    return { success: false as const, error: "Failed to delete inquiry" };
  }
}
