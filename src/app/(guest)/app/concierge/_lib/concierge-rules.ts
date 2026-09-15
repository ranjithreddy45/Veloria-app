import { canCollaborator } from "@/lib/customer-app/collaborator-permissions";
import { CUSTOMER_REQUEST_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";

// ============================================================
// Concierge conversation rules. PURE: no database, no auth, no React.
//
// A conversation is ONE ConciergeThread and its ConciergeMessage rows. The
// customer screen (/app/concierge), the team inbox (/concierge) and the
// booking/contact panel all read those same rows through these functions, so
// the two sides can never disagree about "unread", "seen", "which thread",
// "who may read or write" or "which requests show". Pinned by
// concierge-rules.test.ts.
// ============================================================

export type ConciergeAuthor = "CUSTOMER" | "STAFF" | "SYSTEM";
export type ConciergeViewer = "CUSTOMER" | "STAFF";

type When = Date | string | null | undefined;

function ms(d: When): number {
  return d ? new Date(d).getTime() : Number.NaN;
}

export function asAuthor(v: string): ConciergeAuthor {
  return v === "CUSTOMER" || v === "STAFF" ? v : "SYSTEM";
}

// ------------------------------------------------------------ who may do what (customer side)

export type CustomerAccess = "HOST" | "CO_HOST" | "VIEWER" | "PREVIEW";

/**
 * The host (their own booking or enquiry) and invited co-hosts read, write
 * and mark the team's messages as seen. For collaborators this is the shared
 * permission matrix (collaborator-permissions: concierge:message), enforced on
 * the server: an invited VIEWER has no concierge access, so never reads the
 * conversation, and neither does an unrecognised collaborator role (fail
 * closed; its access is reported as VIEWER). A team member previewing the host
 * view only reads: a receipt is a write, and it must mean someone allowed to
 * act on the conversation opened it.
 */
export function customerAccess(input: { preview: boolean; collaboratorRole?: string | null }): {
  access: CustomerAccess;
  canRead: boolean;
  canSend: boolean;
  marksSeen: boolean;
} {
  if (input.preview) return { access: "PREVIEW", canRead: true, canSend: false, marksSeen: false };
  if (!input.collaboratorRole) return { access: "HOST", canRead: true, canSend: true, marksSeen: true };
  return canCollaborator(input.collaboratorRole, "concierge:message")
    ? { access: "CO_HOST", canRead: true, canSend: true, marksSeen: true }
    : { access: "VIEWER", canRead: false, canSend: false, marksSeen: false };
}

// ------------------------------------------------------------ unread & receipts

export interface ReadState {
  authorType: string;
  customerReadAt: When;
  staffReadAt: When;
}

/**
 * Unread for a viewer = written by the OTHER side and not yet opened by the
 * viewer's side. SYSTEM lines (resolved / reopened) never count.
 */
export function isUnreadFor(m: ReadState, viewer: ConciergeViewer): boolean {
  if (viewer === "CUSTOMER") return m.authorType === "STAFF" && !m.customerReadAt;
  return m.authorType === "CUSTOMER" && !m.staffReadAt;
}

export function unreadCount(messages: ReadState[], viewer: ConciergeViewer): number {
  return messages.reduce((n, m) => n + (isUnreadFor(m, viewer) ? 1 : 0), 0);
}

export interface Receipt {
  state: "SENT" | "SEEN";
  /** When the other side opened it (ISO); null while it is only sent. */
  at: string | null;
}

/**
 * Receipt on a message the viewer's OWN side wrote: SEEN once the other side
 * has opened the conversation, otherwise SENT. Nothing for the other side's
 * messages or for SYSTEM lines.
 */
export function receiptFor(m: ReadState, viewer: ConciergeViewer): Receipt | null {
  if (m.authorType !== viewer) return null;
  const seen = viewer === "CUSTOMER" ? m.staffReadAt : m.customerReadAt;
  return seen ? { state: "SEEN", at: new Date(seen).toISOString() } : { state: "SENT", at: null };
}

/** Index of the viewer's side's latest message (where a chat shows the receipt), or -1. */
export function lastOwnIndex(messages: { authorType: string }[], viewer: ConciergeViewer): number {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].authorType === viewer) return i;
  return -1;
}

// ------------------------------------------------------------ which thread

export interface ThreadCandidate {
  id: string;
  contactId: string;
  bookingId: string | null;
  status: string;
  lastMessageAt: Date | string;
}

export interface ThreadTarget {
  /** The booking the conversation is about, when there is one. */
  bookingId: string | null;
  /** Contacts the caller may act for. A thread on any other contact is never chosen. */
  contactIds: string[];
  /**
   * Only the booking's own thread, never a carried-over pre-booking thread.
   * Set for invited collaborators: the host's enquiry conversation from before
   * the booking stays private to the host.
   */
  bookingOnly?: boolean;
}

export interface ThreadPick<T extends ThreadCandidate> {
  thread: T | null;
  /** True when a pre-booking (contact-level) thread should now be attached to the booking. */
  attachBooking: boolean;
}

/** OPEN before CLOSED, then the most recent activity. */
function preferred(a: ThreadCandidate, b: ThreadCandidate): number {
  const closed = (t: ThreadCandidate) => (t.status === "OPEN" ? 0 : 1);
  return closed(a) - closed(b) || ms(b.lastMessageAt) - ms(a.lastMessageAt);
}

/**
 * Which thread does a conversation live in?
 *  1. With a booking: that booking's thread.
 *  2. With a booking but no thread on it yet: the contact's pre-booking thread,
 *     carried over (attachBooking) so the history stays in one conversation.
 *     Not for bookingOnly callers (invited collaborators): they get nothing,
 *     and their first message starts the booking's thread.
 *  3. Without a booking: the contact's pre-booking thread only. A thread about
 *     a booking is never borrowed for a booking-less conversation.
 *  4. Nothing suitable: null (the first message creates the thread).
 * A rare duplicate (two first messages at once) resolves to OPEN, then newest.
 */
export function pickThread<T extends ThreadCandidate>(threads: T[], target: ThreadTarget): ThreadPick<T> {
  const allowed = new Set(target.contactIds);
  const mine = threads.filter((t) => allowed.has(t.contactId));
  if (target.bookingId) {
    const onBooking = mine.filter((t) => t.bookingId === target.bookingId).sort(preferred);
    if (onBooking[0]) return { thread: onBooking[0], attachBooking: false };
    if (target.bookingOnly) return { thread: null, attachBooking: false };
  }
  const preBooking = mine.filter((t) => t.bookingId === null).sort(preferred);
  if (preBooking[0]) return { thread: preBooking[0], attachBooking: Boolean(target.bookingId) };
  return { thread: null, attachBooking: false };
}

// ------------------------------------------------------------ the team's work queue

/** Minutes of quiet after which another customer message pings the team member again. */
export const TEAM_PING_QUIET_MINUTES = 10;

/**
 * Does a new customer message notify the team member? Yes for the first
 * message, yes when the team has replied since the customer's previous message
 * (a new turn), yes after a quiet spell. No for lines typed one after another:
 * a burst is one ping, not five.
 */
export function shouldPingTeam(input: { previousCustomerAt: When; lastStaffAt: When; now: Date; quietMinutes?: number }): boolean {
  const prev = ms(input.previousCustomerAt);
  if (Number.isNaN(prev)) return true;
  const staff = ms(input.lastStaffAt);
  if (!Number.isNaN(staff) && staff >= prev) return true;
  return input.now.getTime() - prev >= (input.quietMinutes ?? TEAM_PING_QUIET_MINUTES) * 60_000;
}

/** A team reply moves the conversation's task from "to do" to "in progress". It never completes or reopens one. */
export function taskStatusAfterTeamReply(status: string): string {
  return status === "TODO" ? "IN_PROGRESS" : status;
}

/** A customer message updates the conversation's open task, or opens a new one once the last is done. */
export function taskActionForCustomerMessage(latestTask: { status: string } | null): "CREATE" | "UPDATE" {
  return latestTask && latestTask.status !== "DONE" ? "UPDATE" : "CREATE";
}

// ------------------------------------------------------------ requests shown in the conversation

export interface RequestTaskLike {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date | string;
  metadata: unknown;
}

export interface RequestEntry {
  /** The Task id. */
  id: string;
  kind: string;
  label: string;
  text: string;
  /** Raw TaskStatus, for the team. */
  status: string;
  /** Customer wording for the same status (status-labels.ts). */
  statusLabel: string;
  createdAt: string;
}

const REQUEST_KIND_LABEL: Record<string, string> = {
  PACKAGES: "Package request",
  REDEEM: "Reward redemption",
  MESSAGE: "Request to the team",
};

function metaOf(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** The conversation a CLIENT_REQUEST task mirrors, if any. */
export function threadIdOfTask(metadata: unknown): string | null {
  const id = metaOf(metadata).threadId;
  return typeof id === "string" && id ? id : null;
}

/**
 * CLIENT_REQUEST tasks (package requests, reward redemptions, older requests)
 * shown in the conversation as SYSTEM entries carrying their live status. A
 * task that only mirrors a conversation (metadata.threadId) is skipped: its
 * words are already messages in the thread, and showing both would duplicate.
 */
export function requestEntries(tasks: RequestTaskLike[]): RequestEntry[] {
  return tasks
    .filter((t) => !threadIdOfTask(t.metadata))
    .map((t) => {
      const rawKind = metaOf(t.metadata).kind;
      const kind = typeof rawKind === "string" && rawKind ? rawKind : "MESSAGE";
      return {
        id: t.id,
        kind,
        label: REQUEST_KIND_LABEL[kind] ?? "Request to the team",
        text: (t.description ?? "").trim() || t.title,
        status: t.status,
        statusLabel: customerLabel(CUSTOMER_REQUEST_STATUS_LABEL, t.status),
        createdAt: new Date(t.createdAt).toISOString(),
      };
    });
}

/**
 * What a team member previewing the customer view needs, per request kind, on
 * top of the bookings:read the preview itself requires: the permission of the
 * team screen that opens what the request says.
 *   REDEEM    "Use X of Y loyalty points" names the balance: the loyalty screen (loyalty:read)
 *   PACKAGES  packages, prices and the app's estimate: the package catalogue
 *             (packages:read) and the work queue the request is handled in (tasks:read)
 *   MESSAGE   an older note to the team, which the team inbox shows at bookings:read
 * A kind not listed here never shows in a preview (fail closed).
 */
export const REQUEST_PREVIEW_PERMISSIONS = {
  MESSAGE: [],
  PACKAGES: ["packages:read", "tasks:read"],
  REDEEM: ["loyalty:read"],
} as const satisfies Record<string, readonly string[]>;

/**
 * May this viewer see a request of this kind? Requests belong to the booking's
 * own customer: the host sees every kind; invited co-hosts and viewers see
 * none; a staff preview sees a kind only when `can` (the viewer's effective
 * team permissions) grants everything REQUEST_PREVIEW_PERMISSIONS lists for it.
 */
export function mayViewRequestKind(access: CustomerAccess, kind: string, can: (permission: string) => boolean): boolean {
  if (access === "HOST") return true;
  if (access !== "PREVIEW" || !Object.hasOwn(REQUEST_PREVIEW_PERMISSIONS, kind)) return false;
  const needs: readonly string[] = REQUEST_PREVIEW_PERMISSIONS[kind as keyof typeof REQUEST_PREVIEW_PERMISSIONS];
  return needs.every((permission) => can(permission));
}

/** The request entries this viewer may see (mayViewRequestKind), in their order. */
export function visibleRequestEntries(
  entries: readonly RequestEntry[],
  access: CustomerAccess,
  can: (permission: string) => boolean
): RequestEntry[] {
  return entries.filter((e) => mayViewRequestKind(access, e.kind, can));
}

export type TimelineItem<M, R> = { type: "message"; at: number; item: M } | { type: "request"; at: number; item: R };

/** Messages and request entries in one chronological list; on a tie, messages come first. */
export function mergeTimeline<M extends { createdAt: string }, R extends { createdAt: string }>(messages: M[], requests: R[]): TimelineItem<M, R>[] {
  const all: TimelineItem<M, R>[] = [
    ...messages.map((item) => ({ type: "message" as const, at: ms(item.createdAt), item })),
    ...requests.map((item) => ({ type: "request" as const, at: ms(item.createdAt), item })),
  ];
  return all.sort((a, b) => a.at - b.at || (a.type === b.type ? 0 : a.type === "message" ? -1 : 1));
}

// ------------------------------------------------------------ text

export const MESSAGE_MAX = 2000;

/** Trimmed text without control characters (line breaks and tabs kept, blank runs collapsed). "" when nothing is left. */
export function cleanMessageBody(raw: unknown, max = MESSAGE_MAX): string {
  if (typeof raw !== "string") return "";
  let kept = "";
  for (const ch of raw.replace(/\r\n?/g, "\n")) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 9 || c === 10 || (c >= 32 && c !== 127)) kept += ch;
  }
  return kept.replace(/\n{3,}/g, "\n\n").trim().slice(0, max).trim();
}

export function excerpt(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

/** "PS" from "Priya Sharma"; "V" when there is no name, so an avatar is never blank. */
export function initialsOf(name: string | null | undefined): string {
  const s = (name ?? "").split(/[\s&×]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return s || "V";
}
