// ============================================================
// Who may open a quotation printout: /api/quotations/<id>/pdf.
// ------------------------------------------------------------
// The printout shows the client's name and phone, every price and the
// company's bank details, so knowing the quotation id is not enough. ONE pure
// decision, unit-tested in access.test.ts. The printout opens for:
//
//   STAFF       a team login holding quotes:read, the permission the team's
//               /quotations pages need, resolved the way middleware.ts resolves
//               route permissions: SUPER_ADMIN and ADMIN always; otherwise the
//               effective, override-aware permissions baked into the session
//               (auth.ts), or the role's defaults when the session carries
//               none. Customer and vendor logins are never staff.
//   CUSTOMER    a signed-in login whose verified contacts (getVerifiedContactIds
//               in src/lib/portal-identity.ts) include the quotation's contact.
//   SHARE_LINK  ?token= equal, compared in constant time, to the /q/<token>
//               token of a live share link (ACTIVE and not past expiresAt, the
//               /q page's own rule) that shows this quotation.
//
// The route checks whether the quotation is finalised only after this passes,
// so a stranger holding an id learns nothing about it.
// ============================================================

import { createHash, timingSafeEqual } from "crypto";
import { hasPermission } from "@/lib/permissions";

/** The permission the team's /quotations pages require (ROUTE_PERMISSIONS in src/lib/permissions.ts). */
export const QUOTATION_PDF_STAFF_PERMISSION = "quotes:read";

const ADMIN_ROLES: ReadonlySet<string> = new Set(["SUPER_ADMIN", "ADMIN"]);
/** External logins. Every other role is a team role (middleware.ts INTERNAL_ROLES). */
const EXTERNAL_ROLES: ReadonlySet<string> = new Set(["CLIENT", "VENDOR"]);
/** Share tokens are base64url (quote-share / quote-tiers). Anything else is ignored unread. */
const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export interface QuotationPdfViewer {
  role: string | null | undefined;
  /** Effective permissions baked into the session; null/undefined = use the role's defaults. */
  perms?: readonly string[] | null;
}

export interface QuotationShareLinkFact {
  token: string;
  status: string;
  expiresAt: Date | null;
}

export interface QuotationPdfAccessInput {
  /** The quotation's contact, or null. */
  contactId: string | null;
  /** The signed-in viewer, or null when nobody is (fully) signed in. */
  viewer: QuotationPdfViewer | null;
  /** The viewer's verified contact ids ([] when signed out). */
  verifiedContactIds: readonly string[];
  /** The ?token= query value, as received. */
  token: string | null;
  /** Share links that show this quotation, as their primary quote or as a tier. */
  shareLinks: readonly QuotationShareLinkFact[];
  now: Date;
}

export type QuotationPdfAccess =
  | { allowed: true; via: "STAFF" | "CUSTOMER" | "SHARE_LINK" }
  | { allowed: false };

/** A team login that may read quotations, resolved as middleware.ts resolves route permissions. */
export function staffMayReadQuotations(viewer: QuotationPdfViewer | null): boolean {
  if (!viewer?.role || EXTERNAL_ROLES.has(viewer.role)) return false;
  if (ADMIN_ROLES.has(viewer.role)) return true;
  const perms = viewer.perms;
  return perms
    ? perms.includes(QUOTATION_PDF_STAFF_PERMISSION)
    : hasPermission(viewer.role, QUOTATION_PDF_STAFF_PERMISSION);
}

/** The ?token= value when it has the shape of a share token we issue, else null. */
export function shareTokenParam(raw: string | null | undefined): string | null {
  const token = (raw ?? "").trim();
  return SHARE_TOKEN_RE.test(token) ? token : null;
}

/** The /q/<token> page's rule: ACTIVE and not past its expiry. */
export function isLiveQuotationShareLink(link: QuotationShareLinkFact, now: Date): boolean {
  return link.status === "ACTIVE" && (!link.expiresAt || link.expiresAt.getTime() >= now.getTime());
}

/** Constant-time equality: both sides are hashed to equal-length digests first. */
function sameToken(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a, "utf8").digest(), createHash("sha256").update(b, "utf8").digest());
}

export function decideQuotationPdfAccess(input: QuotationPdfAccessInput): QuotationPdfAccess {
  if (staffMayReadQuotations(input.viewer)) return { allowed: true, via: "STAFF" };

  if (input.viewer && input.contactId && input.verifiedContactIds.includes(input.contactId)) {
    return { allowed: true, via: "CUSTOMER" };
  }

  const token = shareTokenParam(input.token);
  if (token) {
    let matched = false;
    // The token is compared against every candidate, so timing doesn't reveal which one matched.
    for (const link of input.shareLinks) {
      if (sameToken(token, link.token) && isLiveQuotationShareLink(link, input.now)) matched = true;
    }
    if (matched) return { allowed: true, via: "SHARE_LINK" };
  }

  return { allowed: false };
}
