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
 * BookMyShow-style auto-confirm: once a verified payment covers the 20%
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
            guestCount: true,
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

    // The booking advance is 20% of the value. Anchor the threshold on the
    // INVOICE total (the same number the 20% installment was computed from),
    // not the booking total — the two can differ by a rupee of GST rounding,
    // and the installment is round(invoiceTotal × 0.20). The ₹1 tolerance then
    // guarantees an exact first-installment payment always clears the bar.
    const threshold = Number(invoice.totalAmount) * 0.2 - 1;
    if (Number(invoice.paidAmount) < threshold) return;

    // Atomic, once-only flip. Razorpay commonly fires the client success handler
    // AND the server webhook for the same payment, so two confirm runs can race.
    // A conditional updateMany keyed on status=HOLD means exactly one wins; the
    // loser sees count 0 and bails BEFORE any side effects (notifications, SOP
    // tasks, BEO auto-create), so none of them ever run twice.
    const confirmed = await prisma.booking.updateMany({
      where: { id: b.id, status: "HOLD" },
      data: { status: "CONFIRMED" },
    });
    if (confirmed.count === 0) return;

    const dateStr = new Date(b.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const slot = SLOT_LABEL[b.timeSlot] ?? b.timeSlot;
    const name = `${b.contact?.firstName ?? "Guest"} ${b.contact?.lastName ?? ""}`.trim();

    // Point of contact (the rep who handled the booking) shared with the customer.
    const poc = b.createdBy;
    const pocContact = poc?.name ? `${poc.name}${poc.phone ? ` · ${poc.phone}` : ""}` : "Sales team";

    // Notify the owning staff member.
    notify({
      userId: b.createdById,
      type: "PAYMENT_RECEIVED",
      title: "Slot confirmed — advance received",
      message: `${b.bookingNumber} (${b.eventName}) is now CONFIRMED for ${dateStr}, ${slot}.`,
      actionUrl: `/bookings/${b.id}`,
    });

    // Share the booking + POC with the operations team so they can take over
    // (their task checklist is also auto-created below).
    const opsUsers = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["OPERATIONS", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"] } },
      select: { id: true },
    });
    for (const o of opsUsers) {
      if (o.id === b.createdById) continue;
      notify({
        userId: o.id,
        type: "BOOKING_CREATED",
        title: "New confirmed booking for ops",
        message: `${b.bookingNumber} — ${name} on ${dateStr} (${slot}) at ${b.venue?.name ?? "venue"}. POC: ${pocContact}.`,
        actionUrl: `/bookings/${b.id}`,
      });
    }

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

    // Auto-create the Function Sheet (BEO) so ops has the day-of document ready.
    // Best-effort + idempotent (one BEO per booking).
    await ensureBeoForBooking(b.id, b.createdById, b.guestCount ?? null).catch((e) =>
      console.error("[CONFIRM_BEO_ERROR]", e)
    );
  } catch (e) {
    console.error("[CONFIRM_BOOKING_ON_PAYMENT_ERROR]", e);
  }
}

// System-level BEO creation (no session) for the auto-confirm path. Mirrors
// createBeo's sequential number allocation + P2002 retry, and is idempotent:
// one Function Sheet per booking.
async function ensureBeoForBooking(
  bookingId: string,
  createdById: string,
  covers: number | null
): Promise<void> {
  const existing = await prisma.beo.findFirst({ where: { bookingId }, select: { id: true } });
  if (existing) return;
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt++) {
    const count = await prisma.beo.count({ where: { beoNumber: { startsWith: `BEO-${year}-` } } });
    const beoNumber = `BEO-${year}-${String(count + 1 + attempt).padStart(3, "0")}`;
    try {
      await prisma.beo.create({
        data: { beoNumber, bookingId, status: "DRAFT", covers, createdById },
      });
      return;
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") continue; // number raced — retry
      throw e;
    }
  }
}
