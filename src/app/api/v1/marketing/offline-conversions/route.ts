import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isAuthorizedOfflineApi,
  qualifiedLeadValue,
  bucketEventType,
  toGoogleIstTimestamp,
  getGadsConfig,
  CLICK_MAX_AGE_MS,
} from "@/lib/marketing/gads-value";

// ============================================================
// GET /api/v1/marketing/offline-conversions
// ------------------------------------------------------------
// The RETURN pipe: emits READY Qualified-Lead / Booking-Confirmed conversions
// for the caller (an offline-conversion uploader) to push to Google Ads.
//   ?conversion = qualified_lead | booking   (required)
//   ?status     = ready                       (default)
//   ?limit      = 1..1000                      (default 500)
//   Auth: Authorization: Bearer <service key>   (or X-API-Key)
// Rows follow Google's format rules exactly (conversion_date_time with +05:30,
// order_id, click id, exact conversion_action name). Clicks older than 90 days
// are marked SKIPPED_EXPIRED and never emitted.
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (
    !(await isAuthorizedOfflineApi(
      request.headers.get("authorization"),
      // Header preferred; ?key= supported so Google Ads scheduled HTTPS uploads
      // (which can't set a custom auth header) can pull the CSV directly.
      request.headers.get("x-api-key") || sp.get("key")
    ))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversion = sp.get("conversion");
  if (conversion !== "qualified_lead" && conversion !== "booking") {
    return NextResponse.json(
      { error: "conversion must be 'qualified_lead' or 'booking'" },
      { status: 400 }
    );
  }
  const isQL = conversion === "qualified_lead";
  const limit = Math.min(1000, Math.max(1, Number(sp.get("limit")) || 500));

  // Only rows that have a click id can be uploaded (enforced by the READY status,
  // but re-stated in the query so a hand-edited row can never leak through).
  const hasClickId: Prisma.LeadAttributionWhereInput = {
    OR: [{ gclid: { not: null } }, { gbraid: { not: null } }, { wbraid: { not: null } }],
  };

  const where: Prisma.LeadWhereInput = isQL
    ? { deletedAt: null, qlUploadStatus: "READY", qualifiedAt: { not: null }, attribution: hasClickId }
    : {
        deletedAt: null,
        bookingUploadStatus: "READY",
        bookedAt: { not: null },
        bookingValue: { not: null },
        attribution: hasClickId,
      };

  const leads = await prisma.lead.findMany({
    where,
    orderBy: isQL ? { qualifiedAt: "asc" } : { bookedAt: "asc" },
    take: limit + 100, // a buffer so expiry-filtering still fills the page
    select: {
      id: true,
      eventType: true,
      createdAt: true,
      qualifiedAt: true,
      bookedAt: true,
      bookingValue: true,
      preferredVenue: { select: { name: true } },
      attribution: {
        select: { gclid: true, gbraid: true, wbraid: true, gadsCampaignId: true },
      },
    },
  });

  const config = await getGadsConfig();
  const now = Date.now();
  const conversions: Record<string, unknown>[] = [];
  const expiredIds: string[] = [];

  for (const l of leads) {
    if (conversions.length >= limit) break;
    // Click-age proxy = lead creation time (the lead is created moments after
    // the click). Older than 90 days → Google will reject it.
    if (now - new Date(l.createdAt).getTime() > CLICK_MAX_AGE_MS) {
      expiredIds.push(l.id);
      continue;
    }
    const convTime = isQL ? l.qualifiedAt : l.bookedAt;
    if (!convTime) continue;

    conversions.push({
      lead_id: l.id,
      order_id: `${isQL ? "VG-QL-" : "VG-BK-"}${l.id}`,
      gclid: l.attribution?.gclid ?? null,
      gbraid: l.attribution?.gbraid ?? null,
      wbraid: l.attribution?.wbraid ?? null,
      conversion_action: isQL ? "Qualified Lead" : "Booking Confirmed",
      conversion_date_time: toGoogleIstTimestamp(new Date(convTime)),
      conversion_value: isQL
        ? qualifiedLeadValue(l.eventType, config?.valueMap)
        : Number(l.bookingValue),
      currency_code: "INR",
      event_type: bucketEventType(l.eventType),
      gads_campaign_id: l.attribution?.gadsCampaignId ?? null,
      venue: l.preferredVenue?.name ?? null,
    });
  }

  // Retire expired rows so they stop appearing (best-effort).
  if (expiredIds.length) {
    await prisma.lead
      .updateMany({
        where: { id: { in: expiredIds } },
        data: isQL
          ? { qlUploadStatus: "SKIPPED_EXPIRED" }
          : { bookingUploadStatus: "SKIPPED_EXPIRED" },
      })
      .catch(() => {});
  }

  // CSV variant — so Google Ads "Scheduled uploads" (or any tool) can pull a
  // ready-to-import file directly, no external uploader. NOTE: match the column
  // order to your Google Ads upload template if it rejects rows.
  if (sp.get("format") === "csv") {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header =
      "Google Click ID,GBRAID,WBRAID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency,Order ID";
    const lines = conversions.map((c) =>
      [
        c.gclid,
        c.gbraid,
        c.wbraid,
        c.conversion_action,
        c.conversion_date_time,
        c.conversion_value,
        c.currency_code,
        c.order_id,
      ]
        .map(esc)
        .join(",")
    );
    return new NextResponse([header, ...lines].join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="offline-conversions-${conversion}.csv"`,
      },
    });
  }

  return NextResponse.json({
    timezone: "Asia/Calcutta",
    count: conversions.length,
    conversions,
  });
}

