import { prisma } from "@/lib/prisma";
import {
  POLICY_KEYS,
  isPolicyKey,
  resolvePublishedFaqs,
  type DisplayFaq,
  type PolicyKey,
} from "@/app/(dashboard)/settings/customer-content/_lib/content-rules";

// ============================================================
// Customer-facing policies (PolicyDocument) and FAQs (FaqItem).
// Customers only ever see the published version; an unpublished or missing
// policy returns null so the UI can say so honestly instead of inventing terms.
//
// The team edits both in Settings → Customer content. A policy draft is kept
// in its own row under "DRAFT:<KEY>" and is never returned from here.
//
// Server-only (Prisma). The pure helpers re-exported below live in
// settings/customer-content/_lib/content-rules.ts — client components import
// them from there.
// ============================================================

export type { PolicyKey, DisplayFaq };
export { POLICY_KEYS };
export {
  POLICY_META,
  formatIstDate,
  groupFaqsForDisplay,
  parsePolicyParam,
  policyPath,
  type FaqGroup,
} from "@/app/(dashboard)/settings/customer-content/_lib/content-rules";

export interface PublishedPolicy {
  key: PolicyKey;
  title: string;
  body: string;
  version: number;
  publishedAt: string | null;
}

export async function getPublishedPolicy(key: PolicyKey): Promise<PublishedPolicy | null> {
  if (!isPolicyKey(key)) return null;
  try {
    const p = await prisma.policyDocument.findUnique({ where: { key } });
    if (!p || !p.isPublished) return null;
    return { key, title: p.title, body: p.body, version: p.version, publishedAt: p.publishedAt?.toISOString() ?? null };
  } catch {
    return null;
  }
}

/** Every published policy, in POLICY_KEYS order. */
export async function getPublishedPolicies(): Promise<PublishedPolicy[]> {
  try {
    const rows = await prisma.policyDocument.findMany({ where: { key: { in: [...POLICY_KEYS] }, isPublished: true } });
    return POLICY_KEYS.flatMap((key) => {
      const p = rows.find((r) => r.key === key);
      return p ? [{ key, title: p.title, body: p.body, version: p.version, publishedAt: p.publishedAt?.toISOString() ?? null }] : [];
    });
  } catch {
    return [];
  }
}

/**
 * Published FAQs in the team's order. A hall-specific FAQ appears only while
 * its hall is visible to customers (active, top-level — the halls the customer
 * app lists) and carries `hallName`. Pass `venueId` for one hall's FAQs only.
 */
export async function getPublishedFaqs(opts: { venueId?: string } = {}): Promise<DisplayFaq[]> {
  try {
    const rows = await prisma.faqItem.findMany({
      where: { isPublished: true, ...(opts.venueId ? { venueId: opts.venueId } : {}) },
      select: { id: true, question: true, answer: true, category: true, venueId: true, order: true, createdAt: true },
    });
    const hallIds = [...new Set(rows.map((r) => r.venueId).filter((id): id is string => !!id))];
    const halls = hallIds.length
      ? await prisma.venue.findMany({ where: { id: { in: hallIds }, isActive: true, parentVenueId: null }, select: { id: true, name: true } })
      : [];
    return resolvePublishedFaqs(rows, halls);
  } catch {
    return [];
  }
}

export interface PolicyConsentInput {
  policyKey: PolicyKey;
  /** Version of the published policy the customer saw. null when no policy was published (the notice text is recorded instead). */
  policyVersion: number | null;
  /** Exact text or notice the customer agreed to, as shown. */
  consentText: string;
  /** Where it was given: "APP_HOLD", "PAY_PAGE", ... */
  source: string;
  bookingId?: string | null;
  contactId?: string | null;
  email?: string | null;
  phone?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

/**
 * Record that a customer accepted a policy. One ConsentRecord row per
 * acceptance, readable by the team on the booking. Never throws; returns the
 * row id or null.
 */
export async function recordPolicyConsent(input: PolicyConsentInput): Promise<string | null> {
  try {
    const row = await prisma.consentRecord.create({
      data: {
        subjectType: input.bookingId ? "BOOKING" : "CONTACT",
        subjectId: input.bookingId ?? input.contactId ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        purpose: `POLICY_${input.policyKey}`,
        source: input.source,
        consentText: input.consentText,
        givenAt: new Date(),
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        policyKey: input.policyKey,
        policyVersion: input.policyVersion,
        bookingId: input.bookingId ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error("[POLICY_CONSENT]", err);
    return null;
  }
}
