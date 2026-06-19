import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isValidCronSecret } from "@/lib/cron-auth";
import { resolveCampaignForUtm } from "@/lib/attribution";

export const maxDuration = 60;

// ============================================================
// Attribution rollup sweep (daily)
// ------------------------------------------------------------
// Closed-loop refresh. For every LeadAttribution row:
//   1. Recompute denormalised bookedRevenue from the Lead -> Deal ->
//      Booking path. A non-CANCELLED booking's totalAmount becomes the
//      booked revenue; otherwise bookedRevenue is reset to 0 (eventually
//      consistent — a later cancellation zeroes it on the next run).
//   2. Re-link campaignId via resolveCampaignForUtm so attributions
//      captured BEFORE their MarketingCampaign existed get connected.
//
// Idempotent + batched + per-row try/catch so one bad row never aborts the
// sweep. Reads denormalised figures the /marketing cockpit renders fast.
//
// Ordering note: must run AFTER customer-360 in the daily JOBS array so
// Contact.totalRevenue (LTV source) is fresh before the cockpit reads it.
// ============================================================

const BATCH = 200;

export async function GET(request: Request) {
  try {
    if (!isValidCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let processed = 0;
    let revenueUpdated = 0;
    let relinked = 0;
    let cursor: string | null = null;

    // Cursor-paginate so very large attribution tables don't blow memory.
    // Extracted to a helper so `rows` gets a concrete inferred type (avoids the
    // TS7022 self-reference from using `cursor` inside its own initializer).
    const loadBatch = (afterId: string | null) =>
      prisma.leadAttribution.findMany({
        take: BATCH,
        ...(afterId ? { skip: 1, cursor: { id: afterId } } : {}),
        orderBy: { id: "asc" as const },
        select: {
          id: true,
          campaignId: true,
          utmCampaign: true,
          campaign: true,
          utmSource: true,
          source: true,
          bookedRevenue: true,
          lead: {
            select: {
              source: true,
              deal: {
                select: {
                  booking: {
                    select: { status: true, totalAmount: true },
                  },
                },
              },
            },
          },
        },
      });

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await loadBatch(cursor);

      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;

      for (const row of rows) {
        try {
          // ---- 1) recompute booked revenue ----
          const booking = row.lead?.deal?.booking;
          const isBooked = booking && booking.status !== "CANCELLED";
          const nextRevenue: Prisma.Decimal = isBooked
            ? booking!.totalAmount
            : new Prisma.Decimal(0);

          const prevRevenue = row.bookedRevenue ?? null;
          const revenueChanged =
            prevRevenue === null || !new Prisma.Decimal(prevRevenue).equals(nextRevenue);

          // ---- 2) re-link campaign ----
          let nextCampaignId = row.campaignId;
          if (!row.campaignId) {
            const resolved = await resolveCampaignForUtm({
              utmCampaign: row.utmCampaign ?? row.campaign,
              utmSource: row.utmSource ?? row.source,
              channel: row.source ?? row.lead?.source ?? row.utmSource,
            });
            if (resolved) nextCampaignId = resolved;
          }
          const campaignChanged = nextCampaignId !== row.campaignId;

          if (revenueChanged || campaignChanged) {
            await prisma.leadAttribution.update({
              where: { id: row.id },
              data: {
                ...(revenueChanged ? { bookedRevenue: nextRevenue } : {}),
                ...(campaignChanged ? { campaignId: nextCampaignId } : {}),
              },
            });
            if (revenueChanged) revenueUpdated += 1;
            if (campaignChanged) relinked += 1;
          }

          processed += 1;
        } catch (e) {
          console.error("[ATTRIBUTION_ROLLUP] per-row failed:", row.id, e);
          // continue — one bad row must not stop the sweep
        }
      }

      if (rows.length < BATCH) break;
    }

    return NextResponse.json({ processed, revenueUpdated, relinked });
  } catch (error) {
    console.error("[ATTRIBUTION_ROLLUP_CRON_ERROR]", error);
    return NextResponse.json({ processed: 0, revenueUpdated: 0, relinked: 0 });
  }
}
