// ============================================================
// Customer content rules — pure and client-safe.
//
// Policies (keys, URLs, draft rows, the version rule, validation) and FAQs
// (validation, ordering, grouping). The team's settings screens, the server
// actions and the customer app all import these, so both sides apply one
// rule set. No Prisma here.
// ============================================================

import { cleanLine, cleanText, collectResults, type FieldErrors } from "../../business-contact/_lib/contact-rules";

// ------------------------------------------------------------
// Policy keys and URLs
// ------------------------------------------------------------

export type PolicyKey = "CANCELLATION_REFUND" | "HOUSE_RULES" | "BOOKING_TERMS";

export const POLICY_KEYS: readonly PolicyKey[] = ["CANCELLATION_REFUND", "HOUSE_RULES", "BOOKING_TERMS"] as const;

/** Names and URL slugs only — the policy text itself always comes from the team. */
export const POLICY_META: Record<PolicyKey, { label: string; slug: string; teamHint: string }> = {
  CANCELLATION_REFUND: {
    label: "Cancellation & refund policy",
    slug: "cancellation-refund",
    teamHint: "What happens to money already paid when a customer cancels or moves a date.",
  },
  HOUSE_RULES: {
    label: "House rules",
    slug: "house-rules",
    teamHint: "Practical rules for event day: timings, décor, sound, outside vendors, conduct.",
  },
  BOOKING_TERMS: {
    label: "Booking terms",
    slug: "booking-terms",
    teamHint: "The terms a customer accepts when they hold or confirm a date.",
  },
};

export function isPolicyKey(value: unknown): value is PolicyKey {
  return typeof value === "string" && (POLICY_KEYS as readonly string[]).includes(value);
}

/** Route param → key. Accepts "house-rules", "HOUSE_RULES", "house_rules" (any case). */
export function parsePolicyParam(param: string | null | undefined): PolicyKey | null {
  const normalised = (param ?? "").trim().toUpperCase().replace(/-/g, "_");
  return isPolicyKey(normalised) ? normalised : null;
}

/** Canonical customer URL for a policy. */
export function policyPath(key: PolicyKey): string {
  return `/app/policies/${POLICY_META[key].slug}`;
}

// ------------------------------------------------------------
// Drafts and versions
//
// PolicyDocument has one row per key. A draft lives in its own row under
// "DRAFT:<KEY>" so the team can work on the next version while customers keep
// reading the live one. Customers only ever query the exact live key, and a
// draft row is never marked published.
// ------------------------------------------------------------

export const POLICY_DRAFT_PREFIX = "DRAFT:";

export function policyDraftKey(key: PolicyKey): string {
  return `${POLICY_DRAFT_PREFIX}${key}`;
}

export interface LiveVersionState {
  version: number;
  isPublished: boolean;
  publishedAt: Date | string | null;
}

/**
 * The version number the next publish gets: v1 the first time, then +1 on
 * every publish. A number is never reused, so a consent recorded against
 * "version N" always means one text.
 */
export function nextPolicyVersion(live: LiveVersionState | null | undefined): number {
  if (!live) return 1;
  const current = Number.isInteger(live.version) && live.version > 0 ? live.version : 0;
  const everPublished = live.isPublished || live.publishedAt !== null;
  return everPublished ? current + 1 : Math.max(1, current);
}

export type PolicyDraftField = "title" | "body";

export function validatePolicyDraft(
  input: { title?: unknown; body?: unknown } | null | undefined
): { ok: true; data: { title: string; body: string } } | { ok: false; errors: FieldErrors<PolicyDraftField> } {
  const i = input ?? {};
  const result = collectResults<PolicyDraftField>({
    title: cleanLine(i.title, 120, "Title"),
    body: cleanText(i.body, 50000, "Policy text"),
  });
  if (!result.ok) return result;
  const { title, body } = result.data;
  if (!title || !body) {
    const errors: FieldErrors<PolicyDraftField> = {};
    if (!title) errors.title = "Give the policy a title.";
    if (!body) errors.body = "Write the policy text before saving.";
    return { ok: false, errors };
  }
  return { ok: true, data: { title, body } };
}

/** True when publishing this draft would not change what customers read. */
export function isSameAsLive(
  draft: { title: string; body: string },
  live: { title: string; body: string; isPublished: boolean } | null | undefined
): boolean {
  return !!live && live.isPublished && live.title === draft.title && live.body === draft.body;
}

// ------------------------------------------------------------
// FAQs
// ------------------------------------------------------------

/** Select value meaning "not tied to one hall". */
export const ALL_HALLS = "__all__";

export type FaqField = "question" | "answer" | "category" | "venueId";
export interface FaqInput {
  question?: string | null;
  answer?: string | null;
  category?: string | null;
  venueId?: string | null;
}
export interface FaqData {
  question: string;
  answer: string;
  category: string | null;
  venueId: string | null;
}

export function validateFaqInput(
  input: FaqInput | null | undefined
): { ok: true; data: FaqData } | { ok: false; errors: Partial<Record<FaqField, string>> } {
  const i = input ?? {};
  const rawVenue = typeof i.venueId === "string" ? i.venueId.trim() : "";
  const venue = rawVenue && rawVenue !== ALL_HALLS ? rawVenue : null;
  const result = collectResults<Exclude<FaqField, "venueId">>({
    question: cleanLine(i.question, 300, "Question"),
    answer: cleanText(i.answer, 4000, "Answer"),
    category: cleanLine(i.category, 60, "Category"),
  });
  if (!result.ok) return result;
  const errors: Partial<Record<FaqField, string>> = {};
  if (!result.data.question) errors.question = "Write the question.";
  if (!result.data.answer) errors.answer = "Write the answer.";
  if (venue !== null && venue.length > 64) errors.venueId = "Pick a hall from the list.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { question: result.data.question as string, answer: result.data.answer as string, category: result.data.category, venueId: venue },
  };
}

export interface Orderable {
  id: string;
  order: number;
  createdAt: Date | string;
}

/** Display order: `order`, then oldest first, then id — stable even when orders tie. */
export function sortByOrder<T extends Orderable>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.order - b.order ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Order for a new FAQ: after everything else. */
export function nextFaqOrder(items: readonly { order: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
}

/**
 * The writes needed to move one FAQ one step. The list is renumbered 0..n-1
 * (which also repairs ties) and only rows whose order changes are returned;
 * moving past either end, or an unknown id, needs no writes.
 */
export function planFaqMove<T extends Orderable>(items: readonly T[], id: string, direction: "up" | "down"): { id: string; order: number }[] {
  const sorted = sortByOrder(items);
  const from = sorted.findIndex((item) => item.id === id);
  if (from < 0) return [];
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= sorted.length) return [];
  const moved = [...sorted];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  const current = new Map(sorted.map((item) => [item.id, item.order]));
  return moved.map((item, index) => ({ id: item.id, order: index })).filter((u) => current.get(u.id) !== u.order);
}

export interface FaqRow extends Orderable {
  question: string;
  answer: string;
  category: string | null;
  venueId: string | null;
}

export interface DisplayFaq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  venueId: string | null;
  /** Set when the FAQ is about one hall. */
  hallName: string | null;
}

/**
 * Published FAQ rows → what customers see, in display order. A hall-specific
 * FAQ is shown only while its hall is visible to customers, and carries the
 * hall's name so the screen can label it.
 */
export function resolvePublishedFaqs(rows: readonly FaqRow[], visibleHalls: readonly { id: string; name: string }[]): DisplayFaq[] {
  const names = new Map(visibleHalls.map((h) => [h.id, h.name]));
  const out: DisplayFaq[] = [];
  for (const row of sortByOrder(rows)) {
    const hallName = row.venueId ? names.get(row.venueId) : null;
    if (row.venueId && !hallName) continue;
    out.push({ id: row.id, question: row.question, answer: row.answer, category: row.category, venueId: row.venueId, hallName: hallName ?? null });
  }
  return out;
}

export interface FaqGroup {
  title: string;
  items: DisplayFaq[];
}

/** Group by category (case-insensitive; uncategorised → "General"), groups in order of their first FAQ. */
export function groupFaqsForDisplay(faqs: readonly DisplayFaq[]): FaqGroup[] {
  const groups = new Map<string, FaqGroup>();
  for (const faq of faqs) {
    const title = faq.category?.replace(/\s+/g, " ").trim() || "General";
    const id = title.toLowerCase();
    let group = groups.get(id);
    if (!group) {
      group = { title, items: [] };
      groups.set(id, group);
    }
    group.items.push(faq);
  }
  return [...groups.values()];
}

// ------------------------------------------------------------
// Dates
// ------------------------------------------------------------

/** "16 Sept 2026" (optionally with time) in India time — servers run on UTC. */
export function formatIstDate(value: Date | string | null | undefined, opts: { withTime?: boolean } = {}): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(opts.withTime ? { hour: "numeric", minute: "2-digit", hour12: true } : {}),
  }).format(date);
}
