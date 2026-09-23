import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import {
  buildConversionRows,
  toFeedCsv,
  type FeedLead,
} from "@/lib/marketing/gads-conversion-feed";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// GET /api/exports/gads-conversions.csv
// ------------------------------------------------------------
// The file Google Ads fetches once a day (Tools → Conversions → Uploads →
// Schedule, "HTTPS URL"). Basic Auth, because that is the only credential a
// Google Ads scheduled upload can carry — it cannot set a custom header, which
// is why the existing Bearer-token API at /api/v1/marketing/offline-conversions
// could never be used for this and has never delivered a single conversion.
//
// Credentials come from GADS_FEED_USER / GADS_FEED_PASS. Fail closed: with no
// credentials configured, nobody is authorised, including Google.
// ============================================================

const REALM = 'Basic realm="Veloria conversions", charset="UTF-8"';

function unauthorized(): NextResponse {
  return new NextResponse("Unauthorized\n", {
    status: 401,
    headers: { "WWW-Authenticate": REALM, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Constant-time string compare that tolerates different lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the answer does not leak the length.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function authorize(request: Request): boolean {
  const user = process.env.GADS_FEED_USER ?? "";
  const pass = process.env.GADS_FEED_PASS ?? "";
  if (!user || !pass) return false; // nothing configured → nobody gets in

  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) return false;

  let decoded = "";
  try {
    decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;

  // Both halves are always compared, so a right username with a wrong password
  // takes the same time as a wrong username.
  const okUser = safeEqual(decoded.slice(0, separator), user);
  const okPass = safeEqual(decoded.slice(separator + 1), pass);
  return okUser && okPass;
}

export async function GET(request: Request) {
  if (!authorize(request)) return unauthorized();

  const url = new URL(request.url);
  const windowDays = Number(url.searchParams.get("days") ?? "30");
  const now = new Date();

  try {
    // Only leads that could produce a row at all: a click id, and at least one
    // of the two conversion timestamps.
    const leads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        OR: [{ qualifiedAt: { not: null } }, { wonAt: { not: null } }],
        attribution: { gclid: { not: null } },
      },
      select: {
        id: true,
        createdAt: true,
        qualifiedAt: true,
        wonAt: true,
        bookingValue: true,
        attribution: { select: { gclid: true } },
      },
    });

    const feedLeads: FeedLead[] = leads.map((l) => ({
      id: l.id,
      createdAt: l.createdAt,
      qualifiedAt: l.qualifiedAt,
      wonAt: l.wonAt,
      bookingValue: l.bookingValue == null ? null : Number(l.bookingValue),
      gclid: l.attribution?.gclid ?? null,
    }));

    const rows = buildConversionRows(feedLeads, {
      now,
      windowDays: Number.isFinite(windowDays) && windowDays > 0 ? windowDays : 30,
    });

    // Audit: remember the first time each conversion appeared in the feed. The
    // feed itself re-lists 30 days on every fetch, so it can never answer "when
    // did we first tell Google about this booking?" — this table can.
    if (rows.length) {
      await prisma.conversionExportLog
        .createMany({
          data: rows.map((r) => ({
            leadId: r.leadId,
            conversionName: r.conversionName,
            conversionTime: r.conversionTime,
            value: r.value,
            currency: r.currency,
            clickId: r.clickId,
          })),
          skipDuplicates: true, // second fetch of the same row must not re-log
        })
        .catch((e) => console.error("[GADS_FEED] could not write the export log", e));
    }

    return new NextResponse(toFeedCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="gads-conversions.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GADS_FEED_ERROR]", error);
    return new NextResponse("Internal Server Error\n", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
