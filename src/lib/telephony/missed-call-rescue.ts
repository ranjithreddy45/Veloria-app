// ============================================================
// Missed-call / unknown-number → WhatsApp lead rescue.
//
// Turns every evaporated inbound ring into a tracked lead. For an UNKNOWN
// caller (no Contact match) it mints a scored, SLA-clocked lead via
// captureLeadFromExternal and fires an instant WhatsApp first-response via
// runSpeedToLead. For a KNOWN caller it records the missed-ring audit (and
// links the matched contact's open lead) but lets the existing speed-to-lead
// flow own re-engagement — it must NOT stamp firstRespondedAt, because the
// CUSTOMER called US (stamping would wrongly silence the SLA clock).
//
// Plain library (NOT "use server"): callable from the public inbound webhook
// and from a future unknown-number branch on the CallLog path. Self-contained,
// idempotent on MissedCallRescue.externalCallId @unique (swallows provider
// redeliveries), and it NEVER throws — rescue is best-effort and must not break
// the webhook's 200 response. Mirrors lead-capture / lead-first-response
// conventions.
// ============================================================

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import {
  captureLeadFromExternal,
  getSystemUserId,
} from "@/lib/lead-capture";
import { runSpeedToLead } from "@/lib/lead-first-response";

// When no stable provider call id is present (some IVR "missed call" pings
// lack one), guard against double-capture for the same number within a short
// window — two near-simultaneous rings would otherwise mint two leads.
const NO_ID_DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export interface MissedCallRescueArgs {
  provider: string; // EXOTEL | KNOWLARITY | MYOPERATOR | IVR
  externalCallId: string | null;
  callerPhone: string;
  receivedAt?: Date;
  rawStatus?: string | null;
}

export interface MissedCallRescueResult {
  ok: boolean;
  /** What the rescue did, for diagnostics. */
  outcome:
    | "UNKNOWN_RESCUED"
    | "KNOWN_ACKED"
    | "DEDUPED"
    | "NO_PHONE"
    | "ERROR";
  rescueId?: string;
  leadId?: string | null;
  contactId?: string | null;
  whatsappSent?: boolean;
  reason?: string;
}

/**
 * Build the 6-format phone candidates used to match an existing Contact —
 * identical strategy to the WhatsApp inbound webhook so a KNOWN customer who
 * called is not mis-classified as UNKNOWN (which would mint a duplicate lead).
 */
function phoneMatchCandidates(rawFrom: string): string[] {
  const from = rawFrom.replace(/[^\d+]/g, "").trim();
  // Strip a leading 0 (Indian trunk prefix) for the bare-digit variant.
  const bare = from.replace(/^\+?91/, "").replace(/^0/, "");
  const candidates = new Set<string>([
    from,
    `+${from.replace(/^\+/, "")}`,
    `+91${bare}`,
    bare,
    `91${bare}`,
    `0${bare}`,
  ]);
  return [...candidates].filter((c) => c.length >= 6);
}

/** Find an existing Contact by any of the 6 phone formats. */
async function findKnownContact(callerPhone: string) {
  const candidates = phoneMatchCandidates(callerPhone);
  return prisma.contact.findFirst({
    where: {
      OR: [
        { phone: { in: candidates } },
        { alternatePhone: { in: candidates } },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
  });
}

/**
 * Handle one inbound/missed ring. Idempotent, never throws.
 */
export async function handleMissedCallRescue(
  args: MissedCallRescueArgs
): Promise<MissedCallRescueResult> {
  const provider = (args.provider || "UNKNOWN").toUpperCase();
  const externalCallId = args.externalCallId?.trim() || null;
  const callerPhone = (args.callerPhone || "").trim();
  const receivedAt = args.receivedAt ?? new Date();

  try {
    if (!callerPhone) {
      return { ok: false, outcome: "NO_PHONE", reason: "No caller phone" };
    }

    // ---- (0) Idempotency: swallow provider redeliveries. -----------------
    if (externalCallId) {
      const existing = await prisma.missedCallRescue.findUnique({
        where: { externalCallId },
        select: {
          id: true,
          leadId: true,
          contactId: true,
          whatsappSent: true,
          wasKnownNumber: true,
        },
      });
      if (existing) {
        return {
          ok: true,
          outcome: "DEDUPED",
          rescueId: existing.id,
          leadId: existing.leadId,
          contactId: existing.contactId,
          whatsappSent: existing.whatsappSent,
        };
      }
    } else {
      // No stable id — short-window guard on (callerPhone, recent) so two
      // simultaneous rings from the same number don't double-create.
      const recent = await prisma.missedCallRescue.findFirst({
        where: {
          callerPhone,
          receivedAt: { gte: new Date(Date.now() - NO_ID_DEDUPE_WINDOW_MS) },
        },
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          leadId: true,
          contactId: true,
          whatsappSent: true,
        },
      });
      if (recent) {
        return {
          ok: true,
          outcome: "DEDUPED",
          rescueId: recent.id,
          leadId: recent.leadId,
          contactId: recent.contactId,
          whatsappSent: recent.whatsappSent,
        };
      }
    }

    // ---- (1) Known-vs-unknown determination. -----------------------------
    const known = await findKnownContact(callerPhone);

    if (known) {
      // ---- KNOWN: record audit + link the open lead, no new lead. --------
      // Do NOT call stampLeadResponded — the customer called US; stamping
      // firstRespondedAt would wrongly silence the speed-to-lead SLA clock.
      const openLead = await prisma.lead.findFirst({
        where: {
          contactId: known.id,
          deletedAt: null,
          status: { notIn: ["WON", "LOST"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, assignedToId: true },
      });

      const rescue = await prisma.missedCallRescue.create({
        data: {
          provider,
          externalCallId,
          callerPhone,
          receivedAt,
          wasKnownNumber: true,
          contactId: known.id,
          leadId: openLead?.id ?? null,
          whatsappSent: false,
          failReason: "Known caller — existing flow owns re-engagement.",
        },
        select: { id: true },
      });

      try {
        logActivity({
          action: "CREATE",
          entityType: "missed_call_rescue",
          entityId: rescue.id,
          changes: { provider, wasKnownNumber: true, contactId: known.id },
          userId: "system",
        });
      } catch {
        // Audit logging must never break the rescue.
      }

      // Alert the assigned rep that a known customer rang in.
      const target =
        openLead?.assignedToId || (await getSystemUserId());
      if (target) {
        const who = `${known.firstName} ${known.lastName}`.trim() || callerPhone;
        notify({
          userId: target,
          title: "📞 Customer called in",
          message: `${who} just rang ${callerPhone}. Call them back.`,
          type: "LEAD_ASSIGNED",
          actionUrl: openLead ? `/leads/${openLead.id}` : `/contacts/${known.id}`,
        });
      }

      return {
        ok: true,
        outcome: "KNOWN_ACKED",
        rescueId: rescue.id,
        leadId: openLead?.id ?? null,
        contactId: known.id,
        whatsappSent: false,
      };
    }

    // ---- UNKNOWN: mint a scored, SLA-clocked lead + instant WhatsApp. -----
    // Pass externalId='call:<id>' for double idempotency protection
    // (captureLeadFromExternal also dedupes on the description marker).
    const capture = await captureLeadFromExternal({
      name: callerPhone,
      phone: callerPhone,
      source: "phone", // → PHONE_INQUIRY via mapSource
      message: "Missed/inbound call — auto-rescued",
      externalId: externalCallId ? `call:${externalCallId}` : undefined,
    });

    if (!capture.success || !capture.leadId) {
      const rescue = await prisma.missedCallRescue.create({
        data: {
          provider,
          externalCallId,
          callerPhone,
          receivedAt,
          wasKnownNumber: false,
          whatsappSent: false,
          failReason:
            ("error" in capture && capture.error) ||
            "Lead capture failed for inbound call.",
        },
        select: { id: true },
      });
      return {
        ok: false,
        outcome: "ERROR",
        rescueId: rescue.id,
        reason: "capture_failed",
      };
    }

    const leadId = capture.leadId;
    const contactId = capture.contactId ?? null;

    // Fire the instant WhatsApp first-response. Prefer runSpeedToLead over a
    // raw sendWhatsApp so the <60s metric + LeadFirstResponse audit are
    // populated and its 10-min recent-outbound guard prevents double-messaging
    // if the same number also messaged on WhatsApp. AWAITED before we return
    // (serverless freezes after the webhook response).
    let whatsappSent = false;
    let whatsappMessageId: string | null = null;
    let failReason: string | null = null;

    if (contactId) {
      const stl = await runSpeedToLead({
        lead: { id: leadId, contactId },
      });
      whatsappSent = stl.ok && stl.status === "SENT";
      if (!whatsappSent) {
        failReason =
          stl.reason || `First-response ${stl.status.toLowerCase()}.`;
      }
      // Pull the audit row's messageId so the cockpit can show it.
      try {
        const fr = await prisma.leadFirstResponse.findUnique({
          where: { leadId },
          select: { whatsappMessageId: true, failReason: true, status: true },
        });
        whatsappMessageId = fr?.whatsappMessageId ?? null;
        if (!whatsappSent && fr?.failReason) failReason = fr.failReason;
      } catch {
        // best-effort
      }
    } else {
      failReason = "Lead captured without a contact — cannot message.";
    }

    const rescue = await prisma.missedCallRescue.create({
      data: {
        provider,
        externalCallId,
        callerPhone,
        receivedAt,
        wasKnownNumber: false,
        leadId,
        contactId,
        whatsappSent,
        whatsappMessageId,
        failReason,
      },
      select: { id: true },
    });

    try {
      logActivity({
        action: "CREATE",
        entityType: "missed_call_rescue",
        entityId: rescue.id,
        changes: { provider, wasKnownNumber: false, leadId, whatsappSent },
        userId: "system",
      });
    } catch {
      // Audit logging must never break the rescue.
    }

    if (!whatsappSent) {
      // Surface a rescued ring whose auto-message didn't land so a human
      // can step in. runSpeedToLead also notifies; this targets the system
      // actor as a backstop when there is no assignee.
      const target = await getSystemUserId();
      if (target) {
        notify({
          userId: target,
          title: "📞 Missed call rescued — message failed",
          message: `Captured a lead from ${callerPhone} but the instant WhatsApp didn't send. Follow up now.`,
          type: "SLA_WARNING",
          actionUrl: `/leads/${leadId}`,
        });
      }
    }

    return {
      ok: true,
      outcome: "UNKNOWN_RESCUED",
      rescueId: rescue.id,
      leadId,
      contactId,
      whatsappSent,
      reason: failReason ?? undefined,
    };
  } catch (error) {
    console.error("[MissedCallRescue] error:", error);
    // Best-effort: record a failure row so the cockpit surfaces it. Guard
    // against the @unique externalCallId colliding on a redelivery race.
    try {
      await prisma.missedCallRescue.create({
        data: {
          provider,
          externalCallId,
          callerPhone: callerPhone || "unknown",
          receivedAt,
          wasKnownNumber: false,
          whatsappSent: false,
          failReason:
            error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
        },
      });
    } catch {
      // give up quietly (likely a unique-constraint race = already handled)
    }
    return { ok: false, outcome: "ERROR", reason: "exception" };
  }
}
