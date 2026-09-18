"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { getHostScope, type HostBooking } from "@/lib/guest/host-scope";
import {
  CUSTOMER_VISIBLE_QUOTE_STATUSES,
  MENU_REQUEST_LIMITS,
  NO_PACKAGE_RULES,
  cleanMenuNotes,
  eventDateHasPassed,
  menuRequestTransition,
  menuTastingHref,
  packageRulesFromQuotation,
  parseStoredItems,
  validateMenuSelection,
  type GuestBookingMenu,
  type GuestMenuView,
  type MenuCatalogEntry,
  type MenuPackageRules,
  type MenuRequestItem,
} from "@/app/(guest)/app/event/menu/_lib/menu-rules";

// ============================================================
// Guest app — a host's menu choices for their own booking.
//
// Reads the team's records directly: MenuItem (the /menu catalog), BookingMenu
// (the menu on the booking) and the booking's quotation (its food package).
// A host never writes the menu itself: their picks become a MenuSelectionRequest
// (SUBMITTED) that the team reviews (menu-request-review.actions.ts), and only
// the team's accept turns it into BookingMenu rows.
//
// Scope comes from getHostScope:
//   - the booking's own customer may send and withdraw requests;
//   - invited collaborators (any role in collaboratorRoles) only see the menu
//     on the booking — never the host's requests, notes or quoted price;
//   - staff get a read-only preview and every write refuses.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

const PREVIEW_REFUSAL = "Staff preview — this would change a real customer's booking. Sign in as that host (or the demo guest) to try it.";
const HOST_ONLY_VIEW = "Only the booking's host can choose or change the menu. You'll see it here as the team has it.";
const HOST_ONLY_WRITE = "Only the booking's host can send or withdraw menu requests.";
const DAY_MS = 86_400_000;

class MenuRequestRefused extends Error {}

async function quotedPackageRules(bookingId: string): Promise<MenuPackageRules> {
  const q = await prisma.salesQuotation.findFirst({
    where: { bookingId, status: { in: [...CUSTOMER_VISIBLE_QUOTE_STATUSES] } },
    orderBy: { updatedAt: "desc" },
    select: { inputsJson: true },
  });
  return q ? packageRulesFromQuotation(q.inputsJson) : NO_PACKAGE_RULES;
}

function closedReason(b: HostBooking): string | null {
  if (b.status === "CANCELLED") return "This booking is cancelled, so its menu can't change.";
  if (b.status === "COMPLETED" || eventDateHasPassed(b.date)) return "This event has already taken place.";
  return null;
}

/** The booking owner plus any coordinator assigned on the event operation. */
async function teamRecipients(b: HostBooking, exceptUserId: string): Promise<string[]> {
  const op = await prisma.eventOperation
    .findUnique({ where: { bookingId: b.id }, select: { staffAssignments: { select: { userId: true, role: true } } } })
    .catch(() => null);
  const ids = new Set<string>([b.createdById]);
  for (const s of op?.staffAssignments ?? []) if (/coordinator/i.test(s.role)) ids.add(s.userId);
  ids.delete(exceptUserId);
  return [...ids];
}

function toEntry(d: { id: string; name: string; category: string; cuisine: string | null; dietaryTags: string[]; pricePerHead: Prisma.Decimal; isActive: boolean }): MenuCatalogEntry {
  return { id: d.id, name: d.name, category: d.category, cuisine: d.cuisine, dietaryTags: d.dietaryTags, pricePerHead: Number(d.pricePerHead), isActive: d.isActive };
}

function bookingSummary(b: HostBooking, venueName: string | null): GuestMenuView["booking"] {
  return { id: b.id, eventName: b.eventName, date: b.date.toISOString(), guestCount: b.guestCount, venueId: b.venueId, venueName, status: b.status };
}

/** The team's BookingMenu for the host: dishes and covers only (no special instructions or prices). */
async function readBookingMenu(bookingId: string): Promise<GuestBookingMenu | null> {
  const menu = await prisma.bookingMenu.findUnique({
    where: { bookingId },
    select: {
      guestCount: true,
      updatedAt: true,
      selections: { orderBy: { order: "asc" }, select: { menuItemId: true, quantity: true, menuItem: { select: { name: true, category: true, dietaryTags: true } } } },
    },
  });
  if (!menu) return null;
  return {
    guestCount: menu.guestCount,
    updatedAt: menu.updatedAt.toISOString(),
    selections: menu.selections.map((s) => ({
      menuItemId: s.menuItemId,
      name: s.menuItem.name,
      category: s.menuItem.category,
      quantity: s.quantity,
      dietaryTags: s.menuItem.dietaryTags,
    })),
  };
}

// ------------------------------------------------------------ read

export async function getGuestMenu(bookingId?: string): Promise<GuestMenuView | null> {
  const scope = await getHostScope(bookingId);
  if (!scope?.booking) return null;
  const b = scope.booking;
  const collaborator = scope.collaboratorRoles?.[b.id] ?? null;

  if (collaborator) {
    const [venue, menu] = await Promise.all([prisma.venue.findUnique({ where: { id: b.venueId }, select: { name: true } }), readBookingMenu(b.id)]);
    return {
      booking: bookingSummary(b, venue?.name ?? null),
      preview: scope.preview,
      collaborator,
      rules: NO_PACKAGE_RULES,
      catalog: [],
      bookingMenu: menu,
      requests: [],
      blockedReason: HOST_ONLY_VIEW,
      tastingHref: menuTastingHref(b.venueId),
    };
  }

  const [venue, dishes, menu, requests, rules, sentToday] = await Promise.all([
    prisma.venue.findUnique({ where: { id: b.venueId }, select: { name: true } }),
    prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 500,
      select: { id: true, name: true, description: true, category: true, cuisine: true, dietaryTags: true, pricePerHead: true },
    }),
    readBookingMenu(b.id),
    prisma.menuSelectionRequest.findMany({
      where: { bookingId: b.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, status: true, items: true, notes: true, createdAt: true, reviewedAt: true, reviewNote: true },
    }),
    quotedPackageRules(b.id),
    prisma.menuSelectionRequest.count({ where: { bookingId: b.id, createdAt: { gte: new Date(Date.now() - DAY_MS) } } }),
  ]);

  // Names for dishes a request mentions that are no longer in the active list.
  const names = new Map(dishes.map((d) => [d.id, { name: d.name, category: d.category }]));
  const parsed = requests.map((r) => ({ ...r, stored: parseStoredItems(r.items) }));
  const missing = [...new Set(parsed.flatMap((r) => r.stored.map((i) => i.menuItemId)).filter((id) => !names.has(id)))];
  if (missing.length > 0) {
    const rows = await prisma.menuItem.findMany({ where: { id: { in: missing } }, select: { id: true, name: true, category: true } });
    for (const r of rows) names.set(r.id, { name: r.name, category: r.category });
  }

  let blockedReason = closedReason(b);
  if (!blockedReason && parsed.some((r) => r.status === "SUBMITTED")) {
    blockedReason = "Your menu request is with the team. Withdraw it if you want to change your picks.";
  }
  if (!blockedReason && sentToday >= MENU_REQUEST_LIMITS.maxPerDay) {
    blockedReason = "You've sent several menu requests today. Please try again tomorrow, or message your coordinator.";
  }
  if (!blockedReason && dishes.length === 0) blockedReason = "The team hasn't published any dishes yet.";

  return {
    booking: bookingSummary(b, venue?.name ?? null),
    preview: scope.preview,
    collaborator: null,
    rules,
    catalog: dishes.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      category: d.category,
      cuisine: d.cuisine,
      dietaryTags: d.dietaryTags,
      pricePerHead: Number(d.pricePerHead),
    })),
    bookingMenu: menu,
    requests: parsed.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewNote: r.status === "DECLINED" || r.status === "ACCEPTED" ? r.reviewNote : null,
      notes: r.notes,
      items: r.stored.map((i) => ({
        menuItemId: i.menuItemId,
        name: names.get(i.menuItemId)?.name ?? "A dish no longer on the menu",
        category: names.get(i.menuItemId)?.category ?? "Other",
        quantity: i.quantity,
        note: i.note ?? null,
      })),
    })),
    blockedReason,
    tastingHref: menuTastingHref(b.venueId),
  };
}

// ------------------------------------------------------------ submit

export async function submitMenuSelection(
  bookingId: string,
  input: { items: MenuRequestItem[]; notes?: string | null }
): Promise<Result<{ id: string }>> {
  if (typeof bookingId !== "string" || !bookingId) return { success: false, error: "Not authorized." };
  const scope = await getHostScope(bookingId);
  if (!scope) return { success: false, error: "Please sign in." };
  const b = scope.booking;
  if (!b || b.id !== bookingId) return { success: false, error: "Not authorized." };
  if (scope.preview) return { success: false, error: PREVIEW_REFUSAL };
  if (scope.collaboratorRoles?.[b.id]) return { success: false, error: HOST_ONLY_WRITE };
  const closed = closedReason(b);
  if (closed) return { success: false, error: closed };

  const notes = cleanMenuNotes(input?.notes);
  if (!notes.ok) return { success: false, error: notes.error };
  const rawItems: unknown[] = Array.isArray(input?.items) ? input.items : [];
  const ids = [
    ...new Set(
      rawItems
        .map((i) => (i && typeof i === "object" && typeof (i as { menuItemId?: unknown }).menuItemId === "string" ? (i as { menuItemId: string }).menuItemId.trim() : ""))
        .filter(Boolean)
    ),
  ].slice(0, MENU_REQUEST_LIMITS.maxItems + 1);

  const [dishes, rules] = await Promise.all([
    ids.length > 0
      ? prisma.menuItem.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, category: true, cuisine: true, dietaryTags: true, pricePerHead: true, isActive: true },
        })
      : Promise.resolve([]),
    quotedPackageRules(b.id),
  ]);
  const checked = validateMenuSelection(rawItems, new Map(dishes.map((d) => [d.id, toEntry(d)])), rules);
  if (!checked.ok) return { success: false, error: checked.errors.slice(0, 3).join(" ") };

  let created: { id: string };
  try {
    created = await prisma.$transaction(
      async (tx) => {
        const open = await tx.menuSelectionRequest.findFirst({ where: { bookingId: b.id, status: "SUBMITTED" }, select: { id: true } });
        if (open) throw new MenuRequestRefused("Your menu request is already with the team. Withdraw it first if you want to change your picks.");
        const recent = await tx.menuSelectionRequest.count({ where: { bookingId: b.id, createdAt: { gte: new Date(Date.now() - DAY_MS) } } });
        if (recent >= MENU_REQUEST_LIMITS.maxPerDay) {
          throw new MenuRequestRefused("You've sent several menu requests today. Please try again tomorrow, or message your coordinator.");
        }
        return tx.menuSelectionRequest.create({
          data: {
            bookingId: b.id,
            contactId: b.contactId,
            userId: scope.user.id,
            packageId: rules.packageId,
            items: checked.items as unknown as Prisma.InputJsonValue,
            notes: notes.value,
            status: "SUBMITTED",
          },
          select: { id: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof MenuRequestRefused) return { success: false, error: err.message };
    if ((err as { code?: string }).code === "P2034") return { success: false, error: "This booking's menu was just updated. Please try again." };
    console.error("[GUEST_MENU_SUBMIT]", err);
    return { success: false, error: "Couldn't send your menu. Please try again." };
  }

  const who = scope.user.name?.trim() || "The host";
  const n = checked.items.length;
  for (const userId of await teamRecipients(b, scope.user.id)) {
    notify({
      userId,
      type: "BOOKING_UPDATED",
      title: `Menu request · ${b.eventName}`.slice(0, 200),
      message: `${who} picked ${n} dish${n === 1 ? "" : "es"} for ${b.bookingNumber} and sent them for review.`,
      actionUrl: `/bookings/${b.id}/menu`,
    });
  }
  revalidatePath("/app/event/menu");
  return { success: true, data: { id: created.id } };
}

// ------------------------------------------------------------ withdraw

export async function withdrawMenuSelection(requestId: string): Promise<Result<{ status: string }>> {
  if (typeof requestId !== "string" || !requestId) return { success: false, error: "Not found." };
  const req = await prisma.menuSelectionRequest.findUnique({ where: { id: requestId }, select: { id: true, bookingId: true, status: true } });
  if (!req) return { success: false, error: "Not found." };
  const scope = await getHostScope(req.bookingId);
  if (!scope) return { success: false, error: "Please sign in." };
  const b = scope.booking;
  if (!b || b.id !== req.bookingId) return { success: false, error: "Not found." };
  if (scope.preview) return { success: false, error: PREVIEW_REFUSAL };
  if (scope.collaboratorRoles?.[b.id]) return { success: false, error: HOST_ONLY_WRITE };

  const step = menuRequestTransition(req.status, "WITHDRAW", "CUSTOMER");
  if (!step.ok) return { success: false, error: step.error };
  const claimed = await prisma.menuSelectionRequest.updateMany({ where: { id: req.id, status: "SUBMITTED" }, data: { status: step.to } });
  if (claimed.count === 0) {
    // The team reviewed it a moment ago: report what actually happened.
    const now = await prisma.menuSelectionRequest.findUnique({ where: { id: req.id }, select: { status: true } });
    const again = menuRequestTransition(now?.status ?? "", "WITHDRAW", "CUSTOMER");
    return { success: false, error: again.ok ? "Please try again." : again.error };
  }

  const who = scope.user.name?.trim() || "The host";
  for (const userId of await teamRecipients(b, scope.user.id)) {
    notify({
      userId,
      type: "BOOKING_UPDATED",
      title: `Menu request withdrawn · ${b.eventName}`.slice(0, 200),
      message: `${who} withdrew their menu request for ${b.bookingNumber}. No review needed.`,
      actionUrl: `/bookings/${b.id}/menu`,
    });
  }
  revalidatePath("/app/event/menu");
  return { success: true, data: { status: step.to } };
}
