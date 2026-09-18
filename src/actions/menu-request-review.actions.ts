"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { notifyCustomer } from "@/lib/customer-notify";
import { CUSTOMER_REQUEST_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import {
  CUSTOMER_VISIBLE_QUOTE_STATUSES,
  MENU_REQUEST_LIMITS,
  NO_PACKAGE_RULES,
  mergeSpecialInstructions,
  menuRequestTransition,
  packageRulesFromQuotation,
  parseStoredItems,
  reviewMenuRequest,
  selectionsToWrite,
  type MenuCatalogEntry,
  type MenuPackageRules,
  type MenuReviewData,
  type MenuReviewRequestView,
} from "@/app/(guest)/app/event/menu/_lib/menu-rules";

// ============================================================
// Team review of customer menu requests (MenuSelectionRequest).
//
// Accepting writes the booking's menu the same way the team's menu builder
// does (saveBookingMenu): the BookingMenu row plus a full replacement of its
// BookingMenuSelection rows, per head = Σ (customPrice ?? pricePerHead) × qty,
// total = per head × the booking's guest count. Negotiated per-dish prices
// already on the menu are carried over. Guarded by the permission pair the menu
// builder needs (menu:update + bookings:update); every decision is written to
// ActivityLog and told to the booking's own customer through notifyCustomer,
// HOST_ONLY: menu requests are the host's (collaborator-permissions
// menu:request), and so are the team's notes on them.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

type Staff = { id: string; role: string; perms: string[] | null };

class ReviewRefused extends Error {}

const EXTERNAL_ROLES = new Set(["CLIENT", "VENDOR"]);

async function staff(): Promise<Staff | null> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string; perms?: string[] } | undefined;
  if (!u?.id || !u.role || EXTERNAL_ROLES.has(u.role)) return null;
  return { id: u.id, role: u.role, perms: Array.isArray(u.perms) ? u.perms : null };
}

/** Evaluated like the middleware route guard: override-aware session perms when present, else role defaults. */
function can(u: Staff, permission: string): boolean {
  if (u.role === "SUPER_ADMIN" || u.role === "ADMIN") return true;
  return u.perms ? u.perms.includes(permission) : hasPermission(u.role, permission);
}

/** Read: whoever may open a booking's menu (getBookingMenu's rule). */
const canReadMenus = (u: Staff) => can(u, "menu:read") || can(u, "bookings:read");
/** Write: the pair saveBookingMenu requires to edit a booking's menu. */
const canEditMenus = (u: Staff) => can(u, "menu:update") && can(u, "bookings:update");

async function quotedPackageRules(bookingId: string): Promise<MenuPackageRules> {
  const q = await prisma.salesQuotation.findFirst({
    where: { bookingId, status: { in: [...CUSTOMER_VISIBLE_QUOTE_STATUSES] } },
    orderBy: { updatedAt: "desc" },
    select: { inputsJson: true },
  });
  return q ? packageRulesFromQuotation(q.inputsJson) : NO_PACKAGE_RULES;
}

async function catalogFor(ids: string[]): Promise<Map<string, MenuCatalogEntry>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, category: true, cuisine: true, dietaryTags: true, pricePerHead: true, isActive: true },
  });
  return new Map(rows.map((d) => [d.id, { ...d, pricePerHead: Number(d.pricePerHead) }]));
}

function customPrices(selections: { menuItemId: string; customPrice: Prisma.Decimal | null }[]): Map<string, number> {
  return new Map(selections.filter((s) => s.customPrice != null).map((s) => [s.menuItemId, Number(s.customPrice)]));
}

function cleanReviewNote(raw: unknown, required: boolean): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (required && value.length < 3) return { ok: false, error: "Add a short note telling the customer why." };
  if (value.length > MENU_REQUEST_LIMITS.maxReviewNote) return { ok: false, error: `Keep the note under ${MENU_REQUEST_LIMITS.maxReviewNote} characters.` };
  return { ok: true, value: value || null };
}

function revalidateMenus(bookingId: string) {
  revalidatePath(`/bookings/${bookingId}/menu`);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/app/event/menu");
}

// ------------------------------------------------------------ read

export async function getMenuRequestsForBooking(bookingId: string): Promise<Result<MenuReviewData>> {
  const u = await staff();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canReadMenus(u)) return { success: false, error: "Insufficient permissions" };
  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, bookingNumber: true, guestCount: true } });
    if (!booking) return { success: false, error: "Booking not found" };
    const [rows, menu, rules] = await Promise.all([
      prisma.menuSelectionRequest.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.bookingMenu.findUnique({
        where: { bookingId },
        select: { pricePerHead: true, totalPrice: true, guestCount: true, updatedAt: true, selections: { select: { menuItemId: true, customPrice: true } } },
      }),
      quotedPackageRules(bookingId),
    ]);
    const parsed = rows.map((row) => ({ row, stored: parseStoredItems(row.items) }));
    const userIds = [...new Set(rows.flatMap((r) => [r.userId, r.reviewedById]).filter((x): x is string => !!x))];
    const [catalog, users] = await Promise.all([
      catalogFor([...new Set(parsed.flatMap((p) => p.stored.map((i) => i.menuItemId)))]),
      userIds.length > 0 ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    ]);
    const names = new Map(users.map((x) => [x.id, x.name]));
    const custom = customPrices(menu?.selections ?? []);
    const requests: MenuReviewRequestView[] = parsed
      .map(({ row, stored }) => ({
        id: row.id,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        submittedBy: row.userId ? names.get(row.userId) ?? null : null,
        notes: row.notes,
        reviewedBy: row.reviewedById ? names.get(row.reviewedById) ?? null : null,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        reviewNote: row.reviewNote,
        ...reviewMenuRequest(stored, catalog, custom, rules, booking.guestCount),
      }))
      .sort((a, b) => Number(b.status === "SUBMITTED") - Number(a.status === "SUBMITTED"));
    return {
      success: true,
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        guestCount: booking.guestCount,
        canReview: canEditMenus(u),
        rules,
        currentMenu: menu
          ? {
              selectionCount: menu.selections.length,
              pricePerHead: Number(menu.pricePerHead),
              totalPrice: Number(menu.totalPrice),
              guestCount: menu.guestCount,
              updatedAt: menu.updatedAt.toISOString(),
            }
          : null,
        requests,
      },
    };
  } catch (err) {
    console.error("[GET_MENU_REQUESTS_ERROR]", err);
    return { success: false, error: "Failed to load menu requests" };
  }
}

// ------------------------------------------------------------ accept

export async function acceptMenuRequest(
  requestId: string,
  reviewNote?: string | null
): Promise<Result<{ bookingMenuId: string; selectionCount: number; warnings: string[] }>> {
  const u = await staff();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canEditMenus(u)) return { success: false, error: "Insufficient permissions" };
  const note = cleanReviewNote(reviewNote, false);
  if (!note.ok) return { success: false, error: note.error };

  const req = await prisma.menuSelectionRequest.findUnique({
    where: { id: requestId },
    select: { id: true, bookingId: true, contactId: true, status: true, items: true, notes: true },
  });
  if (!req) return { success: false, error: "Menu request not found" };
  const step = menuRequestTransition(req.status, "ACCEPT", "TEAM");
  if (!step.ok) return { success: false, error: step.error };
  const booking = await prisma.booking.findUnique({ where: { id: req.bookingId }, select: { id: true, eventName: true, guestCount: true, status: true } });
  if (!booking) return { success: false, error: "Booking not found" };
  if (booking.status === "CANCELLED") return { success: false, error: "This booking is cancelled." };
  if (booking.guestCount < 1) return { success: false, error: "Set the booking's guest count before accepting a menu." };

  const stored = parseStoredItems(req.items);
  const [catalog, rules] = await Promise.all([catalogFor([...new Set(stored.map((i) => i.menuItemId))]), quotedPackageRules(booking.id)]);

  try {
    const out = await prisma.$transaction(async (tx) => {
      const existing = await tx.bookingMenu.findUnique({
        where: { bookingId: booking.id },
        select: { id: true, specialInstructions: true, selections: { select: { menuItemId: true, customPrice: true } } },
      });
      const custom = customPrices(existing?.selections ?? []);
      const review = reviewMenuRequest(stored, catalog, custom, rules, booking.guestCount);
      if (review.blockers.length > 0) {
        throw new ReviewRefused(`Can't accept as it stands: ${review.blockers.join(" ")} Decline with a note so the customer can pick again, or edit the menu in the menu builder.`);
      }
      const claimed = await tx.menuSelectionRequest.updateMany({
        where: { id: req.id, status: "SUBMITTED" },
        data: { status: step.to, reviewedById: u.id, reviewedAt: new Date(), reviewNote: note.value },
      });
      if (claimed.count === 0) throw new ReviewRefused("This request was just withdrawn or reviewed by someone else. Refresh to see its status.");

      const itemNotes = stored.flatMap((s) => (s.note ? [{ name: catalog.get(s.menuItemId)?.name ?? "Dish", note: s.note }] : []));
      const data = {
        guestCount: review.pricing.guestCount,
        pricePerHead: review.pricing.pricePerHead,
        totalPrice: review.pricing.totalPrice,
        specialInstructions: mergeSpecialInstructions(existing?.specialInstructions, req.notes, itemNotes),
      };
      const selections = selectionsToWrite(stored, custom);
      if (existing) {
        await tx.bookingMenuSelection.deleteMany({ where: { menuId: existing.id } });
        const m = await tx.bookingMenu.update({ where: { id: existing.id }, data: { ...data, selections: { create: selections } }, select: { id: true } });
        return { menuId: m.id, created: false, review };
      }
      const m = await tx.bookingMenu.create({ data: { bookingId: booking.id, ...data, selections: { create: selections } }, select: { id: true } });
      return { menuId: m.id, created: true, review };
    });

    await Promise.all([
      logActivity({
        userId: u.id,
        action: out.created ? "created" : "updated",
        entityType: "BookingMenu",
        entityId: out.menuId,
        changes: {
          bookingId: booking.id,
          guestCount: out.review.pricing.guestCount,
          totalPrice: out.review.pricing.totalPrice,
          selectionCount: stored.length,
          source: "customer_menu_request",
          menuSelectionRequestId: req.id,
        },
      }),
      logActivity({
        userId: u.id,
        action: "status_changed",
        entityType: "MenuSelectionRequest",
        entityId: req.id,
        changes: { bookingId: booking.id, from: step.from, to: step.to, bookingMenuId: out.menuId, reviewNote: note.value, warnings: out.review.warnings },
      }),
    ]);
    const n = stored.length;
    await notifyCustomer({
      contactId: req.contactId,
      bookingId: booking.id,
      title: `Your menu request: ${customerLabel(CUSTOMER_REQUEST_STATUS_LABEL, step.to)}`,
      message: `${n} ${n === 1 ? "dish is" : "dishes are"} now on the menu for ${booking.eventName}, for ${booking.guestCount} guests.${note.value ? ` Note from the team: ${note.value}` : ""}`,
      actionUrl: `/app/event/menu?b=${booking.id}`,
      audience: "HOST_ONLY",
    });
    revalidateMenus(booking.id);
    return { success: true, data: { bookingMenuId: out.menuId, selectionCount: n, warnings: out.review.warnings } };
  } catch (err) {
    if (err instanceof ReviewRefused) return { success: false, error: err.message };
    const code = (err as { code?: string }).code;
    if (code === "P2002" || code === "P2034") return { success: false, error: "The booking's menu changed while accepting. Refresh and try again." };
    console.error("[ACCEPT_MENU_REQUEST_ERROR]", err);
    return { success: false, error: "Failed to accept menu request" };
  }
}

// ------------------------------------------------------------ decline

export async function declineMenuRequest(requestId: string, reviewNote: string): Promise<Result<{ status: string }>> {
  const u = await staff();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canEditMenus(u)) return { success: false, error: "Insufficient permissions" };
  const note = cleanReviewNote(reviewNote, true);
  if (!note.ok) return { success: false, error: note.error };

  try {
    const req = await prisma.menuSelectionRequest.findUnique({ where: { id: requestId }, select: { id: true, bookingId: true, contactId: true, status: true } });
    if (!req) return { success: false, error: "Menu request not found" };
    const step = menuRequestTransition(req.status, "DECLINE", "TEAM");
    if (!step.ok) return { success: false, error: step.error };
    const booking = await prisma.booking.findUnique({ where: { id: req.bookingId }, select: { id: true, eventName: true } });
    if (!booking) return { success: false, error: "Booking not found" };

    const claimed = await prisma.menuSelectionRequest.updateMany({
      where: { id: req.id, status: "SUBMITTED" },
      data: { status: step.to, reviewedById: u.id, reviewedAt: new Date(), reviewNote: note.value },
    });
    if (claimed.count === 0) {
      const now = await prisma.menuSelectionRequest.findUnique({ where: { id: req.id }, select: { status: true } });
      const again = menuRequestTransition(now?.status ?? "", "DECLINE", "TEAM");
      return { success: false, error: again.ok ? "Please try again." : again.error };
    }

    await logActivity({
      userId: u.id,
      action: "status_changed",
      entityType: "MenuSelectionRequest",
      entityId: req.id,
      changes: { bookingId: booking.id, from: step.from, to: step.to, reviewNote: note.value },
    });
    await notifyCustomer({
      contactId: req.contactId,
      bookingId: booking.id,
      title: `Your menu request: ${customerLabel(CUSTOMER_REQUEST_STATUS_LABEL, step.to)}`,
      message: `The team couldn't use these menu picks for ${booking.eventName}: ${note.value} You can choose again in the app.`,
      actionUrl: `/app/event/menu?b=${booking.id}`,
      audience: "HOST_ONLY",
    });
    revalidateMenus(booking.id);
    return { success: true, data: { status: step.to } };
  } catch (err) {
    console.error("[DECLINE_MENU_REQUEST_ERROR]", err);
    return { success: false, error: "Failed to decline menu request" };
  }
}
