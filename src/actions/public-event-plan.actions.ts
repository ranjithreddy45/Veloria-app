"use server";

// ============================================================
// Client-facing Event Plan — PUBLIC (no-auth) action for /event/<token>.
// ------------------------------------------------------------
// After a customer pays and ops provisions the booking, they get a polished,
// branded page showing their event coming together. Access control is the
// unguessable EventOperation.clientToken ALONE — exactly like /q, /visit, /hold.
//
// SECURITY POSTURE (mirrors quote-onetap.actions.ts):
//   • token validated against a strict regex before any DB read,
//   • per-IP rate limit blunts token-guessing / scraping,
//   • the returned projection is CLIENT-SAFE ONLY: no money, no costs, no
//     internal notes, no vendor data, no owners, no other bookings.
//
// Also exports an INTERNAL, RBAC-gated `ensureClientToken(bookingId)` so reps
// can mint + share a link for older operations that predate clientToken.
// ============================================================

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { z } from "zod";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { SLOT_LABEL, type TimeSlotEnum } from "@/lib/sales/slot";
import { loadBookingMenu, loadBookingServices, buildDefaultRunOfShow } from "@/lib/ops/beo-content";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// Matches the base64url tokens minted by randomBytes(24) and the existing
// share-link tokens; rejects anything else before we ever touch the DB.
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

// ------------------------------------------------------------
// Per-instance IP rate limiter (mirrors quote-onetap.actions.ts). Best-effort —
// blunts token-guessing / scraping; not a substitute for the unguessable token.
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

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

/** Build the event datetime (UTC) from the @db.Date day + slot start hour. */
const SLOT_START_HOUR: Record<TimeSlotEnum, number> = {
  MORNING: 9,
  AFTERNOON: 12,
  EVENING: 18,
  FULL_DAY: 10,
};

function eventDateTimeISO(date: Date, slot: TimeSlotEnum): string {
  // date is a @db.Date (UTC midnight). Anchor the countdown on the slot start.
  const dt = new Date(date.getTime());
  dt.setUTCHours(SLOT_START_HOUR[slot] ?? 12, 0, 0, 0);
  return dt.toISOString();
}

function firstNameOf(full?: string | null, fallback = "there"): string {
  return (full ?? "").trim().split(/\s+/)[0] || fallback;
}

// ============================================================
// getPublicEventPlan — CLIENT-SAFE projection for /event/<token>.
// ============================================================
export interface PublicEventPlan {
  eventName: string;
  eventType: string;
  /** Anchor for the in-page countdown ("Your wedding is in 12 days"). */
  eventAtISO: string;
  /** Plain calendar day, TZ-safe (no time component). */
  eventDateISO: string;
  slotLabel: string;
  venueName: string | null;
  guestCount: number;
  clientFirstName: string;
  pointOfContact: { name: string | null; phone: string | null };
  /** Confirmed menu — friendly names ONLY, never any cost. */
  menu: { items: { name: string; detail: string }[]; note: string | null };
  /** Client-friendly run of show — time + activity ONLY (owners dropped). */
  timeline: { time: string; activity: string }[];
}

/** Format a @db.Date (UTC-midnight) to YYYY-MM-DD without TZ drift. */
function toUTCDateISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getPublicEventPlan(token: string): Promise<Result<PublicEventPlan>> {
  try {
    if (!tokenSchema.safeParse(token).success)
      return { success: false, error: "This link is not valid." };

    const ip = await clientIp();
    if (rateLimited(ip))
      return { success: false, error: "Too many requests. Please try again in a little while." };

    // Resolve the operation by its client token → the booking it belongs to.
    // Select ONLY client-safe fields; never internal notes / money / vendors.
    const op = await prisma.eventOperation.findFirst({
      where: { clientToken: token },
      select: {
        bookingId: true,
        booking: {
          select: {
            eventName: true,
            eventType: true,
            date: true,
            timeSlot: true,
            guestCount: true,
            status: true,
            venue: { select: { name: true } },
            contact: { select: { firstName: true } },
            createdBy: { select: { name: true, phone: true } },
          },
        },
      },
    });

    // Friendly not-found (expired / wrong / unprovisioned).
    if (!op?.booking) return { success: false, error: "We couldn't find this event." };
    const b = op.booking;

    // Don't surface a cancelled event as a live plan.
    if (b.status === "CANCELLED")
      return { success: false, error: "We couldn't find this event." };

    const slot = (b.timeSlot as TimeSlotEnum) ?? "AFTERNOON";
    const slotLabel = SLOT_LABEL[slot] ?? "—";

    // Confirmed menu (friendly), services, and a client timeline — all
    // best-effort; any piece that can't resolve is simply omitted.
    const [menuRaw, services] = await Promise.all([
      loadBookingMenu(op.bookingId, b.guestCount),
      loadBookingServices(op.bookingId),
    ]);

    // Strip ALL cost fields — clients see names + a friendly detail line only.
    const menuItems = (menuRaw?.items ?? []).map((it) => ({
      name: it.name,
      detail:
        it.unit === "kg"
          ? `${it.quantity} ${it.unit}`
          : `Served to ${it.quantity} guests`,
    }));

    // Run of show → DROP internal owners; keep time + activity only.
    const timeline = buildDefaultRunOfShow(b.timeSlot, services).map((r) => ({
      time: r.time,
      activity: r.activity,
    }));

    return {
      success: true,
      data: {
        eventName: b.eventName,
        eventType: b.eventType,
        eventAtISO: eventDateTimeISO(b.date, slot),
        eventDateISO: toUTCDateISO(b.date),
        slotLabel,
        venueName: b.venue?.name ?? null,
        guestCount: b.guestCount,
        clientFirstName: firstNameOf(b.contact?.firstName),
        pointOfContact: {
          name: b.createdBy?.name ?? null,
          phone: b.createdBy?.phone ?? null,
        },
        menu: {
          items: menuItems,
          // menuNotes from the helper is internal-flavoured; we generate a warm,
          // client-facing line instead and never leak the raw note.
          note:
            menuItems.length > 0
              ? `A curated menu for ${b.guestCount} guests, chosen just for you.`
              : null,
        },
        timeline,
      },
    };
  } catch (e) {
    console.error("[GET_PUBLIC_EVENT_PLAN_ERROR]", e);
    return { success: false, error: "We couldn't load this event right now." };
  }
}

// ============================================================
// ensureClientToken — INTERNAL, RBAC-gated. Mints a clientToken for an
// operation that lacks one (so reps can share the plan link for older events)
// and returns the token + full public URL. Idempotent: reuses an existing token.
// ============================================================
export async function ensureClientToken(
  bookingId: string
): Promise<Result<{ token: string; url: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    // Sharing the plan is part of running the operation — gate on the same
    // permission the rest of the ops actions use.
    if (!hasPermission(session.user.role, "operations:update"))
      return { success: false, error: "You don't have permission to do that." };

    const op = await prisma.eventOperation.findUnique({
      where: { bookingId },
      select: { id: true, clientToken: true },
    });
    if (!op) return { success: false, error: "No operation exists for this booking yet." };

    let token = op.clientToken;
    if (!token) {
      token = randomBytes(24).toString("base64url");
      await prisma.eventOperation.update({
        where: { id: op.id },
        data: { clientToken: token },
      });
    }

    return { success: true, data: { token, url: `${appBaseUrl()}/event/${token}` } };
  } catch (e) {
    console.error("[ENSURE_CLIENT_TOKEN_ERROR]", e);
    return { success: false, error: "Could not generate the client link." };
  }
}
