import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

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
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
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

    // Find the pending payment
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment record not found" },
        { status: 404 }
      );
    }

    // Get invoice for balance calculations
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { totalAmount: true, paidAmount: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    const paymentAmount = Number(payment.amount);
    const newPaidAmount = Number(invoice.paidAmount) + paymentAmount;
    const newBalanceDue = Number(invoice.totalAmount) - newPaidAmount;
    const newStatus = newBalanceDue <= 0.01 ? "PAID" : "PARTIALLY_PAID";

    // Generate receipt number
    const year = new Date().getFullYear();
    const prefix = `RCP-${year}-`;
    const lastPayment = await prisma.payment.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" },
      select: { receiptNumber: true },
    });

    let nextNumber = 1;
    if (lastPayment?.receiptNumber) {
      const lastNum = parseInt(
        lastPayment.receiptNumber.split("-").pop() || "0",
        10
      );
      nextNumber = lastNum + 1;
    }
    const receiptNumber = `${prefix}${String(nextNumber).padStart(4, "0")}`;

    // Update payment and invoice in a transaction
    const [updatedPayment] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          transactionId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          receiptNumber,
          paidAt: new Date(),
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: Math.max(0, newBalanceDue),
          status: newStatus,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: updatedPayment,
    });
  } catch (error) {
    console.error("[RAZORPAY_VERIFY_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
