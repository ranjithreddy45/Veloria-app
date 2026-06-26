import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendVendorAssignmentReminders } from "@/lib/ops/vendor-reminders";

export const maxDuration = 120;

// ============================================================
// Cron · Vendor assignment reminders
// ------------------------------------------------------------
// Re-pings vendors whose OperationVendorAssignment is still NOTIFIED for an
// upcoming event and who weren't reminded in the last 24h, with their
// /vendor-confirm/<token> link (WhatsApp → SMS fallback). Best-effort per row;
// remindedAt is stamped only on a successful send. Returns 500 on a top-level
// throw so runCronLane records the failure + alerts admins. Register in the
// daily JOBS array as "vendor-reminders".
// ============================================================

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (
      !authHeader ||
      !process.env.CRON_SECRET ||
      authHeader.length !== expected.length ||
      !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await sendVendorAssignmentReminders();

    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    console.error("[VENDOR_REMINDERS_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
