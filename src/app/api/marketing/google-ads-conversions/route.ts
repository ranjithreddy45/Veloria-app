// ============================================================
// /api/marketing/google-ads-conversions  (GET, staff)
// ------------------------------------------------------------
// Google Ads **Offline Conversion Import** CSV.
//
// Why this matters: the on-page conversion tag only tells Google "a form was
// filled". This export tells Google which of those clicks became a REAL
// BOOKING and for how much — so Smart Bidding optimises for revenue instead of
// form fills. Source of truth is LeadAttribution.gclid (captured at lead
// creation) + bookedRevenue (recomputed by the attribution-rollup cron from
// Lead → Deal → Booking).
//
// Upload at: Google Ads → Goals → Conversions → Import → Upload from file.
// The conversion action name in Google Ads MUST match ?name= exactly.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // India, no DST

/** "yyyy-MM-dd HH:mm:ss" in IST — pairs with the Parameters:TimeZone header. */
function istStamp(d: Date): string {
  const t = new Date(d.getTime() + IST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
}

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (!hasPermission(role, "marketing:read")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const url = new URL(req.url);
  // The conversion action name must match the one created in Google Ads.
  const conversionName = (url.searchParams.get("name") || "Veloria Booking").trim();
  // Google only accepts conversions within 90 days of the click by default.
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || 90) || 90));
  const since = new Date(Date.now() - days * 24 * 3600e3);
  // "won" (default) = only real bookings. "all" = every gclid lead (form fills).
  const scope = url.searchParams.get("scope") === "all" ? "all" : "won";

  const rows = await prisma.leadAttribution.findMany({
    where: {
      // gclid OR the iOS/privacy-safe ids — Google Ads accepts all three, and
      // a large share of mobile clicks carry gbraid/wbraid instead of gclid.
      OR: [{ gclid: { not: null } }, { gbraid: { not: null } }, { wbraid: { not: null } }],
      createdAt: { gte: since },
      ...(scope === "won"
        ? { AND: [{ OR: [{ bookedRevenue: { gt: 0 } }, { lead: { status: "WON" } }] }] }
        : {}),
    },
    select: {
      gclid: true,
      gbraid: true,
      wbraid: true,
      bookedRevenue: true,
      createdAt: true,
      lead: { select: { status: true, updatedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20000,
  });

  const lines: string[] = [
    // Declares the timezone for every Conversion Time below.
    "Parameters:TimeZone=+0530",
    "Google Click ID,GBRAID,WBRAID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
  ];
  let counted = 0;
  for (const r of rows) {
    // Exactly ONE identifier per row — Google rejects rows with more than one.
    const gclid = r.gclid || "";
    const gbraid = !gclid && r.gbraid ? r.gbraid : "";
    const wbraid = !gclid && !gbraid && r.wbraid ? r.wbraid : "";
    if (!gclid && !gbraid && !wbraid) continue;
    // Conversion moment: when the lead last changed (i.e. became WON). The
    // click time is earlier by definition, which Google requires.
    const when = r.lead?.updatedAt ?? r.createdAt;
    // Never send a conversion timestamped before its click was recorded.
    const stamp = istStamp(when < r.createdAt ? r.createdAt : when);
    const value = Number(r.bookedRevenue ?? 0);
    lines.push([
      csvCell(gclid), csvCell(gbraid), csvCell(wbraid), csvCell(conversionName),
      csvCell(stamp), csvCell(value.toFixed(2)), csvCell("INR"),
    ].join(","));
    counted++;
  }

  // Log the export — it carries click identifiers (marketing PII-adjacent).
  await prisma.activityLog.create({
    data: {
      action: "GOOGLE_ADS_CONVERSION_EXPORT", entityType: "LEAD_ATTRIBUTION", entityId: scope,
      userId: session!.user!.id,
      changes: { scope, days, conversionName, rowCount: counted },
    },
  }).catch((e) => console.error("[GADS_EXPORT_LOG_ERROR]", e));

  return new Response("﻿" + lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="google-ads-conversions-${scope}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
