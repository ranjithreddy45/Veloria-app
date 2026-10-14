import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { clientIpOfHeaders } from "@/lib/hr/geo";
import { isStaffRole } from "@/lib/roles";
import { razorpayKeyId, razorpayKeySecret } from "@/lib/payments/razorpay-creds";
import { HOLD_FACTS_SELECT } from "@/lib/holds/lapsed-hold";
import {
  CANCELLED_BOOKING_CHECKOUT_ERROR,
  CUSTOMER_HOLD_CHECKOUT_ERROR,
  bookingIsCancelled,
  holdCheckoutRefusal,
} from "@/lib/holds/checkout-guard";

// ============================================================
// Razorpay Instance (lazy init to avoid build-time errors)
// ============================================================

function getRazorpay() {
  return new Razorpay({
    key_id: razorpayKeyId(),
    key_secret: razorpayKeySecret(),
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
    const identifier = session?.user?.id || clientIpOfHeaders(request.headers) || "anonymous";
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
      select: {
        id: true,
        balanceDue: true,
        status: true,
        invoiceNumber: true,
        contactId: true,
        // The booking's status, hold window and money on ALL its invoices: the
        // facts the one lapsed-hold rule needs (src/lib/holds/lapsed-hold.ts).
        booking: { select: HOLD_FACTS_SELECT },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // IDOR guard: staff (by allowlist) may pay any invoice; a portal customer
    // (CLIENT) only one that belongs to one of THEIR contacts. Every other
    // login — a vendor, a venue owner — has no invoices of its own and gets
    // the same "not found" (this used to treat any role but CLIENT as staff).
    const role = session.user.role;
    if (!isStaffRole(role)) {
      if (role !== "CLIENT") {
        return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
      }
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

    // A cancelled booking's date is no longer reserved. The public pay links
    // refuse a checkout on any of its invoices, and so does the portal, in the
    // invoice link's words (createPublicRazorpayOrder); the portal's invoice
    // pages hide the Pay button with the same words (portalPayState). Checked
    // after the ownership guard, so nobody learns the state of someone else's
    // booking.
    if (bookingIsCancelled(invoice.booking)) {
      return NextResponse.json(
        { success: false, error: CANCELLED_BOOKING_CHECKOUT_ERROR },
        { status: 409 }
      );
    }

    // The same hold rules and words as the public pay links
    // (createPublicRazorpayOrder, createSplitRazorpayOrder;
    // src/lib/holds/checkout-guard.ts): no checkout on a lapsed hold, and no NEW
    // checkout once the hold's window has passed unless money that doesn't rely
    // on a checkout's 15-minute grace is already against the booking. Every order
    // restarts that grace, so otherwise reopening checkout would keep an expired
    // hold's date indefinitely. Checked after the ownership guard, so nobody
    // learns the state of someone else's hold.
    const holdRefusal = holdCheckoutRefusal(invoice.booking, new Date());
    if (holdRefusal) {
      return NextResponse.json(
        { success: false, error: CUSTOMER_HOLD_CHECKOUT_ERROR[holdRefusal] },
        { status: 409 }
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
        keyId: razorpayKeyId(),
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
