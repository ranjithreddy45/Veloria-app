"use server";

import { auth } from "@/../auth";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { leadSchema, type LeadInput } from "@/schemas/lead.schema";
import { isSafeReceiptDataUrl } from "@/lib/sales/receipt";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";
import { runLeadIntake, leadSlaDeadline } from "@/lib/lead-pipeline";
import { after } from "next/server";
// LeadStatus enum values matching Prisma schema
type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";

// Allowed filter values — an invalid enum string passed straight to Prisma throws
// a generic error, so we validate against these sets and ignore unknown values.
const LEAD_STATUS_VALUES = new Set<string>([
  "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST",
]);
const LEAD_SOURCE_VALUES = new Set<string>([
  "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "PHONE_INQUIRY", "EMAIL",
  "EVENT", "PARTNER", "ADVERTISEMENT", "FACEBOOK_ADS", "GOOGLE_ADS", "INDIAMART",
  "JUSTDIAL", "WEDMEGOOD", "INSTAGRAM", "WHATSAPP", "OTHER",
]);

// Roles a lead can be assigned to (mirrors the new/edit form's user list).
const ASSIGNABLE_ROLES = ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"];

// Next business day (skips Sat/Sun) at 09:00 local — used as a default
// follow-up when a lead is created without one, so active leads always surface
// in the Sales Follow-ups queue instead of silently falling out of it (S-11).
function nextBusinessDay(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  // Sat (6) -> Mon, Sun (0) -> Mon
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

// Keep only safe image data-URLs (base64 image/PDF). Anything else — a bare
// string, an https link, a data:text/html payload — is dropped so a tampered
// client can't write an unsafe value into Lead.images. Caps the count too.
function sanitizeLeadImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((v): v is string => typeof v === "string")
    .filter((v) => isSafeReceiptDataUrl(v) && v.startsWith("data:image/"))
    .slice(0, 24);
}

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

    const page = Math.max(1, Math.floor(params?.page ?? 1));
    // Hard-cap page size: callers (e.g. the leads page) pass large limits like 500,
    // which with nested contact+assignedTo includes can bloat memory / slow the
    // response on accounts with thousands of leads. Bound it to a sane ceiling.
    const limit = Math.min(Math.max(1, Math.floor(params?.limit ?? 50)), 100);
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

    // Validate enum filters before querying — an unknown string would otherwise
    // make Prisma throw and surface as a generic "Failed to fetch leads".
    if (params?.status && LEAD_STATUS_VALUES.has(params.status)) {
      where.status = params.status;
    }

    if (params?.source && LEAD_SOURCE_VALUES.has(params.source)) {
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
// Get Lead Stats (aggregate KPIs — not capped by pagination)
// ============================================================

// Header KPIs must reflect ALL leads, not the paginated slice the list renders,
// so they're computed with DB aggregates here. `total` = every active lead;
// `pipelineValue` = Σ estimatedValue over OPEN statuses only (excludes WON/LOST),
// matching the "Pipeline value" definition used elsewhere (S-1).
export async function getLeadStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [total, openAgg] = await Promise.all([
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.lead.aggregate({
        where: { deletedAt: null, status: { notIn: ["WON", "LOST"] } },
        _sum: { estimatedValue: true },
      }),
    ]);

    return {
      success: true as const,
      data: {
        total,
        pipelineValue: Number(openAgg._sum.estimatedValue ?? 0),
      },
    };
  } catch (error) {
    console.error("[GET_LEAD_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch lead stats" };
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

    const lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
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
        salesQuotations: {
          select: {
            id: true,
            quoteNumber: true,
            version: true,
            status: true,
            grandTotal: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
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

export async function createLead(data: LeadInput & { images?: string[] }) {
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
        images: sanitizeLeadImages(data.images),
        score,
        firstContactDue: leadSlaDeadline(),
        // Default next follow-up so the lead lands in the Follow-ups queue (S-11).
        followUpDate: nextBusinessDay(),
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
  data: Partial<LeadInput> & { assignedToId?: string | null; followUpDate?: Date | null; lostReason?: string | null; images?: string[] }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.lead.findUnique({
      where: { id },
      include: { deal: { select: { id: true } } },
    });
    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }

    // Server-side guards (updateLead doesn't run the full leadSchema). Reject
    // negative numbers (S-8) and an event date before the lead's createdAt (S-6).
    if (data.guestCount != null && (!Number.isInteger(data.guestCount) || data.guestCount < 1)) {
      return { success: false as const, error: "Guest count must be a whole number of at least 1." };
    }
    if (data.estimatedValue != null && Number(data.estimatedValue) < 0) {
      return { success: false as const, error: "Estimated value cannot be negative." };
    }
    if (data.eventDate) {
      const ev = new Date(data.eventDate);
      const created = new Date(existing.createdAt);
      const createdDay = new Date(created); createdDay.setHours(0, 0, 0, 0);
      if (!Number.isNaN(ev.getTime()) && ev.getTime() < createdDay.getTime()) {
        return { success: false as const, error: "Event date cannot be before the lead was created." };
      }
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
    if (data.images !== undefined)
      updateData.images = sanitizeLeadImages(data.images);
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

    // Keep the linked pipeline Deal's money in sync: when estimatedValue actually
    // changes on a lead that already has a Deal, update deal.value in the SAME
    // transaction so the lead and its pipeline deal can never report different
    // amounts. Decimal compare via Number to avoid Prisma.Decimal identity quirks.
    const newEstimated =
      data.estimatedValue !== undefined ? data.estimatedValue || null : undefined;
    const estimatedChanged =
      newEstimated !== undefined &&
      Number(newEstimated ?? 0) !==
        Number(existing.estimatedValue ? Number(existing.estimatedValue) : 0);
    const shouldSyncDeal = !!existing.deal && estimatedChanged;

    const lead = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
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
      if (shouldSyncDeal) {
        await tx.deal.update({
          where: { id: existing.deal!.id },
          data: { value: Number(newEstimated ?? 0) },
        });
      }
      return updated;
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
    if (shouldSyncDeal) revalidatePath("/pipeline");
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

// FEAT-S-005 — the rep's active Sales leads bucketed by follow-up date into
// Overdue / Today / Upcoming. Admins see the whole team; reps see their own.
export async function getSalesFollowupQueue(): Promise<
  { success: true; data: { overdue: unknown[]; today: unknown[]; upcoming: unknown[] } } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role, "leads:read")) return { success: false, error: "Insufficient permissions" };
  const role = session.user.role;
  const isManager = role === "ADMIN" || role === "SUPER_ADMIN" || role === "SALES_HEAD";
  const where: Prisma.LeadWhereInput = {
    status: { notIn: ["WON", "LOST"] },
    followUpDate: { not: null },
  };
  if (!isManager) where.assignedToId = session.user.id as string;

  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true, title: true, status: true, estimatedValue: true, followUpDate: true,
      contact: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { followUpDate: "asc" },
    take: 300,
  });

  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  const overdue: typeof leads = [], today: typeof leads = [], upcoming: typeof leads = [];
  for (const l of leads) {
    const t = l.followUpDate!.getTime();
    if (t < startToday.getTime()) overdue.push(l);
    else if (t <= endToday.getTime()) today.push(l);
    else upcoming.push(l);
  }
  return { success: true, data: serialize({ overdue, today, upcoming }) as { overdue: unknown[]; today: unknown[]; upcoming: unknown[] } };
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

    // Keep active leads visible in the Follow-ups queue: if a lead moves to an
    // open/working status and still has no follow-up scheduled, default one to
    // the next business day so it never silently drops out (S-11).
    const statusData: { status: LeadStatus; score: number; followUpDate?: Date } = { status, score };
    const OPEN_FOR_FOLLOWUP: LeadStatus[] = ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"];
    if (OPEN_FOR_FOLLOWUP.includes(status) && !existing.followUpDate) {
      statusData.followUpDate = nextBusinessDay();
    }

    // SCRM-001: a lead enters the Pipeline once it's Qualified (auto-create a deal), and
    // its Won/Lost / re-open state keeps the deal's stage in sync. Status change + deal
    // sync commit together so the lead and its pipeline deal can never diverge (audit fix).
    const lead = await prisma.$transaction(async (tx) => {
      // Re-assert the "Won needs an owner" guard against the row inside the
      // transaction. The earlier check (line ~828) ran on a read taken outside
      // the transaction, so a concurrent un-assign could otherwise let a lead be
      // marked Won with no owner (SCRM-004). This catches that race atomically.
      if (status === "WON") {
        const current = await tx.lead.findUnique({
          where: { id },
          select: { assignedToId: true },
        });
        if (!current) {
          throw new Error("LEAD_NOT_FOUND");
        }
        if (!current.assignedToId) {
          throw new Error("WON_NEEDS_OWNER");
        }
      }
      const updated = await tx.lead.update({ where: { id }, data: statusData });
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
    if (error instanceof Error && error.message === "WON_NEEDS_OWNER") {
      return { success: false as const, error: "Assign an owner to this lead before marking it Won." };
    }
    if (error instanceof Error && error.message === "LEAD_NOT_FOUND") {
      return { success: false as const, error: "Lead not found" };
    }
    console.error("[UPDATE_LEAD_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update lead status" };
  }
}

// ============================================================
// Convert Lead → Deal (explicit user action from the lead detail).
// Reuses syncPipelineDealForLead so the created Deal is identical to the one the
// Qualified-status bridge produces (same entry stage, value, owner, ordering).
// If the lead is still NEW/CONTACTED we promote it to QUALIFIED as part of the
// same transaction — a Deal only exists for qualified-or-later leads (SCRM-001).
// Idempotent: if a Deal already exists we return it rather than erroring.
// ============================================================
export async function convertLeadToDeal(leadId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Same guard family as other lead mutations, plus pipeline write (creates a Deal).
    if (
      !hasPermission(session.user.role, "leads:update") ||
      !hasPermission(session.user.role, "pipeline:update")
    ) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      include: { deal: { select: { id: true } } },
    });
    if (!existing) {
      return { success: false as const, error: "Lead not found" };
    }

    // Already converted — surface the existing deal, don't create a second one.
    if (existing.deal) {
      return {
        success: true as const,
        data: { dealId: existing.deal.id, alreadyExisted: true },
      };
    }

    if (existing.status === "LOST") {
      return { success: false as const, error: "A lost lead can't be converted to a deal." };
    }

    // A Deal exists only for QUALIFIED-or-later leads; promote NEW/CONTACTED so the
    // pipeline sync will actually create the deal. WON keeps its status.
    const PROMOTE_FROM: LeadStatus[] = ["NEW", "CONTACTED"];
    const targetStatus: LeadStatus = PROMOTE_FROM.includes(existing.status as LeadStatus)
      ? "QUALIFIED"
      : (existing.status as LeadStatus);

    const dealId = await prisma.$transaction(async (tx) => {
      if (targetStatus !== existing.status) {
        const score = calculateLeadScore({
          estimatedValue: existing.estimatedValue ? Number(existing.estimatedValue) : null,
          eventDate: existing.eventDate,
          followUpDate: existing.followUpDate,
          source: existing.source,
          guestCount: existing.guestCount,
          status: targetStatus,
          createdAt: existing.createdAt,
        });
        await tx.lead.update({ where: { id: leadId }, data: { status: targetStatus, score } });
      }
      await syncPipelineDealForLead(tx, leadId, targetStatus, existing);
      const deal = await tx.deal.findUnique({ where: { leadId }, select: { id: true } });
      if (!deal) {
        // Only happens when no pipeline stage is configured — surface a clear error.
        throw new Error("NO_PIPELINE_STAGE");
      }
      return deal.id;
    });

    await logActivity({
      userId: session.user.id as string,
      action: "converted_to_deal",
      entityType: "Lead",
      entityId: leadId,
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/pipeline");
    return { success: true as const, data: { dealId, alreadyExisted: false } };
  } catch (error) {
    if (error instanceof Error && error.message === "NO_PIPELINE_STAGE") {
      return {
        success: false as const,
        error: "No pipeline stage is configured. Set up your pipeline stages first.",
      };
    }
    console.error("[CONVERT_LEAD_TO_DEAL_ERROR]", error);
    return { success: false as const, error: "Failed to convert lead to deal" };
  }
}

// ============================================================
// Backfill: ensure every open/won lead has a pipeline Deal (audit S-9).
// The lead→Deal bridge only fires on updateLeadStatus, so leads that were
// seeded or imported directly into an open/won status never produced a Deal —
// which is why the Pipeline board looked empty while Leads had records. This
// idempotent action (managers only) creates the missing Deals using the same
// sync logic; running it twice is a no-op.
// ============================================================
export async function backfillLeadPipeline() {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role, "pipeline:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Only statuses that syncPipelineDealForLead actually creates a deal for.
    // LOST is excluded: the sync only moves an EXISTING deal to the lost stage and
    // never creates one for a lost-without-deal lead, so scanning LOST here would
    // inflate the "scanned" count with leads that can never produce a deal.
    const PIPELINE_STATUSES: LeadStatus[] = ["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"];
    const leads = await prisma.lead.findMany({
      where: { status: { in: PIPELINE_STATUSES }, deletedAt: null, deal: { is: null } },
      select: { id: true, title: true, estimatedValue: true, assignedToId: true, status: true },
    });

    let created = 0;
    for (const l of leads) {
      await prisma.$transaction(async (tx) => {
        const before = await tx.deal.findUnique({ where: { leadId: l.id }, select: { id: true } });
        await syncPipelineDealForLead(tx, l.id, l.status, { title: l.title, estimatedValue: l.estimatedValue, assignedToId: l.assignedToId });
        const after = await tx.deal.findUnique({ where: { leadId: l.id }, select: { id: true } });
        if (!before && after) created++;
      });
    }

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return { success: true as const, data: { scanned: leads.length, created } };
  } catch (error) {
    console.error("[BACKFILL_LEAD_PIPELINE_ERROR]", error);
    return { success: false as const, error: "Failed to backfill pipeline deals" };
  }
}
