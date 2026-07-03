// Shared deal → property → onboarding-project conversion.
//
// Lives outside the "use server" action files so it can take a Prisma
// TransactionClient (a non-serializable arg that must NOT become a server-action
// endpoint). Reused by the WON state transition and the post-signing
// convertDealToProject handoff so both produce an identical property + project.

import type { Prisma, AcqPropertyType, PropertyType, CommercialModel } from "@prisma/client";
import { ONBOARDING_SEED_TASKS } from "@/lib/acq/constants";

// The minimal deal snapshot the property/onboarding creation needs.
export type DealSnapshot = {
  id: string;
  propertyName: string;
  propertyType: AcqPropertyType;
  ownerName: string;
  city: string;
  locality: string;
  seatingTheatre: number | null;
  seatingFloating: number | null;
  // Optional — used to seed the acquired-property Hall Owner CRM record on win.
  // Full AcqDeal records carry these; the type keeps them optional so lighter
  // snapshots (e.g. imports) still satisfy it.
  bdExecutiveId?: string | null;
  model?: string | null; // AcqDealModel: MANAGEMENT | FRANCHISE
  baseFeePct?: Prisma.Decimal | number | null;
  royaltyPct?: Prisma.Decimal | number | null;
};

// AcqPropertyType (deal/property vocabulary) → HallOwner.PropertyType (owner CRM
// vocabulary). The two enums don't line up 1:1, so anything without a clean
// mapping falls back to MIXED.
const HALL_OWNER_PROPERTY_TYPE: Record<AcqPropertyType, PropertyType> = {
  BANQUET: "BANQUET_HALL",
  MARRIAGE_HALL: "MARRIAGE_GARDEN",
  CONVENTION_CENTRE: "CONVENTION_CENTER",
  RESORT: "MIXED",
  LAWN: "MARRIAGE_GARDEN",
};

// AcqDealModel → HallOwner.CommercialModel (best-effort; unknown → undefined).
function hallOwnerCommercialModel(model: string | null | undefined): CommercialModel | undefined {
  if (model === "MANAGEMENT") return "MANAGEMENT_FEE";
  if (model === "FRANCHISE") return "REVENUE_SHARE";
  return undefined;
}

/**
 * Idempotently create the ONBOARDING property + onboarding project + seed tasks
 * for a won/signed deal, inside the given transaction client. Single source of
 * truth for the deal→property→project conversion.
 *
 * Returns the property + project ids and the property name. Safe to call twice:
 * if the property already exists it is reused, and the onboarding project +
 * seed tasks are only created when missing.
 */
export async function ensureDealProperty(
  tx: Prisma.TransactionClient,
  deal: DealSnapshot,
  actorId: string
): Promise<{ propertyId: string; projectId: string; propertyName: string; created: boolean }> {
  let created = false;
  let property = await tx.acqProperty.findUnique({
    where: { dealId: deal.id },
    select: { id: true, propertyName: true },
  });
  if (!property) {
    property = await tx.acqProperty.create({
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
      select: { id: true, propertyName: true },
    });
    created = true;
    await tx.acqDeal.update({ where: { id: deal.id }, data: { propertyId: property.id } });
    await tx.acqStageTransition.create({
      data: { entity: "PROPERTY", entityId: property.id, fromState: null, toState: "ONBOARDING", actorId },
    });
  }

  // Onboarding project (1:1 with property) — create only if missing.
  let project = await tx.acqOnboardingProject.findUnique({
    where: { propertyId: property.id },
    select: { id: true },
  });
  if (!project) {
    project = await tx.acqOnboardingProject.create({
      data: { propertyId: property.id, status: "OPEN", bdOwnerId: actorId, dealClosedDate: new Date() },
      select: { id: true },
    });
    await tx.acqOnboardingTask.createMany({
      data: ONBOARDING_SEED_TASKS.map((title) => ({ projectId: project!.id, title })),
    });
  }

  // Hall Owner CRM record (§ acquired-property owner). Created alongside the
  // property so a won deal always yields BOTH an AcqProperty AND a HallOwner.
  // NOTE (flagged schema gap): HallOwner has no dealId/propertyId FK, so the link
  // back to the deal/property is by shared ownerName + city + bdOwner rather than
  // a relation. If a hard link is needed, add `dealId String? @unique` (and/or
  // `propertyId`) to HallOwner and switch the idempotency guard below to it.
  await ensureDealHallOwner(tx, deal);

  return { propertyId: property.id, projectId: project.id, propertyName: property.propertyName, created };
}

/**
 * Idempotently create the HallOwner CRM record for a won deal. Guarded by
 * (ownerName + propertyCity + bdOwner, not deleted) since HallOwner carries no
 * deal/property FK. Safe to call twice — reuses an existing matching owner.
 */
async function ensureDealHallOwner(
  tx: Prisma.TransactionClient,
  deal: DealSnapshot
): Promise<string> {
  const existing = await tx.hallOwner.findFirst({
    where: {
      deletedAt: null,
      ownerName: deal.ownerName,
      propertyCity: deal.city,
      ...(deal.bdExecutiveId ? { bdOwnerId: deal.bdExecutiveId } : {}),
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const totalCapacity =
    deal.seatingTheatre ?? deal.seatingFloating ?? null;
  const revenueSharePct =
    deal.model === "FRANCHISE"
      ? deal.royaltyPct ?? null
      : deal.model === "MANAGEMENT"
        ? deal.baseFeePct ?? null
        : null;

  const owner = await tx.hallOwner.create({
    data: {
      ownerName: deal.ownerName,
      propertyCity: deal.city,
      propertyType: HALL_OWNER_PROPERTY_TYPE[deal.propertyType] ?? "MIXED",
      numberOfHalls: 1,
      totalCapacity,
      commercialModel: hallOwnerCommercialModel(deal.model),
      revenueSharePercent: revenueSharePct as never,
      // A won deal means the owner is signed & onboarding into the platform.
      contractStatus: "SIGNED",
      bdOwnerId: deal.bdExecutiveId ?? null,
    },
    select: { id: true },
  });
  return owner.id;
}
