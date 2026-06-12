import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { sendSMSFireAndForget } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { instantiateExecutionPlanFromSOP } from "@/lib/sales/ops-handoff";

const fmtINR = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const SLOT_LABEL: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon (11am–3pm)",
  EVENING: "Evening (5pm–10pm)",
  FULL_DAY: "Full Day",
};

/**
 * BookMyShow-style auto-confirm: once a verified payment covers the 10%
 * booking advance, the HOLD booking flips to CONFIRMED — locking the slot —
 * and the customer is sent confirmations across every available channel
 * (email + SMS + WhatsApp). Idempotent (only acts on a HOLD booking) and
 * never throws, so it's safe to call from both the manual recordPayment
 * path and the Razorpay webhook.
 */
export async function maybeConfirmBookingOnPayment(invoiceId: string): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        paidAmount: true,
        totalAmount: true,
        bookingId: true,
        booking: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            bookingNumber: true,
            eventName: true,
            date: true,
            timeSlot: true,
            createdById: true,
            eventType: true,
            contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
            venue: { select: { name: true } },
            createdBy: { select: { name: true, email: true, phone: true } },
          },
        },
      },
    });

    const b = invoice?.booking;
    if (!b || b.status !== "HOLD") return;

    // The booking advance is 10% of the value. Anchor the threshold on the
    // INVOICE total (the same number the 10% installment was computed from),
    // not the booking total — the two can differ by a rupee of GST rounding,
    // and the installment is round(invoiceTotal × 0.10). The ₹1 tolerance then
    // guarantees an exact first-installment payment always clears the bar.
    const threshold = Number(invoice.totalAmount) * 0.1 - 1;
    if (Number(invoice.paidAmount) < threshold) return;

    await prisma.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED" } });

    const dateStr = new Date(b.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const slot = SLOT_LABEL[b.timeSlot] ?? b.timeSlot;
    const name = `${b.contact?.firstName ?? "Guest"} ${b.contact?.lastName ?? ""}`.trim();

    // Notify the owning staff member.
    notify({
      userId: b.createdById,
      type: "PAYMENT_RECEIVED",
      title: "Slot confirmed — advance received",
      message: `${b.bookingNumber} (${b.eventName}) is now CONFIRMED for ${dateStr}, ${slot}.`,
      actionUrl: `/bookings/${b.id}`,
    });

    // Point of contact (the rep who handled the booking) shared with the customer.
    const poc = b.createdBy;
    const pocLine = poc?.name
      ? ` Your point of contact is ${poc.name}${poc.phone ? ` (${poc.phone})` : ""}.`
      : "";

    // Customer confirmations — every channel, all best-effort.
    const line = `Hi ${b.contact?.firstName ?? "there"}, your booking ${b.bookingNumber} at ${b.venue?.name ?? "Veloria Grand"} is CONFIRMED for ${dateStr} (${slot}). Thank you for the advance payment.${pocLine} — Veloria Grand`;

    if (b.contact?.email) {
      sendEmail({
        to: b.contact.email,
        subject: `Booking Confirmed — ${b.bookingNumber}`,
        html: `<p>Dear ${name || "Guest"},</p><p>Your booking <strong>${b.bookingNumber}</strong> at <strong>${b.venue?.name ?? "Veloria Grand"}</strong> is <strong>confirmed</strong> for <strong>${dateStr}</strong> (${slot}).</p><p>We have received your booking advance and the slot is now locked in your name.</p>${
          poc?.name
            ? `<p><strong>Your point of contact:</strong> ${poc.name}${poc.phone ? ` · ${poc.phone}` : ""}${poc.email ? ` · ${poc.email}` : ""}</p>`
            : ""
        }<p>Warm regards,<br/>Veloria Grand</p>`,
      }).catch((e) => console.error("[CONFIRM_EMAIL_ERROR]", e));
    }
    if (b.contact?.phone) {
      sendSMSFireAndForget({ to: b.contact.phone, message: line });
      sendWhatsApp({ to: b.contact.phone, message: line }).catch((e) => console.error("[CONFIRM_WA_ERROR]", e));
    }

    // Ops handoff: auto-populate the execution plan + tasks from the SOP
    // template so the operations team has its checklist the moment we confirm.
    await instantiateExecutionPlanFromSOP(b.id, b.createdById, b.eventType);
  } catch (e) {
    console.error("[CONFIRM_BOOKING_ON_PAYMENT_ERROR]", e);
  }
}
