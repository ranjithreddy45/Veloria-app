"use server";

// ============================================================
// Public site-visit scheduler — PUBLIC (no auth).
// ------------------------------------------------------------
// Powers /visit + /visit/[token]. No session: the unguessable token is the
// ONLY access control for the manage page, and a fresh zod-validated submission
// is the boundary for create. Mirrors public-hold.actions / public-configurator.
//
// SECURITY (see spec risks):
//  - getPublicVisitByToken SELECTs a whitelist (name, kind, scheduledAt, venue
//    name, status) and NEVER leaks leadId, rep identity, other bookings, or
//    other slots.
//  - submit is a naive-rate-limited + dedup-guarded open lead-creation endpoint
//    (same phone+slot within a short window → return the existing token rather
//    than re-mint, like bulkSendWhatsApp's idempotency window).
//  - All input is zod-validated server-side (untrusted).
// ============================================================

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { SiteVisitKind } from "@prisma/client";
import {
  submitVisitBookingSchema,
  type SubmitVisitBookingInput,
  normalizeVisitPhone,
} from "@/schemas/site-visit.schema";
import {
  buildVisitSlotOptions,
  isValidVisitSlot,
  SITE_VISIT_KIND_LABEL,
  SITE_VISIT_KIND_TAGLINE,
  formatVisitDateLabel,
  formatVisitTimeLabel,
  type VisitSlotOption,
} from "@/lib/site-visit/slots";
import { createSiteVisitBooking } from "@/lib/site-visit/public-booking";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ------------------------------------------------------------
// Naive per-instance IP rate limiter, mirroring public-hold / webforms (10/hr).
// Best-effort (per-process); the dedup guard below backs it for real abuse.
// ------------------------------------------------------------
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

// ============================================================
// (1) Public availability — venue list + bookable slot options for a date.
//     Returns ONLY names + slot times. No internal data.
// ============================================================

export interface PublicVisitVenue {
  id: string;
  name: string;
}

export interface VisitKindOption {
  kind: SiteVisitKind;
  label: string;
  tagline: string;
}

export interface PublicVisitAvailability {
  venues: PublicVisitVenue[];
  kinds: VisitKindOption[];
  /** Present only when a dateISO was supplied. */
  slots: VisitSlotOption[];
  dateISO: string | null;
}

/**
 * Initial scheduler context: active venues + the two kinds (+ optional slots for
 * a date). Safe to call from the server page (no auth).
 */
export async function getPublicVisitAvailability(
  dateISO?: string,
  venueId?: string
): Promise<PublicVisitAvailability> {
  const venues = await prisma.venue
    .findMany({
      where: { isActive: true, parentVenueId: null, ...(venueId ? { id: venueId } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    .catch(() => [] as PublicVisitVenue[]);

  const kinds: VisitKindOption[] = (["SITE_VISIT", "MENU_TASTING"] as SiteVisitKind[]).map(
    (kind) => ({
      kind,
      label: SITE_VISIT_KIND_LABEL[kind],
      tagline: SITE_VISIT_KIND_TAGLINE[kind],
    })
  );

  const slots =
    dateISO && /^\d{4}-\d{2}-\d{2}$/.test(dateISO) ? buildVisitSlotOptions(dateISO) : [];

  return { venues, kinds, slots, dateISO: dateISO ?? null };
}

/**
 * Client-callable slot fetch (used by the date picker). Returns bookable
 * wall-clock options for a date — nothing internal.
 */
export async function getVisitAvailability(
  dateISO: string
): Promise<Result<VisitSlotOption[]>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return { success: false, error: "Please choose a valid date." };
  }
  return { success: true, data: buildVisitSlotOptions(dateISO) };
}

// ============================================================
// (2) Submit a visit booking — open lead-creation endpoint.
// ============================================================

export interface SubmitVisitResult {
  token: string;
  /** true when an identical recent request was deduped to its existing token. */
  deduped: boolean;
}

export async function submitVisitBooking(
  input: SubmitVisitBookingInput
): Promise<Result<SubmitVisitResult>> {
  // (a) Validate untrusted input.
  const parsed = submitVisitBookingSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, error: first || "Please check the form and try again." };
  }
  const data = parsed.data;

  // (b) Rate-limit before any DB work.
  const ip = await clientIp();
  if (rateLimited(ip)) {
    return { success: false, error: "Too many requests. Please try again shortly." };
  }

  // (c) Slot must be a real future catalog slot.
  const scheduledAt = new Date(data.scheduledAt);
  if (!isValidVisitSlot(scheduledAt)) {
    return { success: false, error: "Please choose an available visit time." };
  }

  const normPhone = normalizeVisitPhone(data.phone);

  try {
    // (d) Dedup guard: same phone + same exact slot created very recently → hand
    // back the existing token instead of re-minting a lead + re-sending WhatsApp
    // (spam / cost protection). Match on EXACT normalized-phone equality — a
    // `contains` substring match could collide with a different customer whose
    // stored phone merely ends with these digits and leak THEIR manage token.
    // createSiteVisitBooking stores the same normalized value, so exact is right.
    const recent = await prisma.siteVisitBooking.findFirst({
      where: {
        customerPhone: normPhone,
        scheduledAt,
        status: { notIn: ["CANCELLED"] },
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { token: true },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return { success: true, data: { token: recent.token, deduped: true } };
    }

    // (e) Delegate to the engine (mints lead + Task + confirmation). Fully
    // awaited so side effects survive the serverless freeze.
    const created = await createSiteVisitBooking({
      name: data.name,
      phone: normPhone,
      email: data.email || null,
      kind: data.kind,
      scheduledAt,
      venueId: data.venueId || null,
      eventType: data.eventType || null,
      guestCount: data.guestCount ?? null,
      notes: data.notes || null,
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
    });
    if (!created.success) return created;

    revalidatePath("/site-visits");
    return { success: true, data: { token: created.data.token, deduped: false } };
  } catch (error) {
    console.error("[SUBMIT_VISIT_BOOKING_ERROR]", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ============================================================
// (3) Token-scoped view — ONLY the prospect's own submission.
// ============================================================

export interface PublicVisitView {
  token: string;
  status: "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "RESCHEDULED";
  kind: SiteVisitKind;
  kindLabel: string;
  customerFirstName: string;
  venueName: string | null;
  scheduledAtISO: string;
  dateLabel: string;
  timeLabel: string;
  /** true while the visit can still be cancelled / rescheduled by the prospect. */
  manageable: boolean;
}

export async function getPublicVisitByToken(
  token: string
): Promise<Result<PublicVisitView>> {
  try {
    if (!token || token.length < 8) return { success: false, error: "Visit not found." };

    const v = await prisma.siteVisitBooking.findUnique({
      where: { token },
      // PUBLIC-SAFE whitelist: never leadId / assignedToId / notes / utm / other rows.
      select: {
        token: true,
        status: true,
        kind: true,
        customerName: true,
        scheduledAt: true,
        venue: { select: { name: true } },
      },
    });
    if (!v) return { success: false, error: "Visit not found." };

    const manageable = v.status === "REQUESTED" || v.status === "CONFIRMED";

    return {
      success: true,
      data: {
        token: v.token,
        status: v.status,
        kind: v.kind,
        kindLabel: SITE_VISIT_KIND_LABEL[v.kind],
        // Only the first name — never the full identity.
        customerFirstName: v.customerName.trim().split(/\s+/)[0] || "there",
        venueName: v.venue?.name ?? null,
        scheduledAtISO: v.scheduledAt.toISOString(),
        dateLabel: formatVisitDateLabel(v.scheduledAt),
        timeLabel: formatVisitTimeLabel(v.scheduledAt),
        manageable,
      },
    };
  } catch (error) {
    console.error("[GET_PUBLIC_VISIT_ERROR]", error);
    return { success: false, error: "Failed to load your visit." };
  }
}

// ============================================================
// (4) Cancel a visit — token-scoped, idempotent.
// ============================================================

export async function cancelVisitByToken(
  token: string
): Promise<Result<{ cancelled: boolean }>> {
  try {
    if (!token || token.length < 8) return { success: false, error: "Visit not found." };

    const v = await prisma.siteVisitBooking.findUnique({
      where: { token },
      select: { id: true, status: true },
    });
    if (!v) return { success: false, error: "Visit not found." };
    if (v.status !== "REQUESTED" && v.status !== "CONFIRMED") {
      return { success: false, error: "This visit can no longer be cancelled." };
    }

    // Atomic guard: only flip a still-open visit.
    const flipped = await prisma.siteVisitBooking.updateMany({
      where: { id: v.id, status: { in: ["REQUESTED", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    });
    if (flipped.count === 0) {
      return { success: false, error: "This visit can no longer be cancelled." };
    }

    revalidatePath(`/visit/${token}`);
    revalidatePath("/site-visits");
    return { success: true, data: { cancelled: true } };
  } catch (error) {
    console.error("[CANCEL_VISIT_ERROR]", error);
    return { success: false, error: "Failed to cancel this visit." };
  }
}

// ============================================================
// (5) Reschedule a visit — token-scoped, new catalog slot only.
// ============================================================

export async function rescheduleVisitByToken(
  token: string,
  scheduledAtISO: string
): Promise<Result<{ scheduledAtISO: string }>> {
  try {
    if (!token || token.length < 8) return { success: false, error: "Visit not found." };

    const scheduledAt = new Date(scheduledAtISO);
    if (!isValidVisitSlot(scheduledAt)) {
      return { success: false, error: "Please choose an available visit time." };
    }

    const v = await prisma.siteVisitBooking.findUnique({
      where: { token },
      select: { id: true, status: true },
    });
    if (!v) return { success: false, error: "Visit not found." };
    if (v.status !== "REQUESTED" && v.status !== "CONFIRMED") {
      return { success: false, error: "This visit can no longer be changed." };
    }

    // Move the appointment; reset confirmation + reminder so it re-confirms and
    // re-reminds against the new time. Status → REQUESTED (needs re-confirm).
    const moved = await prisma.siteVisitBooking.updateMany({
      where: { id: v.id, status: { in: ["REQUESTED", "CONFIRMED"] } },
      data: {
        scheduledAt,
        status: "REQUESTED",
        confirmedAt: null,
        reminderSentAt: null,
      },
    });
    if (moved.count === 0) {
      return { success: false, error: "This visit can no longer be changed." };
    }

    revalidatePath(`/visit/${token}`);
    revalidatePath("/site-visits");
    return { success: true, data: { scheduledAtISO: scheduledAt.toISOString() } };
  } catch (error) {
    console.error("[RESCHEDULE_VISIT_ERROR]", error);
    return { success: false, error: "Failed to reschedule this visit." };
  }
}
