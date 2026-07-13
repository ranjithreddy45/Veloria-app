"use server";

// ============================================================
// Guest service confirmation + declaration (public token flow, no auth — the
// unguessable guestConfirmationToken is the only credential). The guest reviews
// their event services (menu/décor/etc from the BEO) and accepts the booking
// Terms & Conditions; acceptance stamps the booking (name + version + IP). Tied
// to the 48h guest-confirmation TAT set at booking confirmation.
// ============================================================

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { serialize } from "@/lib/utils";
import { BookingStatus } from "@prisma/client";
import { BOOKING_TERMS, BOOKING_TERMS_VERSION } from "@/lib/legal/booking-terms";

// Statuses for which a live confirmation link is meaningful. A CANCELLED booking's
// token is never cleared, so guard here (and on submit) — otherwise a stale link
// would still render "Confirm your event" for a dead event and stamp acceptance.
const NON_CONFIRMABLE = new Set<BookingStatus>([BookingStatus.CANCELLED]);

// ------------------------------------------------------------
// Per-instance IP rate limiter (mirrors public-vendor-confirm.actions.ts) — blunts
// token-spray / read-spam on these unauthenticated public actions. Best-effort.
// ------------------------------------------------------------
const RATE_LIMIT = 30;
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

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

// Guest-safe projection of a frozen vendor-package snapshot: keep only what the
// public page renders (vendor/name/category + section items) and DROP internal
// margin-basis fields (vendorPrice / priceUnit / cost) so no unauthenticated
// response ever leaks vendor cost.
function guestSafePackages(snapshot: unknown): unknown[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.map((raw) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    const sections = Array.isArray(p.sections)
      ? (p.sections as unknown[]).map((s) => {
          const sec = (s ?? {}) as Record<string, unknown>;
          const items = Array.isArray(sec.items)
            ? (sec.items as unknown[]).map((it) => {
                const item = (it ?? {}) as Record<string, unknown>;
                return { name: item.name ?? null, chosen: Array.isArray(item.chosen) ? item.chosen : undefined };
              })
            : [];
          return { title: sec.title ?? null, items };
        })
      : [];
    return { vendorName: p.vendorName ?? null, name: p.name ?? null, category: p.category ?? null, sections };
  });
}

export async function getGuestConfirmationByToken(token: string) {
  if (!token || token.length < 8) return null;
  const ip = await clientIp();
  if (rateLimited(ip ?? "unknown")) return null;
  const booking = await prisma.booking.findFirst({
    where: { guestConfirmationToken: token },
    select: {
      id: true, bookingNumber: true, eventName: true, eventType: true, date: true, timeSlot: true,
      guestCount: true, guestConfirmedAt: true, guestConfirmedName: true, guestConfirmationDueAt: true, status: true,
      venue: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
  });
  if (!booking) return null;
  // A cancelled event has no live confirmation — treat the link as no longer valid.
  if (NON_CONFIRMABLE.has(booking.status)) return null;

  // Service details from the BEO (menu / décor / AV / floor / special) + any frozen
  // vendor-package snapshots, if a BEO exists for this booking.
  const beo = await prisma.beo.findFirst({
    where: { bookingId: booking.id },
    select: { menuNotes: true, decorNotes: true, avNotes: true, floorPlanNotes: true, staffingNotes: true, specialInstructions: true, packageSnapshotJson: true },
    orderBy: { createdAt: "desc" },
  });

  const services = beo
    ? {
        menuNotes: beo.menuNotes, decorNotes: beo.decorNotes, avNotes: beo.avNotes,
        floorPlanNotes: beo.floorPlanNotes, staffingNotes: beo.staffingNotes, specialInstructions: beo.specialInstructions,
        // Projected to a guest-safe shape — internal vendorPrice/priceUnit stripped.
        packageSnapshotJson: guestSafePackages(beo.packageSnapshotJson),
      }
    : null;

  return serialize({
    ...booking,
    services,
    // Normalise to { heading, points } for the public page.
    terms: BOOKING_TERMS.map((s) => ({ heading: s.title, points: s.items })),
    termsVersion: BOOKING_TERMS_VERSION,
  });
}

export async function submitGuestConfirmation(
  token: string,
  input: { name: string; accepted: boolean },
): Promise<{ success: true; data: { confirmed: boolean; already?: boolean } } | { success: false; error: string }> {
  if (!token) return { success: false, error: "Invalid link." };
  const ip = await clientIp();
  if (rateLimited(ip ?? "unknown")) return { success: false, error: "Too many attempts — please wait a moment and try again." };
  const booking = await prisma.booking.findFirst({
    where: { guestConfirmationToken: token },
    select: { id: true, guestConfirmedAt: true, status: true },
  });
  if (!booking) return { success: false, error: "This confirmation link is invalid or has expired." };
  if (NON_CONFIRMABLE.has(booking.status)) return { success: false, error: "This booking is no longer active — please contact your event manager." };
  if (booking.guestConfirmedAt) return { success: true, data: { confirmed: true, already: true } };
  if (!input.accepted) return { success: false, error: "Please accept the terms & conditions to confirm." };
  if (!input.name?.trim()) return { success: false, error: "Please type your name to accept on the declaration." };

  const claimed = await prisma.booking.updateMany({
    // status guard in the where-clause closes the flip-race if a cancel lands mid-submit.
    where: { id: booking.id, guestConfirmedAt: null, status: { notIn: Array.from(NON_CONFIRMABLE) } },
    data: {
      guestConfirmedAt: new Date(),
      guestConfirmedName: input.name.trim().slice(0, 120),
      guestTermsVersion: BOOKING_TERMS_VERSION,
      guestConfirmedIp: ip,
    },
  });
  if (claimed.count === 0) return { success: true, data: { confirmed: true, already: true } };
  return { success: true, data: { confirmed: true } };
}
