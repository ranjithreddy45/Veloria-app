"use server";

// ============================================================
// Settings → Venue owners: invite owner logins, choose their venues, switch
// them on and off — plus the two PUBLIC actions behind the activation page.
// ------------------------------------------------------------
// A venue owner is an EXTERNAL person. Their login (role VENUE_OWNER) reaches
// only /venue-portal, which shows lead and booking COUNTS for the venues in
// their VenueOwnerAccess rows (src/lib/venue-owner/portal-data.ts). Nothing
// here hands an owner any customer data: these actions manage the login and
// the venue list, nothing else.
//
// Lifecycle:
//   invite      → User { role VENUE_OWNER, isActive false, no password } and a
//                 single-use link (src/lib/venue-owner/invite.ts). No email is
//                 sent (email isn't configured); the admin shares the link.
//   activate    → the owner (logged out) sets a password; isActive turns on.
//   deactivate  → isActive off. auth.ts re-checks isActive every 5 minutes,
//                 so an open session is cut off within that window.
//
// Every staff action requires "venue-owners:manage", checked with the same
// override-aware rule middleware applies (sessionAllows). The two public
// actions are guarded by the invite token alone.
// ============================================================

import bcryptjs from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { sessionAllows } from "@/lib/permission-claims";
import { logActivity } from "@/lib/activity-logger";
import { isValidOtpPhone, loadPhoneUsers, normalizeOtpPhone } from "@/lib/otp";
import {
  checkVenueOwnerInvite,
  consumeVenueOwnerInvite,
  createVenueOwnerInvite,
  getVenueOwnerInviteExpiries,
  revokeVenueOwnerInvites,
} from "@/lib/venue-owner/invite";
import {
  buildVenueOwnerInviteUrl,
  describeRole,
  normalizeVenueIds,
  ownerPasswordError,
  validateOwnerInvite,
  type OwnerInviteState,
  type VenueOwnerInviteInput,
  type VenueOwnersData,
} from "@/lib/venue-owner/admin-rules";

type Result<T> = { success: true; data: T } | { success: false; error: string };
type Gate = { ok: true; userId: string } | { ok: false; error: string };

const PAGE_PATH = "/settings/venue-owners";
const ENTITY = "VenueOwner";

async function requireManager(): Promise<Gate> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!sessionAllows(session, "venue-owners:manage")) {
    return { ok: false, error: "You don't have permission to manage venue owners." };
  }
  return { ok: true, userId: session.user.id };
}

/** Has this login set a password? Asked as a count so the hash never leaves the DB. */
async function isActivated(userId: string): Promise<boolean> {
  return (await prisma.user.count({ where: { id: userId, hashedPassword: { not: null } } })) > 0;
}

/** The target must be a VENUE_OWNER login: these actions never touch staff, customers or vendors. */
async function findOwner(userId: unknown) {
  if (typeof userId !== "string" || !userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  return user?.role === "VENUE_OWNER" ? user : null;
}

/** Every requested venue must exist. Returns their names (for the activity log). */
async function loadVenues(venueIds: string[]): Promise<{ id: string; name: string }[] | null> {
  if (venueIds.length === 0) return [];
  const found = await prisma.venue.findMany({ where: { id: { in: venueIds } }, select: { id: true, name: true } });
  return found.length === venueIds.length ? found : null;
}

/** The owner's mobile as WhatsApp digits, or null when it isn't a usable number. */
function whatsappDigits(phone: string | null): string | null {
  if (!phone) return null;
  const normalized = normalizeOtpPhone(phone);
  return isValidOtpPhone(normalized) ? normalized : null;
}

// ------------------------------------------------------------
// Staff: list
// ------------------------------------------------------------

export async function listVenueOwners(): Promise<Result<VenueOwnersData>> {
  const gate = await requireManager();
  if (!gate.ok) return { success: false, error: gate.error };
  try {
    const [users, activatedRows, venues] = await Promise.all([
      prisma.user.findMany({
        where: { role: "VENUE_OWNER" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          venueOwnerAccess: {
            select: { venue: { select: { id: true, name: true } } },
            orderBy: { venue: { name: "asc" } },
          },
        },
      }),
      prisma.user.findMany({
        where: { role: "VENUE_OWNER", hashedPassword: { not: null } },
        select: { id: true },
      }),
      prisma.venue.findMany({
        select: { id: true, name: true, isActive: true },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      }),
    ]);
    const activated = new Set(activatedRows.map((r) => r.id));
    const expiries = await getVenueOwnerInviteExpiries(users.filter((u) => !activated.has(u.id)).map((u) => u.id));
    const now = Date.now();

    return {
      success: true,
      data: {
        owners: users.map((u) => {
          const expires = expiries.get(u.id) ?? null;
          const inviteState: OwnerInviteState = !expires ? "none" : expires.getTime() > now ? "live" : "expired";
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            whatsappPhone: whatsappDigits(u.phone),
            isActive: u.isActive,
            activated: activated.has(u.id),
            createdAt: u.createdAt.toISOString(),
            inviteState,
            inviteExpiresAt: expires ? expires.toISOString() : null,
            venues: u.venueOwnerAccess.map((a) => a.venue),
          };
        }),
        venues,
      },
    };
  } catch (error) {
    console.error("[LIST_VENUE_OWNERS_ERROR]", error);
    return { success: false, error: "Couldn't load the venue owners." };
  }
}

// ------------------------------------------------------------
// Staff: invite (or add venues to an existing owner)
// ------------------------------------------------------------

export async function inviteVenueOwner(
  input: VenueOwnerInviteInput
): Promise<Result<{ userId: string; inviteUrl: string | null; existing: boolean; whatsappPhone: string | null }>> {
  const gate = await requireManager();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = validateOwnerInvite(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { name, email, phone, venueIds } = parsed.value;

  try {
    const venues = await loadVenues(venueIds);
    if (!venues) return { success: false, error: "One of the chosen venues no longer exists. Refresh and try again." };

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true, phone: true },
    });

    if (existing) {
      // Never turn a staff, customer or vendor login into an owner login: that
      // would change what an existing person can sign in to.
      if (existing.role !== "VENUE_OWNER") {
        return {
          success: false,
          error: `That email already belongs to ${describeRole(existing.role)} login — use a different email for the owner.`,
        };
      }
      // Already an owner: add the venues and carry on. Identity (name, phone)
      // is left as it is.
      await prisma.venueOwnerAccess.createMany({
        data: venueIds.map((venueId) => ({ userId: existing.id, venueId, grantedById: gate.userId })),
        skipDuplicates: true,
      });
      // A link only for an owner who hasn't activated yet; an activated owner
      // already signs in with their own password.
      const inviteUrl = (await isActivated(existing.id))
        ? null
        : buildVenueOwnerInviteUrl(existing.id, await createVenueOwnerInvite(existing.id));
      await logActivity({
        userId: gate.userId,
        action: "venues_added",
        entityType: ENTITY,
        entityId: existing.id,
        changes: { venues: venues.map((v) => v.name), newInviteLink: inviteUrl !== null },
      });
      revalidatePath(PAGE_PATH);
      return {
        success: true,
        data: { userId: existing.id, inviteUrl, existing: true, whatsappPhone: whatsappDigits(existing.phone) },
      };
    }

    // A number already on another login would break that login's WhatsApp
    // sign-in (two logins on one number are refused as ambiguous).
    if (phone) {
      const digits = normalizeOtpPhone(phone);
      if (!isValidOtpPhone(digits)) return { success: false, error: "Enter a valid mobile number, or leave it blank." };
      const holders = await loadPhoneUsers(prisma, digits);
      if (holders.truncated || holders.users.length > 0) {
        return {
          success: false,
          error: "That mobile number is already on another login. Leave it blank, or use the owner's own number.",
        };
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        // Inactive with no password until the owner opens the invite.
        data: { name, email, phone, role: "VENUE_OWNER", isActive: false },
        select: { id: true },
      });
      await tx.venueOwnerAccess.createMany({
        data: venueIds.map((venueId) => ({ userId: created.id, venueId, grantedById: gate.userId })),
      });
      return created;
    });

    const inviteUrl = buildVenueOwnerInviteUrl(user.id, await createVenueOwnerInvite(user.id));
    await logActivity({
      userId: gate.userId,
      action: "invited",
      entityType: ENTITY,
      entityId: user.id,
      changes: { email, venues: venues.map((v) => v.name) },
    });
    revalidatePath(PAGE_PATH);
    return { success: true, data: { userId: user.id, inviteUrl, existing: false, whatsappPhone: whatsappDigits(phone) } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "That email was just added by someone else. Refresh the list and try again." };
    }
    console.error("[INVITE_VENUE_OWNER_ERROR]", error);
    return { success: false, error: "Couldn't invite the owner. Please try again." };
  }
}

// ------------------------------------------------------------
// Staff: a fresh invite link (the earlier one stops working)
// ------------------------------------------------------------

export async function regenerateVenueOwnerInvite(userId: string): Promise<Result<{ inviteUrl: string }>> {
  const gate = await requireManager();
  if (!gate.ok) return { success: false, error: gate.error };
  try {
    const owner = await findOwner(userId);
    if (!owner) return { success: false, error: "Owner not found." };
    if (await isActivated(owner.id)) {
      return {
        success: false,
        error: "This owner has already set a password and signs in with it. If they've forgotten it, reset it from Settings → Users.",
      };
    }
    const inviteUrl = buildVenueOwnerInviteUrl(owner.id, await createVenueOwnerInvite(owner.id));
    await logActivity({ userId: gate.userId, action: "invite_regenerated", entityType: ENTITY, entityId: owner.id });
    revalidatePath(PAGE_PATH);
    return { success: true, data: { inviteUrl } };
  } catch (error) {
    console.error("[REGENERATE_VENUE_OWNER_INVITE_ERROR]", error);
    return { success: false, error: "Couldn't create a new link. Please try again." };
  }
}

// ------------------------------------------------------------
// Staff: cancel an outstanding invite link
// ------------------------------------------------------------

export async function revokeVenueOwnerInvite(userId: string): Promise<Result<{ revoked: true }>> {
  const gate = await requireManager();
  if (!gate.ok) return { success: false, error: gate.error };
  try {
    const owner = await findOwner(userId);
    if (!owner) return { success: false, error: "Owner not found." };
    await revokeVenueOwnerInvites(owner.id);
    await logActivity({ userId: gate.userId, action: "invite_revoked", entityType: ENTITY, entityId: owner.id });
    revalidatePath(PAGE_PATH);
    return { success: true, data: { revoked: true } };
  } catch (error) {
    console.error("[REVOKE_VENUE_OWNER_INVITE_ERROR]", error);
    return { success: false, error: "Couldn't cancel the link. Please try again." };
  }
}

// ------------------------------------------------------------
// Staff: which venues an owner sees (replaces the whole list)
// ------------------------------------------------------------

export async function setVenueOwnerVenues(input: {
  userId: string;
  venueIds: string[];
}): Promise<Result<{ venueCount: number }>> {
  const gate = await requireManager();
  if (!gate.ok) return { success: false, error: gate.error };

  // Zero is allowed: the owner keeps their login but sees an empty portal.
  const ids = normalizeVenueIds(input?.venueIds);
  if (!ids.ok) return { success: false, error: ids.error };

  try {
    const owner = await findOwner(input?.userId);
    if (!owner) return { success: false, error: "Owner not found." };
    const venues = await loadVenues(ids.value);
    if (!venues) return { success: false, error: "One of the chosen venues no longer exists. Refresh and try again." };

    // Keep rows that stay (their grantedBy / createdAt history), drop the rest,
    // add the new ones — in one transaction so the portal never sees a half-set.
    await prisma.$transaction([
      prisma.venueOwnerAccess.deleteMany({ where: { userId: owner.id, venueId: { notIn: ids.value } } }),
      prisma.venueOwnerAccess.createMany({
        data: ids.value.map((venueId) => ({ userId: owner.id, venueId, grantedById: gate.userId })),
        skipDuplicates: true,
      }),
    ]);
    await logActivity({
      userId: gate.userId,
      action: "venues_changed",
      entityType: ENTITY,
      entityId: owner.id,
      changes: { venues: venues.map((v) => v.name) },
    });
    revalidatePath(PAGE_PATH);
    return { success: true, data: { venueCount: ids.value.length } };
  } catch (error) {
    console.error("[SET_VENUE_OWNER_VENUES_ERROR]", error);
    return { success: false, error: "Couldn't save the venues. Please try again." };
  }
}

// ------------------------------------------------------------
// Staff: switch an owner login off / back on
// ------------------------------------------------------------

export async function setVenueOwnerActive(input: {
  userId: string;
  active: boolean;
}): Promise<Result<{ active: boolean }>> {
  const gate = await requireManager();
  if (!gate.ok) return { success: false, error: gate.error };
  if (typeof input?.active !== "boolean") return { success: false, error: "Invalid request." };

  try {
    const owner = await findOwner(input.userId);
    if (!owner) return { success: false, error: "Owner not found." };
    const activated = await isActivated(owner.id);

    if (input.active) {
      // Switching on a login with no password would let a phone-matched
      // WhatsApp sign-in skip activation entirely. The invite turns it on.
      if (!activated) {
        return {
          success: false,
          error: "This owner hasn't set a password yet. Share their invite link — the login switches on when they use it.",
        };
      }
      await prisma.user.update({ where: { id: owner.id }, data: { isActive: true } });
    } else {
      await prisma.user.update({ where: { id: owner.id }, data: { isActive: false } });
      // A pending owner is already inactive; switching them off means the
      // invite must stop working too, or opening it would switch them back on.
      if (!activated) await revokeVenueOwnerInvites(owner.id);
    }

    await logActivity({
      userId: gate.userId,
      action: input.active ? "reactivated" : "deactivated",
      entityType: ENTITY,
      entityId: owner.id,
    });
    revalidatePath(PAGE_PATH);
    return { success: true, data: { active: input.active } };
  } catch (error) {
    console.error("[SET_VENUE_OWNER_ACTIVE_ERROR]", error);
    return { success: false, error: "Couldn't update the owner. Please try again." };
  }
}

// ------------------------------------------------------------
// PUBLIC: preview for the activation page. Validates the token and returns
// only the owner's own name and email.
// ------------------------------------------------------------

export async function getVenueOwnerInvitePreview(
  userId: string,
  token: string
): Promise<{ valid: true; name: string; email: string } | { valid: false; reason: "invalid" | "expired" | "used" }> {
  try {
    if (typeof userId !== "string" || typeof token !== "string" || !userId || !token) {
      return { valid: false, reason: "invalid" };
    }
    const owner = await findOwner(userId);
    if (!owner) return { valid: false, reason: "invalid" };
    // Checked before the token: a used link's token is gone, and "already
    // used — sign in" is the useful answer for an owner reopening it.
    if (await isActivated(owner.id)) return { valid: false, reason: "used" };
    const state = await checkVenueOwnerInvite(owner.id, token);
    if (state !== "valid") return { valid: false, reason: state };
    return { valid: true, name: owner.name ?? "", email: owner.email };
  } catch (error) {
    console.error("[VENUE_OWNER_INVITE_PREVIEW_ERROR]", error);
    return { valid: false, reason: "invalid" };
  }
}

// ------------------------------------------------------------
// PUBLIC: the owner sets their password, which activates the login. Hashing
// and field match the credentials provider in auth.ts (bcryptjs, cost 12,
// User.hashedPassword) and vendor activation.
// ------------------------------------------------------------

export async function acceptVenueOwnerInvite(input: {
  userId: string;
  token: string;
  password: string;
  confirm: string;
}): Promise<Result<{ email: string }>> {
  const userId = typeof input?.userId === "string" ? input.userId : "";
  const token = typeof input?.token === "string" ? input.token : "";
  if (!userId || !token) return { success: false, error: "This activation link is invalid." };

  const passwordError = ownerPasswordError(input?.password, input?.confirm);
  if (passwordError) return { success: false, error: passwordError };

  try {
    const owner = await findOwner(userId);
    if (!owner) return { success: false, error: "This activation link is invalid." };
    if (await isActivated(owner.id)) {
      return { success: false, error: "This link has already been used. Sign in with your email and password." };
    }

    const state = await checkVenueOwnerInvite(owner.id, token);
    if (state === "expired") return { success: false, error: "This link has expired. Ask your Veloria Grand contact for a fresh one." };
    if (state !== "valid") return { success: false, error: "This link is invalid or has already been used." };

    const hashedPassword = await bcryptjs.hash(input.password, 12);

    // Single use, atomically: the token row must be deleted by THIS call and
    // the login must still have no password, or nothing is written.
    const activated = await prisma.$transaction(async (tx) => {
      if (!(await consumeVenueOwnerInvite(owner.id, token, tx))) return false;
      const { count } = await tx.user.updateMany({
        where: { id: owner.id, role: "VENUE_OWNER", hashedPassword: null },
        data: { hashedPassword, isActive: true, emailVerified: new Date() },
      });
      if (count !== 1) throw new Error("VENUE_OWNER_ALREADY_ACTIVATED");
      return true;
    });
    if (!activated) return { success: false, error: "This link is invalid or has already been used." };

    await logActivity({ userId: owner.id, action: "activated", entityType: ENTITY, entityId: owner.id });
    return { success: true, data: { email: owner.email } };
  } catch (error) {
    if (error instanceof Error && error.message === "VENUE_OWNER_ALREADY_ACTIVATED") {
      return { success: false, error: "This link has already been used. Sign in with your email and password." };
    }
    console.error("[ACCEPT_VENUE_OWNER_INVITE_ERROR]", error);
    return { success: false, error: "Couldn't activate your login. Please try again." };
  }
}
