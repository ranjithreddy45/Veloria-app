"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { isSafeReceiptUrl, isSafeReceiptDataUrl } from "@/lib/sales/receipt";
import { ensureDealProperty } from "@/lib/acq/conversion";
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
  ACQ_LOST_REASON,
  ACQ_DEAL_MODEL,
  ACQ_RM_PRICE_BASIS,
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

// The five REVENUE_MARGIN economics columns. This model quotes ABSOLUTE prices
// (owner-guaranteed base vs. the price we expect to sell at), so the percentage
// floors in requiresBdHeadApproval (base fee / incentive / royalty) do not apply
// to it — every gate below asks for these fields instead.
const RM_ECONOMICS_KEYS = [
  "rmBasePrice",
  "rmBestPrice",
  "rmPriceBasis",
  "rmHallCapacity",
  "rmMinimumPax",
] as const;

/**
 * Which REVENUE_MARGIN economics are still missing, as a human list — shared by
 * the freeze precondition and the PROPOSAL_SENT / WON stage gates so a rep never
 * sees a demand for a fee % this model doesn't have.
 */
function rmMissingEconomics(d: {
  rmBasePrice: unknown;
  rmBestPrice: unknown;
  rmPriceBasis: string | null;
  rmHallCapacity: number | null;
  rmMinimumPax: number | null;
}): string | null {
  const missing: string[] = [];
  if (d.rmBasePrice == null) missing.push("a base price");
  if (d.rmBestPrice == null) missing.push("a best price");
  if (!d.rmPriceBasis) missing.push("a price basis (per event / per pax)");
  if (d.rmPriceBasis === "PER_PAX") {
    // Per-pax volume is bounded by the hall and floored by the minimum, so both
    // are required before the economics mean anything.
    if (d.rmHallCapacity == null) missing.push("the hall capacity");
    if (d.rmMinimumPax == null) missing.push("a minimum billable pax");
  }
  return missing.length > 0 ? missing.join(", ") : null;
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
      lead: true, // full linked lead record so the UI can view/edit lead-stage details
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
    // Deal-preview commercial dates/fees (BD CRM)
    "expectedSigningDate", "taFees", "expectedCollectionDate",
    // REVENUE_MARGIN economics (absolute prices — see RM_ECONOMICS_KEYS)
    ...RM_ECONOMICS_KEYS,
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in patch) data[k] = patch[k];
  }
  if (data.model != null && !ACQ_DEAL_MODEL.includes(data.model as never)) {
    return { success: false, error: "Invalid model" };
  }

  // Once economics are frozen, the agreed commercials are immutable. The
  // Revenue-Margin prices are that model's agreed commercials, so they lock too.
  if (deal.economicsFrozenAt) {
    for (const locked of ["baseFeePct", "incentivePct", "royaltyPct", "termYears", ...RM_ECONOMICS_KEYS]) {
      if (locked in data) {
        return { success: false, error: "Economics are frozen — base fee, incentive, royalty, term and the Revenue-Margin prices can't be changed." };
      }
    }
  }

  // ---- REVENUE_MARGIN validation (absolute prices, not percentages) ----
  // Money: ≥ 0, or null to clear.
  for (const k of ["rmBasePrice", "rmBestPrice"] as const) {
    if (!(k in data)) continue;
    if (data[k] == null || data[k] === "") { data[k] = null; continue; }
    const n = Number(data[k]);
    if (!Number.isFinite(n) || n < 0) {
      return { success: false, error: `${k === "rmBasePrice" ? "Base" : "Best"} price must be a number ≥ 0.` };
    }
    data[k] = n;
  }
  // Head counts: whole numbers ≥ 1. Rejected rather than truncated — silently
  // turning 250.5 pax into 250 would change the owner's economics behind them.
  for (const k of ["rmHallCapacity", "rmMinimumPax"] as const) {
    if (!(k in data)) continue;
    if (data[k] == null || data[k] === "") { data[k] = null; continue; }
    const n = Number(data[k]);
    if (!Number.isInteger(n) || n < 1) {
      return {
        success: false,
        error: `${k === "rmHallCapacity" ? "Hall capacity" : "Minimum pax"} must be a whole number ≥ 1.`,
      };
    }
    data[k] = n;
  }
  if ("rmPriceBasis" in data) {
    if (data.rmPriceBasis == null || data.rmPriceBasis === "") {
      data.rmPriceBasis = null;
    } else if (!ACQ_RM_PRICE_BASIS.includes(data.rmPriceBasis as never)) {
      return { success: false, error: "Price basis must be per event or per pax." };
    }
  }
  // Cross-field checks run on the MERGED view (patch ∪ stored) so patching one
  // field can't leave an invalid pair with what is already on the deal.
  const rmEff = (k: (typeof RM_ECONOMICS_KEYS)[number]): number | null => {
    const v = k in data ? data[k] : (deal as Record<string, unknown>)[k];
    return v == null ? null : Number(v);
  };
  const rmBase = rmEff("rmBasePrice");
  const rmBest = rmEff("rmBestPrice");
  if (rmBase != null && rmBest != null && rmBest < rmBase) {
    // A best price under the guaranteed base is a data-entry error: it would
    // project a negative margin on every event.
    return { success: false, error: "Best price can't be lower than the base price (that would be a negative margin)." };
  }
  const rmCapacity = rmEff("rmHallCapacity");
  const rmMinPax = rmEff("rmMinimumPax");
  if (rmCapacity != null && rmMinPax != null && rmMinPax > rmCapacity) {
    return { success: false, error: "Minimum pax can't exceed the hall capacity." };
  }
  // Coerce date strings → Date for every date field; null clears them.
  for (const dk of ["expectedCloseDate", "expectedSigningDate", "expectedCollectionDate"]) {
    if (dk in data) {
      const v = data[dk];
      data[dk] = v == null || v === "" ? null : new Date(v as string);
    }
  }

  // Defense in depth: never let a NaN/Infinity reach a numeric column, and
  // truncate the Int-only year fields so a decimal can't make Prisma throw.
  const numericFields = [
    "ownerCurrentMonthlyRevenue", "avgEventsPerMonth", "peakRateCard",
    "baseFeePct", "incentivePct", "royaltyPct", "termYears", "lockinYears",
    "expectedMonthlyEvents", "projectedFeeValue", "banquetSizeSft", "taFees",
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
    const commercialKeys = ["model", "baseFeePct", "incentivePct", "royaltyPct", "lockinYears", "termYears", ...RM_ECONOMICS_KEYS];
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
  const logKeys = ["model", "baseFeePct", "incentivePct", "royaltyPct", "termYears", "lockinYears", ...RM_ECONOMICS_KEYS];
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
// Property photos captured on the deal (AcqDeal.images) — base64 image
// data-URLs. Displayed on the linked property's detail. Guarded the same way
// as other deal writes (lead:write). Only safe image data-URLs are stored.
// ------------------------------------------------------------
export async function updateAcqDealImages(
  id: string,
  images: string[]
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const deal = await prisma.acqDeal.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!deal) return { success: false, error: "Deal not found" };

  const safe = (Array.isArray(images) ? images : [])
    .filter((v): v is string => typeof v === "string")
    .filter((v) => isSafeReceiptDataUrl(v) && v.startsWith("data:image/"))
    .slice(0, 24);

  await prisma.acqDeal.update({ where: { id }, data: { images: safe } });
  revalidatePath(`/bd/deals/${id}`);
  revalidatePath("/bd/properties");
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
    if (deal.model === "REVENUE_MARGIN") {
      // This model has no base fee / incentive % to freeze — its agreed
      // commercials are the absolute base/best prices.
      const missing = rmMissingEconomics(deal);
      if (missing) {
        return { success: false, error: `Set the Revenue-Margin economics before freezing — missing ${missing}.` };
      }
      if (deal.termYears == null) {
        return { success: false, error: "Set the term (years) before freezing." };
      }
    } else if (deal.baseFeePct == null || deal.incentivePct == null || deal.termYears == null) {
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
  const url = (input.url ?? "").trim();
  if (!url) return { success: false, error: "URL required" };
  // Reject anything that isn't a safe image/PDF data-URL or an https link — the
  // EVALUATION photo gate counts these, so a bare/broken/unsafe string must not
  // slip through. Also cap the size so an oversized data-URL can't bloat the row.
  if (url.length > 9_000_000) {
    return { success: false, error: "File is too large — please upload a smaller image or PDF (max ~9 MB)." };
  }
  if (!isSafeReceiptUrl(url)) {
    return { success: false, error: "Upload an image/PDF, or enter a valid https:// link." };
  }
  const att = await prisma.acqAttachment.create({
    data: { dealId, kind: input.kind, url, label: input.label || null, uploadedById: user.id },
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
  // Segregation of duties: the deal owner can't approve their own deal (except SUPER_ADMIN).
  if (deal.bdExecutiveId === user.id && user.role !== "SUPER_ADMIN") {
    return { success: false, error: "A different BD Head must approve a deal you own." };
  }
  // Idempotency: don't re-stamp an already-approved deal (a no-op).
  if (deal.bdHeadApprovedById) {
    return { success: true, data: { id: dealId } };
  }
  // Precondition: there must be commercials to approve.
  if (!deal.model) {
    return { success: false, error: "Set the deal model and commercials before approving." };
  }

  // When the BD Head approves a high-value deal (>= ₹15L projected fee), the same
  // approval also records the dedicated large-deal Won sign-off (largeDealSignoffById).
  // This is what makes the large-deal Won gate reachable: "approve" is the only
  // BD-Head-only governance control wired into the deal UI, and the segregation-of-duties
  // check above already guarantees the approver is not the deal owner. The two gate
  // fields stay distinct in the schema/state-machine — we simply stamp both from the one
  // authorized BD-Head action so a >= ₹15L deal can actually progress to Won.
  const cfg = await getAcqConfig();
  const isLargeDeal =
    deal.projectedFeeValue != null &&
    Number(deal.projectedFeeValue) >= cfg.LARGE_DEAL_SIGNOFF_VALUE;

  await prisma.acqDeal.update({
    where: { id: dealId },
    data: {
      bdHeadApprovedById: user.id,
      bdHeadApprovedAt: new Date(),
      ...(isLargeDeal && !deal.largeDealSignoffById
        ? { largeDealSignoffById: user.id, largeDealSignoffAt: new Date() }
        : {}),
    },
  });
  await prisma.acqDealNote.create({
    data: { dealId, noteType: "CHANGE_LOG", body: "BD Head approved the deal commercials.", authorId: user.id },
  });
  if (isLargeDeal && !deal.largeDealSignoffById) {
    await prisma.acqDealNote.create({
      data: { dealId, noteType: "CHANGE_LOG", body: "BD Head signed off the large deal for Won.", authorId: user.id },
    });
  }
  revalidatePath(`/bd/deals/${dealId}`);
  revalidatePath("/bd/dashboard");
  return { success: true, data: { id: dealId } };
}

// Dedicated large-deal WON sign-off (P-2). Distinct from the below-floor
// CONTRACT_SENT approval (bdHeadApprovedById): a high-value Won needs its own
// explicit BD Head stamp so one approval can't silently satisfy both gates.
export async function signoffLargeDeal(dealId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "bdhead:approve")) return { success: false, error: "Only BD Head / Admin can sign off a large deal." };
  const deal = await prisma.acqDeal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) return { success: false, error: "Deal not found" };
  // Segregation of duties: the deal owner can't sign off their own large deal (except SUPER_ADMIN).
  if (deal.bdExecutiveId === user.id && user.role !== "SUPER_ADMIN") {
    return { success: false, error: "A different BD Head must approve a deal you own." };
  }
  // Idempotency: don't re-stamp an already-signed-off deal.
  if (deal.largeDealSignoffById) {
    return { success: true, data: { id: dealId } };
  }
  if (deal.projectedFeeValue == null) {
    return { success: false, error: "Set the projected fee value before signing off." };
  }
  await prisma.acqDeal.update({
    where: { id: dealId },
    data: { largeDealSignoffById: user.id, largeDealSignoffAt: new Date() },
  });
  await prisma.acqDealNote.create({
    data: { dealId, noteType: "CHANGE_LOG", body: "BD Head signed off the large deal for Won.", authorId: user.id },
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
      // REVENUE_MARGIN carries absolute prices instead of a fee/royalty % —
      // require ITS fields, never the percentages it doesn't have.
      if (deal.model === "REVENUE_MARGIN") {
        const missing = rmMissingEconomics(deal);
        if (missing) {
          return { success: false, error: `Revenue Margin model needs ${missing}.`, code: 422 };
        }
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
      if (deal.model === "REVENUE_MARGIN") {
        const missing = rmMissingEconomics(deal);
        if (missing) {
          return { success: false, error: `A Won Revenue Margin deal needs ${missing}.`, code: 422 };
        }
      }
      if (deal.termYears == null) return { success: false, error: "Set the term (years) before marking the deal Won.", code: 422 };
      if (deal.projectedFeeValue == null) {
        return { success: false, error: "Set the projected fee value before marking the deal Won.", code: 422 };
      }
      // Large-deal sign-off (P-2): a high-value Won needs its own dedicated BD
      // Head sign-off (largeDealSignoffById) — NOT the below-floor CONTRACT_SENT
      // approval (bdHeadApprovedById), so one approval can't satisfy both gates.
      if (Number(deal.projectedFeeValue) >= cfg.LARGE_DEAL_SIGNOFF_VALUE && !deal.largeDealSignoffById) {
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
      // §6.1 — create Property (ONBOARDING), onboarding project + seed tasks
      // via the shared idempotent helper (also used by convertDealToProject).
      const res = await ensureDealProperty(tx, deal, user.id);
      createdPropertyId = res.propertyId;
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
