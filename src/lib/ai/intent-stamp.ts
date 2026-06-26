// ============================================================
// Intent stamping — side-effecting orchestrator
// ============================================================
// Plain library (NOT "use server"): callable from the WhatsApp webhook route,
// logCommunication action, lead-capture, and a cron backfill lane. Classifies
// an inbound message, persists a MessageIntentClassification audit row, and
// denormalizes the latest intent onto the resolved lead(s). On a confident
// READY_TO_BUY it applies a ONE-SHOT worklist score boost and pings the
// assigned rep — guarded by the per-classification scoreBoostApplied /
// repNotifiedAt flags so re-classification or webhook redelivery never
// double-boosts or double-pings. Best-effort: swallows all errors, never throws.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { classifyIntent, type MessageIntent } from "@/lib/ai/intent";

// One-shot score bump applied to a lead on a confident READY_TO_BUY signal.
export const INTENT_HOT_BOOST = 15;
// Worklist sort field ceiling — keep boosted score bounded.
const SCORE_CEILING = 100;
// Only boost/ping when the engine is reasonably sure.
const HOT_CONFIDENCE_THRESHOLD = 0.6;

export interface StampMessageIntentArgs {
  text: string;
  whatsappMessageId?: string;
  communicationId?: string;
  contactId?: string;
  leadId?: string;
}

/**
 * Resolve the open leads this message should stamp. If an explicit leadId is
 * given, use it. Otherwise mirror stampLeadResponded's scope: every NEW/
 * CONTACTED, non-deleted lead for the contact.
 */
async function resolveLeadIds(args: StampMessageIntentArgs): Promise<string[]> {
  if (args.leadId) return [args.leadId];
  if (!args.contactId) return [];
  try {
    const leads = await prisma.lead.findMany({
      where: {
        contactId: args.contactId,
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED"] },
      },
      select: { id: true },
      take: 50,
    });
    return leads.map((l) => l.id);
  } catch (e) {
    console.error("[stampMessageIntent] resolveLeadIds error:", e);
    return [];
  }
}

export async function stampMessageIntent(
  args: StampMessageIntentArgs
): Promise<void> {
  try {
    const text = (args.text || "").trim();
    if (!text) return;

    // ---- (1) Classify (LLM-first, keyword fallback). -------------------
    const result = await classifyIntent(text);

    // ---- (2) Resolve target lead(s). -----------------------------------
    const leadIds = await resolveLeadIds(args);
    const primaryLeadId = leadIds[0] ?? args.leadId ?? null;

    // ---- (3) Persist the classification audit row. ---------------------
    let classificationId: string | null = null;
    try {
      const created = await prisma.messageIntentClassification.create({
        data: {
          whatsappMessageId: args.whatsappMessageId ?? null,
          communicationId: args.communicationId ?? null,
          contactId: args.contactId ?? null,
          leadId: primaryLeadId,
          intent: result.intent,
          confidence: new Prisma.Decimal(result.confidence.toFixed(3)),
          method: result.method,
          rawText: text.slice(0, 4000),
        },
        select: { id: true },
      });
      classificationId = created.id;
    } catch (e) {
      console.error("[stampMessageIntent] classification write error:", e);
    }

    // ---- (4) Denormalize latest intent onto the resolved open leads. ---
    if (leadIds.length > 0) {
      try {
        await prisma.lead.updateMany({
          where: { id: { in: leadIds } },
          data: { intent: result.intent, intentAt: new Date() },
        });
      } catch (e) {
        console.error("[stampMessageIntent] intent denorm error:", e);
      }
    }

    // ---- (5) READY_TO_BUY → one-shot boost + rep ping. -----------------
    if (
      result.intent === ("READY_TO_BUY" as MessageIntent) &&
      result.confidence >= HOT_CONFIDENCE_THRESHOLD &&
      classificationId
    ) {
      await applyHotBoost(classificationId, leadIds, primaryLeadId);
    }
  } catch (e) {
    console.error("[stampMessageIntent] error:", e);
  }
}

/**
 * Apply the one-shot boost + ping. The MessageIntentClassification flags
 * (scoreBoostApplied / repNotifiedAt) are the dedupe key — a conditional
 * updateMany ensures only ONE concurrent caller wins, so a redelivered or
 * re-classified message never double-boosts/double-pings.
 */
async function applyHotBoost(
  classificationId: string,
  leadIds: string[],
  primaryLeadId: string | null
): Promise<void> {
  try {
    // Claim the one-shot. updateMany with a guard returns count 0 if already
    // applied (another concurrent stamp won the race).
    const claim = await prisma.messageIntentClassification.updateMany({
      where: { id: classificationId, scoreBoostApplied: 0, repNotifiedAt: null },
      data: { scoreBoostApplied: INTENT_HOT_BOOST, repNotifiedAt: new Date() },
    });
    if (claim.count === 0) return; // already handled

    if (leadIds.length === 0) return;

    // Boost each resolved lead's worklist score, clamped to the ceiling.
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, score: true, assignedToId: true, title: true },
    });

    for (const lead of leads) {
      const current = lead.score ?? 0;
      if (current >= SCORE_CEILING) continue;
      const next = Math.min(SCORE_CEILING, current + INTENT_HOT_BOOST);
      try {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { score: next },
        });
      } catch (e) {
        console.error("[applyHotBoost] score update error:", e);
      }
    }

    // Ping the assigned rep of the primary lead (fire-and-forget; safe in
    // webhook/cron context — notify() does not call revalidatePath).
    const primary =
      leads.find((l) => l.id === primaryLeadId) ?? leads[0] ?? null;
    if (primary?.assignedToId) {
      notify({
        userId: primary.assignedToId,
        title: "🔥 Ready-to-buy signal",
        message: `${
          primary.title || "A lead"
        } just sent a strong buying signal. Reach out now — they're at the top of your worklist.`,
        type: "SLA_WARNING",
        actionUrl: `/leads/${primary.id}`,
      });

      logActivity({
        action: "INTENT_HOT_PING",
        entityType: "lead",
        entityId: primary.id,
        changes: { intent: "READY_TO_BUY", boost: INTENT_HOT_BOOST },
        userId: primary.assignedToId,
      }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));
    }
  } catch (e) {
    console.error("[applyHotBoost] error:", e);
  }
}
