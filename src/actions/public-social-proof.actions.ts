"use server";

// ============================================================
// Public social-proof action — PUBLIC (no auth), read-only.
// ------------------------------------------------------------
// A thin no-auth wrapper around lib/public/social-proof.ts so client
// surfaces (e.g. the live configurator) can re-query matched proof as the
// customer changes occasion/venue WITHOUT exposing the internal Review/
// Gallery actions (which are reviews:read / gallery:read gated).
//
// SECURITY (see spec risks):
//  - NO auth()/hasPermission — the underlying fetcher only reads already
//    approved+public rows.
//  - Accepts ONLY eventType/venueId strings (clamped) — never a raw where
//    clause or id list from the client (no IDOR). Returns the same already
//    public rows regardless of caller.
//  - "use server" file: exports ONLY async functions.
// ============================================================

import { getSocialProof } from "@/lib/public/social-proof";
import type { SocialProofData } from "@/lib/public/social-proof-types";

export async function getSocialProofAction(input: {
  eventType?: string;
  venueId?: string;
}): Promise<SocialProofData> {
  // Clamp/normalise untrusted client input to plain short strings.
  const eventType =
    typeof input?.eventType === "string" && input.eventType.trim()
      ? input.eventType.trim().slice(0, 60)
      : undefined;
  const venueId =
    typeof input?.venueId === "string" && input.venueId.trim()
      ? input.venueId.trim().slice(0, 60)
      : undefined;

  // Delegates to the best-effort fetcher (never throws; capped result sets).
  return getSocialProof({ eventType, venueId });
}
