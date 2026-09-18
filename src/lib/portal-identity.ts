// ============================================================
// Portal identity resolution — the ONE guarded "who am I?" helper.
// ============================================================
// SECURITY (C9 — account takeover): signup/OAuth can mint a CLIENT for ANY
// email (customer emails are printed on every invoice), so we must NOT hand
// over a stranger's bookings/invoices/contracts to an unproven account.
//
// A login resolves to contacts in exactly two ways, and nothing else:
//
//  1. VERIFIED EMAIL (unchanged): the user's email is VERIFIED
//     (`user.emailVerified != null`) and equals Contact.email. Google OAuth
//     sets this automatically (linkAccount event); credential signups start
//     unverified and are onboarded by staff via a portal invite token (see
//     portal-invite.ts).
//
//  2. CUSTOMER LINK: a CustomerLink row for (user, contact). Rows are only
//     created when the user proved the contact's own phone number with a
//     WhatsApp code (method PHONE, src/lib/otp.ts) or when a team member with
//     contacts/bookings update rights gave access (method STAFF,
//     src/actions/customer-access.actions.ts). Links to soft-deleted contacts
//     are ignored. Logins created from a WhatsApp number carry an unverified
//     or non-deliverable email, so rule 1 never widens their access.
//
// This is the single choke-point every portal and customer-app action funnels
// through, so the rules can't be bypassed by one query forgetting to check.

import { prisma } from "@/lib/prisma";

export type PortalIdentity =
  | { verified: true; email: string; contactIds: string[] }
  | { verified: false; email: string | null; contactIds: [] };

/**
 * Resolve the contact ids a portal user is allowed to see. A user with neither
 * a verified email nor a customer link resolves to zero contacts, so no other
 * customer's data is ever returned.
 */
export async function resolvePortalContactIds(
  userId: string
): Promise<PortalIdentity> {
  const [user, links] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    }),
    prisma.customerLink.findMany({
      where: { userId },
      select: { contactId: true },
    }),
  ]);

  if (!user) return { verified: false, email: null, contactIds: [] };

  const emailVerified = !!user.email && !!user.emailVerified;

  const [emailContacts, linkedContacts] = await Promise.all([
    // Rule 1 — verified email only. Unverified users get nothing from it.
    emailVerified
      ? prisma.contact.findMany({
          where: { email: user.email, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([] as { id: string }[]),
    // Rule 2 — customer links, live contacts only.
    links.length > 0
      ? prisma.contact.findMany({
          where: { id: { in: links.map((l) => l.contactId) }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([] as { id: string }[]),
  ]);

  // Not verified and not linked → resolves to nothing. Callers show the
  // "needs verification / contact us" message instead of foreign data.
  if (!emailVerified && linkedContacts.length === 0) {
    return { verified: false, email: user.email ?? null, contactIds: [] };
  }

  const contactIds = [
    ...new Set([...emailContacts.map((c) => c.id), ...linkedContacts.map((c) => c.id)]),
  ];

  return { verified: true, email: user.email, contactIds };
}

/**
 * Convenience: just the contact ids (empty when unverified and unlinked). Use
 * when the caller doesn't need to distinguish "unverified" from "verified but
 * no matching contacts".
 */
export async function getVerifiedContactIds(userId: string): Promise<string[]> {
  const identity = await resolvePortalContactIds(userId);
  return identity.contactIds;
}
