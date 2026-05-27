import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getTelephonyAdapter, mapStatusToDisposition } from "@/lib/telephony";

export async function POST(req: NextRequest) {
  try {
    const provider = req.nextUrl.searchParams.get("provider")?.toUpperCase();

    if (!provider || !["EXOTEL", "KNOWLARITY", "MYOPERATOR"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const config = await prisma.telephonyConfig.findFirst({
      where: { provider: provider as any, isActive: true },
    });

    if (!config) {
      return NextResponse.json({ error: "No config found for provider" }, { status: 404 });
    }

    // Verify webhook secret if configured
    if (config.webhookSecret) {
      const authHeader = req.headers.get("authorization") || req.headers.get("x-webhook-secret") || "";
      const expected = config.webhookSecret;
      const headerValue = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
      if (
        !headerValue ||
        headerValue.length !== expected.length ||
        !timingSafeEqual(Buffer.from(headerValue), Buffer.from(expected))
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();
    const adapter = getTelephonyAdapter(config);
    const event = adapter.parseWebhook(body);

    if (!event || !event.externalCallId) {
      console.log("[Telephony Webhook] Could not parse event:", JSON.stringify(body).slice(0, 500));
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Find the call log by external call ID
    const callLog = await prisma.callLog.findFirst({
      where: { externalCallId: event.externalCallId },
    });

    if (!callLog) {
      console.log("[Telephony Webhook] No call log found for:", event.externalCallId);
      return NextResponse.json({ status: "no_match" }, { status: 200 });
    }

    // Update with recording and duration
    const updateData: Record<string, unknown> = {};

    if (event.recordingUrl) {
      updateData.recordingUrl = event.recordingUrl;
    }

    if (event.durationSeconds !== undefined && event.durationSeconds > 0) {
      updateData.durationSeconds = event.durationSeconds;
    }

    if (event.status) {
      updateData.disposition = mapStatusToDisposition(event.status);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.callLog.update({
        where: { id: callLog.id },
        data: updateData,
      });
    }

    console.log(`[Telephony Webhook] Updated call ${callLog.id}: status=${event.status}, recording=${!!event.recordingUrl}`);

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[Telephony Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
