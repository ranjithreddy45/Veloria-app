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
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma, type TimeSlot } from "@prisma/client";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { notify } from "@/lib/notify";
// captureLeadFromExternal: mint CRM follow-up lead. getSystemUserId: first
// active SUPER_ADMIN/ADMIN, used as createdById for the public (no-login) flow.
import { captureLeadFromExternal, getSystemUserId } from "@/lib/lead-capture";
// Pure re-exports requested centrally (sharedEditsNeeded): identical UTC-day
// math + booking-number allocation as the internal engine — do NOT fork.
import { generateBookingNumber } from "@/actions/booking.actions";
import { utcDayRange } from "@/lib/sales/slot-util";
import { SLOT_LABEL } from "@/lib/sales/slot";
import { publicHoldSchema, type PublicHoldInput } from "@/schemas/public-hold.schema";

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

    const [venues, bookings, blackouts] = await Promise.all([
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
        // PUBLIC-SAFE projection: occupancy only, no labels/identities.
        select: { venueId: true, date: true, timeSlot: true },
      }),
      prisma.blackoutDate.findMany({
        where: { date: { gte: start, lte: end }, ...(venueId ? { venueId } : {}) },
        select: { venueId: true, date: true, timeSlot: true },
      }),
    ]);

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
        // PUBLIC-SAFE: timeSlot occupancy only.
        select: { venueId: true, date: true, timeSlot: true },
      }),
      prisma.blackoutDate.findMany({
        where: { date: { gte: dayStart, lte: dayEnd }, ...(venueId ? { venueId } : {}) },
        // Deliberately NOT selecting `reason` — public never sees blackout reasons.
        select: { venueId: true, date: true, timeSlot: true },
      }),
    ]);

    const bookings = allBookings.filter((b) => new Date(b.date).getUTCDate() === targetUTCDay);
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

  const partialSlots: TimeSlot[] = ["MORNING", "AFTERNOON", "EVENING"];
  const bookingOr =
    timeSlot === "FULL_DAY"
      ? [{ timeSlot: "FULL_DAY" as TimeSlot }, ...partialSlots.map((s) => ({ timeSlot: s }))]
      : [{ timeSlot }, { timeSlot: "FULL_DAY" as TimeSlot }];

  const bookings = await prisma.booking.findMany({
    where: { venueId, date: { gte, lt }, status: { notIn: ["CANCELLED"] }, OR: bookingOr },
    select: { date: true },
  });
  if (bookings.some((b) => new Date(b.date).getUTCDate() === utcDay)) return false;

  const blackoutOr =
    timeSlot === "FULL_DAY"
      ? [{ timeSlot: null }, ...partialSlots.map((s) => ({ timeSlot: s }))]
      : [{ timeSlot: null }, { timeSlot }];

  const blackouts = await prisma.blackoutDate.findMany({
    where: { venueId, date: { gte, lt }, OR: blackoutOr },
    select: { date: true },
  });
  if (blackouts.some((b) => new Date(b.date).getUTCDate() === utcDay)) return false;

  return true;
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

export async function createPublicHold(
  input: PublicHoldInput
): Promise<Result<CreatePublicHoldResult>> {
  // (a) Validate untrusted public input.
  const parsed = publicHoldSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, error: first || "Please check the form and try again." };
  }
  const data = parsed.data;

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
          tags: ["website", "public-hold"],
        },
        select: { id: true },
      });
      contactId = created.id;
      mintedContactId = created.id;
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
              internalNotes: "Public online date hold (/(public)/hold)",
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
      title: "New online date hold",
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
  expiresAt: string | null;
  paid: boolean;
  /** true while the slot is held and payable */
  active: boolean;
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

    // Reflect live payment state: if the linked Invoice is PAID, the hold is paid
    // (and its booking has likely auto-confirmed) even if the row says SLOT_CLAIMED.
    let paid = !!hold.paidAt || hold.status === "PAID" || hold.status === "CONFIRMED";
    let effectiveStatus = hold.status;
    if (!paid && hold.invoiceId) {
      const inv = await prisma.invoice.findUnique({
        where: { id: hold.invoiceId },
        select: { status: true, balanceDue: true },
      });
      if (inv && (inv.status === "PAID" || Number(inv.balanceDue) <= 0)) {
        paid = true;
        effectiveStatus = "PAID";
      }
    }

    // Reflect expiry / cancellation from the booking if the cron hasn't flipped
    // the row yet (read-only — don't mutate here).
    if (!paid && (effectiveStatus === "INITIATED" || effectiveStatus === "SLOT_CLAIMED")) {
      if (hold.expiresAt && hold.expiresAt.getTime() < Date.now()) {
        effectiveStatus = "EXPIRED";
      } else if (hold.bookingId) {
        const bk = await prisma.booking.findUnique({
          where: { id: hold.bookingId },
          select: { status: true },
        });
        if (bk && bk.status === "CANCELLED") effectiveStatus = "EXPIRED";
      }
    }

    const dateISO = formatUTCDateISO(hold.date);
    const active =
      !paid &&
      (effectiveStatus === "INITIATED" || effectiveStatus === "SLOT_CLAIMED");

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
        expiresAt: hold.expiresAt ? hold.expiresAt.toISOString() : null,
        paid,
        active,
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
    if (hold.invoiceId) {
      const inv = await prisma.invoice.findUnique({
        where: { id: hold.invoiceId },
        select: { status: true, balanceDue: true },
      });
      if (inv && (inv.status === "PAID" || Number(inv.balanceDue) <= 0)) {
        return { success: false, error: "This hold is already paid." };
      }
    }

    // Atomic, idempotent guards: flip the PublicHold only if still claimable, and
    // cancel the Booking only if still HOLD (so it stops blocking the slot).
    const flipped = await prisma.publicHold.updateMany({
      where: { id: hold.id, status: { in: ["INITIATED", "SLOT_CLAIMED"] }, paidAt: null },
      data: { status: "RELEASED" },
    });
    if (flipped.count === 0) {
      return { success: false, error: "This hold can no longer be released." };
    }
    if (hold.bookingId) {
      await prisma.booking.updateMany({
        where: { id: hold.bookingId, status: "HOLD" },
        data: { status: "CANCELLED" },
      });
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
