"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { revalidatePath } from "next/cache";
import type { LeadQuality } from "@prisma/client";

// ============================================================
// Lead quality — Google Ads offline-conversion loop (marketing spec)
// ------------------------------------------------------------
// A human decides whether a lead is real. Only QUALIFIED (and WON, implicitly)
// is ever eligible for upload to Google; JUNK_*/DUPLICATE are deliberately never
// uploaded — that is the entire point of the loop. The upload state is derived
// here so the read API just emits rows that are READY.
// ============================================================

const JUNK_QUALITIES: LeadQuality[] = [
  "JUNK_ACCIDENTAL",
  "JUNK_WRONG_SERVICE",
  "JUNK_OUT_OF_AREA",
  "JUNK_PRICE_ONLY",
  "JUNK_UNREACHABLE",
  "DUPLICATE",
];

function isJunk(q: LeadQuality): boolean {
  return JUNK_QUALITIES.includes(q);
}

/** Any Google click identifier present → the lead can be uploaded. */
async function hasClickId(leadId: string): Promise<boolean> {
  const a = await prisma.leadAttribution.findUnique({
    where: { leadId },
    select: { gclid: true, gbraid: true, wbraid: true },
  });
  return !!(a?.gclid || a?.gbraid || a?.wbraid);
}

export async function setLeadQuality(
  leadId: string,
  quality: LeadQuality,
  reason?: string
) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!lead) return { success: false as const, error: "Lead not found" };

    // Can't mark a won lead as junk — a booking is proof it was real.
    if (isJunk(quality) && lead.status === "WON") {
      return {
        success: false as const,
        error: "This lead is Won — it can't be marked junk. Reopen it first if that's wrong.",
      };
    }

    const data: Record<string, unknown> = {
      leadQuality: quality,
      qualityReason: reason?.trim() || null,
    };

    if (quality === "QUALIFIED") {
      data.qualifiedAt = new Date();
      // READY only if we actually have a click id to attribute against.
      data.qlUploadStatus = (await hasClickId(leadId)) ? "READY" : "SKIPPED_NO_CLICK_ID";
    } else if (isJunk(quality)) {
      data.qualifiedAt = null;
      data.qlUploadStatus = "SKIPPED"; // junk is never uploaded
    } else {
      // UNREVIEWED — reset back to pending.
      data.qualifiedAt = null;
      data.qlUploadStatus = "PENDING";
    }

    await prisma.lead.update({ where: { id: leadId }, data });

    await logActivity({
      userId: session.user.id as string,
      action: "lead_quality_set",
      entityType: "Lead",
      entityId: leadId,
      changes: { quality, reason: reason || null },
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
    return { success: true as const };
  } catch (error) {
    console.error("[SET_LEAD_QUALITY_ERROR]", error);
    return { success: false as const, error: "Failed to update lead quality" };
  }
}

/**
 * Record the booking outcome when a lead converts (Won). Stamps bookedAt and
 * arms the Booking-Confirmed upload; also promotes quality to QUALIFIED (a
 * booking is proof the lead was real).
 */
export async function setLeadBooking(
  leadId: string,
  bookingValue: number,
  guestCount?: number
) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "leads:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    if (!Number.isFinite(bookingValue) || bookingValue <= 0) {
      return { success: false as const, error: "Enter a booking value greater than 0." };
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: { id: true, qualifiedAt: true },
    });
    if (!lead) return { success: false as const, error: "Lead not found" };

    const clickId = await hasClickId(leadId);

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        bookingValue,
        bookedAt: new Date(),
        ...(guestCount && guestCount > 0 ? { guestCount } : {}),
        // A booking implies the lead was qualified.
        leadQuality: "QUALIFIED",
        qualifiedAt: lead.qualifiedAt ?? new Date(),
        qlUploadStatus: clickId ? "READY" : "SKIPPED_NO_CLICK_ID",
        bookingUploadStatus: clickId ? "READY" : "SKIPPED_NO_CLICK_ID",
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "lead_booking_set",
      entityType: "Lead",
      entityId: leadId,
      changes: { bookingValue, guestCount: guestCount ?? null },
    });

    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
    return { success: true as const };
  } catch (error) {
    console.error("[SET_LEAD_BOOKING_ERROR]", error);
    return { success: false as const, error: "Failed to record booking value" };
  }
}
