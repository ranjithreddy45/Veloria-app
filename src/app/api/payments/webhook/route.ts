import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

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
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
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

    if (expectedSignature !== signature) {
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
      const amountInPaise = paymentEntity.amount;
      const amountInRupees = amountInPaise / 100;

      // Find the payment record by Razorpay order ID
      const payment = await prisma.payment.findFirst({
        where: { razorpayOrderId },
        include: {
          invoice: {
            select: { id: true, totalAmount: true, paidAmount: true },
          },
        },
      });

      if (!payment) {
        console.warn(
          `[RAZORPAY_WEBHOOK] No payment found for order: ${razorpayOrderId}`
        );
        // Return 200 to acknowledge receipt even if we can't process
        return NextResponse.json({ success: true, message: "No matching payment found" });
      }

      // Skip if payment is already completed
      if (payment.status === "COMPLETED") {
        return NextResponse.json({ success: true, message: "Payment already processed" });
      }

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

      // Calculate new invoice amounts
      const invoice = payment.invoice;
      const newPaidAmount = Number(invoice.paidAmount) + amountInRupees;
      const newBalanceDue = Number(invoice.totalAmount) - newPaidAmount;
      const newStatus = newBalanceDue <= 0.01 ? "PAID" : "PARTIALLY_PAID";

      // Update payment and invoice in a transaction
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            transactionId: razorpayPaymentId,
            receiptNumber,
            paidAt: new Date(),
          },
        }),
        prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaidAmount,
            balanceDue: Math.max(0, newBalanceDue),
            status: newStatus,
          },
        }),
      ]);

      console.log(
        `[RAZORPAY_WEBHOOK] Payment captured: ${razorpayPaymentId} for order: ${razorpayOrderId}`
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
    // Return 200 even on errors to prevent Razorpay from retrying excessively
    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 200 }
    );
  }
}
