"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";

import { serialize } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Corporate Account — event history (account-360 timeline)
// ============================================================
// Read-only. Resolves the account's Contact → Booking history and splits it
// into past (active, before today) and upcoming (held/progressing, today+).
// Internal route only — no leak concerns. Money (totalAmount) is serialized.

type Result<T> = { success: true; data: T } | { success: false; error: string };

const PAST_STATUSES = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;
const UPCOMING_STATUSES = ["HOLD", "CONFIRMED", "IN_PROGRESS"] as const;

/** UTC midnight today — Booking.date is @db.Date (day granularity). */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getAccountEvents(
  accountId: string
): Promise<Result<{ past: unknown[]; upcoming: unknown[] }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role ?? "", "accounts:read")) {
    return { success: false, error: "Insufficient permissions" };
  }

  const account = await prisma.corporateAccount.findUnique({
    where: { id: accountId },
    select: { contactId: true },
  });
  if (!account) return { success: false, error: "Account not found" };

  const today = startOfTodayUtc();

  const select = {
    id: true,
    bookingNumber: true,
    eventName: true,
    eventType: true,
    status: true,
    date: true,
    timeSlot: true,
    guestCount: true,
    totalAmount: true,
    venue: { select: { id: true, name: true } },
  } as const;

  const [past, upcoming] = await Promise.all([
    prisma.booking.findMany({
      where: {
        contactId: account.contactId,
        status: { in: [...PAST_STATUSES] },
        date: { lt: today },
      },
      select,
      orderBy: { date: "desc" },
    }),
    prisma.booking.findMany({
      where: {
        contactId: account.contactId,
        status: { in: [...UPCOMING_STATUSES] },
        date: { gte: today },
      },
      select,
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    success: true,
    data: {
      past: serialize(past) as unknown[],
      upcoming: serialize(upcoming) as unknown[],
    },
  };
}
