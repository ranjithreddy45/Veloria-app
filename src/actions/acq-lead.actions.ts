"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import {
  normalizeMobile,
  isValidMobile,
  evaluateQualification,
  canDisqualify,
  addWorkingHours,
  type QualificationPayload,
} from "@/lib/acq/domain";
import { getAcqConfig } from "@/lib/acq/config";
import { acqCan, acqHasAnyAccess } from "@/lib/acq/rbac";
import {
  ACQ_LEAD_SOURCE,
  ACQ_OWNER_TYPE,
  ACQ_PROPERTY_TYPE,
  ACQ_PROPERTY_STAGE,
  ACQ_SEATING_RANGE,
  ACQ_DISQUALIFY_REASON,
  type AcqDisqualifyReason,
} from "@/lib/acq/constants";
import { z } from "zod";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const leadInputSchema = z.object({
  ownerName: z.string().min(1).max(200),
  mobilePrimary: z.string().min(6).max(20).refine(isValidMobile, "Enter a valid mobile number (10–15 digits)."),
  mobileAlternate: z.string().max(20).refine((v) => !v || isValidMobile(v), "Enter a valid alternate mobile number.").optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  propertyName: z.string().min(1).max(200),
  propertyType: z.enum(ACQ_PROPERTY_TYPE),
  city: z.string().min(1).max(100),
  locality: z.string().min(1).max(100),
  seatingTheatre: z.number().int().nonnegative().optional(),
  seatingFloating: z.number().int().nonnegative().optional(),
  seatingRange: z.enum(ACQ_SEATING_RANGE).optional(),
  propertyStage: z.enum(ACQ_PROPERTY_STAGE).optional(),
  notes: z.string().max(5000).optional().or(z.literal("")),
  leadSource: z.enum(ACQ_LEAD_SOURCE),
  ownerType: z.enum(ACQ_OWNER_TYPE),
  bdExecutiveId: z.string().optional(),
});
export type AcqLeadInput = z.infer<typeof leadInputSchema>;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

// ------------------------------------------------------------
// List / get
// ------------------------------------------------------------
export async function getAcqLeads(filters?: {
  status?: string;
  city?: string;
  bdExecutiveId?: string;
}): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const where: Record<string, unknown> = { deletedAt: null };
  if (filters?.status) where.status = filters.status;
  if (filters?.city) where.city = filters.city;
  if (filters?.bdExecutiveId) where.bdExecutiveId = filters.bdExecutiveId;

  const leads = await prisma.acqLead.findMany({
    where,
    include: { bdExecutive: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return { success: true, data: serialize(leads) as unknown[] };
}

export async function getAcqLead(id: string): Promise<Result<unknown>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const lead = await prisma.acqLead.findFirst({
    where: { id, deletedAt: null },
    include: {
      bdExecutive: { select: { id: true, name: true } },
      deal: { select: { id: true, stage: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!lead) return { success: false, error: "Lead not found" };

  // Activity timeline — stage transitions for this lead, newest first.
  const transitions = await prisma.acqStageTransition.findMany({
    where: { entity: "LEAD", entityId: id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, data: serialize({ ...lead, timeline: transitions }) };
}

// ------------------------------------------------------------
// Create (with dedup §3.1 / §5.1)
// ------------------------------------------------------------
export async function createAcqLead(input: AcqLeadInput): Promise<
  Result<{ id: string }> | { success: false; error: string; duplicateOf?: unknown }
> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const parsed = leadInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Validation failed" };
  const d = parsed.data;

  const mobile = normalizeMobile(d.mobilePrimary);

  // Dedup over non-deleted, non-disqualified leads (mobile OR name+locality).
  const dup = await prisma.acqLead.findFirst({
    where: {
      deletedAt: null,
      status: { not: "DISQUALIFIED" },
      OR: [
        { mobilePrimary: mobile },
        {
          AND: [
            { propertyName: { equals: d.propertyName, mode: "insensitive" } },
            { locality: { equals: d.locality, mode: "insensitive" } },
          ],
        },
      ],
    },
    include: { bdExecutive: { select: { name: true } } },
  });
  if (dup) {
    return {
      success: false,
      error: `This venue already exists as a lead (${dup.propertyName}, ${dup.locality}) owned by ${dup.bdExecutive?.name ?? "a BD exec"}.`,
      duplicateOf: serialize(dup),
    };
  }

  const cfg = await getAcqConfig();
  const now = new Date();
  const firstContactDue = addWorkingHours(now, cfg.LEAD_FIRST_CONTACT_SLA_HOURS);

  const lead = await prisma.acqLead.create({
    data: {
      ownerName: d.ownerName,
      mobilePrimary: mobile,
      mobileAlternate: d.mobileAlternate ? normalizeMobile(d.mobileAlternate) : null,
      email: d.email || null,
      propertyName: d.propertyName,
      propertyType: d.propertyType,
      city: d.city,
      locality: d.locality,
      seatingTheatre: d.seatingTheatre ?? null,
      seatingFloating: d.seatingFloating ?? null,
      seatingRange: d.seatingRange ?? null,
      propertyStage: d.propertyStage ?? null,
      notes: d.notes || null,
      leadSource: d.leadSource,
      ownerType: d.ownerType,
      bdExecutiveId: d.bdExecutiveId || user.id,
      status: "NEW",
      firstContactDue,
    },
    select: { id: true },
  });

  await prisma.acqStageTransition.create({
    data: { entity: "LEAD", entityId: lead.id, fromState: null, toState: "NEW", actorId: user.id },
  });

  revalidatePath("/bd/leads");
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id: lead.id } };
}

// ------------------------------------------------------------
// Update fields / status (§5.1)
// ------------------------------------------------------------
export async function updateAcqLead(
  id: string,
  patch: {
    status?: "NEW" | "CONTACTED";
    nextFollowupAt?: string | null;
    incrementContactAttempt?: boolean;
    mobileAlternate?: string;
    email?: string;
  }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const lead = await prisma.acqLead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) return { success: false, error: "Lead not found" };

  const data: Record<string, unknown> = {};
  if (patch.status === "CONTACTED") {
    if (!patch.nextFollowupAt) return { success: false, error: "A follow-up date is required when marking Contacted." };
    const next = new Date(patch.nextFollowupAt);
    if (Number.isNaN(next.getTime()) || next <= new Date()) {
      return { success: false, error: "Follow-up date must be in the future." };
    }
    data.status = "CONTACTED";
    data.nextFollowupAt = next;
  }
  if (patch.incrementContactAttempt) data.contactAttempts = { increment: 1 };
  if (patch.mobileAlternate !== undefined) data.mobileAlternate = patch.mobileAlternate ? normalizeMobile(patch.mobileAlternate) : null;
  if (patch.email !== undefined) data.email = patch.email || null;

  await prisma.acqLead.update({ where: { id }, data });
  if (patch.status === "CONTACTED" && lead.status !== "CONTACTED") {
    await prisma.acqStageTransition.create({
      data: { entity: "LEAD", entityId: id, fromState: lead.status, toState: "CONTACTED", actorId: user.id },
    });
  }
  revalidatePath("/bd/leads");
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Log a contact touch (BUG-007): channel + outcome + note → activity timeline,
// increments contact attempts, stamps first-contact (clears SLA), optional follow-up.
// ------------------------------------------------------------
const CONTACT_CHANNELS = ["CALL", "WHATSAPP", "EMAIL", "VISIT", "NOTE"];
const CONTACT_OUTCOMES = ["CONNECTED", "NO_ANSWER", "INTERESTED", "NOT_INTERESTED", "CALLBACK", "OTHER"];

export async function logAcqLeadContact(
  leadId: string,
  input: { channel: string; outcome?: string; note?: string; nextFollowupAt?: string | null }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  if (!CONTACT_CHANNELS.includes(input.channel)) return { success: false, error: "Pick how you contacted them." };
  if (input.outcome && !CONTACT_OUTCOMES.includes(input.outcome)) return { success: false, error: "Invalid outcome." };
  const lead = await prisma.acqLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { status: true, firstContactAt: true } });
  if (!lead) return { success: false, error: "Lead not found" };

  let next: Date | null = null;
  if (input.nextFollowupAt) {
    next = new Date(input.nextFollowupAt);
    if (Number.isNaN(next.getTime()) || next <= new Date()) return { success: false, error: "Follow-up date must be in the future." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.acqLeadActivity.create({
      data: { leadId, channel: input.channel, outcome: input.outcome || null, note: input.note?.trim() || null, actorId: user.id, actorName: (user as { name?: string | null }).name ?? null },
    });
    await tx.acqLead.update({
      where: { id: leadId },
      data: {
        contactAttempts: { increment: 1 },
        firstContactAt: lead.firstContactAt ?? new Date(),
        // A real contact moves a NEW lead to CONTACTED and records the follow-up.
        ...(lead.status === "NEW" ? { status: "CONTACTED" } : {}),
        ...(next ? { nextFollowupAt: next } : {}),
      },
    });
    if (lead.status === "NEW") {
      await tx.acqStageTransition.create({
        data: { entity: "LEAD", entityId: leadId, fromState: "NEW", toState: "CONTACTED", actorId: user.id },
      });
    }
  });
  revalidatePath("/bd/leads");
  revalidatePath(`/bd/leads/${leadId}`);
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id: leadId } };
}

// ------------------------------------------------------------
// Qualify → create Deal (§5.2)
// ------------------------------------------------------------
export async function qualifyAcqLead(
  id: string,
  payload: QualificationPayload
): Promise<Result<{ dealId: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const lead = await prisma.acqLead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) return { success: false, error: "Lead not found" };
  if (lead.status === "QUALIFIED") return { success: false, error: "Lead is already qualified." };
  if (lead.status === "DISQUALIFIED") return { success: false, error: "Lead is disqualified." };

  const gate = evaluateQualification(payload);
  if (!gate.qualified) {
    return {
      success: false,
      error: `Qualification failed: ${gate.failed.join(", ")}. Disqualify the lead with reason ${gate.suggestedDisqualifyReason}.`,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const deal = await tx.acqDeal.create({
      data: {
        name: `Acquire – ${lead.propertyName}, ${lead.locality}`,
        leadId: lead.id,
        stage: "QUALIFIED",
        ownerName: lead.ownerName,
        ownerType: lead.ownerType,
        propertyName: lead.propertyName,
        propertyType: lead.propertyType,
        city: lead.city,
        locality: lead.locality,
        seatingTheatre: lead.seatingTheatre,
        seatingFloating: lead.seatingFloating,
        bdExecutiveId: lead.bdExecutiveId,
      },
      select: { id: true },
    });
    await tx.acqLead.update({
      where: { id: lead.id },
      data: {
        status: "QUALIFIED",
        convertedDealId: deal.id,
        qualSeating100: payload.seating_100_plus,
        qualOwnerInterested: payload.owner_interested_in_management_model,
        qualAgreeRenovate: payload.agrees_to_renovate_if_required,
        qualPhotosReady: payload.required_photos_available,
      },
    });
    await tx.acqStageTransition.create({
      data: { entity: "LEAD", entityId: lead.id, fromState: lead.status, toState: "QUALIFIED", actorId: user.id },
    });
    await tx.acqStageTransition.create({
      data: { entity: "DEAL", entityId: deal.id, fromState: null, toState: "QUALIFIED", actorId: user.id, reason: "Created from qualified lead" },
    });
    return deal;
  });

  revalidatePath("/bd/leads");
  revalidatePath("/bd/dashboard");
  revalidatePath("/bd/deals");
  return { success: true, data: { dealId: result.id } };
}

// ------------------------------------------------------------
// Disqualify (§5.1 window)
// ------------------------------------------------------------
export async function disqualifyAcqLead(
  id: string,
  reason: AcqDisqualifyReason
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  if (!ACQ_DISQUALIFY_REASON.includes(reason)) return { success: false, error: "Invalid reason" };

  const lead = await prisma.acqLead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) return { success: false, error: "Lead not found" };
  if (lead.status === "QUALIFIED") return { success: false, error: "Cannot disqualify a qualified lead." };

  const cfg = await getAcqConfig();
  const allowed = canDisqualify(reason, {
    contactAttempts: lead.contactAttempts,
    createdAt: lead.createdAt,
    now: new Date(),
    minAttempts: cfg.LEAD_MIN_ATTEMPTS_BEFORE_DISQUALIFY,
    windowDays: cfg.LEAD_DISQUALIFY_WINDOW_DAYS,
  });
  if (!allowed) {
    return {
      success: false,
      error: `Cannot disqualify yet — needs ${cfg.LEAD_MIN_ATTEMPTS_BEFORE_DISQUALIFY} contact attempts or ${cfg.LEAD_DISQUALIFY_WINDOW_DAYS} days, unless using a first-contact-valid reason.`,
    };
  }

  await prisma.acqLead.update({ where: { id }, data: { status: "DISQUALIFIED", disqualifyReason: reason } });
  await prisma.acqStageTransition.create({
    data: { entity: "LEAD", entityId: id, fromState: lead.status, toState: "DISQUALIFIED", actorId: user.id, reason },
  });
  revalidatePath("/bd/leads");
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id } };
}

export async function getBdUsers(): Promise<{ id: string; name: string | null; role: string }[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["BD_EXECUTIVE", "BD_HEAD", "SUPER_ADMIN", "ADMIN", "OPERATIONS"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return users as { id: string; name: string | null; role: string }[];
}

// ------------------------------------------------------------
// Edit full lead details (BD team) — § "edit/view the lead"
// ------------------------------------------------------------
const editSchema = z.object({
  ownerName: z.string().min(1).max(200).optional(),
  mobilePrimary: z.string().min(6).max(20).optional(),
  mobileAlternate: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  propertyName: z.string().min(1).max(200).optional(),
  propertyType: z.enum(ACQ_PROPERTY_TYPE).optional(),
  city: z.string().min(1).max(100).optional(),
  locality: z.string().min(1).max(100).optional(),
  seatingTheatre: z.number().int().nonnegative().nullable().optional(),
  seatingFloating: z.number().int().nonnegative().nullable().optional(),
  seatingRange: z.enum(ACQ_SEATING_RANGE).nullable().optional(),
  propertyStage: z.enum(ACQ_PROPERTY_STAGE).nullable().optional(),
  leadSource: z.enum(ACQ_LEAD_SOURCE).optional(),
  ownerType: z.enum(ACQ_OWNER_TYPE).optional(),
  notes: z.string().max(5000).optional().or(z.literal("")),
});
export type AcqLeadEditInput = z.infer<typeof editSchema>;

export async function editAcqLead(
  id: string,
  patch: AcqLeadEditInput
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const parsed = editSchema.safeParse(patch);
  if (!parsed.success) return { success: false, error: "Validation failed" };
  const p = parsed.data;

  const lead = await prisma.acqLead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) return { success: false, error: "Lead not found" };

  const data: Record<string, unknown> = {};
  if (p.ownerName !== undefined) data.ownerName = p.ownerName;
  if (p.mobilePrimary !== undefined) data.mobilePrimary = normalizeMobile(p.mobilePrimary);
  if (p.mobileAlternate !== undefined) data.mobileAlternate = p.mobileAlternate ? normalizeMobile(p.mobileAlternate) : null;
  if (p.email !== undefined) data.email = p.email || null;
  if (p.propertyName !== undefined) data.propertyName = p.propertyName;
  if (p.propertyType !== undefined) data.propertyType = p.propertyType;
  if (p.city !== undefined) data.city = p.city;
  if (p.locality !== undefined) data.locality = p.locality;
  if (p.seatingTheatre !== undefined) data.seatingTheatre = p.seatingTheatre;
  if (p.seatingFloating !== undefined) data.seatingFloating = p.seatingFloating;
  if (p.seatingRange !== undefined) data.seatingRange = p.seatingRange;
  if (p.propertyStage !== undefined) data.propertyStage = p.propertyStage;
  if (p.leadSource !== undefined) data.leadSource = p.leadSource;
  if (p.ownerType !== undefined) data.ownerType = p.ownerType;
  if (p.notes !== undefined) data.notes = p.notes || null;

  await prisma.acqLead.update({ where: { id }, data });
  revalidatePath("/bd/leads");
  revalidatePath("/bd/dashboard");
  revalidatePath(`/bd/leads/${id}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Delete a lead — BD Head only (not the BD team)
// ------------------------------------------------------------
export async function deleteAcqLead(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:delete")) {
    return { success: false, error: "Only the BD Head can delete a lead." };
  }
  const lead = await prisma.acqLead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) return { success: false, error: "Lead not found" };
  if (lead.convertedDealId) {
    return { success: false, error: "This lead is qualified and linked to a deal — it can't be deleted." };
  }
  await prisma.acqLead.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.acqStageTransition.create({
    data: { entity: "LEAD", entityId: id, fromState: lead.status, toState: lead.status, actorId: user.id, reason: "Lead deleted" },
  });
  revalidatePath("/bd/leads");
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Reassign lead owner — manager (BD Head) only
// ------------------------------------------------------------
export async function reassignAcqLead(
  id: string,
  bdExecutiveId: string
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:reassign")) {
    return { success: false, error: "Only a manager can change lead ownership." };
  }
  const lead = await prisma.acqLead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) return { success: false, error: "Lead not found" };

  const target = await prisma.user.findFirst({
    where: {
      id: bdExecutiveId,
      isActive: true,
      role: { in: ["BD_EXECUTIVE", "BD_HEAD", "SUPER_ADMIN", "ADMIN", "OPERATIONS"] },
    },
    select: { id: true, name: true },
  });
  if (!target) return { success: false, error: "Pick a valid BD team member." };
  if (target.id === lead.bdExecutiveId) return { success: true, data: { id } };

  await prisma.acqLead.update({ where: { id }, data: { bdExecutiveId: target.id } });
  await prisma.acqStageTransition.create({
    data: {
      entity: "LEAD",
      entityId: id,
      fromState: lead.status,
      toState: lead.status,
      actorId: user.id,
      reason: `Owner changed to ${target.name ?? "another BD exec"}`,
    },
  });
  revalidatePath("/bd/leads");
  revalidatePath("/bd/dashboard");
  revalidatePath(`/bd/leads/${id}`);
  return { success: true, data: { id } };
}
