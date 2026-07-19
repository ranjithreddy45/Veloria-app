// ============================================================
// /api/draw/export  (GET, admin) — CSV of entries; every export is logged
// because it is a PII export.
// ============================================================

import { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { drawEventLabel, drawMonthRange } from "@/lib/draw";

const isAdmin = (role?: string) => role === "SUPER_ADMIN" || role === "ADMIN";

/** RFC-4180 CSV cell: quote + double up internal quotes. Handles Indian names
 *  with spaces/commas and opens cleanly in Excel. */
function csvCell(v: string | null | undefined): string {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (!isAdmin(role)) return new Response(JSON.stringify({ error: "Only an admin can export." }), { status: 403, headers: { "Content-Type": "application/json" } });

  const month = new URL(req.url).searchParams.get("month");
  const where: Prisma.DrawEntryWhereInput = {};
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const { start, end } = drawMonthRange(month);
    where.createdAt = { gte: start, lt: end };
  }

  const rows = await prisma.drawEntry.findMany({ where, orderBy: { createdAt: "desc" }, take: 50000 });

  const header = ["entry_code", "guest_name", "phone", "host_name", "event_type", "event_date", "consent_ts", "source", "created_at"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      csvCell(r.entryCode), csvCell(r.guestName), csvCell(r.phone), csvCell(r.hostName),
      csvCell(drawEventLabel(r.eventType)), csvCell(r.eventDate.toISOString().slice(0, 10)),
      csvCell(r.consentTs.toISOString()), csvCell(r.source), csvCell(r.createdAt.toISOString()),
    ].join(","));
  }
  // Excel-friendly: UTF-8 BOM so accented/Indian names render correctly.
  const csv = "﻿" + lines.join("\r\n");

  // Log the PII export (who, when, how many).
  await prisma.activityLog.create({
    data: {
      action: "DRAW_ENTRIES_EXPORT", entityType: "DRAW_ENTRY", entityId: month || "ALL",
      userId: session!.user!.id, changes: { month: month || "ALL", rowCount: rows.length },
    },
  }).catch((e) => console.error("[DRAW_EXPORT_LOG_ERROR]", e));

  const filename = `veloria-draw-entries${month ? `-${month}` : ""}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
