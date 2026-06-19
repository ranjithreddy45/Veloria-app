import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";
import { recomputePayoutCore } from "@/actions/franchise-revshare.actions";
import { previousPeriod } from "@/lib/franchise/pnl";

// ============================================================
// Cron · Franchise revenue-share monthly accrual
// ------------------------------------------------------------
// For the just-closed month, iterate every ACTIVE FranchisePartner → its
// FranchiseVenue rows and accrue/refresh a RevenueSharePayout via
// recomputePayoutCore. Idempotent on @@unique[partner,venue,period]; an
// APPROVED/PAID payout is left untouched. Each venue is wrapped in try/catch so
// one failure never aborts the batch (this runs inside the shared daily
// orchestrator). cron-only (no user session), so maker is null.
// ============================================================

export async function GET(request: Request) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = previousPeriod(new Date());
  const counts = {
    period,
    partners: 0,
    venues: 0,
    accrued: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    const partners = await prisma.franchisePartner.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        venues: { select: { venueId: true } },
      },
    });

    counts.partners = partners.length;

    for (const partner of partners) {
      for (const fv of partner.venues) {
        counts.venues += 1;
        try {
          const res = await recomputePayoutCore(
            { partnerId: partner.id, venueId: fv.venueId, period },
            null
          );
          if (!res.success) {
            // Most common: no active config for partner/venue — not a hard error.
            counts.skipped += 1;
            continue;
          }
          if ("skipped" in res && res.skipped) {
            counts.skipped += 1;
          } else {
            counts.accrued += 1;
          }
        } catch (e) {
          counts.failed += 1;
          console.error("[CRON_FRANCHISE_REVSHARE_VENUE_ERROR]", {
            partnerId: partner.id,
            venueId: fv.venueId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }
  } catch (error) {
    console.error("[CRON_FRANCHISE_REVSHARE_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Accrual batch failed", counts },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    ranAt: new Date().toISOString(),
    ...counts,
  });
}
