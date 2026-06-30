"use server";

// ============================================================
// OMS CR-004 — Service Confirmation (Stage 2)
// ------------------------------------------------------------
// Booking-level service selections (F&B / Décor / Photo-Video / Add-ons)
// plus a 24h confirmation SLA derived from the booking creation time, a
// "lock services" gate, and a "send service summary" stamp+notify.
//
// Additive: lives alongside the existing BEO / menu / kitchen flows. F&B is
// owned by the existing menu builder — here we only surface a link to it.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export const SERVICE_CATEGORIES = ["FNB", "DECOR", "PHOTO_VIDEO", "ADDON"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

const HOURS_24_MS = 24 * 60 * 60 * 1000;
const HOURS_48_MS = 48 * 60 * 60 * 1000;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
// Reuse existing operations permissions — anyone who can edit a booking or
// write a BEO can confirm services.
const canWrite = (r?: string) => !!r && (hasPermission(r, "beo:write") || hasPermission(r, "bookings:update"));

// ------------------------------------------------------------
// Serialization — Date→ISO, JSON passthrough at the client boundary
// ------------------------------------------------------------
export interface ServiceSelectionDTO {
  id: string;
  bookingId: string;
  category: string;
  name: string;
  enabled: boolean;
  details: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

type SelectionRow = {
  id: string;
  bookingId: string;
  category: string;
  name: string;
  enabled: boolean;
  details: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

function serializeSelection(s: SelectionRow): ServiceSelectionDTO {
  return {
    id: s.id,
    bookingId: s.bookingId,
    category: s.category,
    name: s.name,
    enabled: s.enabled,
    details:
      s.details && typeof s.details === "object" && !Array.isArray(s.details)
        ? (s.details as Record<string, unknown>)
        : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export type SlaStatus = "OnTrack" | "DueSoon" | "Overdue" | "Locked";

export interface BookingServicesData {
  bookingId: string;
  servicesLockedAt: string | null;
  servicesSummarySentAt: string | null;
  // 24h SLA (deadline = booking.createdAt + 24h)
  sla: {
    status: SlaStatus;
    deadline: string;
    hoursRemaining: number; // negative once overdue
  };
  // Editing is allowed until the booking is locked. The UI also surfaces the
  // 48h-before-event soft window for context.
  editable: boolean;
  eventDate: string | null;
  // selections grouped by category
  groups: Record<ServiceCategory, ServiceSelectionDTO[]>;
}

function emptyGroups(): Record<ServiceCategory, ServiceSelectionDTO[]> {
  return { FNB: [], DECOR: [], PHOTO_VIDEO: [], ADDON: [] };
}

function deriveSla(createdAt: Date, lockedAt: Date | null): BookingServicesData["sla"] {
  const deadline = new Date(createdAt.getTime() + HOURS_24_MS);
  const hoursRemaining = (deadline.getTime() - Date.now()) / (60 * 60 * 1000);
  let status: SlaStatus;
  if (lockedAt) {
    status = "Locked";
  } else if (hoursRemaining < 0) {
    status = "Overdue";
  } else if (hoursRemaining <= 6) {
    status = "DueSoon";
  } else {
    status = "OnTrack";
  }
  return {
    status,
    deadline: deadline.toISOString(),
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
  };
}

// ------------------------------------------------------------
// Read
// ------------------------------------------------------------
export async function getBookingServices(bookingId: string): Promise<Result<BookingServicesData>> {
  const u = await requireUser();
  if (!u) return { success: false, error: "Unauthorized" };
  if (!canWrite(u.role)) return { success: false, error: "Not authorized" };

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, createdAt: true, date: true, servicesLockedAt: true, servicesSummarySentAt: true },
  });
  if (!booking) return { success: false, error: "Booking not found" };

  const rows = await prisma.bookingServiceSelection.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
  });

  const groups = emptyGroups();
  for (const r of rows) {
    const cat = (SERVICE_CATEGORIES as readonly string[]).includes(r.category)
      ? (r.category as ServiceCategory)
      : null;
    if (cat) groups[cat].push(serializeSelection(r));
  }

  return {
    success: true,
    data: {
      bookingId: booking.id,
      servicesLockedAt: booking.servicesLockedAt?.toISOString() ?? null,
      servicesSummarySentAt: booking.servicesSummarySentAt?.toISOString() ?? null,
      sla: deriveSla(booking.createdAt, booking.servicesLockedAt),
      editable: !booking.servicesLockedAt,
      eventDate: booking.date ? booking.date.toISOString() : null,
      groups,
    },
  };
}

// ------------------------------------------------------------
// Upsert / remove a single selection
// ------------------------------------------------------------
export interface ServiceSelectionInput {
  category: ServiceCategory;
  name: string;
  enabled?: boolean;
  details?: Record<string, unknown> | null;
}

export async function upsertBookingService(
  bookingId: string,
  input: ServiceSelectionInput
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const category = input.category;
  if (!(SERVICE_CATEGORIES as readonly string[]).includes(category)) {
    return { success: false, error: "Invalid service category" };
  }
  const name = input.name?.trim();
  if (!name) return { success: false, error: "A service name is required" };

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, servicesLockedAt: true },
  });
  if (!booking) return { success: false, error: "Booking not found" };
  // Editing is blocked once services are locked.
  if (booking.servicesLockedAt) {
    return { success: false, error: "Services are locked and can no longer be edited." };
  }

  const enabled = input.enabled ?? true;
  const detailsValue: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    input.details == null ? Prisma.JsonNull : (input.details as Prisma.InputJsonValue);

  // (bookingId, category, name) is the logical key — upsert by finding the
  // existing matching row (no DB unique constraint, matching the app's
  // prod-safe convention of enforcing uniqueness in code).
  const existing = await prisma.bookingServiceSelection.findFirst({
    where: { bookingId, category, name },
    select: { id: true },
  });

  let id: string;
  if (existing) {
    await prisma.bookingServiceSelection.update({
      where: { id: existing.id },
      data: { enabled, details: detailsValue },
    });
    id = existing.id;
  } else {
    const created = await prisma.bookingServiceSelection.create({
      data: { bookingId, category, name, enabled, details: detailsValue },
      select: { id: true },
    });
    id = created.id;
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { success: true, data: { id } };
}

export async function removeBookingService(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const row = await prisma.bookingServiceSelection.findUnique({
    where: { id },
    select: { id: true, bookingId: true },
  });
  if (!row) return { success: false, error: "Service not found" };

  const booking = await prisma.booking.findUnique({
    where: { id: row.bookingId },
    select: { servicesLockedAt: true },
  });
  if (booking?.servicesLockedAt) {
    return { success: false, error: "Services are locked and can no longer be edited." };
  }

  await prisma.bookingServiceSelection.delete({ where: { id } });
  revalidatePath(`/bookings/${row.bookingId}`);
  return { success: true, data: { id } };
}

// ------------------------------------------------------------
// Lock services — one-way gate
// ------------------------------------------------------------
export async function lockServices(bookingId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, servicesLockedAt: true },
  });
  if (!booking) return { success: false, error: "Booking not found" };
  if (booking.servicesLockedAt) {
    return { success: false, error: "Services are already locked." };
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { servicesLockedAt: new Date() },
  });

  await logActivity({
    userId: u.id,
    action: "services_locked",
    entityType: "Booking",
    entityId: bookingId,
  });

  revalidatePath(`/bookings/${bookingId}`);
  return { success: true, data: { id: bookingId } };
}

// ------------------------------------------------------------
// Send service summary — stamp + activity + best-effort notify
// ------------------------------------------------------------
export async function sendServiceSummary(bookingId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u || !canWrite(u.role)) return { success: false, error: "Not authorized" };

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, eventName: true, bookingNumber: true, createdById: true },
  });
  if (!booking) return { success: false, error: "Booking not found" };

  await prisma.booking.update({
    where: { id: bookingId },
    data: { servicesSummarySentAt: new Date() },
  });

  await logActivity({
    userId: u.id,
    action: "service_summary_sent",
    entityType: "Booking",
    entityId: bookingId,
  });

  // Best-effort: notify the event coordinator (booking creator). No real
  // WhatsApp/email here — just an in-app notification.
  if (booking.createdById) {
    notify({
      userId: booking.createdById,
      type: "SYSTEM",
      title: "Service summary sent",
      message: `Service confirmation summary for ${booking.eventName} (${booking.bookingNumber}) has been sent.`,
      actionUrl: `/bookings/${bookingId}`,
    });
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { success: true, data: { id: bookingId } };
}
