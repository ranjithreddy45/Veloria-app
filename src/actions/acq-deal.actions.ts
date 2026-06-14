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
  ACQ_OWNER_TYPE,
  ACQ_PROPERTY_TYPE,
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
    "isExclusive", "expectedMonthlyEvents", "projectedFeeValue", "banquetSizeSft",
    "signatoryAuthorityVerified", "gpaDocumentUrl", "expectedCloseDate",
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in patch) data[k] = patch[k];
  }
  if (data.model != null && !ACQ_DEAL_MODEL.includes(data.model as never)) {
    return { success: false, error: "Invalid model" };
  }

  // Once economics are frozen, the agreed commercials are immutable.
  if (deal.economicsFrozenAt) {
    for (const locked of ["baseFeePct", "incentivePct", "termYears"]) {
      if (locked in data) {
        return { success: false, error: "Economics are frozen — base fee, incentive and term can't be changed." };
      }
    }
  }
  if (data.expectedCloseDate) data.expectedCloseDate = new Date(data.expectedCloseDate as string);

  // Defense in depth: never let a NaN/Infinity reach a numeric column, and
  // truncate the Int-only year fields so a decimal can't make Prisma throw.
  const numericFields = [
    "ownerCurrentMonthlyRevenue", "avgEventsPerMonth", "peakRateCard",
    "baseFeePct", "incentivePct", "royaltyPct", "termYears", "lockinYears",
    "expectedMonthlyEvents", "projectedFeeValue", "banquetSizeSft",
  ];
  const intFields = new Set(["termYears", "lockinYears", "banquetSizeSft"]);
  for (const k of numericFields) {
    if (data[k] != null) {
      const n = Number(data[k]);
      if (!Number.isFinite(n)) {
        return { success: false, error: `Invalid number for ${k}.` };
      }
      data[k] = intFields.has(k) ? Math.trunc(n) : n;
    }
  }

  // If a BD-Head-approved deal has its commercials changed, the prior approval
  // no longer applies — clear it so it must be re-approved (prevents a BD exec
  // approving high terms then quietly lowering them after the fact).
  if (deal.bdHeadApprovedById) {
    const commercialKeys = ["model", "baseFeePct", "incentivePct", "royaltyPct", "lockinYears", "termYears"];
    const changed = commercialKeys.some(
      (k) => k in data && String(data[k]) !== String((deal as Record<string, unknown>)[k])
    );
    if (changed) {
      (data as Record<string, unknown>).bdHeadApprovedById = null;
      (data as Record<string, unknown>).bdHeadApprovedAt = null;
    }
  }

  // Record the commercials edits to the deal change-log (FEAT-007) so the thread shows
  // before→after with actor + timestamp (mirrors editAcqDealOverview).
  const logKeys = ["model", "baseFeePct", "incentivePct", "royaltyPct", "termYears", "lockinYears"];
  const changes = logKeys
    .filter((k) => k in data && String(data[k] ?? "—") !== String((deal as Record<string, unknown>)[k] ?? "—"))
    .map((k) => `${k}: "${(deal as Record<string, unknown>)[k] ?? "—"}" → "${data[k] ?? "—"}"`);

  await prisma.acqDeal.update({ where: { id }, data });
  if (changes.length > 0) {
    await prisma.acqDealNote.create({
      data: { dealId: id, noteType: "CHANGE_LOG", body: changes.join("\n"), authorId: user.id },
    });
  }
  revalidatePath(`/bd/deals/${id}`);
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Freeze / unfreeze economics — locks base fee, incentive, term.
// Freeze: BD Head (or admin). Unfreeze: BD Head only.
// ------------------------------------------------------------
export async function setAcqDealEconomicsFrozen(
  id: string,
  frozen: boolean
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "bdhead:approve")) {
    return { success: false, error: "Only a BD Head can freeze or unfreeze economics." };
  }
  const deal = await prisma.acqDeal.findFirst({ where: { id, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };

  if (frozen) {
    if (deal.baseFeePct == null || deal.incentivePct == null || deal.termYears == null) {
      return { success: false, error: "Set base fee, incentive and term before freezing." };
    }
  }
  await prisma.acqDeal.update({
    where: { id },
    data: { economicsFrozenAt: frozen ? new Date() : null },
  });
  revalidatePath(`/bd/deals/${id}`);
  revalidatePath("/bd/dashboard");
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
  revalidatePath("/bd/dashboard");
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
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id: att.id } };
}

export async function addAcqNote(
  dealId: string,
  input: { noteType: "NEGOTIATION" | "INTERNAL" | "GENERAL"; body: string }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  if (!input.body?.trim()) return { success: false, error: "Note body required" };
  const deal = await prisma.acqDeal.findFirst({
    where: { id: dealId, deletedAt: null },
    select: { propertyName: true, bdExecutiveId: true },
  });
  if (!deal) return { success: false, error: "Deal not found" };

  const note = await prisma.acqDealNote.create({
    data: { dealId, noteType: input.noteType, body: input.body.trim(), authorId: user.id },
    select: { id: true },
  });

  // Negotiation / change requests → alert Management + BD Heads + the BD owner,
  // so nothing the owner asks for is missed and the team stays in the loop.
  if (input.noteType === "NEGOTIATION") {
    await notifyDealStakeholders(deal.bdExecutiveId, {
      title: "Negotiation update",
      message: `${deal.propertyName}: ${input.body.trim().slice(0, 120)}`,
      actionUrl: `/bd/deals/${dealId}`,
      excludeUserId: user.id,
    });
  }

  revalidatePath(`/bd/deals/${dealId}`);
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id: note.id } };
}

/** Notify Management (admins) + BD Heads + the deal's BD owner. */
async function notifyDealStakeholders(
  bdExecutiveId: string,
  n: { title: string; message: string; actionUrl: string; excludeUserId?: string }
) {
  try {
    const recipients = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: { in: ["SUPER_ADMIN", "ADMIN", "BD_HEAD"] } },
          { id: bdExecutiveId },
        ],
      },
      select: { id: true },
    });
    const ids = new Set(recipients.map((r) => r.id));
    ids.delete(n.excludeUserId ?? "");
    for (const id of ids) {
      notify({ userId: id, type: "SYSTEM", title: n.title, message: n.message, actionUrl: n.actionUrl });
    }
  } catch (e) {
    console.error("[notifyDealStakeholders] error:", e);
  }
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
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id: dealId } };
}

export async function approveAcqDeal(dealId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "bdhead:approve")) return { success: false, error: "Only BD Head / Admin can approve." };
  const deal = await prisma.acqDeal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };
  // Idempotency: don't re-stamp an already-approved deal (a no-op).
  if (deal.bdHeadApprovedById) {
    return { success: true, data: { id: dealId } };
  }
  // Precondition: there must be commercials to approve.
  if (!deal.model) {
    return { success: false, error: "Set the deal model and commercials before approving." };
  }
  await prisma.acqDeal.update({
    where: { id: dealId },
    data: { bdHeadApprovedById: user.id, bdHeadApprovedAt: new Date() },
  });
  await prisma.acqDealNote.create({
    data: { dealId, noteType: "CHANGE_LOG", body: "BD Head approved the deal commercials.", authorId: user.id },
  });
  revalidatePath(`/bd/deals/${dealId}`);
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id: dealId } };
}

// ------------------------------------------------------------
// Edit Overview details (BD team) — logs every change for transparency
// ------------------------------------------------------------
export async function editAcqDealOverview(
  dealId: string,
  patch: {
    ownerName?: string;
    ownerType?: string;
    propertyName?: string;
    propertyType?: string;
    city?: string;
    locality?: string;
    seatingTheatre?: number | null;
    seatingFloating?: number | null;
  }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const deal = await prisma.acqDeal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };

  if (patch.ownerType && !ACQ_OWNER_TYPE.includes(patch.ownerType as never)) {
    return { success: false, error: "Invalid owner type" };
  }
  if (patch.propertyType && !ACQ_PROPERTY_TYPE.includes(patch.propertyType as never)) {
    return { success: false, error: "Invalid property type" };
  }

  const fields: (keyof typeof patch)[] = [
    "ownerName", "ownerType", "propertyName", "propertyType",
    "city", "locality", "seatingTheatre", "seatingFloating",
  ];
  const data: Record<string, unknown> = {};
  const changes: string[] = [];
  for (const k of fields) {
    if (patch[k] === undefined) continue;
    let v: unknown = patch[k];
    if (k === "seatingTheatre" || k === "seatingFloating") {
      v = v == null || v === "" ? null : Math.trunc(Number(v));
      if (v != null && !Number.isFinite(v)) v = null;
    }
    const before = (deal as Record<string, unknown>)[k];
    if (String(before ?? "") !== String(v ?? "")) {
      data[k] = v;
      changes.push(`${k}: "${before ?? "—"}" → "${v ?? "—"}"`);
    }
  }

  if (changes.length === 0) return { success: true, data: { id: dealId } };

  await prisma.acqDeal.update({ where: { id: dealId }, data });
  // Transparent change log — written as a note so it shows in the deal thread.
  await prisma.acqDealNote.create({
    data: {
      dealId,
      noteType: "CHANGE_LOG",
      body: changes.join("\n"),
      authorId: user.id,
    },
  });
  revalidatePath(`/bd/deals/${dealId}`);
  revalidatePath("/bd/dashboard");
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
      // A deal must not become terminal-Won without agreed commercials (P-1).
      // The normal path enforces this at PROPOSAL_SENT, but guard here too so
      // Won self-defends against imports / future legal-transition shortcuts.
      if (!deal.model) return { success: false, error: "Set the commercial model before marking the deal Won.", code: 422 };
      if (deal.model === "MANAGEMENT" && (deal.baseFeePct == null || deal.incentivePct == null)) {
        return { success: false, error: "A Won management deal needs base fee % and incentive %.", code: 422 };
      }
      if (deal.model === "FRANCHISE" && deal.royaltyPct == null) {
        return { success: false, error: "A Won franchise deal needs a royalty %.", code: 422 };
      }
      if (deal.termYears == null) return { success: false, error: "Set the term (years) before marking the deal Won.", code: 422 };
      if (deal.projectedFeeValue == null) {
        return { success: false, error: "Set the projected fee value before marking the deal Won.", code: 422 };
      }
      // Large-deal sign-off (P-2): a high-value Won needs explicit BD Head approval.
      if (Number(deal.projectedFeeValue) >= cfg.LARGE_DEAL_SIGNOFF_VALUE && !deal.bdHeadApprovedById) {
        return {
          success: false,
          error: `Deals at or above ₹${(cfg.LARGE_DEAL_SIGNOFF_VALUE / 100000).toFixed(1)}L need BD Head sign-off before they can be marked Won.`,
          code: 422,
        };
      }
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
        data: { propertyId: property.id, status: "OPEN", bdOwnerId: user.id, dealClosedDate: new Date() },
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
  revalidatePath("/bd/dashboard");
  revalidatePath("/bd/properties");
  return { success: true, data: { stage: toStage } };
}
