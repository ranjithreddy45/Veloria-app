"use server";

// ============================================================
// Family sharing — a host shares ONE booking with family or a planner.
//
// One table, both sides: the host invites and revokes BookingCollaborator
// rows from /app/event/share; the team sees the same rows on the booking page
// (CollaboratorsPanel) and can revoke them too. Nothing is copied anywhere.
//
// Lifecycle: the host's invite creates an INVITED row (phone stored in
// normalizeOtpPhone form). It turns ACTIVE when that person signs in with a
// WhatsApp code for the same number (completeOtpLogin, src/lib/otp.ts). Only
// ACTIVE rows grant access — getHostScope() reports them as collaboratorRoles —
// and what they grant comes from collaborator-permissions.ts.
//
// getMyBookingAccess is the access answer for customer-side booking writes:
// the booking's own customer, an ACTIVE collaborator, or a team preview
// (read-only). Writes refuse in preview and wherever the role doesn't allow it.
// ============================================================

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHostScope, getHostUser, isStaffUser, staffCan, type HostUser } from "@/lib/guest/host-scope";
import { logActivity } from "@/lib/activity-logger";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { checkRateLimit } from "@/lib/rate-limit";
import { COLLABORATOR_ROLE_LABEL, COLLABORATOR_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import {
  bookingAccessActions,
  canDo,
  isCollaboratorRole,
  isCollaboratorStatus,
  type BookingAccess,
  type BookingAction,
  type CollaboratorRole,
  type CollaboratorStatus,
} from "@/lib/customer-app/collaborator-permissions";
import { checkPhone, collaboratorPhoneForStorage, displayPhone, samePhone } from "@/app/(guest)/app/event/guests/_lib/host-phone";
import { collaboratorInviteText, welcomeUrl } from "@/app/(guest)/app/event/share/_lib/invite-text";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const PREVIEW_ERROR =
  "Staff preview — this would change a real customer's booking. Sign in as that host (or the demo guest) to try it.";
/** Most people one booking can be shared with at a time (INVITED + ACTIVE). */
const MAX_SHARED = 15;

// ------------------------------------------------------------ access

export type BookingAccessKind = "OWNER" | "COLLABORATOR" | "PREVIEW";

export interface MyBookingAccess {
  bookingId: string;
  userId: string;
  kind: BookingAccessKind;
  /** Set for collaborators only. */
  role: CollaboratorRole | null;
  actions: BookingAction[];
  /** A team member previewing the host view: read-only. */
  preview: boolean;
}

const ACCESS_BOOKING_SELECT = {
  id: true,
  eventName: true,
  date: true,
  contact: { select: { firstName: true, lastName: true, phone: true } },
} as const;
type AccessBooking = Prisma.BookingGetPayload<{ select: typeof ACCESS_BOOKING_SELECT }>;

interface ResolvedAccess extends MyBookingAccess {
  booking: AccessBooking;
}

/** Access through getHostScope — the same scope every guest-app screen reads. */
async function resolveAccess(bookingId?: unknown): Promise<ResolvedAccess | null> {
  const requested = typeof bookingId === "string" && bookingId ? bookingId : undefined;
  const scope = await getHostScope(requested);
  const inScope = scope?.booking ?? null;
  if (!scope || !inScope || (requested && inScope.id !== requested)) return null;

  // collaboratorRoles lists only ACTIVE rows bound to this login; a booking
  // absent from it is the customer's own.
  const sharedRole = scope.preview ? undefined : scope.collaboratorRoles?.[inScope.id];
  const access: BookingAccess = scope.preview
    ? { kind: "PREVIEW" }
    : sharedRole !== undefined
      ? { kind: "COLLABORATOR", role: sharedRole, status: "ACTIVE" }
      : { kind: "OWNER" };
  const actions = bookingAccessActions(access);
  if (actions.length === 0) return null;

  const booking = await prisma.booking.findUnique({ where: { id: inScope.id }, select: ACCESS_BOOKING_SELECT });
  if (!booking) return null;
  return {
    bookingId: booking.id,
    userId: scope.user.id,
    kind: access.kind,
    role: isCollaboratorRole(sharedRole) ? sharedRole : null,
    actions,
    preview: scope.preview,
    booking,
  };
}

/**
 * What the signed-in user may do on a booking (their default booking when no id
 * is given), or null when they have no access. Safe to call from the browser:
 * it only ever describes the caller's own access.
 */
export async function getMyBookingAccess(bookingId?: string): Promise<MyBookingAccess | null> {
  const a = await resolveAccess(bookingId);
  return a ? { bookingId: a.bookingId, userId: a.userId, kind: a.kind, role: a.role, actions: a.actions, preview: a.preview } : null;
}

// ------------------------------------------------------------ shaping

type CollaboratorRecord = {
  id: string;
  bookingId: string;
  name: string | null;
  phone: string;
  role: string;
  status: string;
  userId: string | null;
  invitedById: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export interface ShareCollaboratorRow {
  id: string;
  name: string;
  phoneDisplay: string;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  /** When the current invitation went out (a re-invite moves it). */
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, INVITED: 1, REVOKED: 2 };
function byStatusThenDate(a: CollaboratorRecord, b: CollaboratorRecord): number {
  return (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || a.createdAt.getTime() - b.createdAt.getTime();
}

function shapeShareRow(c: CollaboratorRecord): ShareCollaboratorRow {
  return {
    id: c.id,
    name: c.name?.trim() || "Family member",
    phoneDisplay: displayPhone(c.phone) ?? c.phone,
    // Display only — access itself is always decided by collaborator-permissions (fail closed).
    role: isCollaboratorRole(c.role) ? c.role : "VIEWER",
    status: isCollaboratorStatus(c.status) ? c.status : "REVOKED",
    invitedAt: (c.status === "INVITED" ? c.updatedAt : c.createdAt).toISOString(),
    acceptedAt: c.acceptedAt?.toISOString() ?? null,
    revokedAt: c.revokedAt?.toISOString() ?? null,
  };
}

function eventDateLabel(d: Date): string {
  // booking.date is a @db.Date (UTC midnight): format in UTC so the day never shifts.
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function hostNameOf(b: AccessBooking): string {
  return `${b.contact.firstName} ${b.contact.lastName ?? ""}`.trim() || "Your host";
}

async function whatsappConfigured(): Promise<boolean> {
  try {
    return !!(await prisma.whatsAppConfig.findFirst({ where: { isActive: true }, select: { id: true } }));
  } catch {
    return false;
  }
}

// ------------------------------------------------------------ host: share screen

export interface ShareScreenData {
  bookingId: string;
  eventName: string;
  eventDate: string;
  hostName: string;
  access: BookingAccessKind;
  role: CollaboratorRole | null;
  preview: boolean;
  /** The booking's own customer (not in preview) may invite and revoke. */
  canManage: boolean;
  whatsappReady: boolean;
  welcomeUrl: string;
  /** Empty for collaborators: only the host (and a team preview) see who else has access. */
  collaborators: ShareCollaboratorRow[];
}

export async function getShareScreen(bookingId?: string): Promise<ShareScreenData | null> {
  const access = await resolveAccess(bookingId);
  if (!access || !canDo(access.actions, "event:view")) return null;
  const canSee = canDo(access.actions, "collaborators:view");
  const [rows, ready] = await Promise.all([
    canSee ? prisma.bookingCollaborator.findMany({ where: { bookingId: access.bookingId } }) : Promise.resolve([] as CollaboratorRecord[]),
    whatsappConfigured(),
  ]);
  return {
    bookingId: access.bookingId,
    eventName: access.booking.eventName,
    eventDate: eventDateLabel(access.booking.date),
    hostName: hostNameOf(access.booking),
    access: access.kind,
    role: access.role,
    preview: access.preview,
    canManage: !access.preview && canDo(access.actions, "collaborators:manage"),
    whatsappReady: ready,
    welcomeUrl: welcomeUrl(access.bookingId),
    collaborators: [...rows].sort(byStatusThenDate).map(shapeShareRow),
  };
}

export interface InviteCollaboratorResult {
  collaborator: ShareCollaboratorRow;
  /** SENT only when WhatsApp accepted the message — never a claim that it was delivered. */
  whatsapp: "SENT" | "NOT_SENT";
  /** They already had access; only the name/role changed and no message went out. */
  alreadyActive: boolean;
  shareText: string;
  shareUrl: string;
}

export async function inviteCollaborator(input: {
  bookingId: string;
  name: string;
  phone: string;
  role: string;
}): Promise<Result<InviteCollaboratorResult>> {
  const access = await resolveAccess(input?.bookingId);
  if (!access) return { success: false, error: "Not authorized." };
  if (access.preview) return { success: false, error: PREVIEW_ERROR };
  if (!canDo(access.actions, "collaborators:manage")) return { success: false, error: "Only the host can share this booking." };

  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (name.length < 2) return { success: false, error: "Enter their name." };
  if (!isCollaboratorRole(input.role)) return { success: false, error: "Choose what they can do." };
  const role = input.role;
  const phoneCheck = checkPhone(input.phone);
  if (phoneCheck.kind === "EMPTY") return { success: false, error: "Enter their WhatsApp number." };
  if (phoneCheck.kind === "INVALID") return { success: false, error: phoneCheck.error };
  const phone = collaboratorPhoneForStorage(phoneCheck.digits);

  const me = await prisma.user.findUnique({ where: { id: access.userId }, select: { phone: true } });
  if (samePhone(phone, me?.phone) || samePhone(phone, access.booking.contact.phone)) {
    return { success: false, error: "That's your own number — you already have access." };
  }

  const limit = checkRateLimit(`collaborator-invite:${access.userId}`, { maxRequests: 10, windowSeconds: 600 });
  if (!limit.success) return { success: false, error: `Too many invites in a row. Try again in ${Math.max(1, Math.ceil(limit.resetIn / 60))} min.` };

  const existing = await prisma.bookingCollaborator.findUnique({
    where: { bookingId_phone: { bookingId: access.bookingId, phone } },
  });
  if (!existing || existing.status === "REVOKED") {
    const open = await prisma.bookingCollaborator.count({ where: { bookingId: access.bookingId, status: { in: ["INVITED", "ACTIVE"] } } });
    if (open >= MAX_SHARED) {
      return { success: false, error: `You can share this booking with up to ${MAX_SHARED} people. Remove someone first.` };
    }
  }

  let row: CollaboratorRecord;
  let action: "collaborator_invited" | "collaborator_reinvited" | "collaborator_updated";
  const alreadyActive = existing?.status === "ACTIVE";
  if (existing && alreadyActive) {
    row = await prisma.bookingCollaborator.update({ where: { id: existing.id }, data: { name, role } });
    action = "collaborator_updated";
  } else if (existing) {
    // Invited again, or invited afresh after a revoke. Access returns only when
    // they sign in and prove this number again — never straight from here.
    row = await prisma.bookingCollaborator.update({
      where: { id: existing.id },
      data: { name, role, status: "INVITED", invitedById: access.userId, userId: null, acceptedAt: null, revokedAt: null },
    });
    action = "collaborator_reinvited";
  } else {
    try {
      row = await prisma.bookingCollaborator.create({
        data: { bookingId: access.bookingId, phone, name, role, status: "INVITED", invitedById: access.userId },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { success: false, error: "That number was just invited. Refresh to see it." };
      }
      throw e;
    }
    action = "collaborator_invited";
  }

  const shareUrl = welcomeUrl(access.bookingId);
  const phoneDisplay = displayPhone(phone) ?? `+${phone}`;
  const shareText = collaboratorInviteText({
    recipientName: name,
    hostName: hostNameOf(access.booking),
    eventName: access.booking.eventName,
    eventDate: eventDateLabel(access.booking.date),
    role,
    phoneDisplay,
    url: shareUrl,
  });

  // WhatsAppConfig has no approved template for this message (only OTP,
  // booking-update and guest-invite templates), so it goes as text. Text only
  // reaches people inside WhatsApp's 24-hour window, which is why the share
  // link is always offered too. SENT means accepted, not delivered.
  let whatsapp: "SENT" | "NOT_SENT" = "NOT_SENT";
  if (!alreadyActive) {
    try {
      const res = await sendWhatsApp({ to: phone, message: shareText });
      if (res?.success) whatsapp = "SENT";
      else console.warn("[COLLABORATOR_INVITE_WHATSAPP]", res?.error);
    } catch (e) {
      console.error("[COLLABORATOR_INVITE_WHATSAPP]", e);
    }
  }

  await logActivity({
    userId: access.userId,
    action,
    entityType: "Booking",
    entityId: access.bookingId,
    changes: { collaboratorId: row.id, name, phone: phoneDisplay, role, whatsapp, via: "guest-app" },
  });
  revalidatePath(`/bookings/${access.bookingId}`);
  revalidatePath("/app/event/share");

  return { success: true, data: { collaborator: shapeShareRow(row), whatsapp, alreadyActive, shareText, shareUrl } };
}

async function markRevoked(id: string): Promise<CollaboratorRecord | null> {
  await prisma.bookingCollaborator.updateMany({ where: { id, status: { not: "REVOKED" } }, data: { status: "REVOKED", revokedAt: new Date() } });
  return prisma.bookingCollaborator.findUnique({ where: { id } });
}

export async function revokeCollaborator(bookingId: string, collaboratorId: string): Promise<Result<{ collaborator: ShareCollaboratorRow }>> {
  const access = await resolveAccess(bookingId);
  if (!access) return { success: false, error: "Not authorized." };
  if (access.preview) return { success: false, error: PREVIEW_ERROR };
  if (!canDo(access.actions, "collaborators:manage")) return { success: false, error: "Only the host can change who this booking is shared with." };
  if (typeof collaboratorId !== "string" || !collaboratorId) return { success: false, error: "Not found." };

  const row = await prisma.bookingCollaborator.findFirst({ where: { id: collaboratorId, bookingId: access.bookingId } });
  if (!row) return { success: false, error: "Not found." };
  if (row.status === "REVOKED") return { success: true, data: { collaborator: shapeShareRow(row) } };

  const updated = (await markRevoked(row.id)) ?? row;
  await logActivity({
    userId: access.userId,
    action: "collaborator_revoked",
    entityType: "Booking",
    entityId: access.bookingId,
    changes: { collaboratorId: row.id, name: row.name, phone: displayPhone(row.phone), role: row.role, previousStatus: row.status, via: "guest-app" },
  });
  revalidatePath(`/bookings/${access.bookingId}`);
  revalidatePath("/app/event/share");
  return { success: true, data: { collaborator: shapeShareRow(updated) } };
}

// ------------------------------------------------------------ team: booking page panel

export interface TeamCollaboratorRow {
  id: string;
  name: string | null;
  phone: string;
  role: string;
  /** The customer's own words for the role and status, so both sides describe a row the same way. */
  roleLabel: string;
  status: string;
  statusLabel: string;
  invitedAt: string;
  invitedByName: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  /** The login that proved this number (set once they have signed in). */
  loginName: string | null;
}

export interface TeamCollaboratorsData {
  bookingId: string;
  /** bookings:update — decided on the server; the revoke action checks it again. */
  canRevoke: boolean;
  rows: TeamCollaboratorRow[];
}

/**
 * A team member who may open the booking page: bookings:read by the session's
 * effective permissions (staffCan), the check middleware makes for /bookings.
 */
async function teamMember(): Promise<HostUser | null> {
  const user = await getHostUser();
  return user && isStaffUser(user) ? user : null;
}

export async function getBookingCollaboratorsForTeam(bookingId: string): Promise<TeamCollaboratorsData | null> {
  const staff = await teamMember();
  if (!staff || typeof bookingId !== "string" || !bookingId) return null;

  const rows = await prisma.bookingCollaborator.findMany({ where: { bookingId } });
  const userIds = [...new Set(rows.flatMap((r) => [r.userId, r.invitedById]).filter((x): x is string => !!x))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const nameOf = (id: string | null) => {
    const u = id ? users.find((x) => x.id === id) : undefined;
    return u ? u.name || u.email || null : null;
  };

  return {
    bookingId,
    canRevoke: staffCan(staff, "bookings:update"),
    rows: [...rows].sort(byStatusThenDate).map((r) => ({
      id: r.id,
      name: r.name,
      phone: displayPhone(r.phone) ?? r.phone,
      role: r.role,
      roleLabel: customerLabel(COLLABORATOR_ROLE_LABEL, r.role),
      status: r.status,
      statusLabel: customerLabel(COLLABORATOR_STATUS_LABEL, r.status),
      invitedAt: (r.status === "INVITED" ? r.updatedAt : r.createdAt).toISOString(),
      invitedByName: nameOf(r.invitedById),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
      revokedAt: r.revokedAt?.toISOString() ?? null,
      loginName: nameOf(r.userId),
    })),
  };
}

export async function revokeCollaboratorAsTeam(collaboratorId: string): Promise<Result<{ id: string; status: "REVOKED" }>> {
  const staff = await teamMember();
  if (!staff || !staffCan(staff, "bookings:update")) {
    return { success: false, error: "You don't have permission to change this booking." };
  }
  if (typeof collaboratorId !== "string" || !collaboratorId) return { success: false, error: "Not found." };

  const row = await prisma.bookingCollaborator.findUnique({ where: { id: collaboratorId } });
  if (!row) return { success: false, error: "Not found." };
  if (row.status !== "REVOKED") {
    await markRevoked(row.id);
    await logActivity({
      userId: staff.id,
      action: "collaborator_revoked",
      entityType: "Booking",
      entityId: row.bookingId,
      changes: { collaboratorId: row.id, name: row.name, phone: displayPhone(row.phone), role: row.role, previousStatus: row.status, via: "team" },
    });
  }
  revalidatePath(`/bookings/${row.bookingId}`);
  revalidatePath("/app/event/share");
  return { success: true, data: { id: row.id, status: "REVOKED" } };
}
