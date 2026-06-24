// Shared deal → property → onboarding-project conversion.
//
// Lives outside the "use server" action files so it can take a Prisma
// TransactionClient (a non-serializable arg that must NOT become a server-action
// endpoint). Reused by the WON state transition and the post-signing
// convertDealToProject handoff so both produce an identical property + project.

import type { Prisma, AcqPropertyType } from "@prisma/client";
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
};

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

  return { propertyId: property.id, projectId: project.id, propertyName: property.propertyName, created };
}
