import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { purgeOldTrash } from "@/actions/trash.actions";

/**
 * Daily cron: hard-delete soft-deleted records older than 30 days.
 * Follows the same auth pattern as the other cron jobs (CRON_SECRET).
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

    const result = await purgeOldTrash();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[TRASH_PURGE_CRON_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
