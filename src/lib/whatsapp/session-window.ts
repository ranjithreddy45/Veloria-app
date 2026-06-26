// ============================================================
// WhatsApp 24h Customer-Service Session Window
// ------------------------------------------------------------
// Meta's WhatsApp Cloud API only allows free-text (non-template) replies inside
// a 24h "customer service window" that opens on every INBOUND message from the
// customer. Outside the window, only approved templates may be sent.
//
// computeSessionWindow(contactId) finds the latest INBOUND WhatsAppMessage for
// the contact (by sentAt, UTC) and derives whether the window is currently open
// and when it expires. Used by:
//   - getConsoleThread          → header badge state
//   - generateReplyDrafts       → bias variants toward template-friendly framing
//                                 when the window is closed
//   - sendReplyVariant (UI hint) → free-text only when open; otherwise template
//
// CORRECTNESS (see spec risks): the window MUST be computed from the latest
// INBOUND message, never OUTBOUND. An OUTBOUND-based window would let reps send
// free-text Meta rejects. sentAt is the canonical timestamp on WhatsAppMessage.
// ============================================================

import { prisma } from "@/lib/prisma";

/** 24 hours in milliseconds — the Meta customer-service window length. */
export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SessionWindowState {
  /** True when the latest INBOUND message is within the last 24h. */
  sessionOpen: boolean;
  /** When the current window closes (lastInbound + 24h), or null if no inbound. */
  sessionExpiresAt: Date | null;
  /** sentAt of the latest INBOUND message, or null if the customer never replied. */
  lastInboundAt: Date | null;
  /** Whole minutes left in the window (0 when closed / no inbound). */
  minutesRemaining: number;
}

/**
 * Derive the session-window state from a known last-inbound timestamp. Pure —
 * no IO — so it's trivially testable and reusable by callers that already hold
 * the timestamp (e.g. the draft generator). `now` is injectable for testing.
 */
export function deriveSessionWindow(
  lastInboundAt: Date | null,
  now: Date = new Date()
): SessionWindowState {
  if (!lastInboundAt) {
    return {
      sessionOpen: false,
      sessionExpiresAt: null,
      lastInboundAt: null,
      minutesRemaining: 0,
    };
  }

  const expiresAt = new Date(lastInboundAt.getTime() + SESSION_WINDOW_MS);
  const remainingMs = expiresAt.getTime() - now.getTime();
  const sessionOpen = remainingMs > 0;

  return {
    sessionOpen,
    sessionExpiresAt: expiresAt,
    lastInboundAt,
    minutesRemaining: sessionOpen ? Math.floor(remainingMs / 60_000) : 0,
  };
}

/**
 * Compute the live session-window state for a contact by reading the latest
 * INBOUND WhatsAppMessage. Never throws for the "no inbound" case — returns a
 * closed window. Callers gate the send affordance on `sessionOpen`.
 */
export async function computeSessionWindow(
  contactId: string
): Promise<SessionWindowState> {
  const lastInbound = await prisma.whatsAppMessage.findFirst({
    where: { contactId, direction: "INBOUND" },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  return deriveSessionWindow(lastInbound?.sentAt ?? null);
}
