// ============================================================
// Terms shown before a customer places a hold, and the exact text recorded
// when they accept. Pure (no database, no crypto) so the client component that
// DISPLAYS the terms and the server action that RECORDS the acceptance build
// the same sentences from the same function.
//
// Honesty: only PUBLISHED policies are shown. With no published cancellation
// and refund policy the customer sees HOLD_TERMS_NOTICE instead — never
// invented terms, never a promise that the token is refundable.
// ============================================================

export const HOLD_TERMS_NOTICE =
  "The venue will confirm cancellation and refund terms with you before any further payment.";

export type HoldTermsKey = "CANCELLATION_REFUND" | "BOOKING_TERMS";

/** A published policy as the customer is shown it. */
export interface HoldTermsDoc {
  key: HoldTermsKey;
  title: string;
  body: string;
  version: number;
  publishedAt: string | null;
  /** Server-computed digest of key+version+title+body: proves what was on screen. */
  fingerprint: string;
}

/** What the browser sends back: which documents, at which version, it showed. */
export interface HoldTermsSeen {
  key: string;
  version: number;
  fingerprint: string;
}

export interface HoldTermsAcceptance {
  accepted: boolean;
  seen: HoldTermsSeen[];
}

/** Display order: cancellation and refunds first. */
export const HOLD_TERMS_KEYS: readonly HoldTermsKey[] = ["CANCELLATION_REFUND", "BOOKING_TERMS"];

function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

/** The checkbox sentence. */
export function holdTermsLabel(docs: readonly Pick<HoldTermsDoc, "key" | "title">[]): string {
  const titles = docs.map((d) => d.title.trim()).filter(Boolean);
  const hasCancellation = docs.some((d) => d.key === "CANCELLATION_REFUND");
  const agree = titles.length > 0 ? `I have read and agree to the ${joinTitles(titles)}` : "";
  if (hasCancellation) return `${agree}.`;
  const understand = "I understand that the venue will confirm cancellation and refund terms with me before any further payment.";
  return agree ? `${agree}, and ${understand}` : understand;
}

export interface HoldConsentRow {
  policyKey: HoldTermsKey;
  /** null when no policy was published and the notice was shown instead. */
  policyVersion: number | null;
  consentText: string;
}

/**
 * One consent row per policy accepted, carrying the checkbox sentence and the
 * exact text shown. Without a published cancellation and refund policy, a
 * CANCELLATION_REFUND row records the notice with policyVersion null.
 */
export function holdConsentRows(docs: readonly HoldTermsDoc[]): HoldConsentRow[] {
  const label = holdTermsLabel(docs);
  const rows: HoldConsentRow[] = docs.map((d) => ({
    policyKey: d.key,
    policyVersion: d.version,
    consentText: `${label}\n\n${d.title} (version ${d.version})\n\n${d.body}`,
  }));
  if (!docs.some((d) => d.key === "CANCELLATION_REFUND")) {
    rows.unshift({ policyKey: "CANCELLATION_REFUND", policyVersion: null, consentText: `${label}\n\n${HOLD_TERMS_NOTICE}` });
  }
  return rows;
}

/**
 * Did the customer accept exactly the documents published right now? A policy
 * republished or edited between page load and tap fails, so the customer is
 * asked to read it again rather than being recorded against text they never saw.
 */
export function holdTermsMatch(current: readonly HoldTermsDoc[], acceptance: HoldTermsAcceptance | null | undefined): boolean {
  if (!acceptance || acceptance.accepted !== true || !Array.isArray(acceptance.seen)) return false;
  if (acceptance.seen.length !== current.length) return false;
  return current.every((d) =>
    acceptance.seen.some((s) => s && s.key === d.key && s.version === d.version && s.fingerprint === d.fingerprint)
  );
}
