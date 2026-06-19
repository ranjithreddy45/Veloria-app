import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";
import { notifyAwait } from "@/lib/notify";

export const maxDuration = 60;

// ============================================================
// Payment reminders sweep (daily)
// ------------------------------------------------------------
// Safe, NON-BLOCKING mistake-proofing aid: finds invoices that are
// due soon or already overdue and still carry a balance, then drops an
// in-app Notification for the invoice owner reminding them to chase the
// payment. Touches no booking/payment state machine — read + notify only.
//
// Idempotency: we only nudge at two windows (~15 days out and ~2 days
// out / overdue) and dedupe per invoice + window + calendar day using
// notification.metadata, so a re-run on the same day won't spam.
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000;

type ReminderWindow = "T15" | "T2";

export async function GET(request: Request) {
  try {
    if (!isValidCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const horizon = new Date(now.getTime() + 15 * DAY_MS);

    // Invoices due within the next 15 days OR already past, still unpaid.
    let invoices: Array<{
      id: string;
      invoiceNumber: string;
      dueDate: Date;
      balanceDue: unknown;
      createdById: string;
      booking: { id: string } | null;
    }> = [];
    try {
      invoices = await prisma.invoice.findMany({
        where: {
          status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
          balanceDue: { gt: 0 },
          dueDate: { lte: horizon },
        },
        select: {
          id: true,
          invoiceNumber: true,
          dueDate: true,
          balanceDue: true,
          createdById: true,
          booking: { select: { id: true } },
        },
      });
    } catch (e) {
      console.error("[PAYMENT_REMINDERS] query failed:", e);
      return NextResponse.json({ reminded: 0 });
    }

    let reminded = 0;

    for (const inv of invoices) {
      try {
        const due = new Date(inv.dueDate);
        const daysToDue = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);

        // Pick the window this invoice falls into today.
        // T2 covers anything due in <= 2 days or already overdue (the urgent
        // nudge); T15 covers the gentle heads-up at ~3..15 days out.
        let window: ReminderWindow | null = null;
        if (daysToDue <= 2) window = "T2";
        else if (daysToDue <= 15) window = "T15";
        if (!window) continue;

        const userId = inv.createdById;
        if (!userId) continue;

        // Dedupe: skip if we already reminded this invoice for this window
        // today (metadata carries invoiceId + window + dayKey).
        const already = await prisma.notification.findFirst({
          where: {
            userId,
            type: "PAYMENT_OVERDUE",
            createdAt: { gte: new Date(now.getTime() - DAY_MS) },
            metadata: {
              path: ["paymentReminder"],
              equals: `${inv.id}:${window}:${dayKey}`,
            },
          },
          select: { id: true },
        });
        if (already) continue;

        const balance = Number(inv.balanceDue);
        const balanceLabel = `₹${balance.toLocaleString("en-IN")}`;
        const isOverdue = daysToDue < 0;
        const title = isOverdue
          ? "Overdue payment needs chasing"
          : "Payment due soon";
        const message = isOverdue
          ? `Invoice ${inv.invoiceNumber} is overdue with ${balanceLabel} still outstanding.`
          : `Invoice ${inv.invoiceNumber} has ${balanceLabel} due in ${Math.max(daysToDue, 0)} day${daysToDue === 1 ? "" : "s"}.`;

        await notifyAwait({
          userId,
          type: "PAYMENT_OVERDUE",
          title,
          message,
          actionUrl: `/invoices/${inv.id}`,
          metadata: {
            paymentReminder: `${inv.id}:${window}:${dayKey}`,
            invoiceId: inv.id,
            bookingId: inv.booking?.id ?? null,
            window,
          },
        });
        reminded += 1;
      } catch (e) {
        console.error("[PAYMENT_REMINDERS] per-invoice failed:", e);
        // continue — one bad row must not stop the sweep
      }
    }

    return NextResponse.json({ reminded });
  } catch (error) {
    console.error("[PAYMENT_REMINDERS_CRON_ERROR]", error);
    return NextResponse.json({ reminded: 0 });
  }
}
