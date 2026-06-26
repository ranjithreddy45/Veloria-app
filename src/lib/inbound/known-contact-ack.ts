// ============================================================
// Inbound — known-contact auto-ack + smart routing + lead re-wake.
// ------------------------------------------------------------
// When a KNOWN Contact (matched by phone in the WhatsApp webhook) messages in,
// this single best-effort function:
//   (1) loads the contact (bail if no phone),
//   (2) finds their most-recent still-open lead (NOT WON/LOST, not deleted),
//   (3) routes to an available rep via the shared SMART router
//       (chooseSmartAssignee) with a graceful fallback chain: existing assignee
//       (kept if still SMART-eligible) → chooseSmartAssignee → evaluateAssignmentRules
//       (ROUND_ROBIN) → getSystemUserId,
//   (4) writes a LeadRoutingDecision audit row via recordRoutingDecision,
//   (5) re-wakes the open lead (re-opens the first-response SLA window + clears
//       cooling) and enrolls it into the re-warm cadence (idempotent),
//   (6) sends a plain-text WhatsApp ack (deliverable inside Meta's 24h window),
//       mirrored to WhatsAppMessage, and
//   (7) notifies the routed rep (awaited — serverless-safe).
//
// INVARIANTS: never throws (the webhook must always 200 to Meta); idempotent
// against duplicate webhook redeliveries (the webhook's whatsappId dedupe gates
// re-entry) PLUS an anti-double-ack window so rapid bursts don't re-ack. Runs
// session-free — exactly like runSpeedToLead / handleInboundReply.
//
// REUSE (per spec): the rep-availability lib + actions are owned by the routing
// agent — this file imports chooseSmartAssignee / recordRoutingDecision from
// @/lib/routing/smart-router rather than recreating any routing logic.
//
// SECURITY: the ack text carries ONLY the contact + rep first names (no lead
// value, rep id, or pricing). Re-wake mutates ONLY the single most-recent open
// lead — never the contact's whole lead history. WON/LOST leads are never
// resurrected.
// ============================================================

import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { notifyAwait } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";
import { getSystemUserId } from "@/lib/lead-capture";
import { leadSlaDeadline } from "@/lib/lead-pipeline";
import {
  chooseSmartAssignee,
  recordRoutingDecision,
} from "@/lib/routing/smart-router";
import {
  DOUBLE_ACK_WINDOW_MS,
  buildKnownAckText,
  firstNameOf,
  resolveRewarmCadenceId,
} from "@/lib/inbound/known-ack-config";

export interface HandleKnownContactAckOpts {
  inboundText?: string;
  inboundMessageId?: string;
}

export interface HandleKnownContactAckResult {
  ok: boolean;
  acked: boolean;
  routedToId: string | null;
  rewokeLeadId: string | null;
  reason?: string;
}

const CLOSED_STATUSES: ("WON" | "LOST")[] = ["WON", "LOST"];

/** Best-effort: enroll a lead into a cadence, idempotent on (cadenceId, entityId). */
async function enrollLeadInCadence(
  cadenceId: string,
  leadId: string,
  enrolledById: string
): Promise<void> {
  try {
    const existing = await prisma.cadenceEnrollment.findUnique({
      where: { cadenceId_entityId: { cadenceId, entityId: leadId } },
      select: { id: true },
    });
    if (existing) return; // idempotent — already enrolled

    const cadence = await prisma.cadence.findUnique({
      where: { id: cadenceId },
      select: {
        status: true,
        steps: {
          orderBy: { order: "asc" },
          take: 1,
          select: { delayDays: true, delayHours: true },
        },
      },
    });
    if (!cadence || cadence.status !== "ACTIVE") return;

    const firstStep = cadence.steps[0];
    const nextExecuteAt = firstStep
      ? new Date(
          Date.now() +
            firstStep.delayDays * 24 * 60 * 60 * 1000 +
            firstStep.delayHours * 60 * 60 * 1000
        )
      : null;

    await prisma.cadenceEnrollment.create({
      data: {
        cadenceId,
        entityId: leadId,
        enrolledById,
        status: "ACTIVE",
        currentStepOrder: 0,
        nextExecuteAt,
      },
    });
  } catch (e) {
    // P2002 (race on the unique) and any other error are non-fatal.
    console.error("[known-contact-ack] enroll error:", e);
  }
}

/**
 * Handle a known contact's inbound WhatsApp: ack + smart route + re-wake.
 * Self-contained, idempotent, never throws. Returns diagnostics.
 */
export async function handleKnownContactAck(
  contactId: string,
  opts: HandleKnownContactAckOpts = {}
): Promise<HandleKnownContactAckResult> {
  void opts; // reserved for future intent-aware copy; signature kept stable.
  try {
    // ---- (1) Load contact; bail if no phone. -----------------------------
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { firstName: true, phone: true, alternatePhone: true },
    });
    const phone = contact?.phone?.trim() || contact?.alternatePhone?.trim() || "";
    if (!phone) {
      return {
        ok: true,
        acked: false,
        routedToId: null,
        rewokeLeadId: null,
        reason: "no_phone",
      };
    }

    // ---- (2) Most-recent still-open lead for this contact. ---------------
    const openLead = await prisma.lead.findFirst({
      where: {
        contactId,
        deletedAt: null,
        status: { notIn: CLOSED_STATUSES },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        eventType: true,
        assignedToId: true,
      },
    });

    // ---- (3) Resolve rep. Fallback chain, never route to nobody. ---------
    let routedToId: string | null = null;
    let routingMethod: "SMART" | "ROUND_ROBIN" | "DIRECT" = "SMART";
    let matchedEventType = false;
    let matchedLanguage = false;
    let repLoadAtDecision = 0;
    let scoreBreakdown: Record<string, unknown> = {};

    // (a) Keep the current assignee if SMART still considers them eligible.
    if (openLead?.assignedToId) {
      const sticky = await chooseSmartAssignee({
        team: [openLead.assignedToId],
        eventType: openLead.eventType,
      });
      if (sticky && sticky.assigneeId === openLead.assignedToId) {
        routedToId = sticky.assigneeId;
        routingMethod = "DIRECT";
        matchedEventType = sticky.matchedEventType;
        matchedLanguage = sticky.matchedLanguage;
        repLoadAtDecision = sticky.repLoadAtDecision;
        scoreBreakdown = { ...sticky.scoreBreakdown, sticky: true };
      }
    }

    // (b) Smart pick across the full eligible pool.
    if (!routedToId) {
      const picked = await chooseSmartAssignee({
        eventType: openLead?.eventType ?? null,
      });
      if (picked) {
        routedToId = picked.assigneeId;
        routingMethod = "SMART";
        matchedEventType = picked.matchedEventType;
        matchedLanguage = picked.matchedLanguage;
        repLoadAtDecision = picked.repLoadAtDecision;
        scoreBreakdown = picked.scoreBreakdown as unknown as Record<string, unknown>;
      }
    }

    // (c) ROUND_ROBIN via assignment rules (RepAvailability table empty/stale).
    if (!routedToId) {
      try {
        const candidate = await evaluateAssignmentRules({
          source: "whatsapp",
          eventType: openLead?.eventType ?? "",
          status: openLead?.status ?? "",
          guestCount: 0,
          score: 0,
          estimatedValue: 0,
        });
        if (candidate) {
          routedToId = candidate;
          routingMethod = "ROUND_ROBIN";
          scoreBreakdown = { reason: "round_robin_fallback" };
        }
      } catch (e) {
        console.error("[known-contact-ack] round-robin error:", e);
      }
    }

    // (d) Final fallback: system admin (never route to nobody).
    if (!routedToId) {
      const sys = await getSystemUserId();
      routedToId = sys || null;
      routingMethod = "DIRECT";
      scoreBreakdown = { reason: "system_admin_fallback" };
    }

    // Persist assignment if it changed on the open lead.
    const assignmentChanged =
      !!openLead && !!routedToId && openLead.assignedToId !== routedToId;
    if (openLead && assignmentChanged && routedToId) {
      try {
        await prisma.lead.update({
          where: { id: openLead.id },
          data: { assignedToId: routedToId },
        });
      } catch (e) {
        console.error("[known-contact-ack] assign persist error:", e);
      }
    }

    // ---- (4) Routing-decision audit row (also bumps rep load when changed).
    // Only bump the rep's optimistic load when we actually (re)assigned, so a
    // sticky no-op doesn't double-count an already-counted open lead.
    if (openLead) {
      await recordRoutingDecision({
        leadId: openLead.id,
        assignedToId: assignmentChanged ? routedToId : null,
        method: routingMethod,
        matchedEventType,
        matchedLanguage,
        repLoadAtDecision,
        scoreBreakdown: { ...scoreBreakdown, routedToId },
      });
    }

    // ---- (5) Re-wake the open lead (only the single most-recent one). ----
    let rewokeLeadId: string | null = null;
    if (openLead) {
      try {
        // NEW stays NEW; anything else re-opens at CONTACTED. Re-open the SLA
        // window (firstRespondedAt=null + fresh firstContactDue) and clear
        // escalation + cooling so it re-enters the active worklist.
        await prisma.lead.update({
          where: { id: openLead.id },
          data: {
            status: openLead.status === "NEW" ? "NEW" : "CONTACTED",
            firstRespondedAt: null,
            firstContactDue: leadSlaDeadline(),
            slaEscalatedAt: null,
            coolingEnrolledAt: null,
          },
        });
        rewokeLeadId = openLead.id;

        const cadenceId = await resolveRewarmCadenceId();
        if (cadenceId) {
          const enrolledBy = routedToId || (await getSystemUserId());
          if (enrolledBy) {
            await enrollLeadInCadence(cadenceId, openLead.id, enrolledBy);
          }
        }

        await logActivity({
          action: "REWAKE_KNOWN_CONTACT_LEAD",
          entityType: "Lead",
          entityId: openLead.id,
          changes: {
            routedToId,
            routingMethod,
            via: "known_contact_inbound_ack",
          },
          userId: routedToId || (await getSystemUserId()),
        });
      } catch (e) {
        console.error("[known-contact-ack] re-wake error:", e);
      }
    }

    // ---- (6) Anti-double-ack guard: skip if we just messaged them. -------
    const recentOutbound = await prisma.whatsAppMessage.findFirst({
      where: {
        contactId,
        direction: "OUTBOUND",
        sentAt: { gte: new Date(Date.now() - DOUBLE_ACK_WINDOW_MS) },
      },
      orderBy: { sentAt: "desc" },
      select: { id: true },
    });
    if (recentOutbound) {
      return {
        ok: true,
        acked: false,
        routedToId,
        rewokeLeadId,
        reason: "recent_outbound_suppressed",
      };
    }

    // ---- (7) Send the ack + mirror + notify the rep. ---------------------
    let repFirstName: string | null = null;
    if (routedToId) {
      const rep = await prisma.user
        .findUnique({ where: { id: routedToId }, select: { name: true } })
        .catch(() => null);
      repFirstName = firstNameOf(rep?.name);
    }

    const text = buildKnownAckText(contact?.firstName, repFirstName);
    const result = await sendWhatsApp({ to: phone, message: text });

    // Mirror to the unified inbox (never block the flow).
    try {
      await prisma.whatsAppMessage.create({
        data: {
          direction: "OUTBOUND",
          content: text,
          status: result.success ? "SENT" : "FAILED",
          whatsappId: result.messageId || null,
          contactId,
        },
      });
    } catch {
      // inbox logging must never break the ack flow
    }

    // Notify the routed rep (awaited so serverless freeze doesn't drop it).
    if (routedToId) {
      const who = firstNameOf(contact?.firstName) || "A known contact";
      if (result.success) {
        await notifyAwait({
          userId: routedToId,
          type: "LEAD_ASSIGNED",
          title: "💬 Known contact messaged",
          message: `${who} just messaged — re-engaged lead, you're on it.`,
          actionUrl: rewokeLeadId ? `/leads/${rewokeLeadId}` : `/contacts/${contactId}`,
        });
      } else {
        // Failed auto-ack → ask the rep to follow up manually (never drop).
        await notifyAwait({
          userId: routedToId,
          type: "SLA_WARNING",
          title: "⚡ Auto-ack failed",
          message: `Couldn't auto-message ${who}. Reach out manually now.`,
          actionUrl: rewokeLeadId ? `/leads/${rewokeLeadId}` : `/contacts/${contactId}`,
        });
      }
    }

    return {
      ok: result.success,
      acked: result.success,
      routedToId,
      rewokeLeadId,
      reason: result.success ? undefined : "send_failed",
    };
  } catch (e) {
    console.error("[handleKnownContactAck] error:", e);
    return {
      ok: false,
      acked: false,
      routedToId: null,
      rewokeLeadId: null,
      reason: "exception",
    };
  }
}
