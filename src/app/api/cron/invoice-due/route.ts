import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { triggerWorkflows } from "@/lib/workflow-executor";

export const maxDuration = 60;

// ============================================================
// Invoice due / overdue sweep (daily)
// - Marks SENT/PARTIALLY_PAID invoices past their due date as OVERDUE
//   (this is the markOverdue logic, runnable without a user session).
// - Fires PAYMENT_DUE workflows for invoices due within the next 3 days,
//   so PAYMENT_DUE automations (which were previously never fired) run.
// ============================================================

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (
    !authHeader ||
    !process.env.CRON_SECRET ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 1) Mark overdue.
  const overdue = await prisma.invoice.updateMany({
    where: { dueDate: { lt: now }, status: { in: ["SENT", "PARTIALLY_PAID"] } },
    data: { status: "OVERDUE" },
  });

  // 2) Fire PAYMENT_DUE for invoices due within the next 3 days.
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const dueSoon = await prisma.invoice.findMany({
    where: {
      dueDate: { gte: now, lte: soon },
      status: { in: ["SENT", "PARTIALLY_PAID"] },
    },
    select: { id: true, contactId: true, bookingId: true },
  });

  for (const inv of dueSoon) {
    try {
      await triggerWorkflows("PAYMENT_DUE", {
        invoiceId: inv.id,
        contactId: inv.contactId ?? undefined,
        bookingId: inv.bookingId ?? undefined,
      });
    } catch (e) {
      console.error("[INVOICE_DUE] workflow trigger failed:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    markedOverdue: overdue.count,
    paymentDueFired: dueSoon.length,
  });
}
