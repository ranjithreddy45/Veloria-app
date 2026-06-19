import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAvailabilityJson, buildAvailabilityICal } from "@/lib/ota/feed";
import { logOtaSync } from "@/lib/ota/sync-log";

export const runtime = "nodejs";
// Always reflect fresh occupancy; short Cache-Control header handles edge caching.
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 180;
const MAX_DAYS = 365;

/**
 * GET /api/ota/feed/[token]
 *
 * PUBLIC, no-auth. The feedToken is the only access control — fail closed
 * (404) on unknown/inactive token so we never leak whether a token exists.
 *
 * Emits ONLY date / slot / status (see src/lib/ota/feed.ts). No PII, no
 * booking numbers, no amounts. Writes an OUTBOUND OtaSyncLog row for
 * observability (best-effort, never blocks the response).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const channel = await prisma.otaChannel.findFirst({
      where: { feedToken: token, isActive: true },
      select: { id: true, venueId: true, feedFormat: true },
    });

    // Fail closed — same 404 for missing/inactive/unknown so nothing leaks.
    if (!channel) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Outbound feeds are per-venue; a non-venue-scoped channel is a misconfig.
    if (!channel.venueId) {
      logOtaSync({
        channelId: channel.id,
        direction: "OUTBOUND",
        status: "FAILED",
        message: "Channel is not venue-scoped",
      });
      return NextResponse.json(
        { error: "Channel is not venue-scoped" },
        { status: 422 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Date window: today .. today + clamp(days, 1, MAX_DAYS).
    const daysParam = Number(searchParams.get("days"));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, MAX_DAYS) : DEFAULT_DAYS;
    const from = new Date();
    const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

    // Format: explicit ?format= overrides the channel default.
    const formatParam = (searchParams.get("format") || "").toUpperCase();
    const format = formatParam === "JSON" || formatParam === "ICAL" ? formatParam : channel.feedFormat;

    if (format === "ICAL") {
      const result = await buildAvailabilityICal(channel.venueId, from, to);
      if (!result) {
        logOtaSync({
          channelId: channel.id,
          direction: "OUTBOUND",
          status: "FAILED",
          message: "Venue not found or inactive",
        });
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      logOtaSync({
        channelId: channel.id,
        direction: "OUTBOUND",
        status: "SUCCESS",
        recordCount: result.eventCount,
        message: `iCal feed served (${result.eventCount} blocked slots)`,
      });

      return new NextResponse(result.ical, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'inline; filename="availability.ics"',
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    // Default: JSON.
    const feed = await buildAvailabilityJson(channel.venueId, from, to);
    if (!feed) {
      logOtaSync({
        channelId: channel.id,
        direction: "OUTBOUND",
        status: "FAILED",
        message: "Venue not found or inactive",
      });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    logOtaSync({
      channelId: channel.id,
      direction: "OUTBOUND",
      status: "SUCCESS",
      recordCount: feed.slots.length,
      message: `JSON feed served (${feed.slots.length} slots)`,
    });

    return NextResponse.json(feed, {
      status: 200,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    console.error("[OTA_FEED_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
