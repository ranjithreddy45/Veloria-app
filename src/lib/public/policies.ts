import { prisma } from "@/lib/prisma";

// ============================================================
// Customer-facing policies (PolicyDocument). Customers only ever see the
// published version; an unpublished or missing policy returns null so the
// UI can say so honestly instead of inventing terms.
// ============================================================

export type PolicyKey = "CANCELLATION_REFUND" | "HOUSE_RULES" | "BOOKING_TERMS";

export const POLICY_KEYS: readonly PolicyKey[] = ["CANCELLATION_REFUND", "HOUSE_RULES", "BOOKING_TERMS"] as const;

export interface PublishedPolicy {
  key: PolicyKey;
  title: string;
  body: string;
  version: number;
  publishedAt: string | null;
}

export async function getPublishedPolicy(key: PolicyKey): Promise<PublishedPolicy | null> {
  try {
    const p = await prisma.policyDocument.findUnique({ where: { key } });
    if (!p || !p.isPublished) return null;
    return { key, title: p.title, body: p.body, version: p.version, publishedAt: p.publishedAt?.toISOString() ?? null };
  } catch {
    return null;
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
