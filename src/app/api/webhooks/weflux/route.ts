import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { processWefluxEvent } from "@/lib/whatsapp/inbound-pipeline";
import {
  captureInboundEvent,
  updateInboundEvent,
  errorMessage,
} from "@/lib/whatsapp/inbound-capture";

// ============================================================
// Weflux → CRM webhook (Inbox sync)
// ------------------------------------------------------------
// Weflux POSTs events here (registered under Weflux → Outbound endpoints). We
// authenticate, ACK 2xx fast (<15s), then process asynchronously — mirroring
// Weflux conversations into the CRM inbox and capturing WhatsApp-first leads.
//
// Two accepted auth methods (either passes):
//   1. Shared token in the URL — ?token=<verifyToken> — matching the token the
//      settings page bakes into the webhook URL (read from the saved config).
//   2. HMAC signature — X-Weflux-Signature: sha256=<hex of `${ts}.${raw}`> with
//      env WEFLUX_ENDPOINT_SECRET, X-Weflux-Timestamp within 300s (anti-replay).
//
// OBSERVABILITY: every POST is persisted as a WhatsAppInboundEvent BEFORE auth
// or parsing (best-effort — logging can never change a response code), then
// that row is updated with the auth result, the parsed summary and any error.
// Viewer + replay: /settings/integrations/whatsapp-inbound. The parse/dispatch
// step itself lives in @/lib/whatsapp/inbound-pipeline so replay runs the same
// code this route does.
// ============================================================

export const runtime = "nodejs";

function timingSafe(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hmacHex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

/** Auth material from the saved WhatsApp config (in-app, no env vars needed):
 *  the shared URL token (verifyToken) and the HMAC event-signing secret. Env
 *  vars are used only as a fallback for back-compat. Reading the saved config
 *  here is the fix for the handler reporting "not configured" after a save. */
async function getWebhookAuth(): Promise<{ token: string | null; signingSecret: string | null }> {
  try {
    const config = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: { verifyToken: true, eventSigningSecret: true },
    });
    return {
      token: config?.verifyToken || null,
      signingSecret: config?.eventSigningSecret || process.env.WEFLUX_ENDPOINT_SECRET || null,
    };
  } catch {
    return { token: null, signingSecret: process.env.WEFLUX_ENDPOINT_SECRET || null };
  }
}

// GET — handshake. Some providers verify with a hub.challenge / challenge echo.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const challenge = sp.get("hub.challenge") || sp.get("challenge");
  const token = sp.get("hub.verify_token") || sp.get("token") || "";
  const expected = (await getWebhookAuth()).token || process.env.WEFLUX_ENDPOINT_SECRET || "";
  if (challenge && expected && token === expected) {
    return new NextResponse(challenge, { status: 200 });
  }
  // Never 405 — return 200 so a provider's reachability check passes.
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();

  // Persist FIRST — before auth, before JSON.parse — so a payload we reject or
  // cannot read is still on record with its (redacted) headers.
  const captureId = await captureInboundEvent({
    provider: "WEFLUX",
    rawBody: raw,
    headers: request.headers,
    url: request.nextUrl,
  });

  const { token: configToken, signingSecret: envSecret } = await getWebhookAuth();

  // Fail closed only if there's genuinely nothing to authenticate against.
  if (!configToken && !envSecret) {
    await updateInboundEvent(captureId, {
      parseError: "Webhook not configured — no verify token or signing secret saved",
    });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Method 1 — shared token (URL query or header).
  const providedToken =
    request.nextUrl.searchParams.get("token") || request.headers.get("x-weflux-token") || "";
  const tokenOk = !!(configToken && providedToken && timingSafe(providedToken, configToken));

  // Method 2 — HMAC signature over `${ts}.${raw}` (body-only fallback).
  let sigOk = false;
  const sig = request.headers.get("x-weflux-signature") || "";
  const ts = request.headers.get("x-weflux-timestamp") || "";
  if (envSecret && sig) {
    const staleTs = ts && Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300;
    if (!staleTs) {
      const expTs = "sha256=" + hmacHex(envSecret, `${ts}.${raw}`);
      const expBody = "sha256=" + hmacHex(envSecret, raw);
      sigOk = timingSafe(sig, expTs) || timingSafe(sig, expBody);
    }
  }

  if (!tokenOk && !sigOk) {
    await updateInboundEvent(captureId, {
      signatureValid: false,
      parseError: [
        "Unauthorized:",
        providedToken ? "URL/header token did not match the saved verify token" : "no token supplied",
        sig ? "; X-Weflux-Signature did not verify" : "; no X-Weflux-Signature header",
      ].join(" "),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    await updateInboundEvent(captureId, { signatureValid: true, parseError: "Invalid JSON body" });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await updateInboundEvent(captureId, { signatureValid: true });

  // ACK immediately; process after the response is sent (15s Weflux timeout).
  after(async () => {
    try {
      const summary = await processWefluxEvent(payload);
      await updateInboundEvent(captureId, { parsedOk: true, ...summary });
    } catch (e) {
      console.error("[Weflux Webhook] processing error:", e);
      await updateInboundEvent(captureId, { parseError: `Processing threw: ${errorMessage(e)}` });
    }
  });

  return NextResponse.json({ ok: true });
}
