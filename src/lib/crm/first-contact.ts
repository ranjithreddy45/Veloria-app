import { prisma } from "@/lib/prisma";
import { awardVelos } from "@/lib/velos/award";
import { velosOnLeadContact } from "@/lib/velos/triggers";

// ============================================================
// First contact on a Sales lead — stopping the SLA clock, and paying for it.
//
// TWO THINGS WERE DISCONNECTED HERE.
//
// 1. The speed-to-lead SLA never stopped. `Lead.firstRespondedAt` is READ in
//    four places (quality.actions, sla-warroom) and was WRITTEN in none. The
//    clock started on capture and ran forever, so every lead looked permanently
//    un-responded no matter how fast a rep called — which makes the
//    Speed-to-Lead page and the War Room say the same thing about everyone, and
//    therefore say nothing.
//
// 2. The Sales CRM awarded no Velos at all. VELOS_DEFAULTS has carried
//    "contacted" (5), "contact_logged_before_sla" (20) and
//    "contact_logged_within_15min" (10) since the engine shipped, and the only
//    caller of velosOnLeadContact was the BD module. A sales rep scored points
//    when money landed or a task was ticked; the calling that produced the money
//    was worth nothing.
//
// Both are the same omission — the read side was built, the write side was not —
// and both are fixed by the one place a rep records having spoken to someone.
// ============================================================

/** How fast counts as "instant" for the bonus. */
const FAST_RESPONSE_MS = 15 * 60 * 1000;

/**
 * Record that a rep actually spoke to this lead.
 *
 * ONLY call this for a genuine outbound contact (a logged CALL), never for an
 * internal note. An internal note is not contact with the customer, and letting
 * it stop the SLA clock would turn the entire speed-to-lead metric into
 * "did someone type something", which is worse than not measuring at all.
 *
 * Best-effort throughout: a rep logging a call must never see it fail because a
 * points ledger or an SLA column would not update.
 */
export async function recordFirstContact(
  leadId: string | null | undefined,
  actorId: string
): Promise<void> {
  if (!leadId) return;
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        createdAt: true,
        firstContactDue: true,
        firstRespondedAt: true,
        assignedToId: true,
      },
    });
    if (!lead) return;

    const now = new Date();

    // Award "contacted" WITHOUT a keySuffix on purpose.
    //
    // awardVelos keys on `entityId:eventType`, so this pays exactly once per
    // lead however many calls get logged against it. That is the whole
    // anti-gaming design: points come from working MORE leads, not from logging
    // the same lead repeatedly. No daily cap or rate limiter needed — the
    // idempotency already there does it.
    await awardVelos(prisma, {
      userId: actorId,
      eventType: "contacted",
      entityType: "lead",
      entityId: lead.id,
    }).catch(() => {
      /* points are never worth failing the action for */
    });

    // Everything below is first-contact only.
    if (lead.firstRespondedAt) return;

    // Stop the clock. Guarded on firstRespondedAt still being null so two
    // concurrent logs cannot both claim the first response.
    await prisma.lead.updateMany({
      where: { id: lead.id, firstRespondedAt: null },
      data: { firstRespondedAt: now },
    });

    // Speed bonuses. Credited to the lead's OWNER rather than whoever typed it:
    // the SLA belongs to the person the lead is assigned to, and crediting a
    // manager who logged a call on someone else's lead would quietly move their
    // score. Falls back to the actor when the lead has no owner.
    const ownerId = lead.assignedToId ?? actorId;
    await velosOnLeadContact({
      leadId: lead.id,
      ownerId,
      withinSla: lead.firstContactDue ? now <= lead.firstContactDue : false,
      within15Min: now.getTime() - lead.createdAt.getTime() <= FAST_RESPONSE_MS,
    });
  } catch (e) {
    console.error("[FIRST_CONTACT] failed for lead", leadId, e);
  }
}
