import { NextResponse } from "next/server";
import { isValidCronSecret } from "@/lib/cron-auth";
import { reconcileGlPostings } from "@/lib/finance/gl-reconcile";

export const maxDuration = 120;

// Daily self-heal: re-post any issued invoice / completed payment that is
// missing its GL entry, so the books reconcile themselves. Invoked by
// /api/cron/daily. Idempotent; surfaces persistent failures to admins.
export async function GET(request: Request) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await reconcileGlPostings();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("[GL_RECONCILE_ERROR]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
