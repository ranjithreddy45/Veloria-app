import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getVerifiedContactIds } from "@/lib/portal-identity";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Signed-in guest app: who is the customer, and which bookings may they see?
//
// Shared by every signed-in guest-app action that lives OUTSIDE
// guest-host.actions.ts. Same rules as scope() in that file:
//   - customers see bookings of their verified contacts (portal-identity)
//   - team members with bookings:read and no customer contact get a
//     read-only PREVIEW of live bookings
// Every write MUST refuse when `preview` is true, and every booking id that
// comes from the browser MUST be checked with `canSeeBooking` or by passing it
// to getHostScope(bookingId) and using the returned `booking`.
// Keep these exported signatures stable: several features depend on them.
// ============================================================

export interface HostUser {
  id: string;
  name: string | null;
  role: string | null;
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

export interface HostScope {
  user: HostUser;
  contactIds: string[];
  bookings: HostBooking[];
  /** The requested booking when it is in scope, otherwise the next upcoming one (or null). */
  booking: HostBooking | null;
  /** True for a team member previewing the host view: read-only. */
  preview: boolean;
}

const EXTERNAL_ROLES = new Set(["CLIENT", "VENDOR"]);

export function isStaffRole(role: string | null): boolean {
  return !!role && !EXTERNAL_ROLES.has(role) && hasPermission(role as never, "bookings:read");
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
  return { id: s.user.id, name: s.user.name ?? null, role: (s.user as { role?: string }).role ?? null };
}

/** null when nobody is signed in. */
export async function getHostScope(bookingId?: string): Promise<HostScope | null> {
  const user = await getHostUser();
  if (!user) return null;

  let contactIds = await getVerifiedContactIds(user.id);
  let preview = false;
  let rows: HostBooking[] = [];
  if (contactIds.length > 0) {
    rows = await prisma.booking.findMany({
      where: { contactId: { in: contactIds }, status: { not: "CANCELLED" } },
      select: HOST_BOOKING_SELECT,
      orderBy: { date: "asc" },
    });
  } else if (isStaffRole(user.role)) {
    preview = true;
    rows = await prisma.booking.findMany({
      where: { status: { in: ["HOLD", "TENTATIVE", "CONFIRMED", "IN_PROGRESS"] } },
      select: HOST_BOOKING_SELECT,
      orderBy: { date: "asc" },
      take: 25,
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookings = [...rows.filter((r) => r.date >= today), ...rows.filter((r) => r.date < today).reverse()];
  let booking: HostBooking | null = bookingId ? bookings.find((b) => b.id === bookingId) ?? null : bookings[0] ?? null;
  if (!booking && bookingId && preview) {
    booking = await prisma.booking.findFirst({ where: { id: bookingId }, select: HOST_BOOKING_SELECT });
  }
  if (preview && booking) contactIds = [booking.contactId];
  return { user, contactIds, bookings, booking, preview };
}

/** True when the signed-in user may READ this booking (customers: in scope; staff: preview). */
export async function canSeeBooking(bookingId: string): Promise<boolean> {
  const scope = await getHostScope(bookingId);
  return !!scope?.booking && scope.booking.id === bookingId;
}
