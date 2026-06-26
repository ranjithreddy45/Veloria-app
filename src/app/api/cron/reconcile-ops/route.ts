import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { reconcileOpsProvisioning } from "@/lib/ops/provision";
import { reportSystemFailure } from "@/lib/ops-alert";

export const maxDuration = 120;

// ============================================================
// Cron · Reconcile ops provisioning (the backstop)
// ------------------------------------------------------------
// Confirmation provisions every team's ops workspace synchronously, but that
// path is best-effort (a transient DB/template error must never block a paid
// booking). This sweep is the safety net: it finds CONFIRMED/IN_PROGRESS
// bookings whose ops were never fully provisioned (no EventOperation, or one
// with opsProvisionedAt still null) and re-runs the idempotent provisioner so
// the gap is filled. If any booking STILL fails after the retry, we escalate to
// admins — a confirmed booking can never silently end up with no ops checklist.
// Returns 500 on a top-level throw so runCronLane records the failure + alerts.
// Registered in the daily lane.
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

    const result = await reconcileOpsProvisioning();

    // Anything still failing after the retry pass is a real problem — surface it.
    if (result.failed.length > 0) {
      await reportSystemFailure({
        area: "Ops provisioning",
        title: `${result.failed.length} booking(s) still missing ops after reconcile`,
        detail: result.failed.map((f) => `${f.bookingId}: ${f.error}`).join(" | ").slice(0, 1500),
        actionUrl: "/bookings",
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, ranAt: new Date().toISOString(), data: result });
  } catch (error) {
    console.error("[RECONCILE_OPS_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
