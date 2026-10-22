// ============================================================
// Writing a Meta venue-owner lead into the BD CRM (AcqLead).
// ------------------------------------------------------------
// The database half of owner-lead.ts: who gets it, is it already there, and
// the create itself — the same shape createAcqLead writes (normalised mobile,
// first-contact SLA in working hours, a stage transition), minus the session,
// because this runs from the Meta webhook / poll / import, not a screen.
// ============================================================

import { prisma } from "@/lib/prisma";
import { getAcqConfig } from "@/lib/acq/config";
import { addWorkingHours, isValidMobile, normalizeMobile } from "@/lib/acq/domain";
import { getSystemUserId } from "@/lib/lead-capture";
import { bdCandidatesForCity, type MappedOwnerLead } from "./owner-lead";

export type OwnerLeadOutcome =
  | { status: "created"; acqLeadId: string }
  | { status: "duplicate"; acqLeadId: string }
  | { status: "skipped"; reason: string };

const BD_ROLES = ["BD_HEAD", "BD_EXECUTIVE"] as const;

/**
 * The BD person for a city's next owner lead: the named candidate(s) for that
 * city (owner-lead.ts), shared by giving it to whoever holds fewer open leads.
 * Falls back to any active BD head, then null (the lead is then skipped and
 * logged, never silently given to the wrong person).
 */
export async function pickBdExecutive(city: string): Promise<string | null> {
  const bdUsers = await prisma.user.findMany({
    where: { isActive: true, role: { in: [...BD_ROLES] } },
    select: { id: true, name: true, role: true },
  });
  const firstName = (n: string | null) => (n ?? "").trim().split(/\s+/)[0].toLowerCase();
  const candidates = bdCandidatesForCity(city)
    .map((want) => bdUsers.find((u) => firstName(u.name) === want.toLowerCase()))
    .filter((u): u is (typeof bdUsers)[number] => !!u);
  const pool = candidates.length ? candidates : bdUsers.filter((u) => u.role === "BD_HEAD");
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0].id;

  const open = await prisma.acqLead.groupBy({
    by: ["bdExecutiveId"],
    where: { bdExecutiveId: { in: pool.map((u) => u.id) }, deletedAt: null, status: { in: ["NEW", "CONTACTED"] } },
    _count: { _all: true },
  });
  const load = (id: string) => open.find((o) => o.bdExecutiveId === id)?._count._all ?? 0;
  return [...pool].sort((a, b) => load(a.id) - load(b.id))[0].id;
}

/** Create the BD lead, or find the one this owner already has. */
export async function createAcqLeadFromMeta(
  mapped: MappedOwnerLead,
  opts: { enquiryAt: Date | null },
): Promise<OwnerLeadOutcome> {
  if (!mapped.phone || !isValidMobile(mapped.phone)) {
    return { status: "skipped", reason: "No usable mobile number in the answers" };
  }
  const mobile = normalizeMobile(mapped.phone);

  // One owner, one lead: the same person filling the form twice (or arriving
  // through two exports) must not become two BD leads to chase.
  const existing = await prisma.acqLead.findFirst({
    where: { mobilePrimary: mobile, deletedAt: null, status: { not: "DISQUALIFIED" } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { status: "duplicate", acqLeadId: existing.id };

  const bdExecutiveId = await pickBdExecutive(mapped.city);
  if (!bdExecutiveId) return { status: "skipped", reason: `No active BD user to assign ${mapped.city} owner leads to` };

  const cfg = await getAcqConfig();
  const now = new Date();
  // The SLA clock starts now, not at the enquiry: an imported lead from two
  // weeks ago is "call within the SLA from today", not "already overdue".
  const firstContactDue = addWorkingHours(now, cfg.LEAD_FIRST_CONTACT_SLA_HOURS);
  const enquiryAt = opts.enquiryAt && opts.enquiryAt.getTime() <= now.getTime() ? opts.enquiryAt : null;

  const lead = await prisma.acqLead.create({
    data: {
      ownerName: mapped.ownerName.slice(0, 200),
      mobilePrimary: mobile,
      email: mapped.email,
      propertyName: mapped.propertyName,
      propertyType: mapped.propertyType,
      city: mapped.city,
      locality: mapped.locality,
      propertyStage: mapped.propertyStage,
      qualOwnerInterested: mapped.qualOwnerInterested,
      notes: mapped.notes,
      leadSource: mapped.leadSource,
      ownerType: mapped.ownerType,
      bdExecutiveId,
      status: "NEW",
      firstContactDue,
      ...(enquiryAt ? { createdAt: enquiryAt } : {}),
    },
    select: { id: true },
  });

  const actorId = (await getSystemUserId()) || bdExecutiveId;
  await prisma.acqStageTransition
    .create({ data: { entity: "LEAD", entityId: lead.id, fromState: null, toState: "NEW", actorId } })
    .catch((e) => console.error("[MetaOwnerLead] stage transition failed", lead.id, e));

  return { status: "created", acqLeadId: lead.id };
}
