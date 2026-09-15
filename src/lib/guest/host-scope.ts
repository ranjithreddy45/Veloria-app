import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getVerifiedContactIds } from "@/lib/portal-identity";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Signed-in guest app: who is the customer, and which bookings may they see?
//
// Shared by every signed-in guest-app action that lives OUTSIDE
// guest-host.actions.ts. Same rules as scope() in that file, plus invited
// collaborators:
//   - customers see bookings of their verified contacts (portal-identity:
//     verified email or CustomerLink)
//   - a login that accepted a host's invite (BookingCollaborator ACTIVE, bound
//     to this user) also sees THAT booking — and only that booking; the host's
//     contact is never added to `contactIds`
//   - team members who hold bookings:read and have no customer access get a
//     read-only PREVIEW of live bookings
// Team permissions are always the EFFECTIVE ones (staffCan): role defaults ±
// the overrides edited in Settings → Roles, applied the way middleware and the
// team inbox apply them, with admins always allowed. Every staff preview gate
// in the customer app asks staffCan(scope.user, permission), never the static
// role table, so a permission revoked in role settings is revoked here too.
// Every write MUST refuse when `preview` is true (and for VIEWER
// collaborators), and every booking id that comes from the browser MUST be
// checked with `canSeeBooking` or by passing it to getHostScope(bookingId) and
// using the returned `booking`.
// Keep these exported signatures stable: several features depend on them.
// ============================================================

export interface HostUser {
  id: string;
  name: string | null;
  role: string | null;
  /**
   * The session's effective team permissions, resolved by auth.ts (role
   * defaults ± Settings → Roles overrides; ["*"] for admins). null when the
   * session carries none, so the role's defaults apply, as in middleware.
   * Read it only through staffCan().
   */
  perms: string[] | null;
}

export interface HostBooking {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: Date;
  timeSlot: string;
  status: string;
  guestCount: number;
  venueId: string;
  createdById: string;
  contactId: string;
}

export type CollaboratorRole = "CO_HOST" | "VIEWER";

export interface HostScope {
  user: HostUser;
  contactIds: string[];
  bookings: HostBooking[];
  /** The requested booking when it is in scope, otherwise the next upcoming one (or null). */
  booking: HostBooking | null;
  /** True for a team member previewing the host view: read-only. */
  preview: boolean;
  /**
   * Bookings this login reaches ONLY as an invited collaborator, keyed by
   * booking id. Bookings of the login's own contacts never appear here.
   * Collaborator access is booking-scoped: the host's contact is not in
   * `contactIds`, so read money/documents/requests for these bookings by
   * booking id, and refuse writes for VIEWER.
   */
  collaboratorRoles?: Record<string, CollaboratorRole>;
}

const EXTERNAL_ROLES = new Set(["CLIENT", "VENDOR"]);
const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

/** A team login (any role except CLIENT and VENDOR), whatever its permissions. Not an access check. */
export function isTeamRole(role: string | null | undefined): boolean {
  return !!role && !EXTERNAL_ROLES.has(role);
}

/**
 * May this signed-in user do `permission` on the team side? The rule
 * middleware, the concierge inbox and menu-request review apply: CLIENT and
 * VENDOR never; SUPER_ADMIN and ADMIN always; anyone else by the session's
 * effective permissions (so an override in Settings → Roles counts, either
 * way), or by the role's defaults when the session carries none.
 */
export function staffCan(user: Pick<HostUser, "role" | "perms"> | null | undefined, permission: string): boolean {
  const role = user?.role;
  if (!user || !role || !isTeamRole(role)) return false;
  if (ADMIN_ROLES.has(role)) return true;
  return user.perms ? user.perms.includes("*") || user.perms.includes(permission) : hasPermission(role, permission);
}

/** A team member who may preview the customer view: bookings:read by their effective permissions (staffCan). */
export function isStaffUser(user: Pick<HostUser, "role" | "perms"> | null | undefined): boolean {
  return staffCan(user, "bookings:read");
}

const HOST_BOOKING_SELECT = {
  id: true,
  bookingNumber: true,
  eventName: true,
  eventType: true,
  date: true,
  timeSlot: true,
  status: true,
  guestCount: true,
  venueId: true,
  createdById: true,
  contactId: true,
} as const;

export async function getHostUser(): Promise<HostUser | null> {
  const s = await auth();
  if (!s?.user?.id) return null;
  const u = s.user as { name?: string | null; role?: string | null; perms?: unknown };
  return {
    id: s.user.id,
    name: u.name ?? null,
    role: u.role ?? null,
    perms: Array.isArray(u.perms) ? u.perms.filter((p): p is string => typeof p === "string") : null,
  };
}

/** null when nobody is signed in. */
export async function getHostScope(bookingId?: string): Promise<HostScope | null> {
  const user = await getHostUser();
  if (!user) return null;

  const [verifiedContactIds, collaborations] = await Promise.all([
    getVerifiedContactIds(user.id),
    // Only rows a WhatsApp-verified sign-in bound to THIS login (see
    // completeOtpLogin in src/lib/otp.ts). INVITED and REVOKED rows grant nothing.
    prisma.bookingCollaborator.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: { bookingId: true, role: true },
    }),
  ]);
  let contactIds = verifiedContactIds;
  let preview = false;
  let rows: HostBooking[] = [];
  const collaboratorRoles: Record<string, CollaboratorRole> = {};

  if (contactIds.length > 0 || collaborations.length > 0) {
    // CO_HOST wins if a login somehow holds two rows for one booking.
    const roleByBooking = new Map<string, CollaboratorRole>();
    for (const c of collaborations) {
      if (c.role === "CO_HOST") roleByBooking.set(c.bookingId, "CO_HOST");
      else if (!roleByBooking.has(c.bookingId)) roleByBooking.set(c.bookingId, "VIEWER");
    }
    const collaboratorBookingIds = [...roleByBooking.keys()];
    rows = await prisma.booking.findMany({
      where: {
        status: { not: "CANCELLED" },
        OR: [
          ...(contactIds.length > 0 ? [{ contactId: { in: contactIds } }] : []),
          ...(collaboratorBookingIds.length > 0 ? [{ id: { in: collaboratorBookingIds } }] : []),
        ],
      },
      select: HOST_BOOKING_SELECT,
      orderBy: { date: "asc" },
    });
    const ownContacts = new Set(contactIds);
    for (const r of rows) {
      if (ownContacts.has(r.contactId)) continue; // their own booking: full host access
      collaboratorRoles[r.id] = roleByBooking.get(r.id) ?? "VIEWER";
    }
  } else if (isStaffUser(user)) {
    preview = true;
    rows = await prisma.booking.findMany({
      where: { status: { in: ["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS"] } },
      select: HOST_BOOKING_SELECT,
      orderBy: { date: "asc" },
      take: 25,
    });
  }

  // Upcoming vs past by India calendar day (same rule as istDateKey/dbDateKey in
  // app/(guest)/app/event/_components/event-view.ts). Booking.date is @db.Date,
  // stored as UTC midnight of the event's day, and the server runs on UTC, so
  // "today" must be India's date: otherwise between 00:00 and 05:30 IST today's
  // event would read as past.
  const IST_OFFSET_MS = 330 * 60_000;
  const todayKey = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const bookings = [
    ...rows.filter((r) => dayKey(r.date) >= todayKey),
    ...rows.filter((r) => dayKey(r.date) < todayKey).reverse(),
  ];
  let booking: HostBooking | null = bookingId ? bookings.find((b) => b.id === bookingId) ?? null : bookings[0] ?? null;
  if (!booking && bookingId && preview) {
    booking = await prisma.booking.findFirst({ where: { id: bookingId }, select: HOST_BOOKING_SELECT });
  }
  if (preview && booking) contactIds = [booking.contactId];
  return { user, contactIds, bookings, booking, preview, collaboratorRoles };
}

/** True when the signed-in user may READ this booking (customers and collaborators: in scope; staff: preview). */
export async function canSeeBooking(bookingId: string): Promise<boolean> {
  const scope = await getHostScope(bookingId);
  return !!scope?.booking && scope.booking.id === bookingId;
}
