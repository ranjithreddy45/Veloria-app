import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedOfflineApi } from "@/lib/marketing/gads-value";

// ============================================================
// POST /api/v1/marketing/offline-conversions/ack
// ------------------------------------------------------------
// The uploader reports back what Google accepted so nothing is uploaded twice.
//   { "conversion": "qualified_lead"|"booking",
//     "results": [ { "lead_id": "...", "status": "UPLOADED"|"FAILED", "error"? } ] }
// Sets qlUploadedAt / bookingUploadedAt + the matching status.
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (
    !(await isAuthorizedOfflineApi(
      request.headers.get("authorization"),
      request.headers.get("x-api-key")
    ))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { conversion?: string; results?: Array<{ lead_id?: string; status?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const isQL = body.conversion === "qualified_lead";
  const isBooking = body.conversion === "booking";
  if (!isQL && !isBooking) {
    return NextResponse.json(
      { error: "conversion must be 'qualified_lead' or 'booking'" },
      { status: 400 }
    );
  }
  const results = Array.isArray(body.results) ? body.results : [];

  let updated = 0;
  for (const r of results) {
    const status =
      r.status === "UPLOADED" ? "UPLOADED" : r.status === "FAILED" ? "FAILED" : null;
    if (!r.lead_id || !status) continue;
    const uploadedAt = status === "UPLOADED" ? new Date() : null;
    try {
      await prisma.lead.update({
        where: { id: r.lead_id },
        data: isQL
          ? { qlUploadStatus: status, qlUploadedAt: uploadedAt ?? undefined }
          : { bookingUploadStatus: status, bookingUploadedAt: uploadedAt ?? undefined },
      });
      updated++;
    } catch {
      // Unknown lead id — skip.
    }
  }

  return NextResponse.json({ ok: true, updated });
}
