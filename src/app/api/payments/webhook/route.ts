import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { applyRazorpayCapture } from "@/lib/payments/apply-capture";
import { reportSystemFailure } from "@/lib/ops-alert";
import { razorpayWebhookSecret } from "@/lib/payments/razorpay-creds";

// ============================================================
// POST: Razorpay Webhook Handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json(
        { success: false, error: "Missing webhook signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const webhookSecret = razorpayWebhookSecret();
    if (!webhookSecret) {
      console.error("[RAZORPAY_WEBHOOK] RAZORPAY_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { success: false, error: "Webhook secret not configured" },
        { status: 500 }
      );
    }
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature);
    const signatureBuf = Buffer.from(signature);
    if (
      expectedBuf.length !== signatureBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      console.error("[RAZORPAY_WEBHOOK] Invalid signature");
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const event = JSON.parse(body);
    const eventType = event.event;

    // Handle payment.captured event
    if (eventType === "payment.captured") {
      const paymentEntity = event.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;

      // Single shared path: idempotent + atomic credit + auto-confirm. Safe to
      // run alongside the browser verify call for the same payment.
      const applied = await applyRazorpayCapture({ razorpayOrderId, razorpayPaymentId });
      if (!applied.ok) {
        console.warn(`[RAZORPAY_WEBHOOK] ${applied.error} for order: ${razorpayOrderId}`);
        return NextResponse.json({ success: true, message: applied.error });
      }
      console.log(
        `[RAZORPAY_WEBHOOK] Payment captured: ${razorpayPaymentId} (${applied.alreadyProcessed ? "already processed" : "credited"})`
      );
    }

    // Handle payment.failed event
    if (eventType === "payment.failed") {
      const paymentEntity = event.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;

      await prisma.payment.updateMany({
        where: {
          razorpayOrderId,
          status: "PENDING",
        },
        data: { status: "FAILED" },
      });

      console.log(
        `[RAZORPAY_WEBHOOK] Payment failed for order: ${razorpayOrderId}`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RAZORPAY_WEBHOOK_ERROR]", error);
    // Return 500 so Razorpay RETRIES — a transient DB/processing error must not
    // be swallowed as success, or a paid customer's invoice silently stays
    // unpaid. Razorpay caps its own retries, so this won't loop forever.
    void reportSystemFailure({
      area: "Payment webhook",
      title: "Razorpay webhook processing failed",
      detail: error instanceof Error ? error.message : "unknown error",
      actionUrl: "/finance",
    });
    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
