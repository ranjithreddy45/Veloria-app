"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { utcDayRange } from "@/lib/sales/slot-util";
import { revalidatePath } from "next/cache";
import { bookingSchema, type BookingInput } from "@/schemas/booking.schema";
import type { BookingStatus, TimeSlot } from "@prisma/client";
import { serialize, formatINR } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { bookingConfirmationEmail } from "@/lib/email-templates/booking-confirmation";
import { triggerWorkflows } from "@/lib/workflow-executor";
import { requestApprovalIfNeeded } from "@/lib/approval-engine";
import { awardVelos } from "@/lib/velos/award";
import { after } from "next/server";
import { format } from "date-fns";

// ============================================================
// Helper: Generate Booking Number (VG-YYYY-NNNN)
// ============================================================

export async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VG-${year}-`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const lastBooking = await prisma.booking.findFirst({
      where: { bookingNumber: { startsWith: prefix } },
      orderBy: { bookingNumber: "desc" },
      select: { bookingNumber: true },
    });

    let nextNumber = 1;
    if (lastBooking) {
      const lastNum = parseInt(lastBooking.bookingNumber.split("-").pop() || "0", 10);
      nextNumber = lastNum + 1;
    }

    const number = `${prefix}${String(nextNumber + attempt).padStart(4, "0")}`;

    // Check uniqueness to avoid TOCTOU race condition
    const existing = await prisma.booking.findFirst({
      where: { bookingNumber: number },
    });

    if (!existing) return number;
  }

  // Fallback: use timestamp-based unique number
  return `VG-${Date.now()}`;
}

// formatINR is in @/lib/utils

// ============================================================
// Helper: UTC day range for @db.Date conflict matching
// ============================================================
//
// `Booking.date`/`BlackoutDate.date` are `@db.Date`, which Prisma reads back as
// UTC-midnight regardless of how the row was written. Matching with a local-
// midnight Date via exact equality (`where: { date }`) is brittle across
// timezones — on a non-UTC server it can target the wrong calendar day and
// either miss an existing booking (double-book) or block a free slot. Scan the
// full UTC day instead, identical to availability.actions getAvailabilityGrid.
// ============================================================
// Get Bookings (Paginated + Filtered)
// ============================================================

export async function getBookings(params?: {
  search?: string;
  status?: BookingStatus;
  venueId?: string;
  month?: number;
  year?: number;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { bookingNumber: { contains: search, mode: "insensitive" } },
        { eventName: { contains: search, mode: "insensitive" } },
        {
          contact: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    if (params?.month && params?.year) {
      const startDate = new Date(params.year, params.month - 1, 1);
      const endDate = new Date(params.year, params.month, 0);
      where.date = { gte: startDate, lte: endDate };
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          venue: { select: { id: true, name: true } },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    // Derived display flag: a HOLD/TENTATIVE whose event date has already
    // passed is effectively a dead hold. We never mutate the stored status —
    // this is a read-only hint the UI can surface as "Hold — expired".
    // Compare on the UTC calendar day to match how @db.Date is stored
    // (local midnight drifts the day on a non-UTC server).
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const serialized = serialize(bookings).map((b) => ({
      ...b,
      isExpiredHold:
        (b.status === "HOLD" || b.status === "TENTATIVE") &&
        new Date(b.date) < todayStart,
    }));

    return {
      success: true as const,
      data: {
        data: serialized,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_BOOKINGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch bookings" };
  }
}

// ============================================================
// Get Booking Stats (DB-wide, not capped by a row slice)
// ============================================================
//
// Headline KPI tiles must reflect every booking, not just the first N rows the
// list page loads. Aggregate/count directly in the DB so the numbers stay
// correct past the page's row ceiling.

export async function getBookingStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const confirmedRevenueStatuses: BookingStatus[] = [
      "CONFIRMED",
      "IN_PROGRESS",
      "COMPLETED",
    ];
    const pipelineStatuses: BookingStatus[] = ["HOLD", "TENTATIVE"];

    const [
      total,
      confirmedCount,
      pendingCount,
      thisMonthCount,
      confirmedRevenueAgg,
      holdsValueAgg,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "CONFIRMED" } }),
      prisma.booking.count({ where: { status: { in: pipelineStatuses } } }),
      prisma.booking.count({
        where: {
          date: { gte: monthStart, lt: nextMonthStart },
          status: { not: "CANCELLED" },
        },
      }),
      prisma.booking.aggregate({
        where: { status: { in: confirmedRevenueStatuses } },
        _sum: { totalAmount: true },
      }),
      prisma.booking.aggregate({
        where: { status: { in: pipelineStatuses } },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      success: true as const,
      data: {
        total,
        confirmedCount,
        pendingCount,
        thisMonthCount,
        // Decimal → Number for the client.
        confirmedRevenue: Number(confirmedRevenueAgg._sum.totalAmount ?? 0),
        holdsValue: Number(holdsValueAgg._sum.totalAmount ?? 0),
      },
    };
  } catch (error) {
    console.error("[GET_BOOKING_STATS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch booking stats" };
  }
}

// ============================================================
// Get Single Booking
// ============================================================

export async function getBooking(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        venue: true,
        contact: true,
        createdBy: { select: { id: true, name: true, email: true } },
        invoices: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            balanceDue: true,
            issueDate: true,
            dueDate: true,
          },
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            assignee: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[GET_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to fetch booking" };
  }
}

// ============================================================
// Check Availability
// ============================================================

export async function checkAvailability(
  venueId: string,
  date: Date,
  timeSlot: TimeSlot
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Match by UTC day range (not local-midnight equality) — see utcDayRange.
    const { gte, lt, utcDay } = utcDayRange(new Date(date));

    // Check for existing booking
    const existingBookings = await prisma.booking.findMany({
      where: {
        venueId,
        date: { gte, lt },
        status: { notIn: ["CANCELLED"] },
        OR: [
          { timeSlot },
          // FULL_DAY conflicts with everything
          { timeSlot: "FULL_DAY" },
          // Any slot conflicts with FULL_DAY
          ...(timeSlot === "FULL_DAY"
            ? [
                { timeSlot: "MORNING" as TimeSlot },
                { timeSlot: "AFTERNOON" as TimeSlot },
                { timeSlot: "EVENING" as TimeSlot },
              ]
            : []),
        ],
      },
      select: { id: true, bookingNumber: true, eventName: true, timeSlot: true, date: true },
    });
    const existingBooking = existingBookings.find(
      (b) => new Date(b.date).getUTCDate() === utcDay
    );

    // Check for blackout dates
    const blackouts = await prisma.blackoutDate.findMany({
      where: {
        venueId,
        date: { gte, lt },
        OR: [
          { timeSlot: null }, // Full day blackout
          { timeSlot }, // Specific slot blackout
          ...(timeSlot === "FULL_DAY"
            ? [
                { timeSlot: "MORNING" as TimeSlot },
                { timeSlot: "AFTERNOON" as TimeSlot },
                { timeSlot: "EVENING" as TimeSlot },
              ]
            : []),
        ],
      },
      select: { date: true, reason: true },
    });
    const blackout = blackouts.find((b) => new Date(b.date).getUTCDate() === utcDay);

    if (blackout) {
      return {
        success: true as const,
        data: {
          available: false,
          reason: `Venue is blacked out: ${blackout.reason || "No reason specified"}`,
        },
      };
    }

    if (existingBooking) {
      return {
        success: true as const,
        data: {
          available: false,
          reason: `Slot taken by ${existingBooking.bookingNumber} - ${existingBooking.eventName}`,
        },
      };
    }

    return {
      success: true as const,
      data: { available: true, reason: null },
    };
  } catch (error) {
    console.error("[CHECK_AVAILABILITY_ERROR]", error);
    return { success: false as const, error: "Failed to check availability" };
  }
}

// ============================================================
// Create Booking
// ============================================================

export async function createBooking(data: BookingInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bookingSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const bookingData = parsed.data;

    // Fast pre-check for a friendly message (not authoritative on its own).
    const availability = await checkAvailability(
      bookingData.venueId,
      bookingData.date,
      bookingData.timeSlot as TimeSlot
    );

    if (availability.success && availability.data && !availability.data.available) {
      return {
        success: false as const,
        error: availability.data.reason || "Slot is not available",
      };
    }

    const bookingNumber = await generateBookingNumber();

    // Pin to UTC midnight of the input's UTC calendar day so the stored
    // @db.Date day and the conflict scan agree on any server timezone (a local
    // setHours(0,0,0,0) shifts the day on non-UTC hosts → missed conflicts).
    const srcDate = new Date(bookingData.date);
    const bookingDate = new Date(
      Date.UTC(srcDate.getUTCFullYear(), srcDate.getUTCMonth(), srcDate.getUTCDate())
    );
    // UTC day window for the @db.Date conflict scan (see utcDayRange).
    const { gte: dayGte, lt: dayLt, utcDay: bookingUTCDay } = utcDayRange(bookingDate);

    // Slot-conflict OR covering the cross-slot overlap the @@unique constraint
    // can't express: requested slot taken, OR an existing FULL_DAY blocks any
    // slot, OR a requested FULL_DAY conflicts with any partial slot.
    const reqSlot = bookingData.timeSlot as TimeSlot;
    const conflictOr =
      reqSlot === "FULL_DAY"
        ? [
            { timeSlot: "FULL_DAY" as TimeSlot },
            { timeSlot: "MORNING" as TimeSlot },
            { timeSlot: "AFTERNOON" as TimeSlot },
            { timeSlot: "EVENING" as TimeSlot },
          ]
        : [{ timeSlot: reqSlot }, { timeSlot: "FULL_DAY" as TimeSlot }];

    // Re-check + insert ATOMICALLY under Serializable isolation so two
    // concurrent blocks for overlapping slots (e.g. EVENING + FULL_DAY) can't
    // both succeed. The loser aborts with a serialization error → "slot taken".
    let booking;
    try {
      booking = await prisma.$transaction(
        async (tx) => {
          const clashes = await tx.booking.findMany({
            where: { venueId: bookingData.venueId, date: { gte: dayGte, lt: dayLt }, status: { notIn: ["CANCELLED"] }, OR: conflictOr },
            select: { id: true, date: true },
          });
          if (clashes.some((c) => new Date(c.date).getUTCDate() === bookingUTCDay)) throw new Error("SLOT_TAKEN");
          return tx.booking.create({
            data: {
              bookingNumber,
              eventName: bookingData.eventName,
              eventType: bookingData.eventType,
              date: bookingDate,
              timeSlot: reqSlot,
              guestCount: bookingData.guestCount,
              totalAmount: bookingData.totalAmount,
              hallBooked: bookingData.hallBooked || null,
              startTime: bookingData.eventStart ?? null,
              endTime: bookingData.eventEnd ?? null,
              perPlatePrice: bookingData.perPlatePrice ?? null,
              hallRental: bookingData.hallRental ?? null,
              decorCharges: bookingData.decorCharges ?? null,
              otherServices: bookingData.otherServices ?? null,
              specialRequests: bookingData.specialRequests || null,
              internalNotes: bookingData.internalNotes || null,
              venueId: bookingData.venueId,
              contactId: bookingData.contactId,
              createdById: session.user.id,
              status: "HOLD",
            },
            include: {
              venue: { select: { id: true, name: true } },
              contact: { select: { id: true, firstName: true, lastName: true } },
            },
          });
        },
        { isolationLevel: "Serializable" }
      );
    } catch (e) {
      const code = (e as { code?: string }).code;
      // SLOT_TAKEN (our guard), P2002 (unique violation), or 40001 (serialization failure).
      if ((e instanceof Error && e.message === "SLOT_TAKEN") || code === "P2002" || code === "P2034") {
        return { success: false as const, error: "That slot was just taken — please pick another." };
      }
      throw e;
    }

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Booking",
      entityId: booking.id,
    });

    // Fire-and-forget: Notify user
    notify({
      userId: session.user.id as string,
      type: "BOOKING_CREATED",
      title: "Booking Created",
      message: `Booking ${booking.bookingNumber} for ${booking.contact.firstName} ${booking.contact.lastName} has been created.`,
      actionUrl: `/bookings/${booking.id}`,
    });

    // Fire-and-forget: Send booking email.
    // A freshly-created booking is on HOLD (unpaid). Sending the hard
    // "Booking Confirmed" email here would falsely tell the customer their
    // slot is locked before any advance has cleared — and would duplicate the
    // confirmation that maybeConfirmBookingOnPayment sends once the advance
    // lands. So only send the confirmation template when the booking is
    // actually CONFIRMED; otherwise send a tentative "hold / pending advance"
    // notice. maybeConfirmBookingOnPayment owns the real confirmation.
    if (booking.contact) {
      const contactEmail = await prisma.contact.findUnique({
        where: { id: bookingData.contactId },
        select: { email: true },
      });

      if (contactEmail?.email) {
        const venueForEmail = await prisma.venue.findUnique({
          where: { id: bookingData.venueId },
          select: { name: true },
        });

        const contactName = `${booking.contact.firstName} ${booking.contact.lastName}`;
        const venueName = venueForEmail?.name || "Venue";

        if (booking.status === "CONFIRMED") {
          sendEmail({
            to: contactEmail.email,
            subject: `Booking Confirmed — ${booking.bookingNumber}`,
            html: bookingConfirmationEmail({
              contactName,
              bookingNumber: booking.bookingNumber,
              eventName: bookingData.eventName,
              eventType: bookingData.eventType,
              date: format(bookingDate, "dd MMM yyyy"),
              timeSlot: bookingData.timeSlot,
              venueName,
              guestCount: bookingData.guestCount,
              totalAmount: formatINR(bookingData.totalAmount),
              specialRequests: bookingData.specialRequests,
            }),
          }).catch((err) => console.error("[BOOKING_EMAIL_ERROR]", err));
        } else {
          // Tentative HOLD notice — explicitly NOT a confirmation.
          sendEmail({
            to: contactEmail.email,
            subject: `Booking Received (Pending Advance) — ${booking.bookingNumber}`,
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#18181b;">
  <h2 style="font-size:20px;font-weight:600;margin:0 0 8px;">We've received your booking request</h2>
  <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 16px;">
    Dear ${contactName},<br/>
    Your booking <strong>${booking.bookingNumber}</strong> for <strong>${bookingData.eventName}</strong> on <strong>${format(bookingDate, "dd MMM yyyy")}</strong> at <strong>${venueName}</strong> is currently on a tentative hold.
  </p>
  <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 16px;">
    The slot is <strong>not yet confirmed</strong>. To lock it in your name, please pay the advance. We'll send a confirmation as soon as your advance clears.
  </p>
  <p style="color:#a1a1aa;font-size:12px;margin:16px 0 0;">This is an automated message. Please do not reply directly.</p>
</div>`,
          }).catch((err) => console.error("[BOOKING_HOLD_EMAIL_ERROR]", err));
        }
      }
    }

    // Fire EVENT_CREATED workflows; also BOOKING_CONFIRMED if the booking
    // was created already in CONFIRMED state. `after()` keeps the function
    // alive on Vercel until the async work finishes.
    after(async () => {
      try {
        await triggerWorkflows("EVENT_CREATED", {
          bookingId: booking.id,
          contactId: booking.contactId,
          triggeredByUserId: session.user.id as string,
        });
        if (booking.status === "CONFIRMED") {
          await triggerWorkflows("BOOKING_CONFIRMED", {
            bookingId: booking.id,
            contactId: booking.contactId,
            triggeredByUserId: session.user.id as string,
          });
        }
      } catch (e) {
        console.error("[TRIGGER_WORKFLOWS_ERROR]", e);
      }

      // Raise an approval request for managerial oversight if this booking
      // matches an active rule (e.g. value over a threshold). Non-blocking:
      // the booking already exists in HOLD; this surfaces it for review.
      try {
        await requestApprovalIfNeeded(
          "BOOKING",
          booking.id,
          session.user.id as string
        );
      } catch (e) {
        console.error("[BOOKING_APPROVAL_ERROR]", e);
      }
    });

    revalidatePath("/bookings");
    revalidatePath("/bookings/calendar");
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[CREATE_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to create booking" };
  }
}

// ============================================================
// Update Booking
// ============================================================

export async function updateBooking(id: string, data: BookingInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bookingSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Booking not found" };
    }

    // A cancelled or completed booking is terminal — editing it could silently
    // re-activate it and re-occupy a slot that's since been freed/rebooked.
    if (existing.status === "CANCELLED") {
      return { success: false as const, error: "Cannot edit a cancelled booking" };
    }
    if (existing.status === "COMPLETED") {
      return { success: false as const, error: "Cannot edit a completed booking" };
    }

    const bookingData = parsed.data;
    // Pin to UTC midnight of the input's UTC calendar day so the comparison
    // against the stored @db.Date and the conflict scan agree on any server tz.
    const srcDate = new Date(bookingData.date);
    const bookingDate = new Date(
      Date.UTC(srcDate.getUTCFullYear(), srcDate.getUTCMonth(), srcDate.getUTCDate())
    );

    // Re-check availability if venue, date, or slot changed
    const dateChanged =
      existing.date.getTime() !== bookingDate.getTime() ||
      existing.venueId !== bookingData.venueId ||
      existing.timeSlot !== bookingData.timeSlot;

    if (dateChanged) {
      // Match by UTC day range (not local-midnight equality) — see utcDayRange.
      const { gte, lt, utcDay } = utcDayRange(bookingDate);

      // Check for conflicts excluding the current booking
      const conflicts = await prisma.booking.findMany({
        where: {
          id: { not: id },
          venueId: bookingData.venueId,
          date: { gte, lt },
          status: { notIn: ["CANCELLED"] },
          OR: [
            { timeSlot: bookingData.timeSlot as TimeSlot },
            { timeSlot: "FULL_DAY" },
            ...(bookingData.timeSlot === "FULL_DAY"
              ? [
                  { timeSlot: "MORNING" as TimeSlot },
                  { timeSlot: "AFTERNOON" as TimeSlot },
                  { timeSlot: "EVENING" as TimeSlot },
                ]
              : []),
          ],
        },
        select: { id: true, date: true },
      });
      const conflict = conflicts.some((c) => new Date(c.date).getUTCDate() === utcDay);

      if (conflict) {
        return {
          success: false as const,
          error: "The selected venue, date, and time slot is no longer available",
        };
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        eventName: bookingData.eventName,
        eventType: bookingData.eventType,
        date: bookingDate,
        timeSlot: bookingData.timeSlot as TimeSlot,
        guestCount: bookingData.guestCount,
        totalAmount: bookingData.totalAmount,
        hallBooked: bookingData.hallBooked || null,
        startTime: bookingData.eventStart ?? null,
        endTime: bookingData.eventEnd ?? null,
        perPlatePrice: bookingData.perPlatePrice ?? null,
        hallRental: bookingData.hallRental ?? null,
        decorCharges: bookingData.decorCharges ?? null,
        otherServices: bookingData.otherServices ?? null,
        specialRequests: bookingData.specialRequests || null,
        internalNotes: bookingData.internalNotes || null,
        venueId: bookingData.venueId,
        contactId: bookingData.contactId,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Booking",
      entityId: booking.id,
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);
    revalidatePath("/bookings/calendar");
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[UPDATE_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to update booking" };
  }
}

// ============================================================
// Complete Booking — quality gate (poka-yoke) + Velos defect-free award
// ------------------------------------------------------------
// The controlled close-out transition. A booking cannot be marked COMPLETED
// until it is genuinely "clean": final payment cleared, the Function Sheet
// (BEO) published, guest count set, and the event date has passed. SUPER_ADMIN
// may override (recorded). A defect-free completion (no override, all checks
// met) awards Velos points to the owning rep — quality becomes rewarded.
// ============================================================

const VELOS_DEFECT_FREE_POINTS = 50;

export interface CompleteBookingResult {
  success: boolean;
  error?: string;
  /** When blocked by the quality gate, the list of unmet checks. */
  gate?: string[];
  defectFree?: boolean;
  pointsAwarded?: number;
}

export async function completeBooking(
  id: string,
  opts?: { override?: boolean }
): Promise<CompleteBookingResult> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!hasPermission(session.user.role, "bookings:update")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        bookingNumber: true,
        eventName: true,
        guestCount: true,
        date: true,
        createdById: true,
        invoices: { select: { balanceDue: true } },
        tasks: { select: { status: true, dueDate: true } },
      },
    });
    if (!booking) return { success: false, error: "Booking not found" };

    // BEO is one-to-many on the booking (no singular relation) — fetch the latest.
    const beo = await prisma.beo.findFirst({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });
    if (booking.status === "COMPLETED") {
      return { success: false, error: "Booking is already completed" };
    }
    if (!["CONFIRMED", "IN_PROGRESS"].includes(booking.status)) {
      return {
        success: false,
        error: "Only a confirmed or in-progress booking can be completed",
      };
    }

    // ---- Quality gate (poka-yoke) ----
    const now = new Date();
    // End of the stored UTC calendar day (booking.date is @db.Date UTC-midnight);
    // setUTCHours keeps the completion gate correct on a non-UTC server.
    const eventEnd = new Date(booking.date);
    eventEnd.setUTCHours(23, 59, 59, 999);

    const gate: string[] = [];
    const balanceOwed = booking.invoices.some((i) => Number(i.balanceDue) > 0);
    if (balanceOwed) gate.push("Final payment not cleared (balance still due)");
    const beoReady = beo && ["PUBLISHED", "LOCKED"].includes(beo.status);
    if (!beoReady) gate.push("Function sheet (BEO) not published");
    if (!booking.guestCount || booking.guestCount <= 0) gate.push("Guest count not set");
    if (eventEnd > now) gate.push("Event date hasn't passed yet");

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const override = !!opts?.override && isSuperAdmin;

    if (gate.length > 0 && !override) {
      return { success: false, gate };
    }

    // ---- Atomic, once-only transition ----
    const done = await prisma.booking.updateMany({
      where: { id, status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
      data: { status: "COMPLETED" },
    });
    if (done.count === 0) {
      return { success: false, error: "Booking could not be completed (status changed)" };
    }

    await logActivity({
      userId: session.user.id as string,
      action: override ? "completed (gate overridden)" : "completed",
      entityType: "Booking",
      entityId: id,
    });

    // ---- Velos: reward a genuinely defect-free event ----
    // Defect-free = passed every gate without override AND no overdue/incomplete
    // tasks lingering. Idempotent via the entity+event key (one award per booking).
    const hasOverdueTask = booking.tasks.some(
      (t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < now
    );
    const defectFree = gate.length === 0 && !override && !hasOverdueTask;
    let pointsAwarded = 0;
    if (defectFree && booking.createdById) {
      try {
        const r = await awardVelos(prisma, {
          userId: booking.createdById,
          eventType: "quality_defect_free_event",
          entityType: "quality",
          entityId: id,
          pointsOverride: VELOS_DEFECT_FREE_POINTS,
          note: `Defect-free event · ${booking.bookingNumber}`,
        });
        if (r.awarded) pointsAwarded = r.points;
      } catch (e) {
        console.error("[COMPLETE_BOOKING_VELOS_ERROR]", e);
      }
    }

    if (booking.createdById) {
      notify({
        userId: booking.createdById,
        type: "BOOKING_CREATED",
        title: defectFree ? "Event completed — defect-free! 🎉" : "Event completed",
        message: defectFree
          ? `${booking.bookingNumber} (${booking.eventName}) closed clean. +${pointsAwarded} Velos.`
          : `${booking.bookingNumber} (${booking.eventName}) marked completed.`,
        actionUrl: `/bookings/${id}`,
      });
    }

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);
    revalidatePath("/quality");
    return { success: true, defectFree, pointsAwarded };
  } catch (error) {
    console.error("[COMPLETE_BOOKING_ERROR]", error);
    return { success: false, error: "Failed to complete booking" };
  }
}

// ============================================================
// Cancel Booking
// ============================================================

export async function cancelBooking(id: string, reason?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:cancel")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Booking not found" };
    }

    if (existing.status === "CANCELLED") {
      return { success: false as const, error: "Booking is already cancelled" };
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        internalNotes: reason
          ? `${existing.internalNotes ? existing.internalNotes + "\n" : ""}Cancellation reason: ${reason}`
          : existing.internalNotes,
      },
    });

    // Release the slot on the sales side: unlink any quotation that booked this
    // slot so it can re-block the (now free) slot. Without this the quotation's
    // bookingId guard rejects re-blocking with "already has a booked slot".
    await prisma.salesQuotation
      .updateMany({ where: { bookingId: id }, data: { bookingId: null, slotBlockedAt: null } })
      .catch((e) => console.error("[CANCEL_UNLINK_QUOTATION_ERROR]", e));

    notify({
      userId: session.user.id as string,
      type: "BOOKING_CANCELLED",
      title: "Booking Cancelled",
      message: `Booking ${existing.bookingNumber} has been cancelled.`,
      actionUrl: `/bookings/${id}`,
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);
    revalidatePath("/bookings/calendar");
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[CANCEL_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to cancel booking" };
  }
}

// ============================================================
// Place Hold
// ============================================================

export async function placeHold(bookingId: string, expiresInHours: number = 48) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existing) {
      return { success: false as const, error: "Booking not found" };
    }

    // Only a tentative/held booking can be placed (or refreshed) on hold.
    // A CONFIRMED / IN_PROGRESS / COMPLETED / CANCELLED booking must not be
    // silently reverted to HOLD (which would re-enter the hold pool and
    // appear as an expired hold despite a paid/locked event).
    if (existing.status !== "HOLD" && existing.status !== "TENTATIVE") {
      return { success: false as const, error: "Only a tentative/held booking can be placed on hold" };
    }

    const holdExpiresAt = new Date();
    holdExpiresAt.setHours(holdExpiresAt.getHours() + expiresInHours);

    // Conditional write: re-check the status at the DB level to avoid a race
    // with maybeConfirmBookingOnPayment / completeBooking flipping the status.
    const updated = await prisma.booking.updateMany({
      where: { id: bookingId, status: { in: ["HOLD", "TENTATIVE"] } },
      data: {
        status: "HOLD",
        holdExpiresAt,
      },
    });
    if (updated.count === 0) {
      return { success: false as const, error: "Only a tentative/held booking can be placed on hold" };
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[PLACE_HOLD_ERROR]", error);
    return { success: false as const, error: "Failed to place hold" };
  }
}

// ============================================================
// Release Hold
// ============================================================

export async function releaseHold(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:cancel")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existing) {
      return { success: false as const, error: "Booking not found" };
    }

    // Only a HOLD can be released. Releasing a CONFIRMED/COMPLETED/etc. booking
    // here would silently cancel a live booking.
    if (existing.status !== "HOLD") {
      return { success: false as const, error: "Only a booking on hold can be released" };
    }

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        holdExpiresAt: null,
      },
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/bookings/calendar");
    return { success: true as const, data: serialize(booking) };
  } catch (error) {
    console.error("[RELEASE_HOLD_ERROR]", error);
    return { success: false as const, error: "Failed to release hold" };
  }
}

// ============================================================
// Get Bookings for Calendar
// ============================================================

export async function getBookingsForCalendar(
  month: number,
  year: number,
  venueId?: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const bookings = await prisma.booking.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        // Exclude cancelled bookings to match the grid/heatmap occupancy view.
        status: { not: "CANCELLED" },
        ...(venueId ? { venueId } : {}),
      },
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        eventType: true,
        status: true,
        date: true,
        timeSlot: true,
        guestCount: true,
        venue: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    });

    return { success: true as const, data: serialize(bookings) };
  } catch (error) {
    console.error("[GET_BOOKINGS_CALENDAR_ERROR]", error);
    return { success: false as const, error: "Failed to fetch calendar bookings" };
  }
}

// ============================================================
// Get Leads for Calendar (enquiries with an event date in the month)
// ------------------------------------------------------------
// Lets the calendar show which dates already have ENQUIRIES (leads), distinct
// from dates that are already BOOKED — optionally scoped to one venue via the
// lead's preferred venue. Open leads only (won leads become bookings).
// ============================================================

export async function getLeadsForCalendar(
  month: number,
  year: number,
  venueId?: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const leads = await prisma.lead.findMany({
      where: {
        eventDate: { gte: startDate, lte: endDate },
        deletedAt: null,
        // Open enquiries only — WON leads have converted to bookings, LOST are dead.
        status: { notIn: ["WON", "LOST"] },
        ...(venueId ? { preferredVenueId: venueId } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        eventType: true,
        eventDate: true,
        slot: true,
        guestCount: true,
        contact: { select: { firstName: true, lastName: true, company: true } },
        preferredVenue: { select: { id: true, name: true } },
      },
      orderBy: { eventDate: "asc" },
    });

    return { success: true as const, data: serialize(leads) };
  } catch (error) {
    console.error("[GET_LEADS_CALENDAR_ERROR]", error);
    return { success: false as const, error: "Failed to fetch calendar leads" };
  }
}

// ============================================================
// Venue CRUD
// ============================================================

export async function getVenues() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const venues = await prisma.venue.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { bookings: true } },
      },
    });

    return { success: true as const, data: serialize(venues) };
  } catch (error) {
    console.error("[GET_VENUES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch venues" };
  }
}

export async function createVenue(data: {
  name: string;
  description?: string;
  capacity: number;
  pricePerSlot: number;
  amenities?: string[];
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:venues")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const venue = await prisma.venue.create({
      data: {
        name: data.name,
        description: data.description || null,
        capacity: data.capacity,
        pricePerSlot: data.pricePerSlot,
        amenities: data.amenities || [],
      },
    });

    revalidatePath("/settings/venues");
    revalidatePath("/bookings/new");
    return { success: true as const, data: serialize(venue) };
  } catch (error) {
    console.error("[CREATE_VENUE_ERROR]", error);
    return { success: false as const, error: "Failed to create venue" };
  }
}

export async function updateVenue(
  id: string,
  data: {
    name?: string;
    description?: string;
    capacity?: number;
    pricePerSlot?: number;
    amenities?: string[];
    isActive?: boolean;
  }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:venues")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const venue = await prisma.venue.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description || null,
        }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.pricePerSlot !== undefined && {
          pricePerSlot: data.pricePerSlot,
        }),
        ...(data.amenities !== undefined && { amenities: data.amenities }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    revalidatePath("/settings/venues");
    return { success: true as const, data: serialize(venue) };
  } catch (error) {
    console.error("[UPDATE_VENUE_ERROR]", error);
    return { success: false as const, error: "Failed to update venue" };
  }
}

// ============================================================
// Blackout Date CRUD
// ============================================================

export async function getBlackoutDates(params?: {
  venueId?: string;
  month?: number;
  year?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "bookings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    if (params?.month && params?.year) {
      const startDate = new Date(params.year, params.month - 1, 1);
      const endDate = new Date(params.year, params.month, 0);
      where.date = { gte: startDate, lte: endDate };
    }

    const blackoutDates = await prisma.blackoutDate.findMany({
      where,
      include: {
        venue: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    });

    return { success: true as const, data: serialize(blackoutDates) };
  } catch (error) {
    console.error("[GET_BLACKOUT_DATES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch blackout dates" };
  }
}

export async function createBlackoutDate(data: {
  venueId: string;
  date: Date;
  timeSlot?: TimeSlot | null;
  reason?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:venues")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Pin to UTC midnight of the input's UTC calendar day so the stored
    // @db.Date day agrees with the availability scans (getUTCDate-bucketed) on
    // any server timezone (a local setHours(0,0,0,0) shifts the day on non-UTC
    // hosts → blackout lands on the wrong day). Mirrors createBooking.
    const srcBlackout = new Date(data.date);
    const blackoutDate = new Date(
      Date.UTC(srcBlackout.getUTCFullYear(), srcBlackout.getUTCMonth(), srcBlackout.getUTCDate())
    );

    const blackout = await prisma.blackoutDate.create({
      data: {
        venueId: data.venueId,
        date: blackoutDate,
        timeSlot: data.timeSlot || null,
        reason: data.reason || null,
      },
    });

    revalidatePath("/bookings/calendar");
    revalidatePath("/settings/venues");
    return { success: true as const, data: serialize(blackout) };
  } catch (error) {
    console.error("[CREATE_BLACKOUT_DATE_ERROR]", error);
    return { success: false as const, error: "Failed to create blackout date" };
  }
}

export async function deleteBlackoutDate(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "settings:venues")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await prisma.blackoutDate.delete({ where: { id } });

    revalidatePath("/bookings/calendar");
    revalidatePath("/settings/venues");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_BLACKOUT_DATE_ERROR]", error);
    return { success: false as const, error: "Failed to delete blackout date" };
  }
}
