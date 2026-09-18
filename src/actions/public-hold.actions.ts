"use server";

// ============================================================
// Public Availability + Instant Date-Hold — PUBLIC (no auth).
// ------------------------------------------------------------
// A customer browses FREE/BUSY availability, fills name+phone, and instantly
// holds a date. The canonical createBooking() in booking.actions.ts is
// auth-gated and cannot be called publicly, so this file REPLICATES its
// Serializable $transaction + cross-slot conflictOr + utcDayRange UTC-day
// bucketing EXACTLY (see booking.actions.ts ~lines 466-530) to guarantee no
// double-book, resolving createdById via the system-admin user.
//
// SECURITY (see spec risks):
//  - Availability + getPublicHold expose ONLY FREE/BUSY and the token's own
//    row. NEVER bookingNumber, eventName, internalNotes, blackout reasons, or
//    other holds' identities.
//  - All public input is zod-validated server-side (untrusted).
//  - A naive in-memory IP rate limiter mirrors the /api/webforms limiter to
//    blunt slot-squatting spam; the short hold window + cron release back it up.
//    The IP is the one our proxy appended (clientIpOfHeaders), and since an IP
//    is cheap to change, each phone number and each email may also place only
//    MAX_PUBLIC_HOLDS_PER_CUSTOMER new holds a day (DB-backed; recentHoldCounts).
// ============================================================

import { prisma } from "@/lib/prisma";
import { eventTypeTag } from "@/lib/enquiry-source";
import { Prisma, type TimeSlot } from "@prisma/client";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createHash, randomUUID } from "crypto";
import { notify } from "@/lib/notify";
// captureLeadFromExternal: mint CRM follow-up lead. getSystemUserId: first
// active SUPER_ADMIN/ADMIN, used as createdById for the public (no-login) flow.
import { captureLeadFromExternal, getSystemUserId } from "@/lib/lead-capture";
// Pure re-exports requested centrally (sharedEditsNeeded): identical UTC-day
// math + booking-number allocation as the internal engine — do NOT fork.
import { generateBookingNumber } from "@/actions/booking.actions";
import { utcDayRange } from "@/lib/sales/slot-util";
import { SLOT_LABEL, plannerSlotToEnum } from "@/lib/sales/slot";
import {
  PUBLIC_HOLD_CAP_WINDOW_HOURS,
  publicHoldCapError,
  publicHoldSchema,
  type PublicHoldCounts,
  type PublicHoldInput,
} from "@/schemas/public-hold.schema";
import { clientIpOfHeaders } from "@/lib/hr/geo";
import { normalizeOtpPhone, phoneKeySql } from "@/lib/otp";
import { hashPrivacyIp, recordConsent, requestClientMeta } from "@/lib/privacy/consent";
import { CONSENT_TEXT_ENQUIRY } from "@/lib/privacy/consent-text";
import { getPublishedPolicy, recordPolicyConsent } from "@/lib/public/policies";
import { BOOKING_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
// Lapsed holds: ONE decision shared with the team's availability view and the
// frequent-lane release job (src/lib/holds/lapsed-hold.ts).
import { HOLD_FACTS_SELECT, holdMoneyState, holdPhase, releasableHoldWhere, type HoldPhase } from "@/lib/holds/lapsed-hold";
import { findLapsedHoldIds, releaseLapsedHoldsForSlot } from "@/lib/holds/release-lapsed-holds";
import { slotIsFree } from "@/lib/holds/slot-occupancy";
import {
  HOLD_TERMS_KEYS,
  holdConsentRows,
  holdTermsMatch,
  type HoldTermsAcceptance,
  type HoldTermsDoc,
} from "@/lib/holds/hold-terms";

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ------------------------------------------------------------
// Tunables (see "ABUSE" + "AUTO-CONFIRM THRESHOLD" risks).
// ------------------------------------------------------------
// Short window so unpaid spam holds free up fast (cron + hold-expiry both sweep).
const PUBLIC_HOLD_TOKEN_HOLD_HOURS = 4;
// Token charged to hold a date. The token Invoice total == this amount, so a
// full token payment is 100% of that invoice and WILL auto-confirm the HOLD
// booking via maybeConfirmBookingOnPayment (clean BookMyShow UX). Kept modest.
const PUBLIC_HOLD_TOKEN_AMOUNT = 5000;
const PUBLIC_CURRENCY = "INR";

const SLOTS: TimeSlot[] = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"];

// ------------------------------------------------------------
// Local helpers (no fork of engine internals beyond the shared exports).
// ------------------------------------------------------------

/** Parse YYYY-MM-DD to LOCAL midnight, matching parseLocalDate/booking.actions. */
function parseLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  // UTC midnight (not local) so the stored @db.Date day and the utcDayRange
  // conflict window agree on any server timezone (see utcDayRange).
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Date(iso);
}

/** Today at UTC midnight (for past-date rejection vs @db.Date UTC-midnight values). */
function todayLocalMidnight(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Naive per-instance IP rate limiter, mirroring the in-memory limiter on
// /api/webforms (10/hr). Best-effort only (per-process), backed by the short
// hold window + cron release for real abuse protection.
const RATE_LIMIT = 10;
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
    // The address our proxy appended, never the client's own X-Forwarded-For entry.
    return clientIpOfHeaders(await headers()) || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * New holds placed in the cap window with this phone number, compared the way
 * WhatsApp sign-in compares numbers ("+91 98765 43210" and "09876543210" are
 * one number), and with this email, case-insensitive. Every PublicHold row
 * counts, released and lapsed ones too, so abandoning holds doesn't reset it.
 */
async function recentHoldCounts(phone: string, email: string | null): Promise<PublicHoldCounts> {
  const since = new Date(Date.now() - PUBLIC_HOLD_CAP_WINDOW_HOURS * 60 * 60 * 1000);
  const phoneKey = normalizeOtpPhone(phone);
  const emailKey = (email ?? "").trim().toLowerCase();
  const byEmail = emailKey
    ? Prisma.sql`(count(*) FILTER (WHERE lower(btrim("customerEmail")) = ${emailKey}))::int`
    : Prisma.sql`0`;
  const rows = await prisma.$queryRaw<{ byPhone: number | bigint; byEmail: number | bigint }[]>`
    SELECT (count(*) FILTER (WHERE ${phoneKeySql("customerPhone")} = ${phoneKey}))::int AS "byPhone",
           ${byEmail} AS "byEmail"
    FROM "PublicHold"
    WHERE "createdAt" >= ${since}`;
  return { byPhone: Number(rows[0]?.byPhone ?? 0), byEmail: Number(rows[0]?.byEmail ?? 0) };
}

// ============================================================
// (1a) Public availability — MONTH heatmap (FREE/BUSY only).
// ------------------------------------------------------------
// Mirrors getAvailabilityMonth's UTC range scan + getUTCDate() bucketing, but
// returns only a per-day busy flag (NEVER booking numbers / blackout reasons).
// ============================================================

export interface PublicMonthDay {
  /** 1-based day of month */
  day: number;
  /** true if at least one slot is taken / blacked out (no FREE slot detail) */
  busy: boolean;
  /** true only when the whole day is unavailable (full-day block) */
  full: boolean;
}
export interface PublicVenueMonth {
  venueId: string;
  venueName: string;
  days: PublicMonthDay[];
}

export async function getPublicAvailabilityMonth(
  year: number,
  month: number,
  venueId?: string
): Promise<Result<{ days: number; rows: PublicVenueMonth[] }>> {
  try {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return { success: false, error: "Invalid month." };
    }
    // UTC range to match how @db.Date reads back (UTC-midnight), bucketed by UTC day.
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

    const [venues, occupied, blackouts] = await Promise.all([
      prisma.venue.findMany({
        where: { isActive: true, ...(venueId ? { id: venueId } : {}) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.booking.findMany({
        where: {
          date: { gte: start, lte: end },
          status: { not: "CANCELLED" },
          ...(venueId ? { venueId } : {}),
        },
        // PUBLIC-SAFE projection: occupancy only, no labels/identities. The
        // hold fields only decide lapsed holds; they never leave the server.
        select: { id: true, venueId: true, date: true, timeSlot: true, status: true, holdExpiresAt: true },
      }),
      prisma.blackoutDate.findMany({
        where: { date: { gte: start, lte: end }, ...(venueId ? { venueId } : {}) },
        select: { venueId: true, date: true, timeSlot: true },
      }),
    ]);
    // A lapsed hold (window passed, no payment) no longer makes a day busy —
    // the same decision the team's availability board uses.
    const lapsedIds = await findLapsedHoldIds(occupied);
    const bookings = occupied.filter((b) => !lapsedIds.has(b.id));

    const rows: PublicVenueMonth[] = venues.map((v) => {
      const days: PublicMonthDay[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayBookings = bookings.filter(
          (b) => b.venueId === v.id && new Date(b.date).getUTCDate() === d
        );
        const dayBlackouts = blackouts.filter(
          (b) => b.venueId === v.id && new Date(b.date).getUTCDate() === d
        );
        const hasFull =
          dayBookings.some((b) => b.timeSlot === "FULL_DAY") ||
          dayBlackouts.some((b) => b.timeSlot === null);
        const partials =
          dayBookings.filter((b) => b.timeSlot !== "FULL_DAY").length +
          dayBlackouts.filter((b) => b.timeSlot !== null).length;
        const busy = hasFull || partials > 0;
        // A day is "full" only when no partial slot remains sellable.
        const full = hasFull || partials >= 3;
        days.push({ day: d, busy, full });
      }
      return { venueId: v.id, venueName: v.name, days };
    });

    return { success: true, data: { days: daysInMonth, rows } };
  } catch (error) {
    console.error("[PUBLIC_AVAILABILITY_MONTH_ERROR]", error);
    return { success: false, error: "Failed to load availability." };
  }
}

// ============================================================
// (1b) Public availability — DAY grid (per-slot FREE/BUSY only).
// ------------------------------------------------------------
// Mirrors getAvailabilityGrid's UTC-day scan + FULL_DAY/blackout resolution,
// but collapses every slot to FREE | BUSY (NO labels, NO reasons).
// ============================================================

export type PublicSlotStatus = "FREE" | "BUSY";
export interface PublicSlotCell {
  slot: TimeSlot;
  label: string;
  status: PublicSlotStatus;
}
export interface PublicVenueDay {
  venueId: string;
  venueName: string;
  capacity: number;
  slots: PublicSlotCell[];
}

export async function getPublicAvailabilityGrid(
  dateISO: string,
  venueId?: string
): Promise<Result<PublicVenueDay[]>> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return { success: false, error: "Invalid date." };
    }
    // UTC-day scan, bucketed by getUTCDate(), identical to getAvailabilityGrid.
    const dayStart = new Date(dateISO + "T00:00:00.000Z");
    const dayEnd = new Date(dateISO + "T23:59:59.999Z");
    if (Number.isNaN(dayStart.getTime())) {
      return { success: false, error: "Invalid date." };
    }
    const targetUTCDay = dayStart.getUTCDate();

    const [venues, allBookings, allBlackouts] = await Promise.all([
      prisma.venue.findMany({
        where: { isActive: true, ...(venueId ? { id: venueId } : {}) },
        select: { id: true, name: true, capacity: true },
        orderBy: { name: "asc" },
      }),
      prisma.booking.findMany({
        where: {
          date: { gte: dayStart, lte: dayEnd },
          status: { not: "CANCELLED" },
          ...(venueId ? { venueId } : {}),
        },
        // PUBLIC-SAFE: timeSlot occupancy only. The hold fields only decide
        // lapsed holds; they never leave the server.
        select: { id: true, venueId: true, date: true, timeSlot: true, status: true, holdExpiresAt: true },
      }),
      prisma.blackoutDate.findMany({
        where: { date: { gte: dayStart, lte: dayEnd }, ...(venueId ? { venueId } : {}) },
        // Deliberately NOT selecting `reason` — public never sees blackout reasons.
        select: { venueId: true, date: true, timeSlot: true },
      }),
    ]);

    const dayBookings = allBookings.filter((b) => new Date(b.date).getUTCDate() === targetUTCDay);
    // A lapsed hold (window passed, no payment) no longer occupies its slot.
    const lapsedIds = await findLapsedHoldIds(dayBookings);
    const bookings = dayBookings.filter((b) => !lapsedIds.has(b.id));
    const blackouts = allBlackouts.filter((b) => new Date(b.date).getUTCDate() === targetUTCDay);

    const rows: PublicVenueDay[] = venues.map((v) => {
      const vb = bookings.filter((b) => b.venueId === v.id);
      const vx = blackouts.filter((b) => b.venueId === v.id);
      const fullDayBooking = vb.some((b) => b.timeSlot === "FULL_DAY");
      const fullDayBlackout = vx.some((b) => b.timeSlot === null);
      const anyPartialBooking = vb.some((b) => b.timeSlot !== "FULL_DAY");
      const anyPartialBlackout = vx.some((b) => b.timeSlot !== null);

      const slots: PublicSlotCell[] = SLOTS.map((slot) => {
        let busy: boolean;
        if (slot === "FULL_DAY") {
          // FULL_DAY is sellable only if nothing on the day blocks it.
          busy =
            fullDayBlackout ||
            fullDayBooking ||
            anyPartialBooking ||
            anyPartialBlackout;
        } else {
          // Partial slot: a whole-day block, a FULL_DAY booking, or this slot's
          // own booking/blackout makes it BUSY.
          busy =
            fullDayBlackout ||
            fullDayBooking ||
            vb.some((b) => b.timeSlot === slot) ||
            vx.some((b) => b.timeSlot === slot);
        }
        return {
          slot,
          label: SLOT_LABEL[slot as keyof typeof SLOT_LABEL],
          status: busy ? "BUSY" : "FREE",
        };
      });

      return { venueId: v.id, venueName: v.name, capacity: v.capacity, slots };
    });

    return { success: true, data: rows };
  } catch (error) {
    console.error("[PUBLIC_AVAILABILITY_GRID_ERROR]", error);
    return { success: false, error: "Failed to load availability." };
  }
}

// ------------------------------------------------------------
// Public-safe pre-check: same bookings+blackouts OR-logic as checkAvailability
// but WITHOUT auth and WITHOUT leaking blackout reason / booking labels.
// Returns only a boolean (+ a generic message). Authoritative re-check still
// happens inside the Serializable tx below.
// ------------------------------------------------------------
async function publicSlotIsFree(
  venueId: string,
  date: Date,
  timeSlot: TimeSlot
): Promise<boolean> {
  const { gte, lt, utcDay } = utcDayRange(date);

  const [bookings, blackouts] = await Promise.all([
    prisma.booking.findMany({
      where: { venueId, date: { gte, lt }, status: { notIn: ["CANCELLED"] } },
      select: { id: true, date: true, timeSlot: true, status: true, holdExpiresAt: true },
    }),
    prisma.blackoutDate.findMany({
      where: { venueId, date: { gte, lt } },
      select: { date: true, timeSlot: true },
    }),
  ]);
  const dayBookings = bookings.filter((b) => new Date(b.date).getUTCDate() === utcDay);
  const dayBlackouts = blackouts.filter((b) => new Date(b.date).getUTCDate() === utcDay);

  // A lapsed hold (window passed, no payment) no longer blocks the slot. The
  // conflict rules themselves live in slotIsFree (src/lib/holds/slot-occupancy.ts).
  const lapsedIds = await findLapsedHoldIds(dayBookings);
  return slotIsFree(timeSlot, dayBookings.filter((b) => !lapsedIds.has(b.id)), dayBlackouts);
}

// Exported for the public configurator (C6): is a venue + date + planner-slot
// still free? Used to refuse an advance pay-link for an already-booked date,
// and to re-check at payment time. Never blocks on failure (human review).
export async function publicConfiguratorSlotFree(
  venueId: string,
  date: Date,
  plannerSlot: string | null | undefined
): Promise<boolean> {
  try {
    return await publicSlotIsFree(venueId, date, plannerSlotToEnum(plannerSlot));
  } catch {
    return true;
  }
}

// ============================================================
// (2) Create a public HOLD — the core flow.
// ============================================================

export interface CreatePublicHoldResult {
  token: string;
  payUrl: string;
  invoiceId: string;
  payInvoiceUrl: string;
  tokenAmount: number;
}

/**
 * Runs once the HOLD booking exists, before the invoice, hold row, lead or
 * notification. Resolve to null to continue, or to a customer-facing error to
 * roll the hold back (booking cancelled, freshly minted contact removed), so a
 * hold never exists without what the hook records.
 */
type AfterBookingCreated = (ctx: {
  bookingId: string;
  contactId: string;
  email: string | null;
  phone: string;
}) => Promise<string | null>;

interface PlaceHoldOptions {
  /** Where the hold came from; shown to the team in the booking's internal notes. */
  channel: "WEBSITE" | "APP";
  afterBookingCreated?: AfterBookingCreated;
}

// Shared by createPublicHold (website /hold) and createAppHold (customer app),
// so both create the very same HOLD booking + token invoice + PublicHold row.
async function placeHold(
  input: PublicHoldInput,
  options: PlaceHoldOptions
): Promise<Result<CreatePublicHoldResult>> {
  // (a) Validate untrusted public input.
  const parsed = publicHoldSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, error: first || "Please check the form and try again." };
  }
  const data = parsed.data;

  // DPDP consent. NOT enforced here on purpose: the public /hold form requires
  // the tick client-side, but this action is ALSO called by the guest app's
  // reserve stepper (src/app/(guest)/app/book), whose signed-in hosts are
  // covered by its own terms flow. Recorded below whenever `consent: true`.

  // Rate-limit (best-effort, per instance) before any DB work.
  const ip = await clientIp();
  if (rateLimited(ip)) {
    return { success: false, error: "Too many requests. Please try again in a little while." };
  }

  const timeSlot = data.timeSlot as TimeSlot;
  const date = parseLocalDate(data.dateISO);
  if (Number.isNaN(date.getTime())) {
    return { success: false, error: "Pick a valid date." };
  }
  // Reject past dates.
  if (date.getTime() < todayLocalMidnight().getTime()) {
    return { success: false, error: "Please choose a future date." };
  }

  try {
    // Per-customer caps: the IP limit above is per process and an IP is cheap to
    // change, so each phone number and each email may place at most
    // MAX_PUBLIC_HOLDS_PER_CUSTOMER new holds in PUBLIC_HOLD_CAP_WINDOW_HOURS
    // (public-hold.schema.ts). Checked before anything is written. Requests
    // racing in the same instant can each pass; the IP limit bounds that.
    const capError = publicHoldCapError(await recentHoldCounts(data.customerPhone, data.customerEmail || null));
    if (capError) return { success: false, error: capError };

    // Confirm the venue exists + is active (public must not hold an inactive venue).
    const venue = await prisma.venue.findFirst({
      where: { id: data.venueId, isActive: true },
      select: { id: true, name: true },
    });
    if (!venue) return { success: false, error: "That venue isn't available." };

    // (b) Friendly pre-check (non-authoritative — the tx below is the source of truth).
    const free = await publicSlotIsFree(venue.id, date, timeSlot);
    if (!free) {
      return { success: false, error: "That slot is already taken — please pick another." };
    }

    // A lapsed hold (window passed, no payment) reads as free above but its
    // booking row still occupies the slot. Release it with the SAME guarded
    // cancel the frequent-lane job uses, so the transaction below can take the
    // slot. A hold that gained money meanwhile is left alone, and the
    // transaction's clash check then refuses the slot.
    await releaseLapsedHoldsForSlot(venue.id, date, timeSlot).catch((e) => {
      console.error("[PUBLIC_HOLD_LAPSED_RELEASE_ERROR]", e);
    });

    // (d) Resolve createdById via the system-admin user (no logged-in user).
    const systemUserId = await getSystemUserId();
    if (!systemUserId) {
      return { success: false, error: "We can't process holds right now. Please contact us." };
    }

    // (c) Resolve/mint Contact reusing the dedup pattern from
    // blockSlotFromQuotation: match a non-deleted contact by email/phone first.
    const email = data.customerEmail?.trim() || null;
    const phone = data.customerPhone.trim();
    const nameParts = data.customerName.trim().split(/\s+/);
    const firstName = nameParts[0] || "Guest";
    const lastName = nameParts.slice(1).join(" ") || "";

    let contactId: string | null = null;
    let mintedContactId: string | null = null;
    const existingContact = await prisma.contact.findFirst({
      where: {
        deletedAt: null,
        OR: [...(email ? [{ email }] : []), { phone }],
      },
      select: { id: true },
    });
    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const created = await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          // Tag = what the event IS. Channel goes in enquirySource — see
          // lead-capture for why it is not duplicated here.
          tags: [eventTypeTag(data.eventType)].filter(Boolean) as string[],
          enquirySource: "LEAD_FORM", // public website hold form
        },
        select: { id: true },
      });
      contactId = created.id;
      mintedContactId = created.id;
    }

    // Consent ledger (DPDP) — attached to the resolved contact (new or matched).
    // Awaited (one insert) so a serverless freeze can't drop it; never throws.
    if (data.consent === true) {
      await recordConsent({
        subjectType: "CONTACT",
        subjectId: contactId,
        email,
        phone,
        purpose: "DATE_HOLD",
        source: "/hold",
        consentText: CONSENT_TEXT_ENQUIRY,
      });
    }

    // (e) Create the HOLD Booking inside a Serializable $transaction, replicating
    // createBooking lines 466-530 EXACTLY: same conflictOr + utcDayRange bucket.
    const bookingNumber = await generateBookingNumber();
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);
    const { gte: dayGte, lt: dayLt, utcDay: bookingUTCDay } = utcDayRange(bookingDate);
    const holdExpiresAt = new Date(Date.now() + PUBLIC_HOLD_TOKEN_HOLD_HOURS * 60 * 60 * 1000);

    const reqSlot = timeSlot;
    const conflictOr =
      reqSlot === "FULL_DAY"
        ? [
            { timeSlot: "FULL_DAY" as TimeSlot },
            { timeSlot: "MORNING" as TimeSlot },
            { timeSlot: "AFTERNOON" as TimeSlot },
            { timeSlot: "EVENING" as TimeSlot },
          ]
        : [{ timeSlot: reqSlot }, { timeSlot: "FULL_DAY" as TimeSlot }];

    let booking;
    try {
      booking = await prisma.$transaction(
        async (tx) => {
          const clashes = await tx.booking.findMany({
            where: {
              venueId: venue.id,
              date: { gte: dayGte, lt: dayLt },
              status: { notIn: ["CANCELLED"] },
              OR: conflictOr,
            },
            select: { id: true, date: true },
          });
          if (clashes.some((c) => new Date(c.date).getUTCDate() === bookingUTCDay)) {
            throw new Error("SLOT_TAKEN");
          }
          return tx.booking.create({
            data: {
              bookingNumber,
              // At most 80 + 3 + 80 characters: the schema caps eventType and customerName.
              eventName: data.eventType
                ? `${data.eventType} — ${data.customerName.trim()}`
                : `Date hold — ${data.customerName.trim()}`,
              eventType: data.eventType || "Event",
              date: bookingDate,
              timeSlot: reqSlot,
              guestCount: data.guestCount,
              totalAmount: new Prisma.Decimal(0),
              holdExpiresAt,
              specialRequests: data.notes || null,
              internalNotes:
                options.channel === "APP"
                  ? "Customer app date hold (/app/book)"
                  : "Public online date hold (/(public)/hold)",
              venueId: venue.id,
              contactId: contactId as string,
              createdById: systemUserId,
              status: "HOLD",
            },
            select: { id: true, bookingNumber: true, holdExpiresAt: true },
          });
        },
        { isolationLevel: "Serializable" }
      );
    } catch (e) {
      // Compensate: drop a freshly-minted contact so it doesn't linger.
      if (mintedContactId) {
        await prisma.contact.delete({ where: { id: mintedContactId } }).catch(() => {});
      }
      const code = (e as { code?: string }).code;
      if ((e instanceof Error && e.message === "SLOT_TAKEN") || code === "P2002" || code === "P2034") {
        return { success: false, error: "That slot was just taken — please pick another." };
      }
      throw e;
    }

    // From here on, if a later write fails we roll back the HOLD Booking (and a
    // freshly-minted contact) so a ghost hold doesn't block the slot.
    const rollbackBooking = async () => {
      await prisma.booking
        .updateMany({ where: { id: booking.id, status: "HOLD" }, data: { status: "CANCELLED" } })
        .catch(() => {});
      if (mintedContactId) {
        await prisma.contact.delete({ where: { id: mintedContactId } }).catch(() => {});
      }
    };

    // Whatever must exist alongside the hold (the app's terms acceptance) is
    // written now, before the invoice, lead or notification. If it can't be
    // written, the hold is undone rather than left without it.
    if (options.afterBookingCreated) {
      let hookError: string | null;
      try {
        hookError = await options.afterBookingCreated({
          bookingId: booking.id,
          contactId: contactId as string,
          email,
          phone,
        });
      } catch (e) {
        console.error("[PUBLIC_HOLD_AFTER_CREATE_ERROR]", e);
        hookError = "We couldn't complete your hold. Please try again.";
      }
      if (hookError) {
        await rollbackBooking();
        return { success: false, error: hookError };
      }
    }

    const token = randomUUID();
    const tokenAmount = new Prisma.Decimal(PUBLIC_HOLD_TOKEN_AMOUNT);

    // (h) Token-payment Invoice (status SENT) — created directly (createInvoice is
    // auth-gated). Single line item; totalAmount == token == balanceDue.
    let invoiceId: string;
    try {
      const invoiceNumber = await generatePublicInvoiceNumber();
      const slotLabel = SLOT_LABEL[reqSlot as keyof typeof SLOT_LABEL];
      const dateLabel = data.dateISO;
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          status: "SENT",
          issueDate: new Date(),
          dueDate: holdExpiresAt,
          subtotal: tokenAmount,
          cgstRate: new Prisma.Decimal(0),
          sgstRate: new Prisma.Decimal(0),
          igstRate: new Prisma.Decimal(0),
          cgstAmount: new Prisma.Decimal(0),
          sgstAmount: new Prisma.Decimal(0),
          igstAmount: new Prisma.Decimal(0),
          totalAmount: tokenAmount,
          paidAmount: new Prisma.Decimal(0),
          balanceDue: tokenAmount,
          notes: "Online date-hold token payment.",
          contactId: contactId as string,
          bookingId: booking.id,
          createdById: systemUserId,
          lineItems: {
            create: [
              {
                description: `Date hold token — ${venue.name} · ${dateLabel} · ${slotLabel}`,
                quantity: new Prisma.Decimal(1),
                unitPrice: tokenAmount,
                amount: tokenAmount,
                order: 0,
              },
            ],
          },
        },
        select: { id: true },
      });
      invoiceId = invoice.id;
    } catch (e) {
      console.error("[PUBLIC_HOLD_INVOICE_ERROR]", e);
      await rollbackBooking();
      return { success: false, error: "We couldn't set up your hold. Please try again." };
    }

    // (f) PublicHold container row (status SLOT_CLAIMED), unguessable token.
    let publicHoldId: string;
    try {
      const ph = await prisma.publicHold.create({
        data: {
          token,
          status: "SLOT_CLAIMED",
          eventType: data.eventType || null,
          date: bookingDate,
          timeSlot: reqSlot,
          guestCount: data.guestCount,
          customerName: data.customerName.trim(),
          customerPhone: phone,
          customerEmail: email,
          notes: data.notes || null,
          tokenAmount,
          currency: PUBLIC_CURRENCY,
          expiresAt: booking.holdExpiresAt ?? holdExpiresAt,
          utmSource: data.utmSource || null,
          utmMedium: data.utmMedium || null,
          utmCampaign: data.utmCampaign || null,
          bookingId: booking.id,
          invoiceId,
          venueId: venue.id,
        },
        select: { id: true },
      });
      publicHoldId = ph.id;
    } catch (e) {
      console.error("[PUBLIC_HOLD_ROW_ERROR]", e);
      await rollbackBooking();
      return { success: false, error: "We couldn't set up your hold. Please try again." };
    }

    // (g) Mint a CRM follow-up Lead (source 'website', carry utm*). Non-fatal:
    // a lead failure should not collapse a valid, paid-pending hold.
    try {
      const lead = await captureLeadFromExternal({
        name: data.customerName.trim(),
        email: email || undefined,
        phone,
        source: "website",
        message: `Online date hold for ${venue.name} on ${data.dateISO} (${SLOT_LABEL[reqSlot as keyof typeof SLOT_LABEL]}).${data.notes ? ` Notes: ${data.notes}` : ""}`,
        eventType: data.eventType || undefined,
        eventDate: data.dateISO,
        guestCount: data.guestCount,
        venueId: venue.id,
        customFields: {
          utmSource: data.utmSource || null,
          utmMedium: data.utmMedium || null,
          utmCampaign: data.utmCampaign || null,
          publicHoldToken: token,
        },
      });
      if (lead && (lead as { success?: boolean; leadId?: string }).success) {
        const leadId = (lead as { leadId?: string }).leadId;
        if (leadId) {
          await prisma.publicHold.update({ where: { id: publicHoldId }, data: { leadId } });
        }
      }
    } catch (e) {
      console.error("[PUBLIC_HOLD_LEAD_ERROR]", e);
    }

    // Notify the system/owner user that a public hold was placed.
    notify({
      userId: systemUserId,
      type: "BOOKING_CREATED",
      title: options.channel === "APP" ? "New date hold (customer app)" : "New online date hold",
      message: `${firstName} placed a hold on ${venue.name} for ${data.dateISO} (${SLOT_LABEL[reqSlot as keyof typeof SLOT_LABEL]}). Awaiting token payment.`,
      actionUrl: `/bookings/${booking.id}`,
    });

    revalidatePath("/hold");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return {
      success: true,
      data: {
        token,
        payUrl: `${appUrl}/hold/${token}`,
        invoiceId,
        // The /pay route resolves the invoice by its id (route param is :token).
        payInvoiceUrl: `/pay/${invoiceId}?amt=${PUBLIC_HOLD_TOKEN_AMOUNT}`,
        tokenAmount: PUBLIC_HOLD_TOKEN_AMOUNT,
      },
    };
  } catch (error) {
    console.error("[CREATE_PUBLIC_HOLD_ERROR]", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

/** Website /hold form. */
export async function createPublicHold(
  input: PublicHoldInput
): Promise<Result<CreatePublicHoldResult>> {
  return placeHold(input, { channel: "WEBSITE" });
}

// ============================================================
// (2b) Customer app: the terms come BEFORE the hold.
// ------------------------------------------------------------
// Only PUBLISHED policies are shown and accepted. Each carries a fingerprint
// of exactly what was on screen; createAppHold refuses an acceptance of text
// that has since changed, so a ConsentRecord never claims a customer agreed to
// words they never saw. With no published cancellation and refund policy the
// customer acknowledges the honest notice, recorded with policyVersion null.
// ============================================================

async function loadHoldTermsDocs(): Promise<HoldTermsDoc[]> {
  const published = await Promise.all(HOLD_TERMS_KEYS.map((key) => getPublishedPolicy(key)));
  return published.flatMap((p, i) => {
    if (!p) return [];
    const key = HOLD_TERMS_KEYS[i];
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([key, p.version, p.title, p.body]))
      .digest("hex");
    return [{ key, title: p.title, body: p.body, version: p.version, publishedAt: p.publishedAt, fingerprint }];
  });
}

/** The published terms a customer accepts before an app hold, in display order. */
export async function getAppHoldTerms(): Promise<HoldTermsDoc[]> {
  return loadHoldTermsDocs();
}

export type AppHoldResult =
  | { success: true; data: CreatePublicHoldResult }
  | { success: false; error: string; code?: "TERMS_REQUIRED" | "TERMS_CHANGED" };

/**
 * Customer-app hold: the same HOLD booking, token invoice and PublicHold row as
 * a website hold, placed only after the customer accepted the published terms.
 * The acceptance is written as ConsentRecord rows on the new booking (source
 * "APP_HOLD": policy key, version, exact text, contact, phone, email) before
 * anything else; if that write fails the hold is undone.
 */
export async function createAppHold(
  input: PublicHoldInput,
  acceptance: HoldTermsAcceptance
): Promise<AppHoldResult> {
  if (!acceptance || acceptance.accepted !== true) {
    return { success: false, error: "Please read the terms and tick the box to hold your date.", code: "TERMS_REQUIRED" };
  }
  const docs = await loadHoldTermsDocs();
  if (!holdTermsMatch(docs, acceptance)) {
    return {
      success: false,
      error: "The terms were updated a moment ago. Please read them again and tick the box.",
      code: "TERMS_CHANGED",
    };
  }
  const rows = holdConsentRows(docs);
  const meta = await requestClientMeta();
  const ipHash = hashPrivacyIp(meta.ip);

  return placeHold(input, {
    channel: "APP",
    afterBookingCreated: async ({ bookingId, contactId, email, phone }) => {
      for (const row of rows) {
        const id = await recordPolicyConsent({
          policyKey: row.policyKey,
          policyVersion: row.policyVersion,
          consentText: row.consentText,
          source: "APP_HOLD",
          bookingId,
          contactId,
          email,
          phone,
          ipHash,
          userAgent: meta.userAgent,
        });
        if (!id) return "We couldn't record your acceptance of the terms, so the date wasn't held. Please try again.";
      }
      return null;
    },
  });
}

// ============================================================
// (3) Public hold view — minimal safe projection for /hold/[token].
// ============================================================

export interface PublicHoldView {
  token: string;
  status: "INITIATED" | "SLOT_CLAIMED" | "PAID" | "CONFIRMED" | "EXPIRED" | "RELEASED";
  venueName: string;
  /** Public-safe context for social-proof matching on /hold (non-PII). */
  venueId: string;
  eventType: string | null;
  dateISO: string;
  timeSlot: TimeSlot;
  slotLabel: string;
  guestCount: number;
  tokenAmount: number;
  currency: string;
  customerFirstName: string;
  invoiceId: string | null;
  /** When the date stops being held: the team's Booking.holdExpiresAt (the hold row's expiry only when no booking exists). */
  expiresAt: string | null;
  /** The token invoice is settled. */
  paid: boolean;
  /** true while the slot is held and payable */
  active: boolean;
  /** Where the hold stands, derived from the team's booking (holdPhase in src/lib/holds/lapsed-hold.ts). */
  phase: HoldPhase;
  /** The team's Booking.status (null when the booking is missing)… */
  bookingStatus: string | null;
  /** …and its customer wording from src/lib/customer-app/status-labels.ts. */
  bookingStatusLabel: string | null;
}

/** Token amount + hold window, for the guest app to state BEFORE asking anyone to pay. */
export async function getPublicHoldTerms(): Promise<{ tokenAmount: number; holdHours: number; currency: string }> {
  return { tokenAmount: PUBLIC_HOLD_TOKEN_AMOUNT, holdHours: PUBLIC_HOLD_TOKEN_HOLD_HOURS, currency: PUBLIC_CURRENCY };
}

export async function getPublicHold(token: string): Promise<Result<PublicHoldView>> {
  try {
    if (!token || token.length < 8) return { success: false, error: "Hold not found." };

    const hold = await prisma.publicHold.findUnique({
      where: { token },
      select: {
        token: true,
        status: true,
        date: true,
        timeSlot: true,
        guestCount: true,
        tokenAmount: true,
        currency: true,
        customerName: true,
        invoiceId: true,
        expiresAt: true,
        paidAt: true,
        bookingId: true,
        eventType: true,
        venueId: true,
        venue: { select: { name: true } },
      },
    });
    if (!hold) return { success: false, error: "Hold not found." };

    const now = new Date();

    // The team's Booking is the source of truth: its status, its hold window
    // and the money on ALL of its invoices, not just the token invoice. Read
    // only — nothing is mutated here.
    const booking = hold.bookingId
      ? await prisma.booking.findUnique({
          where: { id: hold.bookingId },
          select: {
            ...HOLD_FACTS_SELECT,
            invoices: { select: { ...HOLD_FACTS_SELECT.invoices.select, id: true, balanceDue: true } },
          },
        })
      : null;

    // Token paid: the hold's own token invoice is settled.
    const tokenInvoice =
      booking?.invoices.find((i) => i.id === hold.invoiceId) ??
      (hold.invoiceId
        ? await prisma.invoice.findUnique({ where: { id: hold.invoiceId }, select: { status: true, balanceDue: true } })
        : null);
    const paid =
      !!hold.paidAt ||
      hold.status === "PAID" ||
      hold.status === "CONFIRMED" ||
      (!!tokenInvoice && (tokenInvoice.status === "PAID" || Number(tokenInvoice.balanceDue) <= 0));

    const phase = holdPhase({ publicHoldStatus: hold.status, publicHoldExpiresAt: hold.expiresAt, booking }, now);

    // Legacy status for the website /hold page, derived from the booking so the
    // two can't disagree: a hold with money on it never reads EXPIRED, and a
    // hold the team extended or confirmed never reads EXPIRED either.
    let effectiveStatus = hold.status;
    if (paid) {
      if (effectiveStatus === "INITIATED" || effectiveStatus === "SLOT_CLAIMED" || effectiveStatus === "EXPIRED") effectiveStatus = "PAID";
    } else if (phase === "LAPSED" || phase === "CANCELLED") {
      if (effectiveStatus !== "RELEASED") effectiveStatus = "EXPIRED";
    } else if (phase === "BOOKED") {
      effectiveStatus = "CONFIRMED";
    } else if (phase === "HELD" || phase === "PAYMENT_PENDING" || phase === "PAYMENT_RECEIVED") {
      if (effectiveStatus === "EXPIRED" || effectiveStatus === "RELEASED" || effectiveStatus === "INITIATED") effectiveStatus = "SLOT_CLAIMED";
    }

    const dateISO = formatUTCDateISO(hold.date);
    const active = !paid && (phase === "HELD" || phase === "PAYMENT_PENDING" || phase === "PAYMENT_RECEIVED");
    const heldUntil = booking ? booking.holdExpiresAt : hold.expiresAt;

    return {
      success: true,
      data: {
        token: hold.token,
        status: effectiveStatus,
        venueName: hold.venue.name,
        venueId: hold.venueId,
        eventType: hold.eventType,
        dateISO,
        timeSlot: hold.timeSlot,
        slotLabel: SLOT_LABEL[hold.timeSlot as keyof typeof SLOT_LABEL],
        guestCount: hold.guestCount,
        tokenAmount: Number(hold.tokenAmount),
        currency: hold.currency,
        // Only the customer's own first name — never the full identity/notes.
        customerFirstName: hold.customerName.trim().split(/\s+/)[0] || "there",
        invoiceId: hold.invoiceId,
        expiresAt: heldUntil ? heldUntil.toISOString() : null,
        paid,
        active,
        phase,
        bookingStatus: booking?.status ?? null,
        bookingStatusLabel: booking ? customerLabel(BOOKING_STATUS_LABEL, booking.status) : null,
      },
    };
  } catch (error) {
    console.error("[GET_PUBLIC_HOLD_ERROR]", error);
    return { success: false, error: "Failed to load your hold." };
  }
}

// ============================================================
// (4) Release a public hold — customer abandons.
// ============================================================

export async function releasePublicHold(token: string): Promise<Result<{ released: boolean }>> {
  try {
    if (!token || token.length < 8) return { success: false, error: "Hold not found." };

    const hold = await prisma.publicHold.findUnique({
      where: { token },
      select: { id: true, status: true, bookingId: true, invoiceId: true, paidAt: true },
    });
    if (!hold) return { success: false, error: "Hold not found." };

    // Guard: only releasable while unpaid and still INITIATED/SLOT_CLAIMED.
    if (hold.paidAt || !(hold.status === "INITIATED" || hold.status === "SLOT_CLAIMED")) {
      return { success: false, error: "This hold can no longer be released." };
    }
    const now = new Date();
    let cancelledBooking = false;
    if (hold.bookingId) {
      // Money on ANY invoice of the booking — received, in flight or awaiting
      // verification — means the hold is no longer the customer's to release.
      const booking = await prisma.booking.findUnique({
        where: { id: hold.bookingId },
        select: HOLD_FACTS_SELECT,
      });
      if (booking && holdMoneyState(booking.invoices, now) !== "NONE") {
        return {
          success: false,
          error: "A payment has been made or started for this hold, so it can't be released here. Please contact us.",
        };
      }
      if (booking && booking.status !== "HOLD" && booking.status !== "CANCELLED") {
        return { success: false, error: "This hold can no longer be released." };
      }
      if (booking?.status === "HOLD") {
        // Cancel the booking FIRST, with the shared money guard inside the
        // UPDATE: a payment landing this instant wins and nothing is changed.
        const cancelled = await prisma.booking.updateMany({
          where: { id: hold.bookingId, ...releasableHoldWhere(now) },
          data: { status: "CANCELLED" },
        });
        if (cancelled.count === 0) {
          return { success: false, error: "This hold can no longer be released." };
        }
        cancelledBooking = true;
      }
    } else if (hold.invoiceId) {
      const inv = await prisma.invoice.findUnique({
        where: { id: hold.invoiceId },
        select: { status: true, balanceDue: true },
      });
      if (inv && (inv.status === "PAID" || Number(inv.balanceDue) <= 0)) {
        return { success: false, error: "This hold is already paid." };
      }
    }

    // Then the PublicHold, still guarded to its claimable, unpaid states, so the
    // customer's link and the team's booking say the same thing.
    const flipped = await prisma.publicHold.updateMany({
      where: { id: hold.id, status: { in: ["INITIATED", "SLOT_CLAIMED"] }, paidAt: null },
      data: { status: "RELEASED" },
    });
    if (flipped.count === 0 && !cancelledBooking) {
      return { success: false, error: "This hold can no longer be released." };
    }

    revalidatePath(`/hold/${token}`);
    revalidatePath("/hold");
    return { success: true, data: { released: true } };
  } catch (error) {
    console.error("[RELEASE_PUBLIC_HOLD_ERROR]", error);
    return { success: false, error: "Failed to release this hold." };
  }
}

// ------------------------------------------------------------
// Internal: invoice-number allocation mirroring invoice.actions
// generateInvoiceNumber (INV-YYYY-NNNN) with a P2002-safe +attempt retry.
// (createInvoice's generator is private + auth-gated; replicate the format.)
// ------------------------------------------------------------
async function generatePublicInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });
    let next = 1;
    if (last) {
      const n = parseInt(last.invoiceNumber.split("-").pop() || "0", 10);
      next = n + 1;
    }
    const number = `${prefix}${String(next + attempt).padStart(4, "0")}`;
    const existing = await prisma.invoice.findFirst({ where: { invoiceNumber: number } });
    if (!existing) return number;
  }
  return `INV-${Date.now()}`;
}

/** Format a @db.Date (read back as UTC-midnight) to YYYY-MM-DD without TZ drift. */
function formatUTCDateISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
