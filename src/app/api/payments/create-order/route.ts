import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// ============================================================
// Razorpay Instance (lazy init to avoid build-time errors)
// ============================================================

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

// ============================================================
// POST: Create Razorpay Order
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

    // Rate limit: 10 payment creation requests per minute per user
    const identifier = session?.user?.id || request.headers.get("x-forwarded-for") || "anonymous";
    const rateCheck = checkRateLimit(`payment-create:${identifier}`, { maxRequests: 10, windowSeconds: 60 });
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.resetIn);
    }

    const body = await request.json();
    const { invoiceId, amount, receipt } = body;

    if (!invoiceId || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify invoice exists and amount is valid
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, balanceDue: true, status: true, invoiceNumber: true, contactId: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // IDOR guard: a portal customer (non-staff) may only pay an invoice that
    // belongs to one of THEIR contacts. Staff roles may pay any invoice.
    const role = (session.user as { role?: string }).role;
    const isStaff = !!role && role !== "CLIENT";
    if (!isStaff) {
      const u = await prisma.user.findUnique({
        where: { id: session.user.id as string },
        select: { email: true },
      });
      const myContacts = u?.email
        ? await prisma.contact.findMany({ where: { email: u.email, deletedAt: null }, select: { id: true } })
        : [];
      if (!myContacts.some((c) => c.id === invoice.contactId)) {
        // Don't leak existence — return 404.
        return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
      }
    }

    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Cannot create order for this invoice" },
        { status: 400 }
      );
    }

    const balanceDue = Number(invoice.balanceDue);
    if (amount > balanceDue + 0.01) {
      return NextResponse.json(
        { success: false, error: "Amount exceeds balance due" },
        { status: 400 }
      );
    }

    // Create Razorpay order (amount in paise)
    const amountInPaise = Math.round(amount * 100);
    const order = await getRazorpay().orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt || invoice.invoiceNumber,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    // Create a pending payment record
    await prisma.payment.create({
      data: {
        invoiceId,
        amount,
        method: "RAZORPAY",
        status: "PENDING",
        razorpayOrderId: order.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        amount: amountInPaise,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error("[RAZORPAY_CREATE_ORDER_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}
