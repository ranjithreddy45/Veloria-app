import { timingSafeEqual, createHmac } from "crypto";
import { NextResponse } from "next/server";
import { after } from "next/server";

import { getMetaCredentials } from "@/lib/meta/graph";
import { drainMetaLeadJobs, enqueueMetaLead } from "@/lib/meta/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// GET|POST /api/meta/leadgen — Meta Lead Ads webhook.
// ------------------------------------------------------------
// GET is Meta's subscription handshake. POST is a lead notification, signed
// with the app secret, carrying only an id.
//
// The one rule that matters here: answer fast. Meta allows about two seconds
// and treats anything slower as a failure, retrying for a while and then
// dropping the lead permanently. So this endpoint verifies, records the id and
// returns; the Graph fetch happens after the response is flushed, and anything
// that fails there is retried by the cron lane rather than lost.
// ============================================================

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const creds = await getMetaCredentials();
  // Fail closed: with no verify token configured, nobody can subscribe.
  if (!creds.verifyToken || mode !== "subscribe" || token !== creds.verifyToken) {
    return new NextResponse("forbidden", { status: 403 });
  }
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function signatureMatches(raw: string, header: string, appSecret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface LeadgenChange {
  field?: string;
  value?: {
    leadgen_id?: string | number;
    form_id?: string | number;
    page_id?: string | number;
    ad_id?: string | number;
    adgroup_id?: string | number;
    created_time?: number;
  };
}

export async function POST(request: Request) {
  const raw = await request.text();
  const creds = await getMetaCredentials();

  // No app secret means we cannot tell Meta's deliveries from anyone else's,
  // and this endpoint creates leads. Refuse rather than trust the internet.
  if (!creds.appSecret) {
    console.error("[MetaLeadgen] no app secret configured — refusing the delivery");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const header = request.headers.get("x-hub-signature-256") ?? "";
  if (!header.startsWith("sha256=") || !signatureMatches(raw, header, creds.appSecret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let body: { object?: string; entry?: { changes?: LeadgenChange[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  let queued = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const value = change.value ?? {};
      const leadgenId = value.leadgen_id != null ? String(value.leadgen_id) : "";
      if (!leadgenId) continue;

      // Only our page. A shared app can be subscribed to several, and another
      // page's leads are not ours to store.
      const pageId = value.page_id != null ? String(value.page_id) : "";
      if (creds.pageId && pageId && pageId !== creds.pageId) continue;

      await enqueueMetaLead({
        leadgenId,
        formId: value.form_id != null ? String(value.form_id) : null,
        pageId: pageId || null,
        adId: value.ad_id != null ? String(value.ad_id) : null,
        adgroupId: value.adgroup_id != null ? String(value.adgroup_id) : null,
        createdTime: value.created_time ? new Date(value.created_time * 1000) : null,
        source: "webhook",
      });
      queued++;
    }
  }

  // Fetch after the response is flushed, so the lead is in the CRM seconds
  // later without Meta ever waiting on Graph. If this never runs — a crash, a
  // cold start killed early — the cron lane drains the same queue.
  if (queued > 0) {
    after(async () => {
      try {
        await drainMetaLeadJobs(queued + 5);
      } catch (e) {
        console.error("[MetaLeadgen] post-response drain failed", e);
      }
    });
  }

  return NextResponse.json({ ok: true, queued });
}
