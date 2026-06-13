"use server";

import { auth } from "@/../auth";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { leadSchema, type LeadInput } from "@/schemas/lead.schema";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";
import { runLeadIntake, leadSlaDeadline } from "@/lib/lead-pipeline";
import { after } from "next/server";
// LeadStatus enum values matching Prisma schema
type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";

// Roles a lead can be assigned to (mirrors the new/edit form's user list).
const ASSIGNABLE_ROLES = ["SALES_EXEC", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"];

// Returns an error string if the id is not a real, active, assignable user; null if OK.
async function assigneeInvalid(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!u || !u.isActive || !ASSIGNABLE_ROLES.includes(u.role)) {
    return "Assigned user is invalid or not assignable.";
  }
  return null;
}

// ============================================================
// Get Leads (Paginated + Filters)
// ============================================================

export async function getLeads(params?: {
  search?: string;
  status?: string;
  source?: string;
  page?: number;
  limit?: number;
  sort?: "score" | "recent"; // default: score (hot-lead worklist)
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

    // Build where clause — exclude soft-deleted records by default
    const where: Record<string, unknown> = { deletedAt: null };

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
        // Default to a hot-lead worklist: highest score first so reps work the
        // best opportunities before cold ones. "recent" restores newest-first.
        orderBy:
          params?.sort === "recent"
            ? { createdAt: "desc" }
            : [{ score: "desc" }, { createdAt: "desc" }],
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

    // Validate an explicit assignee: must be a real, active, sales-facing user
    // (otherwise a tampered id would silently FK-fail or bypass the role list).
    if (leadData.assignedToId) {
      const bad = await assigneeInvalid(leadData.assignedToId);
      if (bad) return { success: false as const, error: bad };
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
        preferredVenueId: leadData.preferredVenueId || null,
        slot: leadData.slot || null,
        vegNonVeg: leadData.vegNonVeg || null,
        perPlateBudget: leadData.perPlateBudget || null,
        description: leadData.description || null,
        score,
        firstContactDue: leadSlaDeadline(),
        ...(leadData.assignedToId ? { assignedToId: leadData.assignedToId } : {}),
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

    // Auto-assign by rules ONLY when the sales rep didn't pick an assignee.
    try {
      const assignedUserId = leadData.assignedToId
        ? null
        : await evaluateAssignmentRules({
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

    // Intake: LEAD_CREATED workflows (instant email ack + "call now" task)
    // AND auto-enrolment into matching nurture cadences. `after()` runs it
    // once the response is sent while keeping the function alive to finish.
    after(async () => {
      try {
        await runLeadIntake({
          lead: {
            id: lead.id,
            contactId: lead.contactId,
            source: lead.source,
            eventType: lead.eventType,
            status: lead.status,
            guestCount: lead.guestCount,
            score: lead.score,
            estimatedValue: leadData.estimatedValue ?? null,
          },
          triggeredByUserId: session.user.id as string,
        });
      } catch (e) {
        console.error("[LEAD_INTAKE_ERROR]", e);
      }
    });

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
    if (data.preferredVenueId !== undefined)
      updateData.preferredVenueId = data.preferredVenueId || null;
    if (data.slot !== undefined) updateData.slot = data.slot || null;
    if (data.vegNonVeg !== undefined)
      updateData.vegNonVeg = data.vegNonVeg || null;
    if (data.perPlateBudget !== undefined)
      updateData.perPlateBudget = data.perPlateBudget || null;
    if (data.description !== undefined)
      updateData.description = data.description || null;
    if (data.assignedToId !== undefined) {
      if (data.assignedToId) {
        const bad = await assigneeInvalid(data.assignedToId);
        if (bad) return { success: false as const, error: bad };
      }
      updateData.assignedToId = data.assignedToId || null;
    }
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

    // Soft-delete: set deletedAt instead of removing the row.
    // A cron job (or admin action) purges leads older than 30 days.
    await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Lead",
      entityId: id,
    });

    revalidatePath("/leads");
    revalidatePath("/contacts");
    revalidatePath("/settings/trash");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to delete lead" };
  }
}

// ============================================================
// Restore Lead (from trash)
// ============================================================

export async function restoreLead(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.lead.update({
      where: { id },
      data: { deletedAt: null },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "restored",
      entityType: "Lead",
      entityId: id,
    });

    revalidatePath("/leads");
    revalidatePath("/settings/trash");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[RESTORE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to restore lead" };
  }
}

// ============================================================
// Permanently delete (admin only — bypasses 30-day retention)
// ============================================================

export async function purgeLead(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    const role = (session.user as { role?: string }).role ?? "";
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // FK safety: a lead with a converted deal cannot be hard-deleted
    // without orphaning the deal. Refuse rather than throw a DB error.
    const existing = await prisma.lead.findUnique({
      where: { id },
      include: { deal: { select: { id: true } }, quotes: { select: { id: true } } },
    });
    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }
    if (existing.deal || existing.quotes.length > 0) {
      return {
        success: false as const,
        error:
          "Cannot permanently delete a lead with a linked deal or quote. Delete those first.",
      };
    }

    await prisma.lead.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "purged",
      entityType: "Lead",
      entityId: id,
    });

    revalidatePath("/settings/trash");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[PURGE_LEAD_ERROR]", error);
    return { success: false as const, error: "Failed to purge lead" };
  }
}

// ============================================================
// Update Lead Status
// ============================================================

// SCRM-001: keep the Pipeline in sync with a lead's status.
// A lead enters the pipeline (auto-creates a Deal at the entry stage) the first time it
// reaches a pipeline-worthy status, and Won/Lost move that deal to the won/lost stage.
async function syncPipelineDealForLead(
  tx: Prisma.TransactionClient,
  leadId: string,
  status: LeadStatus,
  lead: { title: string; estimatedValue: unknown; assignedToId: string | null }
) {
  const entryStage = async () =>
    (await tx.pipelineStage.findFirst({ where: { isDefault: true }, select: { id: true } })) ??
    (await tx.pipelineStage.findFirst({ orderBy: { order: "asc" }, select: { id: true } }));

  const OPEN_STATUSES: LeadStatus[] = ["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"];
  if (OPEN_STATUSES.includes(status) || status === "WON") {
    const existingDeal = await tx.deal.findUnique({
      where: { leadId },
      select: { id: true, stage: { select: { isWonStage: true, isLostStage: true } } },
    });
    if (!existingDeal) {
      const entry = await entryStage();
      if (entry) {
        const last = await tx.deal.findFirst({ where: { stageId: entry.id }, orderBy: { orderInStage: "desc" }, select: { orderInStage: true } });
        await tx.deal.create({
          data: {
            title: lead.title,
            leadId,
            stageId: entry.id,
            value: (lead.estimatedValue as number | null) ?? 0,
            assignedToId: lead.assignedToId,
            orderInStage: (last?.orderInStage ?? -1) + 1,
          },
        });
      }
    } else if (status !== "WON" && (existingDeal.stage?.isWonStage || existingDeal.stage?.isLostStage)) {
      // Re-opening a previously closed deal: move it back to the entry stage and clear
      // the terminal dates so pipeline metrics stop counting it as won/lost (audit fix).
      const entry = await entryStage();
      if (entry) {
        await tx.deal.update({ where: { id: existingDeal.id }, data: { stageId: entry.id, wonDate: null, lostDate: null } });
      }
    }
  }
  if (status === "WON" || status === "LOST") {
    const stage = await tx.pipelineStage.findFirst({
      where: status === "WON" ? { isWonStage: true } : { isLostStage: true },
      select: { id: true },
    });
    const deal = await tx.deal.findUnique({ where: { leadId }, select: { id: true } });
    if (stage && deal) {
      await tx.deal.update({
        where: { id: deal.id },
        data: status === "WON" ? { stageId: stage.id, wonDate: new Date(), lostDate: null } : { stageId: stage.id, lostDate: new Date(), wonDate: null },
      });
    }
  }
}

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

    // A lead can't be marked Won without an owner (SCRM-004) — accountability for the close.
    if (status === "WON" && !existing.assignedToId) {
      return { success: false as const, error: "Assign an owner to this lead before marking it Won." };
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

    // SCRM-001: a lead enters the Pipeline once it's Qualified (auto-create a deal), and
    // its Won/Lost / re-open state keeps the deal's stage in sync. Status change + deal
    // sync commit together so the lead and its pipeline deal can never diverge (audit fix).
    const lead = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({ where: { id }, data: { status, score } });
      await syncPipelineDealForLead(tx, id, status, existing);
      return updated;
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Lead",
      entityId: lead.id,
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    revalidatePath("/pipeline");
    return { success: true as const, data: serialize(lead) };
  } catch (error) {
    console.error("[UPDATE_LEAD_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update lead status" };
  }
}
