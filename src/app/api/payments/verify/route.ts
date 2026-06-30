import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { applyRazorpayCapture } from "@/lib/payments/apply-capture";
import { razorpayKeySecret } from "@/lib/payments/razorpay-creds";

// ============================================================
// POST: Verify Razorpay Payment
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limit: 10 payment verification requests per minute per user
    const identifier = session?.user?.id || request.headers.get("x-forwarded-for") || "anonymous";
    const rateCheck = checkRateLimit(`payment-verify:${identifier}`, { maxRequests: 10, windowSeconds: 60 });
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.resetIn);
    }

    const body = await request.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      invoiceId,
    } = body;

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !invoiceId
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify payment signature
    const generatedSignature = crypto
      .createHmac("sha256", razorpayKeySecret() ?? "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Mark payment as failed
      await prisma.payment.updateMany({
        where: { razorpayOrderId: razorpay_order_id },
        data: { status: "FAILED" },
      });

      return NextResponse.json(
        { success: false, error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    // Idempotently + atomically credit the payment's OWN invoice. We ignore the
    // caller-supplied `invoiceId` for the financial write (it could point at
    // another tenant's invoice) — the helper uses payment.invoiceId — but if it
    // was supplied and disagrees, reject as a tamper signal.
    const applied = await applyRazorpayCapture({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });
    if (!applied.ok) {
      return NextResponse.json({ success: false, error: applied.error }, { status: 404 });
    }
    if (invoiceId && invoiceId !== applied.invoiceId) {
      return NextResponse.json(
        { success: false, error: "Invoice mismatch for this payment" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: { invoiceId: applied.invoiceId } });
  } catch (error) {
    console.error("[RAZORPAY_VERIFY_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
