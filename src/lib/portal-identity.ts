// ============================================================
// Portal identity resolution — the ONE guarded "who am I?" helper.
// ============================================================
// SECURITY (C9 — account takeover): every piece of portal data resolves by
// matching Contact.email == User.email. Because signup/OAuth can mint a CLIENT
// for ANY email (customer emails are printed on every invoice), we must NOT
// hand over a stranger's bookings/invoices/contracts to an unverified account.
//
// Rule: a portal user only resolves to contacts once their identity is
// VERIFIED (`user.emailVerified != null`). Google OAuth sets this automatically
// (linkAccount event). Credential signups start unverified and are onboarded by
// staff via a portal invite token (see portal-invite.ts). This is the single
// choke-point every portal action funnels through, so the rule can't be
// bypassed by one query forgetting to check.

import { prisma } from "@/lib/prisma";

export type PortalIdentity =
  | { verified: true; email: string; contactIds: string[] }
  | { verified: false; email: string | null; contactIds: [] };

/**
 * Resolve the contact ids a portal user is allowed to see — but ONLY if the
 * user's email is verified. Unverified users resolve to zero contacts so no
 * other customer's data is ever returned.
 */
export async function resolvePortalContactIds(
  userId: string
): Promise<PortalIdentity> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });

  // Not verified (or no email) → resolves to nothing. Callers show the
  // "needs verification / contact us" message instead of foreign data.
  if (!user?.email || !user.emailVerified) {
    return { verified: false, email: user?.email ?? null, contactIds: [] };
  }

  const contacts = await prisma.contact.findMany({
    where: { email: user.email, deletedAt: null },
    select: { id: true },
  });

  return {
    verified: true,
    email: user.email,
    contactIds: contacts.map((c) => c.id),
  };
}

/**
 * Convenience: just the contact ids (empty when unverified). Use when the
 * caller doesn't need to distinguish "unverified" from "verified but no
 * matching contacts".
 */
export async function getVerifiedContactIds(userId: string): Promise<string[]> {
  const identity = await resolvePortalContactIds(userId);
  return identity.contactIds;
}
