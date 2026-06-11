"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import {
  isLegalTransition,
  computeEvaluation,
  requiresBdHeadApproval,
  shouldReengage,
  isValidScore,
  type EvaluationScores,
} from "@/lib/acq/domain";
import { getAcqConfig } from "@/lib/acq/config";
import { acqCan, acqHasAnyAccess } from "@/lib/acq/rbac";
import {
  ONBOARDING_SEED_TASKS,
  ACQ_LOST_REASON,
  ACQ_DEAL_MODEL,
  type AcqDealStage,
  type AcqLostReason,
} from "@/lib/acq/constants";

type Result<T> = { success: true; data: T } | { success: false; error: string; code?: number };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

// ------------------------------------------------------------
// List / get
// ------------------------------------------------------------
export async function getAcqDeals(): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const deals = await prisma.acqDeal.findMany({
    where: { deletedAt: null },
    include: {
      bdExecutive: { select: { id: true, name: true } },
      _count: { select: { attachments: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  return { success: true, data: serialize(deals) as unknown[] };
}

export async function getAcqDeal(id: string): Promise<Result<unknown>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const deal = await prisma.acqDeal.findFirst({
    where: { id, deletedAt: null },
    include: {
      bdExecutive: { select: { id: true, name: true } },
      bdHeadApprovedBy: { select: { id: true, name: true } },
      evaluations: { orderBy: { createdAt: "desc" }, include: { evaluatedBy: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      property: { select: { id: true, status: true } },
    },
  });
  if (!deal) return { success: false, error: "Deal not found" };
  return { success: true, data: serialize(deal) };
}

// ------------------------------------------------------------
// Update economics / commercials / contract fields (deal is source of truth)
// ------------------------------------------------------------
export async function updateAcqDeal(
  id: string,
  patch: Record<string, unknown>
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const deal = await prisma.acqDeal.findFirst({ where: { id, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };

  const allowed = [
    "ownerCurrentMonthlyRevenue", "avgEventsPerMonth", "peakRateCard",
    "model", "baseFeePct", "incentivePct", "royaltyPct", "termYears", "lockinYears",
    "isExclusive", "expectedMonthlyEvents", "projectedFeeValue",
    "signatoryAuthorityVerified", "gpaDocumentUrl", "expectedCloseDate",
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in patch) data[k] = patch[k];
  }
  if (data.model != null && !ACQ_DEAL_MODEL.includes(data.model as never)) {
    return { success: false, error: "Invalid model" };
  }
  if (data.expectedCloseDate) data.expectedCloseDate = new Date(data.expectedCloseDate as string);

  await prisma.acqDeal.update({ where: { id }, data });
  revalidatePath(`/bd/deals/${id}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Evaluation scorecard (§5.3) — computes score + pass, stores row.
// ------------------------------------------------------------
export async function submitAcqEvaluation(
  dealId: string,
  scores: EvaluationScores & { notes?: string }
): Promise<Result<{ totalScore: number; passed: boolean }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "deal:transition")) return { success: false, error: "Unauthorized" };
  const deal = await prisma.acqDeal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };

  const keys: (keyof EvaluationScores)[] = [
    "capacityScore", "parkingScore", "kitchenScore", "roomsScore",
    "conditionScore", "locationScore", "avAmenitiesScore",
  ];
  for (const k of keys) {
    if (!isValidScore(scores[k])) return { success: false, error: `${k} must be an integer 1–5.` };
  }
  const cfg = await getAcqConfig();
  const { totalScore, passed } = computeEvaluation(scores, cfg.EVALUATION_PASS_THRESHOLD);

  await prisma.acqEvaluation.create({
    data: {
      dealId,
      capacityScore: scores.capacityScore,
      parkingScore: scores.parkingScore,
      kitchenScore: scores.kitchenScore,
      roomsScore: scores.roomsScore,
      conditionScore: scores.conditionScore,
      locationScore: scores.locationScore,
      avAmenitiesScore: scores.avAmenitiesScore,
      totalScore,
      passed,
      notes: scores.notes || null,
      evaluatedById: user.id,
    },
  });
  revalidatePath(`/bd/deals/${dealId}`);
  return { success: true, data: { totalScore, passed } };
}

// ------------------------------------------------------------
// Attachments / notes / approval
// ------------------------------------------------------------
export async function addAcqAttachment(
  dealId: string,
  input: { kind: "PHOTO" | "DOCUMENT" | "AGREEMENT" | "GPA"; url: string; label?: string }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "deal:transition")) return { success: false, error: "Unauthorized" };
  if (!["PHOTO", "DOCUMENT", "AGREEMENT", "GPA"].includes(input.kind)) return { success: false, error: "Invalid kind" };
  if (!input.url) return { success: false, error: "URL required" };
  const att = await prisma.acqAttachment.create({
    data: { dealId, kind: input.kind, url: input.url, label: input.label || null, uploadedById: user.id },
    select: { id: true },
  });
  revalidatePath(`/bd/deals/${dealId}`);
  return { success: true, data: { id: att.id } };
}

export async function addAcqNote(
  dealId: string,
  input: { noteType: "NEGOTIATION" | "INTERNAL" | "GENERAL"; body: string }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  if (!input.body?.trim()) return { success: false, error: "Note body required" };
  const note = await prisma.acqDealNote.create({
    data: { dealId, noteType: input.noteType, body: input.body.trim(), authorId: user.id },
    select: { id: true },
  });
  revalidatePath(`/bd/deals/${dealId}`);
  return { success: true, data: { id: note.id } };
}

/** Legal/BD Head marks the executed contract as signed (precondition for the SIGNED stage). */
export async function markAcqContractSigned(dealId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "legal:review")) return { success: false, error: "Only Legal / BD Head / Admin can mark a contract signed." };
  const deal = await prisma.acqDeal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };
  if (deal.contractStatus !== "SENT") return { success: false, error: "Contract must be SENT before it can be marked signed." };
  await prisma.acqDeal.update({ where: { id: dealId }, data: { contractStatus: "SIGNED" } });
  revalidatePath(`/bd/deals/${dealId}`);
  return { success: true, data: { id: dealId } };
}

export async function approveAcqDeal(dealId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "bdhead:approve")) return { success: false, error: "Only BD Head / Admin can approve." };
  const deal = await prisma.acqDeal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };
  await prisma.acqDeal.update({
    where: { id: dealId },
    data: { bdHeadApprovedById: user.id, bdHeadApprovedAt: new Date() },
  });
  revalidatePath(`/bd/deals/${dealId}`);
  return { success: true, data: { id: dealId } };
}

// ------------------------------------------------------------
// THE guarded state machine (§4) — only path that changes deal.stage
// ------------------------------------------------------------
export interface TransitionPayload {
  lostReason?: AcqLostReason;
  reason?: string;
}

export async function transitionAcqDeal(
  dealId: string,
  toStage: AcqDealStage,
  payload: TransitionPayload = {}
): Promise<Result<{ stage: AcqDealStage }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "deal:transition")) return { success: false, error: "Unauthorized" };

  const deal = await prisma.acqDeal.findFirst({
    where: { id: dealId, deletedAt: null },
    include: {
      evaluations: { where: { passed: true }, orderBy: { createdAt: "desc" }, take: 1 },
      attachments: { select: { kind: true } },
    },
  });
  if (!deal) return { success: false, error: "Deal not found" };

  const from = deal.stage as AcqDealStage;

  // (a) legal transition
  if (!isLegalTransition(from, toStage)) {
    return { success: false, error: `Illegal transition ${from} → ${toStage}.`, code: 409 };
  }

  // (b) entry guards
  const photoCount = deal.attachments.filter((a) => a.kind === "PHOTO").length;
  const hasGpa = deal.attachments.some((a) => a.kind === "GPA");
  const hasAgreement = deal.attachments.some((a) => a.kind === "AGREEMENT");
  const cfg = await getAcqConfig();

  // fields set during the transition
  const data: Record<string, unknown> = { stage: toStage };

  switch (toStage) {
    case "EVALUATION_COMPLETED": {
      const passedEval = deal.evaluations[0];
      if (!passedEval) return { success: false, error: "A passed evaluation scorecard is required.", code: 422 };
      if (photoCount < 8) return { success: false, error: `At least 8 photos are required (have ${photoCount}).`, code: 422 };
      data.evalScore = passedEval.totalScore;
      data.evalPassed = true;
      break;
    }
    case "PROPOSAL_SENT": {
      if (!deal.model) return { success: false, error: "Set the commercial model before sending a proposal.", code: 422 };
      if (deal.model === "MANAGEMENT" && (deal.baseFeePct == null || deal.incentivePct == null)) {
        return { success: false, error: "Management model needs base fee % and incentive %.", code: 422 };
      }
      if (deal.model === "FRANCHISE" && deal.royaltyPct == null) {
        return { success: false, error: "Franchise model needs a royalty %.", code: 422 };
      }
      if (deal.termYears == null || deal.lockinYears == null) {
        return { success: false, error: "Term (years) and lock-in (years) are required.", code: 422 };
      }
      break;
    }
    case "CONTRACT_SENT": {
      if (!deal.signatoryAuthorityVerified) {
        return { success: false, error: "Signatory authority must be verified first.", code: 422 };
      }
      if (deal.ownerType === "GPA_HOLDER" && !hasGpa) {
        return { success: false, error: "A GPA document must be attached for a GPA-holder owner.", code: 422 };
      }
      const needsApproval = requiresBdHeadApproval(
        {
          model: deal.model,
          baseFeePct: deal.baseFeePct == null ? null : Number(deal.baseFeePct),
          incentivePct: deal.incentivePct == null ? null : Number(deal.incentivePct),
          royaltyPct: deal.royaltyPct == null ? null : Number(deal.royaltyPct),
          lockinYears: deal.lockinYears,
        },
        {
          MANAGEMENT_BASE_FEE_FLOOR_PCT: cfg.MANAGEMENT_BASE_FEE_FLOOR_PCT,
          MANAGEMENT_INCENTIVE_FLOOR_PCT: cfg.MANAGEMENT_INCENTIVE_FLOOR_PCT,
          FRANCHISE_ROYALTY_FLOOR_PCT: cfg.FRANCHISE_ROYALTY_FLOOR_PCT,
          MIN_LOCKIN_YEARS: cfg.MIN_LOCKIN_YEARS,
        }
      );
      if (needsApproval && !deal.bdHeadApprovedById) {
        return { success: false, error: "Below-floor / short lock-in deal needs BD Head approval before the contract can be sent.", code: 422 };
      }
      data.contractStatus = "SENT";
      break;
    }
    case "SIGNED": {
      if (deal.contractStatus !== "SIGNED") {
        return { success: false, error: "Mark the contract status SIGNED (with the executed agreement) first.", code: 422 };
      }
      if (!hasAgreement) {
        return { success: false, error: "An executed AGREEMENT attachment is required.", code: 422 };
      }
      break;
    }
    case "LOST": {
      if (!payload.lostReason || !ACQ_LOST_REASON.includes(payload.lostReason)) {
        return { success: false, error: "A valid lost reason is required.", code: 422 };
      }
      data.lostReason = payload.lostReason;
      if (shouldReengage(payload.lostReason)) {
        data.reengageAt = new Date(Date.now() + cfg.REENGAGE_DAYS * 24 * 60 * 60 * 1000);
      }
      break;
    }
    case "WON": {
      data.wonAt = new Date();
      break;
    }
  }

  // (c)+(d) apply transition + automations atomically
  let createdPropertyId: string | null = null;
  await prisma.$transaction(async (tx) => {
    await tx.acqDeal.update({ where: { id: dealId }, data });
    await tx.acqStageTransition.create({
      data: { entity: "DEAL", entityId: dealId, fromState: from, toState: toStage, actorId: user.id, reason: payload.reason || null },
    });

    if (toStage === "WON") {
      // §6.1 — create Property (ONBOARDING), onboarding project + seed tasks.
      const property = await tx.acqProperty.create({
        data: {
          dealId: deal.id,
          propertyName: deal.propertyName,
          propertyType: deal.propertyType,
          ownerName: deal.ownerName,
          city: deal.city,
          locality: deal.locality,
          seatingTheatre: deal.seatingTheatre,
          seatingFloating: deal.seatingFloating,
          status: "ONBOARDING",
          acquisitionDate: new Date(),
        },
        select: { id: true },
      });
      createdPropertyId = property.id;
      await tx.acqDeal.update({ where: { id: dealId }, data: { propertyId: property.id } });
      const project = await tx.acqOnboardingProject.create({
        data: { propertyId: property.id, status: "OPEN" },
        select: { id: true },
      });
      await tx.acqOnboardingTask.createMany({
        data: ONBOARDING_SEED_TASKS.map((title) => ({ projectId: project.id, title })),
      });
      await tx.acqStageTransition.create({
        data: { entity: "PROPERTY", entityId: property.id, fromState: null, toState: "ONBOARDING", actorId: user.id },
      });
    }
  });

  // Post-commit automations (notifications — fire-and-forget).
  if (toStage === "WON" && createdPropertyId) {
    // §6.1.3 Notify Operations (NOT Sales).
    const ops = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["OPERATIONS", "SUPER_ADMIN", "ADMIN"] } },
      select: { id: true },
    });
    for (const u of ops) {
      notify({
        userId: u.id,
        type: "TASK_ASSIGNED",
        title: "New property to onboard",
        message: `${deal.propertyName}, ${deal.locality} was won. Complete onboarding within ${cfg.ONBOARDING_SLA_DAYS} days.`,
        actionUrl: `/bd/properties/${createdPropertyId}`,
      });
    }
    logActivity({ userId: user.id, action: "WON", entityType: "AcqDeal", entityId: dealId, changes: { propertyId: createdPropertyId } });
  }

  revalidatePath("/bd/deals");
  revalidatePath(`/bd/deals/${dealId}`);
  revalidatePath("/bd/properties");
  return { success: true, data: { stage: toStage } };
}
