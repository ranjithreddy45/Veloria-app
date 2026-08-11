"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { cappedList } from "@/lib/capped-list";
import { revalidatePath } from "next/cache";
import { velosOnLeadContact } from "@/lib/velos/triggers";
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
  ACQ_LEAD_SOURCE_RETIRED,
  ACQ_LEAD_STATUS,
  ACQ_LEAD_STATUS_LABEL,
  ACQ_LEAD_STATUS_TRANSITIONS,
  ACQ_OWNER_TYPE,
  ACQ_PROPERTY_TYPE,
  ACQ_PROPERTY_STAGE,
  ACQ_DISQUALIFY_REASON,
  type AcqDisqualifyReason,
  type AcqLeadStatus,
} from "@/lib/acq/constants";
import { isSafeReceiptDataUrl } from "@/lib/sales/receipt";
import { z } from "zod";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// Accept the retired WALK_IN on INPUT (a stale open form may still post it) but
// never store it — it is normalised to INCOMING_LEAD below. Item 7.
const leadSourceInput = z.enum([...ACQ_LEAD_SOURCE, ACQ_LEAD_SOURCE_RETIRED]);
function normalizeLeadSource(v: z.infer<typeof leadSourceInput>): (typeof ACQ_LEAD_SOURCE)[number] {
  return v === ACQ_LEAD_SOURCE_RETIRED ? "INCOMING_LEAD" : v;
}

/** Max property photos stored on a lead — mirrors updateAcqDealImages. */
const MAX_LEAD_IMAGES = 24;

/**
 * Validate base64 image data-URLs for AcqLead.images.
 *
 * Returns an ERROR when something was offered and nothing survived (or when any
 * single entry is rejected). Silently filtering to [] and reporting success is
 * the bug the owner hit: the picker showed photos, the save said "Saved", and
 * the column stayed empty.
 */
function sanitizeLeadImages(images: unknown): { ok: true; images: string[] } | { ok: false; error: string } {
  const raw = Array.isArray(images) ? images : [];
  const candidates = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (candidates.length !== raw.length) {
    return { ok: false, error: "Some photos couldn't be read — remove them and try again." };
  }
  if (candidates.length > MAX_LEAD_IMAGES) {
    return { ok: false, error: `Up to ${MAX_LEAD_IMAGES} photos per lead — remove a few and save again.` };
  }
  const safe = candidates.filter((v) => isSafeReceiptDataUrl(v) && v.startsWith("data:image/"));
  if (safe.length !== candidates.length) {
    const rejected = candidates.length - safe.length;
    return {
      ok: false,
      error: `${rejected} file${rejected === 1 ? " isn't" : "s aren't"} a supported image (PNG, JPEG or WebP) — remove ${rejected === 1 ? "it" : "them"} and save again.`,
    };
  }
  return { ok: true, images: safe };
}

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
  // NOTE: seatingRange (bucketed dropdown) is intentionally NOT accepted — the
  // exact theatre/floating numbers are the single source of truth (item 9).
  propertyStage: z.enum(ACQ_PROPERTY_STAGE).optional(),
  notes: z.string().max(5000).optional().or(z.literal("")),
  parkingAvailable: z.boolean().optional(),
  referrerName: z.string().max(200).optional().or(z.literal("")),
  referrerPhone: z.string().max(20).optional().or(z.literal("")),
  referrerEmail: z.string().email().optional().or(z.literal("")),
  brokerageDemand: z.string().max(200).optional().or(z.literal("")),
  leadSource: leadSourceInput,
  ownerType: z.enum(ACQ_OWNER_TYPE),
  bdExecutiveId: z.string().optional(),
  // Property photos captured at capture time (AcqLead.images) — validated by
  // sanitizeLeadImages, not by zod, so the caller gets a specific reason.
  images: z.array(z.string()).optional(),
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
  /**
   * The follow-up worklist, as a VIEW of this list rather than a separate page.
   *
   * /bd/followups ran its own query (getFollowupQueue) over the same acqLead
   * table with this exact condition, on its own screen, with its own columns —
   * so the same lead appeared in two places that could not be filtered, sorted
   * or acted on the same way. One list with a view chip is the same information
   * and one fewer thing to learn.
   */
  dueFollowup?: boolean;
}): Promise<Result<unknown[]> & { total?: number; truncated?: boolean }> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) {
    return { success: false, error: "Unauthorized" };
  }
  const where: Record<string, unknown> = { deletedAt: null };

  // Mirrors getFollowupQueue's condition exactly. If these two ever drift, the
  // chip count and the list stop agreeing — which is the class of bug this
  // consolidation exists to remove, so they are kept literally identical.
  if (filters?.dueFollowup) {
    where.status = { in: ["NEW", "CONTACTED"] };
    where.nextFollowupAt = { not: null };
  }
  // Validate the status against the allowed set BEFORE it reaches Prisma — an
  // arbitrary ?status= string in the URL would otherwise throw a Prisma
  // enum-conversion error and 500 the leads page (item 12).
  if (filters?.status) {
    if (!(ACQ_LEAD_STATUS as readonly string[]).includes(filters.status)) {
      return { success: false, error: "Unknown lead status filter." };
    }
    where.status = filters.status;
  }
  if (filters?.city) where.city = filters.city;
  if (filters?.bdExecutiveId) where.bdExecutiveId = filters.bdExecutiveId;

  // Capped, and it SAYS SO. Returning a bare 500 made the inbox look complete
  // while the status chips counted the whole table — the two disagreed on
  // screen with nothing to explain why.
  const page = await cappedList<{ id: string }>(
    prisma.acqLead as never,
    {
      where,
      include: { bdExecutive: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    },
    500
  );
  return {
    success: true,
    data: serialize(page.rows) as unknown[],
    total: page.total,
    truncated: page.truncated,
  };
}

/**
 * Per-status lead totals for the inbox chips. Computed server-side so the chip
 * numbers stay the true totals even when the list itself is filtered down to one
 * status (or capped by the 500-row take).
 */
export async function getAcqLeadStatusCounts(): Promise<Result<Record<string, number>>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };

  const grouped = await prisma.acqLead.groupBy({
    by: ["status"],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  const counts: Record<string, number> = { ALL: 0 };
  // Same condition as the dueFollowup filter, so the chip's number and the list
  // it opens can never disagree.
  counts.FOLLOWUP = await prisma.acqLead.count({
    where: {
      deletedAt: null,
      status: { in: ["NEW", "CONTACTED"] },
      nextFollowupAt: { not: null },
    },
  });
  for (const s of ACQ_LEAD_STATUS) counts[s] = 0;
  for (const row of grouped) {
    counts[row.status] = row._count._all;
    counts.ALL += row._count._all;
  }
  return { success: true, data: counts };
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
      // Everyone the team works this property through — primary first (item 1).
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
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

  const pics = sanitizeLeadImages(d.images ?? []);
  if (!pics.ok) return { success: false, error: pics.error };

  const mobile = normalizeMobile(d.mobilePrimary);

  // Block only a TRUE duplicate — the same PROPERTY (name + locality). A repeat
  // phone alone is allowed: an existing owner can register another hall/venue
  // (the create form surfaces "owner already exists" via getAcqOwnerByPhone).
  const dup = await prisma.acqLead.findFirst({
    where: {
      deletedAt: null,
      status: { not: "DISQUALIFIED" },
      AND: [
        { propertyName: { equals: d.propertyName, mode: "insensitive" } },
        { locality: { equals: d.locality, mode: "insensitive" } },
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
      propertyStage: d.propertyStage ?? null,
      notes: d.notes || null,
      parkingAvailable: d.parkingAvailable ?? null,
      referrerName: d.referrerName || null,
      referrerPhone: d.referrerPhone || null,
      referrerEmail: d.referrerEmail || null,
      brokerageDemand: d.brokerageDemand || null,
      leadSource: normalizeLeadSource(d.leadSource),
      ownerType: d.ownerType,
      images: pics.images,
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
  revalidatePath("/bd/followups");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Change lead status from the UI (item 6).
//
// This is the ONLY generic status writer, and it deliberately refuses the three
// statuses that carry side effects — they must keep going through their own
// gated actions:
//   • QUALIFIED / DEAL_CREATED → qualifyAcqLead (4-criteria gate + creates the deal)
//   • DISQUALIFIED             → disqualifyAcqLead (reason + attempts/window rule)
// Everything else is driven by ACQ_LEAD_STATUS_TRANSITIONS, and every move
// writes an AcqStageTransition row so the timeline stays complete.
// ------------------------------------------------------------
export async function setAcqLeadStatus(
  id: string,
  status: string,
  opts?: { nextFollowupAt?: string | null; reason?: string }
): Promise<Result<{ id: string; status: AcqLeadStatus }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  if (!(ACQ_LEAD_STATUS as readonly string[]).includes(status)) {
    return { success: false, error: "Unknown lead status." };
  }
  const target = status as AcqLeadStatus;

  const lead = await prisma.acqLead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) return { success: false, error: "Lead not found" };
  const current = lead.status as AcqLeadStatus;
  if (current === target) return { success: true, data: { id, status: target } };

  // Route the gated statuses back to their own flows instead of silently
  // skipping their side effects.
  if (target === "QUALIFIED" || target === "DEAL_CREATED") {
    return {
      success: false,
      error: 'Use "Qualify lead" — it confirms the four criteria and creates the deal.',
    };
  }
  if (target === "DISQUALIFIED") {
    return { success: false, error: 'Use "Drop lead" — a drop reason is required.' };
  }
  if (!ACQ_LEAD_STATUS_TRANSITIONS[current].includes(target)) {
    return {
      success: false,
      error: `Can't move a ${ACQ_LEAD_STATUS_LABEL[current]} lead to ${ACQ_LEAD_STATUS_LABEL[target]}.`,
    };
  }

  const data: Record<string, unknown> = { status: target };
  if (target === "CONTACTED") {
    // Same rule updateAcqLead enforces: a Contacted lead without a follow-up date
    // falls out of the follow-up queue AND out of the NEW-only SLA net.
    if (!opts?.nextFollowupAt) {
      return { success: false, error: "A follow-up date is required when marking Contacted." };
    }
    const next = new Date(opts.nextFollowupAt);
    if (Number.isNaN(next.getTime()) || next <= new Date()) {
      return { success: false, error: "Follow-up date must be in the future." };
    }
    data.nextFollowupAt = next;
  }
  if (target === "NEW") {
    // Back to the top of the funnel: the pending follow-up no longer applies.
    data.nextFollowupAt = null;
  }
  // Reopening a dropped lead must clear the drop reason, or the lead keeps
  // reporting as dropped-for-X in the reports.
  if (current === "DISQUALIFIED") data.disqualifyReason = null;

  await prisma.$transaction(async (tx) => {
    await tx.acqLead.update({ where: { id }, data });
    await tx.acqStageTransition.create({
      data: {
        entity: "LEAD",
        entityId: id,
        fromState: current,
        toState: target,
        actorId: user.id,
        reason:
          opts?.reason?.trim() ||
          (current === "DISQUALIFIED" ? "Lead reopened" : "Status changed manually"),
      },
    });
  });

  revalidatePath("/bd/leads");
  revalidatePath(`/bd/leads/${id}`);
  revalidatePath("/bd/dashboard");
  revalidatePath("/bd/followups");
  return { success: true, data: { id, status: target } };
}

// ------------------------------------------------------------
// Property photos on the lead (AcqLead.images) — mirrors updateAcqDealImages,
// but reports an error instead of quietly storing [] when nothing validates.
// ------------------------------------------------------------
export async function updateAcqLeadImages(
  id: string,
  images: string[]
): Promise<Result<{ id: string; count: number }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const lead = await prisma.acqLead.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!lead) return { success: false, error: "Lead not found" };

  const pics = sanitizeLeadImages(images);
  if (!pics.ok) return { success: false, error: pics.error };

  await prisma.acqLead.update({ where: { id }, data: { images: pics.images } });
  revalidatePath(`/bd/leads/${id}`);
  revalidatePath("/bd/leads");
  return { success: true, data: { id, count: pics.images.length } };
}

// ------------------------------------------------------------
// Follow-up queue (FEAT-002): the rep's active leads bucketed by next-follow-up date
// into Overdue / Today / Upcoming. Managers (BD Head / admin) see the whole team.
// ------------------------------------------------------------
export async function getFollowupQueue(): Promise<Result<{ overdue: unknown[]; today: unknown[]; upcoming: unknown[] }>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const isManager = ["BD_HEAD", "ADMIN", "SUPER_ADMIN"].includes(user.role ?? "");
  const where: Record<string, unknown> = {
    deletedAt: null,
    status: { in: ["NEW", "CONTACTED"] },
    nextFollowupAt: { not: null },
  };
  if (!isManager) where.bdExecutiveId = user.id;

  const leads = await prisma.acqLead.findMany({
    where,
    select: {
      id: true, ownerName: true, propertyName: true, city: true, status: true,
      nextFollowupAt: true, contactAttempts: true, bdExecutive: { select: { name: true } },
    },
    orderBy: { nextFollowupAt: "asc" },
    take: 300,
  });

  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  const overdue: typeof leads = [], today: typeof leads = [], upcoming: typeof leads = [];
  for (const l of leads) {
    const t = l.nextFollowupAt!.getTime();
    if (t < startToday.getTime()) overdue.push(l);
    else if (t <= endToday.getTime()) today.push(l);
    else upcoming.push(l);
  }
  return { success: true, data: serialize({ overdue, today, upcoming }) as { overdue: unknown[]; today: unknown[]; upcoming: unknown[] } };
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
  const lead = await prisma.acqLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { status: true, firstContactAt: true, bdExecutiveId: true, createdAt: true, firstContactDue: true } });
  if (!lead) return { success: false, error: "Lead not found" };

  let next: Date | null = null;
  if (input.nextFollowupAt) {
    next = new Date(input.nextFollowupAt);
    if (Number.isNaN(next.getTime()) || next <= new Date()) return { success: false, error: "Follow-up date must be in the future." };
  }
  // Logging the first contact moves NEW → CONTACTED; it must carry a follow-up date or
  // the lead drops out of the follow-up queue AND the NEW-only SLA net (audit fix).
  if (lead.status === "NEW" && !next) {
    return { success: false, error: "Set a follow-up date when logging the first contact." };
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
  // Velos: speed-engine award on the FIRST contact only (the SLA race). Shipped
  // with the quality gate (A5, governing the downstream close award). Best-effort.
  if (!lead.firstContactAt && lead.bdExecutiveId) {
    const now = Date.now();
    const elapsedMin = (now - lead.createdAt.getTime()) / 60000;
    await velosOnLeadContact({
      leadId,
      ownerId: lead.bdExecutiveId,
      withinSla: now <= lead.firstContactDue.getTime(), // contacted before the SLA deadline
      within15Min: elapsedMin <= 15,
    });
  }

  revalidatePath("/bd/leads");
  revalidatePath(`/bd/leads/${leadId}`);
  revalidatePath("/bd/dashboard");
  revalidatePath("/bd/followups");
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
  if (lead.status === "DEAL_CREATED") return { success: false, error: "This lead already has a deal." };
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
        // Qualifying CREATES the deal in this same transaction, so the lead lands
        // on DEAL_CREATED, not QUALIFIED (item 11). Setting it here — inside the
        // one path that can create a deal — is what makes it impossible to forget.
        status: "DEAL_CREATED",
        convertedDealId: deal.id,
        qualSeating100: payload.seating_100_plus,
        qualOwnerInterested: payload.owner_interested_in_management_model,
        qualAgreeRenovate: payload.agrees_to_renovate_if_required,
        qualPhotosReady: payload.required_photos_available,
      },
    });
    await tx.acqStageTransition.create({
      data: {
        entity: "LEAD",
        entityId: lead.id,
        fromState: lead.status,
        toState: "DEAL_CREATED",
        actorId: user.id,
        reason: "Qualified — deal created",
      },
    });
    await tx.acqStageTransition.create({
      data: { entity: "DEAL", entityId: deal.id, fromState: null, toState: "QUALIFIED", actorId: user.id, reason: "Created from qualified lead" },
    });
    return deal;
  });

  revalidatePath("/bd/leads");
  revalidatePath(`/bd/leads/${id}`);
  revalidatePath("/bd/dashboard");
  revalidatePath("/bd/followups");
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
  // A lead with a deal behind it must be lost on the DEAL, not dropped here.
  if (lead.status === "DEAL_CREATED") {
    return { success: false, error: "This lead has a deal — mark the deal Lost instead." };
  }

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
  revalidatePath(`/bd/leads/${id}`);
  revalidatePath("/bd/dashboard");
  revalidatePath("/bd/followups");
  return { success: true, data: { id } };
}

export async function getBdUsers(): Promise<{ id: string; name: string | null; role: string }[]> {
  // A server action is a PUBLIC endpoint. This one had no auth check at all, so
  // anyone able to invoke it could enumerate the internal staff directory (names
  // + roles). It only ever feeds BD assignee pickers, so gate it on BD access and
  // return an empty list — not an error — so a caller without access simply sees
  // no assignees instead of a broken panel.
  const session = await auth();
  if (!session?.user || !acqHasAnyAccess(session.user.role as string)) return [];

  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["BD_EXECUTIVE", "BD_HEAD", "SUPER_ADMIN", "ADMIN", "OPERATIONS"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return users as { id: string; name: string | null; role: string }[];
}

// Property Manager candidates — only roles that may own/operate a property.
// BD_EXECUTIVE is intentionally excluded (they capture leads, they don't manage
// venues). Kept in lockstep with the server-side check in assignPropertyManager.
// Module-local (NOT exported): a "use server" file may export ONLY async
// functions — an exported const breaks `next build`. The matching server-side
// check in assignPropertyManager keeps its own copy of this list.
const PROPERTY_MANAGER_ROLES = ["OPERATIONS", "BD_HEAD", "ADMIN", "SUPER_ADMIN"] as const;

export async function getPropertyManagerCandidates(): Promise<{ id: string; name: string | null; role: string }[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: [...PROPERTY_MANAGER_ROLES] } },
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
  // seatingRange intentionally omitted — retired from the UI (item 9); the stored
  // value stays untouched in the DB.
  propertyStage: z.enum(ACQ_PROPERTY_STAGE).nullable().optional(),
  leadSource: leadSourceInput.optional(),
  ownerType: z.enum(ACQ_OWNER_TYPE).optional(),
  notes: z.string().max(5000).optional().or(z.literal("")),
  parkingAvailable: z.boolean().nullable().optional(),
  referrerName: z.string().max(200).optional().or(z.literal("")),
  referrerPhone: z.string().max(20).optional().or(z.literal("")),
  referrerEmail: z.string().email().optional().or(z.literal("")),
  brokerageDemand: z.string().max(200).optional().or(z.literal("")),
  // Qualification checklist (editable from the Deal-Preview lead panel).
  qualSeating100: z.boolean().nullable().optional(),
  qualOwnerInterested: z.boolean().nullable().optional(),
  qualAgreeRenovate: z.boolean().nullable().optional(),
  qualPhotosReady: z.boolean().nullable().optional(),
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
  if (p.mobilePrimary !== undefined) {
    data.mobilePrimary = normalizeMobile(p.mobilePrimary);
    // NOTE: create deliberately allows a repeat phone (an existing owner can
    // register another venue), so no phone-collision check here.
  }
  if (p.mobileAlternate !== undefined) data.mobileAlternate = p.mobileAlternate ? normalizeMobile(p.mobileAlternate) : null;
  if (p.email !== undefined) data.email = p.email || null;
  if (p.propertyName !== undefined) data.propertyName = p.propertyName;
  if (p.propertyType !== undefined) data.propertyType = p.propertyType;
  if (p.city !== undefined) data.city = p.city;
  if (p.locality !== undefined) data.locality = p.locality;
  if (p.seatingTheatre !== undefined) data.seatingTheatre = p.seatingTheatre;
  if (p.seatingFloating !== undefined) data.seatingFloating = p.seatingFloating;
  if (p.propertyStage !== undefined) data.propertyStage = p.propertyStage;
  if (p.leadSource !== undefined) data.leadSource = normalizeLeadSource(p.leadSource);
  if (p.ownerType !== undefined) data.ownerType = p.ownerType;
  if (p.notes !== undefined) data.notes = p.notes || null;
  if (p.parkingAvailable !== undefined) data.parkingAvailable = p.parkingAvailable;
  if (p.referrerName !== undefined) data.referrerName = p.referrerName || null;
  if (p.referrerPhone !== undefined) data.referrerPhone = p.referrerPhone || null;
  if (p.referrerEmail !== undefined) data.referrerEmail = p.referrerEmail || null;
  if (p.brokerageDemand !== undefined) data.brokerageDemand = p.brokerageDemand || null;
  if (p.qualSeating100 !== undefined) data.qualSeating100 = p.qualSeating100;
  if (p.qualOwnerInterested !== undefined) data.qualOwnerInterested = p.qualOwnerInterested;
  if (p.qualAgreeRenovate !== undefined) data.qualAgreeRenovate = p.qualAgreeRenovate;
  if (p.qualPhotosReady !== undefined) data.qualPhotosReady = p.qualPhotosReady;

  // When the property identity (name + locality) is being changed, re-run the same
  // active-lead duplicate guard createAcqLead enforces so an edit can't recreate a
  // (propertyName + locality) duplicate that create would have blocked.
  if (p.propertyName !== undefined || p.locality !== undefined) {
    const effPropertyName = p.propertyName !== undefined ? p.propertyName : lead.propertyName;
    const effLocality = p.locality !== undefined ? p.locality : lead.locality;
    const dup = await prisma.acqLead.findFirst({
      where: {
        id: { not: id },
        deletedAt: null,
        status: { not: "DISQUALIFIED" },
        AND: [
          { propertyName: { equals: effPropertyName, mode: "insensitive" } },
          { locality: { equals: effLocality, mode: "insensitive" } },
        ],
      },
      include: { bdExecutive: { select: { name: true } } },
    });
    if (dup) {
      return {
        success: false,
        error: `This venue already exists as a lead (${dup.propertyName}, ${dup.locality}) owned by ${dup.bdExecutive?.name ?? "a BD exec"}.`,
      };
    }
  }

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
  revalidatePath("/bd/followups");
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
  revalidatePath("/bd/followups");
  revalidatePath(`/bd/leads/${id}`);
  return { success: true, data: { id } };
}
