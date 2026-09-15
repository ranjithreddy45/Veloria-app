import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  pruneInboundEvents,
  INBOUND_EVENT_RETENTION_DAYS,
} from "@/lib/whatsapp/inbound-capture";

/**
 * Daily cron: delete WhatsAppInboundEvent rows (raw webhook captures for the
 * WhatsApp inbound log) older than 30 days. Raw bodies are up to 64 KB each,
 * so the log must not grow unbounded. CRON_SECRET auth, same as every other job.
 */
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

    const deleted = await pruneInboundEvents();
    return NextResponse.json({
      success: true,
      deleted,
      retentionDays: INBOUND_EVENT_RETENTION_DAYS,
    });
  } catch (error) {
    console.error("[WHATSAPP_INBOUND_PRUNE_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
