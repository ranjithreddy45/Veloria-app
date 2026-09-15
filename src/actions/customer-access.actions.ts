"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import {
  CUSTOMER_ACCESS_ACTIVITY,
  createCustomerLogin,
  decideStaffGrant,
  isUndeliverableEmail,
  isValidOtpPhone,
  loadPhoneUsers,
  lockPhoneForLogin,
  normalizeOtpPhone,
} from "@/lib/otp";

// ============================================================
// Team side: who can sign in to the customer app as this contact?
//
// Lists the contact's CustomerLink logins, plus logins that reach it through
// a verified matching email (portal-identity rule 1, shown read-only). Removes
// a link, or gives access to a phone number (CustomerLink method STAFF).
// Guarded by contacts:update or bookings:update. Every change writes an
// ActivityLog row in the same transaction. A removal also stops the customer
// being re-linked automatically at their next WhatsApp sign-in (see
// accessRemovedByTeam in src/lib/otp.ts) until someone gives access again.
// ============================================================

type AccessResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; forbidden?: boolean };

export interface CustomerAccessLogin {
  /** CustomerLink id; null for access through a verified email (not removable here). */
  linkId: string | null;
  userId: string;
  name: string | null;
  phone: string | null;
  /** A real address only; placeholder logins show none. */
  email: string | null;
  /** PHONE (WhatsApp code) | STAFF (given by the team) | EMAIL | VERIFIED_EMAIL (email rule). */
  method: string;
  /** ISO timestamp: when the link was made, or when the email was verified. */
  verifiedAt: string | null;
  isActive: boolean;
}

export interface CustomerAccessData {
  contactId: string;
  contactName: string;
  contactPhones: string[];
  logins: CustomerAccessLogin[];
}

async function requireManager(): Promise<{ id: string } | { error: string; forbidden: true }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", forbidden: true };
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "contacts:update") && !hasPermission(role, "bookings:update")) {
    return { error: "You don't have permission to manage customer access.", forbidden: true };
  }
  return { id: session.user.id };
}

function displayName(c: { firstName: string | null; lastName: string | null }): string {
  return `${c.firstName ?? ""} ${c.lastName ?? ""}`.replace(/\s+/g, " ").trim();
}

// ============================================================
// List
// ============================================================

export async function getCustomerAccess(contactId: string): Promise<AccessResult<CustomerAccessData>> {
  try {
    const manager = await requireManager();
    if ("error" in manager) return { success: false, error: manager.error, forbidden: true };

    const contact = await prisma.contact.findFirst({
      where: { id: String(contactId ?? ""), deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, alternatePhone: true },
    });
    if (!contact) return { success: false, error: "Contact not found." };

    const links = await prisma.customerLink.findMany({
      where: { contactId: contact.id },
      orderBy: { verifiedAt: "asc" },
    });

    const [linkedUsers, emailUsers] = await Promise.all([
      links.length > 0
        ? prisma.user.findMany({
            where: { id: { in: links.map((l) => l.userId) } },
            select: { id: true, name: true, phone: true, email: true, isActive: true },
          })
        : Promise.resolve([]),
      // Same rule as portal-identity: exact email match, verified logins only.
      contact.email
        ? prisma.user.findMany({
            where: { email: contact.email, emailVerified: { not: null } },
            select: { id: true, name: true, phone: true, email: true, isActive: true, emailVerified: true },
          })
        : Promise.resolve([]),
    ]);

    const usersById = new Map(linkedUsers.map((u) => [u.id, u]));
    const logins: CustomerAccessLogin[] = [];
    for (const link of links) {
      const u = usersById.get(link.userId);
      if (!u) continue; // the login was deleted: nobody can sign in through this link
      logins.push({
        linkId: link.id,
        userId: u.id,
        name: u.name,
        phone: u.phone,
        email: isUndeliverableEmail(u.email) ? null : u.email,
        method: link.method,
        verifiedAt: link.verifiedAt.toISOString(),
        isActive: u.isActive,
      });
    }
    const listed = new Set(logins.map((l) => l.userId));
    for (const u of emailUsers) {
      if (listed.has(u.id)) continue;
      logins.push({
        linkId: null,
        userId: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        method: "VERIFIED_EMAIL",
        verifiedAt: u.emailVerified ? u.emailVerified.toISOString() : null,
        isActive: u.isActive,
      });
    }

    return {
      success: true,
      data: {
        contactId: contact.id,
        contactName: displayName(contact),
        contactPhones: [contact.phone, contact.alternatePhone].filter((p): p is string => !!p?.trim()),
        logins,
      },
    };
  } catch (error) {
    console.error("getCustomerAccess error:", error);
    return { success: false, error: "Couldn't load customer access. Please try again." };
  }
}

// ============================================================
// Give access by phone (method STAFF)
// ============================================================

export async function grantCustomerAccessByPhone(input: {
  contactId: string;
  phone: string;
}): Promise<AccessResult<{ newLogin: boolean; alreadyHadAccess: boolean }>> {
  try {
    const manager = await requireManager();
    if ("error" in manager) return { success: false, error: manager.error, forbidden: true };

    const contactId = String(input?.contactId ?? "");
    const normalized = normalizeOtpPhone(String(input?.phone ?? ""));
    if (!isValidOtpPhone(normalized)) {
      return { success: false, error: "Enter a valid mobile number, with the country code if it isn't Indian." };
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!contact) return { success: false, error: "Contact not found." };

    type GrantOutcome =
      | { ok: false; error: string }
      | { ok: true; newLogin: boolean; alreadyHadAccess: boolean };

    const outcome = await prisma.$transaction(
      async (tx): Promise<GrantOutcome> => {
        // Same per-number lock as WhatsApp sign-in, so the two can't both mint a login.
        await lockPhoneForLogin(tx, normalized);
        const { users, truncated } = await loadPhoneUsers(tx, normalized);
        const decision = decideStaffGrant(users, truncated);
        if (decision.kind === "REFUSE") return { ok: false, error: decision.error };

        let userId: string;
        let newLogin = false;
        if (decision.kind === "LINK_EXISTING") {
          userId = decision.userId;
        } else {
          const created = await createCustomerLogin(tx, {
            normalized,
            name: displayName(contact) || null,
            phoneVerifiedAt: null, // proven only when they sign in with a code
          });
          userId = created.id;
          newLogin = true;
        }

        const existing = await tx.customerLink.findUnique({
          where: { userId_contactId: { userId, contactId: contact.id } },
          select: { id: true },
        });
        if (existing) return { ok: true, newLogin, alreadyHadAccess: true };

        await tx.customerLink.create({
          data: { userId, contactId: contact.id, method: "STAFF", verifiedAt: new Date() },
        });
        await tx.activityLog.create({
          data: {
            userId: manager.id,
            action: CUSTOMER_ACCESS_ACTIVITY.GRANTED,
            entityType: "Contact",
            entityId: contact.id,
            changes: { customerUserId: userId, method: "STAFF", phone: normalized, newLogin },
          },
        });
        return { ok: true, newLogin, alreadyHadAccess: false };
      },
      { maxWait: 5_000, timeout: 15_000 }
    );

    if (!outcome.ok) return { success: false, error: outcome.error };
    revalidatePath(`/contacts/${contact.id}`);
    return { success: true, data: { newLogin: outcome.newLogin, alreadyHadAccess: outcome.alreadyHadAccess } };
  } catch (error) {
    console.error("grantCustomerAccessByPhone error:", error);
    return { success: false, error: "Couldn't give access. Please try again." };
  }
}

// ============================================================
// Remove access
// ============================================================

export async function removeCustomerAccess(input: {
  contactId: string;
  linkId: string;
}): Promise<AccessResult<{ removed: boolean }>> {
  try {
    const manager = await requireManager();
    if ("error" in manager) return { success: false, error: manager.error, forbidden: true };

    const link = await prisma.customerLink.findUnique({ where: { id: String(input?.linkId ?? "") } });
    if (!link || link.contactId !== input.contactId) {
      return { success: false, error: "That access has already been removed." };
    }

    const removed = await prisma.$transaction(async (tx) => {
      const deleted = await tx.customerLink.deleteMany({ where: { id: link.id } });
      if (deleted.count === 0) return false;
      await tx.activityLog.create({
        data: {
          userId: manager.id,
          action: CUSTOMER_ACCESS_ACTIVITY.REMOVED,
          entityType: "Contact",
          entityId: link.contactId,
          changes: {
            customerUserId: link.userId,
            method: link.method,
            linkedAt: link.verifiedAt.toISOString(),
          },
        },
      });
      return true;
    });
    if (!removed) return { success: false, error: "That access has already been removed." };

    revalidatePath(`/contacts/${link.contactId}`);
    return { success: true, data: { removed } };
  } catch (error) {
    console.error("removeCustomerAccess error:", error);
    return { success: false, error: "Couldn't remove access. Please try again." };
  }
}
