"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

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

    // Split name into firstName / lastName
    const nameParts = inquiry.name.trim().split(/\s+/);
    const firstName = nameParts[0] || inquiry.name;
    const lastName = nameParts.slice(1).join(" ") || "";

    // Check if contact already exists by email
    let contact = await prisma.contact.findFirst({
      where: { email: inquiry.email },
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
        },
      });
    }

    // Create a lead from the inquiry
    const lead = await prisma.lead.create({
      data: {
        title: `Widget Inquiry - ${inquiry.name}`,
        contactId: contact.id,
        source: "WEBSITE",
        eventType: inquiry.eventType || null,
        eventDate: inquiry.eventDate || null,
        guestCount: inquiry.guestCount || null,
        description: inquiry.message,
        createdById: session.user.id as string,
      },
    });

    // Mark inquiry as processed
    await prisma.widgetInquiry.update({
      where: { id },
      data: { isProcessed: true },
    });

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
