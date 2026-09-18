// ============================================================
// The host portal guest list (/portal/guests/[bookingId]): the words after a
// pasted import and after "Send all", and the Send-all button's label.
//
// Who may be invited is NOT decided here: that is guest-invites.ts's rule
// (canSendInvite) plus the server's booking-status refusal, the same rules the
// guest app and the team's Guest Manager use. This file only reports what the
// portal actions returned, so the counts on screen are the server's.
//
// Pure (one client-safe import): used by the client component, and tested.
// ============================================================

import { INVITE_ALL_BATCH } from "@/app/(guest)/app/event/guests/_lib/guest-invites";

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** After an import (portalBulkImportGuests): guests added, and rows left out because their number is already on the list. */
export function importResultMessage(r: { count: number; duplicates: number }): string {
  const added = `${count(r.count, "guest", "guests")} imported`;
  if (r.duplicates <= 0) return `${added}.`;
  const which = r.duplicates === 1 ? "that number is" : "those numbers are";
  return `${added} · ${r.duplicates} left out: ${which} already on your list.`;
}

/** What portalBulkSendInvitations reports. */
export interface SendAllCounts {
  /** Accepted by WhatsApp. */
  sent: number;
  /** WhatsApp didn't accept them. */
  failed: number;
  /** Guests on the list without a phone WhatsApp can reach. */
  needPhone: number;
  /** Eligible, but beyond this press's batch. */
  later: number;
  /** Eligible, but over the 24-hour sending limit. */
  limited: number;
}

export type SendAllTone = "success" | "info" | "warning" | "error";

/** The toast after "Send all": only accepted sends count as sent, and anything not sent says why. */
export function sendAllResult(r: SendAllCounts): { tone: SendAllTone; message: string } {
  const parts = [`${count(r.sent, "invitation", "invitations")} sent`];
  if (r.needPhone > 0) parts.push(`${count(r.needPhone, "guest needs", "guests need")} a phone number`);
  if (r.failed > 0) parts.push(`${r.failed} couldn't be sent`);
  if (r.later > 0) parts.push(`${r.later} more to send — press Send again`);
  if (r.limited > 0) parts.push(`${r.limited} over the 24-hour sending limit — send them later`);
  let tone: SendAllTone = "success";
  if (r.sent === 0) tone = r.failed > 0 ? "error" : r.limited > 0 ? "warning" : "info";
  else if (r.failed > 0 || r.limited > 0) tone = "warning";
  return { tone, message: parts.join(" · ") };
}

/** The Send-all button for `eligible` guests not invited yet. One press sends at most INVITE_ALL_BATCH, so it never offers more. */
export function sendAllLabel(eligible: number): string {
  return eligible > INVITE_ALL_BATCH ? `Send ${INVITE_ALL_BATCH} invitations` : `Send all invitations (${eligible})`;
}

/** Shown by the button when one press can't reach everyone; null when it can. */
export function sendAllNote(eligible: number): string | null {
  return eligible > INVITE_ALL_BATCH
    ? `${eligible} guests not invited yet. Up to ${INVITE_ALL_BATCH} invitations go out each time you press Send.`
    : null;
}
