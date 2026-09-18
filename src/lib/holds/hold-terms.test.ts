import { describe, it, expect } from "vitest";
import { HOLD_TERMS_NOTICE, holdConsentRows, holdTermsLabel, holdTermsMatch, type HoldTermsDoc } from "./hold-terms";

const cancellation: HoldTermsDoc = {
  key: "CANCELLATION_REFUND",
  title: "Cancellation and refund policy",
  body: "Line one.\nLine two.",
  version: 3,
  publishedAt: "2026-09-01T06:30:00.000Z",
  fingerprint: "fp-cancel-3",
};
const bookingTerms: HoldTermsDoc = {
  key: "BOOKING_TERMS",
  title: "Booking terms",
  body: "Terms body.",
  version: 1,
  publishedAt: null,
  fingerprint: "fp-terms-1",
};

describe("nothing published", () => {
  it("asks the customer to acknowledge the honest notice, not invented terms", () => {
    expect(holdTermsLabel([])).toBe(
      "I understand that the venue will confirm cancellation and refund terms with me before any further payment."
    );
  });

  it("records the notice against CANCELLATION_REFUND with no version", () => {
    const rows = holdConsentRows([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].policyKey).toBe("CANCELLATION_REFUND");
    expect(rows[0].policyVersion).toBeNull();
    expect(rows[0].consentText).toContain(HOLD_TERMS_NOTICE);
  });
});

describe("published policies", () => {
  it("records each policy with its version and exact body", () => {
    const rows = holdConsentRows([cancellation, bookingTerms]);
    expect(rows.map((r) => [r.policyKey, r.policyVersion])).toEqual([
      ["CANCELLATION_REFUND", 3],
      ["BOOKING_TERMS", 1],
    ]);
    expect(rows[0].consentText).toContain("Line one.\nLine two.");
    expect(rows[0].consentText).toContain("(version 3)");
    expect(rows[0].consentText.startsWith("I have read and agree to the Cancellation and refund policy and Booking terms.")).toBe(true);
    expect(rows.every((r) => !r.consentText.includes(HOLD_TERMS_NOTICE))).toBe(true);
  });

  it("with only booking terms published, the cancellation notice is still acknowledged and recorded", () => {
    expect(holdTermsLabel([bookingTerms])).toBe(
      "I have read and agree to the Booking terms, and I understand that the venue will confirm cancellation and refund terms with me before any further payment."
    );
    const rows = holdConsentRows([bookingTerms]);
    expect(rows.map((r) => [r.policyKey, r.policyVersion])).toEqual([
      ["CANCELLATION_REFUND", null],
      ["BOOKING_TERMS", 1],
    ]);
  });

  it("never calls anything refundable on its own", () => {
    for (const docs of [[], [bookingTerms], [cancellation], [cancellation, bookingTerms]]) {
      expect(holdTermsLabel(docs).toLowerCase()).not.toContain("refundable");
    }
  });
});

describe("holdTermsMatch", () => {
  const seen = (docs: HoldTermsDoc[]) => ({ accepted: true, seen: docs.map((d) => ({ key: d.key, version: d.version, fingerprint: d.fingerprint })) });

  it("accepts exactly what is published now", () => {
    expect(holdTermsMatch([cancellation, bookingTerms], seen([cancellation, bookingTerms]))).toBe(true);
    expect(holdTermsMatch([], seen([]))).toBe(true);
  });

  it("refuses when a policy changed after the page loaded", () => {
    expect(holdTermsMatch([{ ...cancellation, version: 4, fingerprint: "fp-cancel-4" }], seen([cancellation]))).toBe(false);
    expect(holdTermsMatch([{ ...cancellation, fingerprint: "edited-in-place" }], seen([cancellation]))).toBe(false);
  });

  it("refuses when a policy was published or withdrawn in between", () => {
    expect(holdTermsMatch([cancellation, bookingTerms], seen([cancellation]))).toBe(false);
    expect(holdTermsMatch([cancellation], seen([cancellation, bookingTerms]))).toBe(false);
  });

  it("refuses without an explicit tick", () => {
    expect(holdTermsMatch([cancellation], { accepted: false, seen: seen([cancellation]).seen })).toBe(false);
    expect(holdTermsMatch([cancellation], null)).toBe(false);
    expect(holdTermsMatch([], undefined)).toBe(false);
  });
});
