// ============================================================
// Known-contact ack — small config + copy helpers.
// ------------------------------------------------------------
// Pure constants + one tiny DB lookup used by handleKnownContactAck:
//   - DOUBLE_ACK_WINDOW_MS: anti-double-ack guard window (mirrors the
//     RECENT_OUTBOUND idempotency window used in runSpeedToLead / bulk sends).
//   - resolveRewarmCadenceId(): find an ACTIVE entityType=LEAD cadence to use as
//     the re-warm cadence (by a "Re-warm" name marker) — returns id or null.
//   - buildKnownAckText(): the customer-facing ack copy. NO internal data —
//     only the contact first name + rep first name (mirrors buildFirstResponseText).
// ============================================================

import { prisma } from "@/lib/prisma";

/**
 * If an OUTBOUND WhatsApp was sent to this contact within this window, skip the
 * auto-ack so rapid multi-message bursts don't get double-acked. 60s mirrors the
 * bulkSendWhatsApp idempotency window.
 */
export const DOUBLE_ACK_WINDOW_MS = 60_000;

/**
 * If a rep's RepAvailability.lastSeenAt is older than this and they're still
 * marked ONLINE/BUSY, treat them as stale (soft signal only — never a hard
 * block; routing still falls back rather than route to nobody).
 */
export const REP_STALE_AFTER_MS = 30 * 60_000;

/** Marker substring identifying the re-warm cadence by name (case-insensitive). */
export const REWARM_CADENCE_NAME_MARKER = "re-warm";

/**
 * Resolve the re-warm cadence id: the first ACTIVE, entityType=LEAD cadence whose
 * name contains the "re-warm" marker. Returns null when none exists (caller then
 * simply skips enrollment — re-warm is best-effort). Never throws.
 */
export async function resolveRewarmCadenceId(): Promise<string | null> {
  try {
    const cadence = await prisma.cadence.findFirst({
      where: {
        status: "ACTIVE",
        entityType: "LEAD",
        name: { contains: REWARM_CADENCE_NAME_MARKER, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    return cadence?.id ?? null;
  } catch (e) {
    console.error("[resolveRewarmCadenceId] error:", e);
    return null;
  }
}

/** Strip a full name to a clean first token (no internal/PII beyond first name). */
export function firstNameOf(name?: string | null): string {
  const token = (name || "").trim().split(/\s+/)[0] || "";
  return /^[\p{L}][\p{L}'.-]{0,40}$/u.test(token) ? token : "";
}

/**
 * Build the auto-ack WhatsApp text. Contains ONLY the contact's first name and
 * the routed rep's first name — never lead value, rep id, or pricing. Graceful
 * fallbacks when either name is missing.
 */
export function buildKnownAckText(
  firstName?: string | null,
  repFirstName?: string | null
): string {
  const name = firstNameOf(firstName);
  const rep = firstNameOf(repFirstName);

  const greeting = name ? `Got it ${name} 🙌` : "Got it 🙌";
  const who = rep ? `${rep} from Veloria Grand` : "our team at Veloria Grand";
  return `${greeting} ${who} will be right with you.`;
}
