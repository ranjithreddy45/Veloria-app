import { NextRequest, NextResponse } from "next/server";
import { razorpayCredFingerprint } from "@/lib/payments/razorpay-creds";

export const runtime = "nodejs";

// ============================================================
// TEMPORARY diagnostic endpoint (remove after the Razorpay 401 is resolved).
// Returns only NON-SECRET credential info: the key id (a public value, already
// sent to the browser checkout) and the secret's LENGTH — never the secret
// value. Token-gated so it isn't casually probed.
// ============================================================

const DIAG_TOKEN = "vg-diag-7Kx9q2r5";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== DIAG_TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(razorpayCredFingerprint(), {
    headers: { "Cache-Control": "no-store" },
  });
}
