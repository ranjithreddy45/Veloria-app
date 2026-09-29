// ============================================================
// AiSensy → CRM webhook. Thin wrapper: all auth, dedupe and dispatch logic
// lives in @/lib/whatsapp/aisensy/handler (unit-tested, framework-free).
//
// URL to register in the AiSensy Custom App:
//   https://<host>/api/webhooks/aisensy?token=<aisensyVerifyToken>
// Auth is BOTH the URL token and the X-AiSensy-Signature HMAC over the raw body
// (aisensyWebhookSecret) — see handler.ts.
//
// While AiSensy is not the active provider this route answers 200 and does
// nothing, but still logs any delivery that verifies, so messages sent during a
// cutover or rollback can be replayed instead of vanishing.
// ============================================================

import { after, NextRequest, NextResponse } from "next/server";
import { handleAiSensyWebhook } from "@/lib/whatsapp/aisensy/handler";
import { aisensySink } from "@/lib/whatsapp/aisensy/sink.impl";

export const runtime = "nodejs";

// Reachability / handshake check — never 405.
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("challenge");
  if (challenge) {
    const settings = await aisensySink.loadSettings();
    const token = request.nextUrl.searchParams.get("token") || "";
    if (settings?.verifyToken && token === settings.verifyToken) {
      return new NextResponse(challenge, { status: 200 });
    }
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const result = await handleAiSensyWebhook(
    { rawBody, headers: request.headers, token: request.nextUrl.searchParams.get("token") },
    aisensySink,
    // Acknowledge inside AiSensy's ~5s budget; do the work after the response.
    (fn) => after(fn),
  );
  return NextResponse.json(result.body, { status: result.status });
}
