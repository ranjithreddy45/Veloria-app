"use server";

// ============================================================
// Vendor Confirm — PUBLIC (no-auth) actions for /vendor-confirm/<token>.
// ------------------------------------------------------------
// Mirrors the security posture of quote-onetap.actions.ts: the unguessable
// OperationVendorAssignment.respondToken is the ONLY access control; every read
// returns a vendor-safe projection (event name/date/slot/venue + the vendor's
// own role) and NEVER internal pricing, contacts, or other assignments. Every
// action is IP-rate-limited to blunt token-spray / response-spam.
//
// Flow the VendorConfirm client drives:
//   1. getVendorAssignmentByToken(token)            → vendor-safe summary
//   2. submitVendorResponse(token, "CONFIRM"|"DECLINE", note?) → idempotent flip
//
// The status flip routes through the same assertTransition the internal actions
// use, but a re-submit of the SAME response is a no-op success (idempotent) so a
// double-tap or a re-load never errors.
// ============================================================

import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { z } from "zod";
import { assertTransition } from "@/lib/ops/state-machine";
import { SLOT_LABEL } from "@/lib/sales/slot";
import { reportSystemFailure } from "@/lib/ops-alert";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// respondToken is randomUUID().replace(/-/g, "") → 32 hex chars; allow a range.
const tokenSchema = z.string().regex(/^[A-Za-z0-9]{16,64}$/);

// ------------------------------------------------------------
// Per-instance IP rate limiter (mirrors quote-onetap.actions.ts). Best-effort.
// ------------------------------------------------------------
const RATE_LIMIT = 20;
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

/** Format a @db.Date (UTC-midnight) without TZ drift. */
function eventDateLabel(d: Date | null | undefined): string {
  if (!d) return "TBC";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// ============================================================
// (1) Vendor-safe summary by token — no pricing, no contacts, no other rows.
// ============================================================
export interface PublicVendorAssignmentView {
  token: string;
  status: "NOTIFIED" | "CONFIRMED" | "DECLINED";
  vendorName: string;
  role: string | null;
  eventName: string;
  dateLabel: string;
  slotLabel: string;
  venueName: string | null;
  arrivalTime: string | null;
  setupTime: string | null;
  /** true while the vendor can still act (still NOTIFIED). */
  actionable: boolean;
}

export async function getVendorAssignmentByToken(
  token: string
): Promise<Result<PublicVendorAssignmentView>> {
  try {
    if (!tokenSchema.safeParse(token).success) {
      return { success: false, error: "This link is not valid." };
    }

    const a = await prisma.operationVendorAssignment.findFirst({
      where: { respondToken: token },
      // VENDOR-SAFE whitelist: never agreedRate / vendor contacts / other assignments.
      select: {
        respondToken: true,
        status: true,
        arrivalTime: true,
        setupTime: true,
        bookingVendor: {
          select: {
            role: true,
            vendor: { select: { name: true } },
            booking: {
              select: {
                eventName: true,
                date: true,
                timeSlot: true,
                venue: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!a) return { success: false, error: "This link is not valid." };

    const status = a.status as PublicVendorAssignmentView["status"];

    return {
      success: true,
      data: {
        token,
        status,
        vendorName: a.bookingVendor.vendor.name,
        role: a.bookingVendor.role,
        eventName: a.bookingVendor.booking.eventName,
        dateLabel: eventDateLabel(a.bookingVendor.booking.date),
        slotLabel:
          SLOT_LABEL[a.bookingVendor.booking.timeSlot] ??
          a.bookingVendor.booking.timeSlot,
        venueName: a.bookingVendor.booking.venue?.name ?? null,
        arrivalTime: a.arrivalTime,
        setupTime: a.setupTime,
        actionable: status === "NOTIFIED",
      },
    };
  } catch (error) {
    console.error("[GET_VENDOR_ASSIGNMENT_BY_TOKEN_ERROR]", error);
    return { success: false, error: "We couldn't load this request. Please try again." };
  }
}

// ============================================================
// (2) Submit a vendor response — idempotent flip keyed by token.
// ============================================================
export interface VendorResponseResult {
  status: "CONFIRMED" | "DECLINED";
  alreadyDone: boolean;
}

export async function submitVendorResponse(
  token: string,
  response: "CONFIRM" | "DECLINE",
  note?: string
): Promise<Result<VendorResponseResult>> {
  try {
    if (!tokenSchema.safeParse(token).success) {
      return { success: false, error: "This link is not valid." };
    }
    if (response !== "CONFIRM" && response !== "DECLINE") {
      return { success: false, error: "Please choose Confirm or Decline." };
    }

    const ip = await clientIp();
    if (rateLimited(ip)) {
      return { success: false, error: "Too many requests. Please try again shortly." };
    }

    const target: "CONFIRMED" | "DECLINED" =
      response === "CONFIRM" ? "CONFIRMED" : "DECLINED";

    const a = await prisma.operationVendorAssignment.findFirst({
      where: { respondToken: token },
      select: { id: true, status: true, notes: true, operationId: true },
    });
    if (!a) return { success: false, error: "This link is not valid." };

    // Idempotent: re-submitting the SAME response is a no-op success.
    if (a.status === target) {
      return { success: true, data: { status: target, alreadyDone: true } };
    }

    // Validate the transition (NOTIFIED→CONFIRMED/DECLINED, plus reversals).
    const check = assertTransition("vendorAssignment", a.status, target);
    if (!check.ok) {
      return { success: false, error: check.error ?? "This request can no longer be changed." };
    }

    const trimmedNote = (note ?? "").trim().slice(0, 500);

    // Atomic guard: only flip from the status we read (concurrency-safe).
    const flipped = await prisma.operationVendorAssignment.updateMany({
      where: { id: a.id, status: a.status },
      data:
        target === "CONFIRMED"
          ? {
              status: "CONFIRMED",
              confirmedAt: new Date(),
              declinedAt: null,
              ...(trimmedNote ? { notes: `Vendor note: ${trimmedNote}` } : {}),
            }
          : {
              status: "DECLINED",
              declinedAt: new Date(),
              confirmedAt: null,
              ...(trimmedNote ? { notes: `Vendor declined: ${trimmedNote}` } : {}),
            },
    });

    if (flipped.count === 0) {
      // Lost a race — re-read and report the resolved state idempotently.
      const fresh = await prisma.operationVendorAssignment.findUnique({
        where: { id: a.id },
        select: { status: true },
      });
      if (fresh?.status === target) {
        return { success: true, data: { status: target, alreadyDone: true } };
      }
      return { success: false, error: "This request was just updated. Please reload." };
    }

    // A vendor DECLINING leaves a gap — alert ops to reassign (no auto-backfill yet).
    if (target === "DECLINED") {
      void reportSystemFailure({
        area: "Vendor assignment — ACTION NEEDED",
        title: "A vendor DECLINED an assignment — reassign",
        detail: `Assignment ${a.id} was declined by the vendor${trimmedNote ? `: "${trimmedNote}"` : ""}. Assign an alternate vendor for this operation.`,
        actionUrl: "/bookings",
      }).catch(() => {});
    }

    return { success: true, data: { status: target, alreadyDone: false } };
  } catch (error) {
    console.error("[SUBMIT_VENDOR_RESPONSE_ERROR]", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
