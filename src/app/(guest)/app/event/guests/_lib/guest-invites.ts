// ============================================================
// Guest invitations: the true state of each guest — ONE pure rule.
//
// The host's guest list, the "Invite all" counts and the buttons offered on
// each row are all derived here from the same three facts the team's guest
// list reads: Guest.phone, Guest.rsvpStatus and the GuestInvitation row
// (invitationStatus, sentAt, rsvpRespondedAt).
//
// Honesty rules baked in:
//   - "Invite sent" only when the invitation row says it was sent. A link the
//     host copied or shared by hand leaves the row NOT_SENT, so it never counts.
//   - Nothing here claims delivery: DELIVERED / OPENED still read "Invite sent".
//
// Plain module with no imports: safe in client components, actions and tests.
// ============================================================

export interface InviteFacts {
  phone: string | null;
  /** Guest.rsvpStatus: PENDING | ACCEPTED | DECLINED. */
  rsvpStatus: string;
  invitation: {
    invitationStatus: string;
    sentAt?: Date | string | null;
    rsvpRespondedAt?: Date | string | null;
  } | null;
}

export const GUEST_INVITE_STATES = ["NOT_INVITED", "INVITE_SENT", "RSVP_RECEIVED", "NO_PHONE"] as const;
export type GuestInviteState = (typeof GUEST_INVITE_STATES)[number];

export const GUEST_INVITE_STATE_LABEL: Record<GuestInviteState, string> = {
  NOT_INVITED: "Not invited",
  INVITE_SENT: "Invite sent",
  RSVP_RECEIVED: "RSVP received",
  NO_PHONE: "No phone",
};

/** Most invitations one "Invite all" press sends; the rest wait for the next press. */
export const INVITE_ALL_BATCH = 50;

const REPLIED_VIA_LINK = new Set(["RSVP_ACCEPTED", "RSVP_DECLINED"]);

/** A number WhatsApp could plausibly reach: at least ten digits. "N/A" or "123" is not a phone. */
export function hasUsablePhone(phone: string | null | undefined): boolean {
  return !!phone && phone.replace(/\D/g, "").length >= 10;
}

/** A reply is on record — recorded by hand (host or team) or sent through the RSVP link. */
export function hasReplied(g: InviteFacts): boolean {
  if (g.rsvpStatus === "ACCEPTED" || g.rsvpStatus === "DECLINED") return true;
  const inv = g.invitation;
  return !!inv && (!!inv.rsvpRespondedAt || REPLIED_VIA_LINK.has(inv.invitationStatus));
}

export function guestInviteState(g: InviteFacts): GuestInviteState {
  if (hasReplied(g)) return "RSVP_RECEIVED";
  const status = g.invitation?.invitationStatus;
  // SENT / DELIVERED / OPENED — and any status added later that isn't NOT_SENT,
  // so a new "sent" state can never make us send the same guest twice.
  if (status && status !== "NOT_SENT") return "INVITE_SENT";
  if (!hasUsablePhone(g.phone)) return "NO_PHONE";
  return "NOT_INVITED";
}

/** Only a guest with a phone who was never sent an invitation and hasn't replied. */
export function canSendInvite(g: InviteFacts): boolean {
  return guestInviteState(g) === "NOT_INVITED";
}

/** Copy / share the RSVP link by hand — pointless once a reply is in (the link shows "thank you"). */
export function canShareRsvpLink(g: InviteFacts): boolean {
  return guestInviteState(g) !== "RSVP_RECEIVED";
}

export function countInviteStates(guests: readonly InviteFacts[]): Record<GuestInviteState, number> {
  const counts: Record<GuestInviteState, number> = { NOT_INVITED: 0, INVITE_SENT: 0, RSVP_RECEIVED: 0, NO_PHONE: 0 };
  for (const g of guests) counts[guestInviteState(g)]++;
  return counts;
}

export interface InviteAllPlan<T> {
  /** Eligible guests for this press, in list order. */
  toSend: T[];
  /** Eligible guests beyond this press's batch. */
  later: number;
  /** Eligible guests over the sending limit: they can't go out yet, however often Invite all is pressed. */
  limited: number;
  needPhone: number;
  alreadyInvited: number;
  replied: number;
}

/** A count the plan can use: whole and never below zero (Infinity stays unlimited). */
function wholeCount(n: number): number {
  return Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
}

/**
 * Splits the list into exactly one bucket per guest:
 * toSend + later + limited + needPhone + alreadyInvited + replied = total.
 * `allowance` is how many invitations the sending limit still allows (no limit when omitted).
 */
export function planInviteAll<T extends InviteFacts>(
  guests: readonly T[],
  batch: number = INVITE_ALL_BATCH,
  allowance: number = Infinity
): InviteAllPlan<T> {
  const eligible: T[] = [];
  let needPhone = 0;
  let alreadyInvited = 0;
  let replied = 0;
  for (const g of guests) {
    const state = guestInviteState(g);
    if (state === "NOT_INVITED") eligible.push(g);
    else if (state === "NO_PHONE") needPhone++;
    else if (state === "INVITE_SENT") alreadyInvited++;
    else replied++;
  }
  const sendable = Math.min(eligible.length, wholeCount(allowance));
  const toSend = eligible.slice(0, Math.min(wholeCount(batch), sendable));
  return { toSend, later: sendable - toSend.length, limited: eligible.length - sendable, needPhone, alreadyInvited, replied };
}

/**
 * SENT = the provider accepted it. FAILED = it didn't. SKIPPED = another send already had it in hand.
 * LIMITED = the sending limit was reached before it went out.
 */
export type InviteOutcome = "SENT" | "FAILED" | "SKIPPED" | "LIMITED";

export interface InviteAllSummary {
  sent: number;
  failed: number;
  skipped: number;
  needPhone: number;
  later: number;
  /** Over the sending limit: left out by the plan, or stopped by the limit while sending. */
  limited: number;
  alreadyInvited: number;
  replied: number;
}

export function summarizeInviteAll(
  plan: Pick<InviteAllPlan<unknown>, "later" | "needPhone" | "alreadyInvited" | "replied"> & { limited?: number },
  outcomes: readonly InviteOutcome[]
): InviteAllSummary {
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let limited = plan.limited ?? 0;
  for (const o of outcomes) {
    if (o === "SENT") sent++;
    else if (o === "FAILED") failed++;
    else if (o === "LIMITED") limited++;
    else skipped++;
  }
  return {
    sent,
    failed,
    skipped,
    needPhone: plan.needPhone,
    later: plan.later,
    limited,
    alreadyInvited: plan.alreadyInvited,
    replied: plan.replied,
  };
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Always states how many were sent and how many need a phone — both numbers, even when zero. */
export function inviteAllMessage(s: InviteAllSummary): string {
  const parts = [`${count(s.sent, "invitation", "invitations")} sent`, `${count(s.needPhone, "guest needs", "guests need")} a phone number`];
  if (s.failed > 0) parts.push(`${s.failed} couldn't be sent`);
  if (s.skipped > 0) parts.push(`${s.skipped} already in progress`);
  if (s.later > 0) parts.push(`${s.later} more to send — tap Invite all again`);
  if (s.limited > 0) parts.push(`${s.limited} over the 24-hour sending limit — send them later`);
  return parts.join(" · ");
}

// Guest and people totals are deliberately NOT defined here: the guest list uses
// guestCounts() from event/_components/event-view.ts, the team Guest Manager's
// own definition, so the host and the team never quote different numbers.
