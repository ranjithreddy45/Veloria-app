"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { backfillEnquirySource } from "@/lib/enquiry-source-backfill";
import { logActivity } from "@/lib/activity-logger";

// ============================================================
// Run the enquiry data repair on demand.
//
// The same pass runs nightly, but "nightly" is no help to someone looking at a
// wrong Tags column right now. This lets an admin apply it immediately and see
// exactly what changed.
//
// It rewrites many contact rows at once, so it is gated on settings:update
// (admin-level) rather than contacts:update, and it writes an activity log
// entry naming who ran it and what it touched.
// ============================================================

export async function runEnquiryDataRepair() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    // Bulk rewrite — deliberately a higher bar than an ordinary contact edit.
    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const result = await backfillEnquirySource();

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Contact",
      entityId: "bulk-enquiry-repair",
      changes: { ...result },
    });

    revalidatePath("/contacts");
    return { success: true as const, data: result };
  } catch (error) {
    console.error("[ENQUIRY_DATA_REPAIR_ERROR]", error);
    return { success: false as const, error: "Repair failed — nothing was changed" };
  }
}
