"use server";

import type { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { POLICY_KEYS, policyPath, type PolicyKey } from "@/lib/public/policies";

// ============================================================
// Team side: what did the customer accept?
// Reads ConsentRecord rows for a booking or a contact — the policy, the
// version, the exact text, when and where it was given — so the team sees
// precisely what was agreed in the customer app (source "APP_HOLD", ...) and
// on public forms. Read-only.
// Booking lookups need bookings:read; contact lookups need contacts:read.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface ConsentRecordRow {
  id: string;
  /** CANCELLATION_REFUND | BOOKING_TERMS | HOUSE_RULES, or null for a privacy consent. */
  policyKey: string | null;
  /** null when no policy was published and a notice was shown instead. */
  policyVersion: number | null;
  /** The policy's public page (current published version), or null. */
  policyHref: string | null;
  purpose: string;
  source: string;
  /** Exactly what the customer was shown and agreed to. */
  consentText: string;
  givenAt: string;
  email: string | null;
  phone: string | null;
  bookingId: string | null;
  subjectType: string;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function mayRead(role: string | undefined, permission: "bookings:read" | "contacts:read"): boolean {
  if (!role) return false;
  return role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role, permission);
}

function hrefFor(policyKey: string | null): string | null {
  if (!policyKey || !(POLICY_KEYS as readonly string[]).includes(policyKey)) return null;
  return policyPath(policyKey as PolicyKey);
}

export async function getConsentRecords(target: {
  bookingId?: string | null;
  contactId?: string | null;
}): Promise<Result<ConsentRecordRow[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    const role = (session.user as { role?: string }).role;

    const bookingId = typeof target?.bookingId === "string" && ID_PATTERN.test(target.bookingId) ? target.bookingId : null;
    const contactId = typeof target?.contactId === "string" && ID_PATTERN.test(target.contactId) ? target.contactId : null;
    if (!bookingId && !contactId) return { success: false, error: "Choose a booking or a contact." };
    if (bookingId && !mayRead(role, "bookings:read")) return { success: false, error: "Unauthorized" };
    if (contactId && !mayRead(role, "contacts:read")) return { success: false, error: "Unauthorized" };

    const or: Prisma.ConsentRecordWhereInput[] = [];
    if (bookingId) or.push({ bookingId }, { subjectType: "BOOKING", subjectId: bookingId });
    if (contactId) {
      or.push({ subjectType: "CONTACT", subjectId: contactId });
      const bookings = await prisma.booking.findMany({ where: { contactId }, select: { id: true }, take: 500 });
      const ids = bookings.map((b) => b.id);
      if (ids.length > 0) or.push({ bookingId: { in: ids } }, { subjectType: "BOOKING", subjectId: { in: ids } });
    }

    const rows = await prisma.consentRecord.findMany({
      where: { OR: or },
      orderBy: { givenAt: "desc" },
      take: 200,
      select: {
        id: true,
        policyKey: true,
        policyVersion: true,
        purpose: true,
        source: true,
        consentText: true,
        givenAt: true,
        email: true,
        phone: true,
        bookingId: true,
        subjectType: true,
      },
    });

    return {
      success: true,
      data: rows.map((r) => ({ ...r, givenAt: r.givenAt.toISOString(), policyHref: hrefFor(r.policyKey) })),
    };
  } catch (error) {
    console.error("[GET_CONSENT_RECORDS_ERROR]", error);
    return { success: false, error: "Failed to load consent records." };
  }
}
