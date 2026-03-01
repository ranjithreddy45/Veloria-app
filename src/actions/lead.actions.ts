"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { leadSchema, type LeadInput } from "@/schemas/lead.schema";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";
// LeadStatus enum values matching Prisma schema
type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";

// ============================================================
// Get Leads (Paginated + Filters)
// ============================================================

export async function getLeads(params?: {
  search?: string;
  status?: string;
  source?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        {
          contact: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.source) {
      where.source = params.source;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(leads),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_LEADS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch leads" };
  }
}

// ============================================================
// Get Single Lead
// ============================================================

export async function getLead(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        contact: true,
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            probability: true,
            stage: { select: { name: true, color: true } },
          },
        },
      },
    });

    if (!lead) {
      return { success: false as const, error: "Lead not found" };
    }

    return { success: true as const, data: serialize(lead) };
  } catch (error) {
    console.error("[GET_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to fetch lead" };
  }
}

// ============================================================
// Create Lead
// ============================================================

export async function createLead(data: LeadInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = leadSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const leadData = parsed.data;

    // Verify the contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: leadData.contactId },
    });

    if (!contact) {
      return { success: false as const, error: "Contact not found" };
    }

    // Calculate lead score
    const score = calculateLeadScore({
      estimatedValue: leadData.estimatedValue,
      eventDate: leadData.eventDate,
      source: leadData.source,
      guestCount: leadData.guestCount,
      status: "NEW",
    });

    const lead = await prisma.lead.create({
      data: {
        title: leadData.title,
        contactId: leadData.contactId,
        source: leadData.source,
        eventType: leadData.eventType || null,
        eventDate: leadData.eventDate || null,
        guestCount: leadData.guestCount || null,
        estimatedValue: leadData.estimatedValue || null,
        description: leadData.description || null,
        score,
        createdById: session.user.id as string,
      },
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Lead",
      entityId: lead.id,
    });

    // Auto-assign lead based on assignment rules
    try {
      const assignedUserId = await evaluateAssignmentRules({
        source: lead.source,
        eventType: lead.eventType ?? undefined,
        status: lead.status,
        score: lead.score,
      });

      if (assignedUserId) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { assignedToId: assignedUserId },
        });

        // Notify assigned user
        notify({
          userId: assignedUserId,
          type: "LEAD_ASSIGNED",
          title: "New Lead Auto-Assigned",
          message: `Lead "${lead.title}" has been automatically assigned to you.`,
          actionUrl: `/leads/${lead.id}`,
        });
      }
    } catch (e) {
      // Don't fail lead creation if assignment rules fail
      console.error("[AUTO_ASSIGN_ERROR]", e);
    }

    revalidatePath("/leads");
    revalidatePath("/contacts");
    return { success: true as const, data: serialize(lead) };
  } catch (error) {
    console.error("[CREATE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to create lead" };
  }
}

// ============================================================
// Update Lead
// ============================================================

export async function updateLead(
  id: string,
  data: Partial<LeadInput> & { assignedToId?: string | null; followUpDate?: Date | null; lostReason?: string | null }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.contactId !== undefined) updateData.contactId = data.contactId;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.eventType !== undefined)
      updateData.eventType = data.eventType || null;
    if (data.eventDate !== undefined)
      updateData.eventDate = data.eventDate || null;
    if (data.guestCount !== undefined)
      updateData.guestCount = data.guestCount || null;
    if (data.estimatedValue !== undefined)
      updateData.estimatedValue = data.estimatedValue || null;
    if (data.description !== undefined)
      updateData.description = data.description || null;
    if (data.assignedToId !== undefined)
      updateData.assignedToId = data.assignedToId || null;
    if (data.followUpDate !== undefined)
      updateData.followUpDate = data.followUpDate || null;
    if (data.lostReason !== undefined)
      updateData.lostReason = data.lostReason || null;

    // Recalculate lead score with merged data
    const mergedForScoring = {
      estimatedValue:
        data.estimatedValue !== undefined
          ? data.estimatedValue
          : existing.estimatedValue
            ? Number(existing.estimatedValue)
            : null,
      eventDate:
        data.eventDate !== undefined ? data.eventDate : existing.eventDate,
      followUpDate:
        data.followUpDate !== undefined
          ? data.followUpDate
          : existing.followUpDate,
      source: data.source ?? existing.source,
      guestCount: data.guestCount ?? existing.guestCount,
      status: existing.status,
      createdAt: existing.createdAt,
    };

    updateData.score = calculateLeadScore(mergedForScoring);

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Lead",
      entityId: lead.id,
    });

    // Notify assigned user if lead was re-assigned
    if (data.assignedToId && lead.assignedTo && data.assignedToId !== session.user.id) {
      notify({
        userId: data.assignedToId,
        type: "LEAD_ASSIGNED",
        title: "Lead Assigned to You",
        message: `You've been assigned the lead "${lead.title}".`,
        actionUrl: `/leads/${lead.id}`,
      });
    }

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return { success: true as const, data: serialize(lead) };
  } catch (error) {
    console.error("[UPDATE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to update lead" };
  }
}

// ============================================================
// Delete Lead
// ============================================================

export async function deleteLead(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { deal: { select: { id: true } } },
    });

    if (!lead) {
      return { success: false as const, error: "Lead not found" };
    }

    if (lead.deal) {
      return {
        success: false as const,
        error:
          "Cannot delete a lead that has been converted to a deal. Delete the deal first.",
      };
    }

    await prisma.lead.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Lead",
      entityId: id,
    });

    revalidatePath("/leads");
    revalidatePath("/contacts");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to delete lead" };
  }
}

// ============================================================
// Update Lead Status
// ============================================================

export async function updateLeadStatus(id: string, status: LeadStatus) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }

    // Recalculate score with new status
    const score = calculateLeadScore({
      estimatedValue: existing.estimatedValue
        ? Number(existing.estimatedValue)
        : null,
      eventDate: existing.eventDate,
      followUpDate: existing.followUpDate,
      source: existing.source,
      guestCount: existing.guestCount,
      status,
      createdAt: existing.createdAt,
    });

    const lead = await prisma.lead.update({
      where: { id },
      data: { status, score },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Lead",
      entityId: lead.id,
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return { success: true as const, data: serialize(lead) };
  } catch (error) {
    console.error("[UPDATE_LEAD_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update lead status" };
  }
}
