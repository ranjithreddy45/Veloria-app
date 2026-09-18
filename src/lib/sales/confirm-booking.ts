import { after } from "next/server";
import { initBookingConfirmationArtifacts } from "@/lib/sales/booking-confirmation-artifacts";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { notifyCustomer } from "@/lib/customer-notify";
import { logActivity } from "@/lib/activity-logger";
import { sendEmail } from "@/lib/email";
import { sendSMS, isSmsConfigured } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { provisionEventOperations } from "@/lib/ops/provision";
import { reportSystemFailure } from "@/lib/ops-alert";
import {
  notifyOpsAssignees,
  triggerVendorsForBooking,
  type BookingEventInfo,
} from "@/lib/sales/ops-assignment";

import { SLOT_LABEL } from "@/lib/sales/slot";

// ============================================================
// Customer confirmation delivery — what was actually sent, and what wasn't.
// ------------------------------------------------------------
// Every channel reports its real outcome: sent, failed (with the provider's
// reason), skipped (not configured / nothing to send to), or unconfirmed (no
// answer in time). The outcome is written to the booking's ActivityLog, and
// the booking owner is alerted when the customer was not reached, so nobody
// assumes a confirmation went out when it didn't.
// ============================================================

type ChannelResult =
  | { status: "sent"; detail?: string }
  | { status: "failed"; reason: string }
  | { status: "skipped"; reason: string }
  | { status: "unconfirmed"; reason: string };

const CHANNEL_TIMEOUT_MS = 20_000;

const skipped = (reason: string): ChannelResult => ({ status: "skipped", reason });

/** Await one send, bounded in time, and classify the outcome honestly. */
async function settle(
  send: () => Promise<{ success: boolean; error?: string }>,
  skipReason: (error: string) => string | null = () => null
): Promise<ChannelResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const res = await Promise.race([
      send(),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), CHANNEL_TIMEOUT_MS);
      }),
    ]);
    if (res === "timeout") {
      return { status: "unconfirmed", reason: `no answer from the provider within ${CHANNEL_TIMEOUT_MS / 1000}s` };
    }
    if (res.success) return { status: "sent" };
    const error = res.error || "unknown error";
    const skip = skipReason(error);
    return skip ? skipped(skip) : { status: "failed", reason: error };
  } catch (e) {
    return { status: "failed", reason: e instanceof Error ? e.message : "unknown error" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** The approved WhatsApp template for booking updates, when the team has set one. */
async function bookingUpdateTemplateName(): Promise<string | null> {
  try {
    const cfg = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true },
      select: { bookingUpdateTemplateName: true },
    });
    return cfg?.bookingUpdateTemplateName?.trim() || null;
  } catch {
    return null;
  }
}

const EMAIL_SKIPS: Record<string, string> = {
  "Email not configured": "email is not configured",
  "No deliverable recipient": "no deliverable email address",
};

const CHANNEL_NAME: Record<string, string> = { email: "Email", sms: "SMS", whatsapp: "WhatsApp", app: "App" };

function describeDelivery(record: Record<string, ChannelResult & { via?: string }>): string {
  return Object.entries(record)
    .map(([channel, r]) => {
      const name = `${CHANNEL_NAME[channel] ?? channel}${r.via ? ` (${r.via})` : ""}`;
      const why = "reason" in r ? ` — ${r.reason}` : r.detail ? ` — ${r.detail}` : "";
      return `${name}: ${r.status}${why}`;
    })
    .join(" · ");
}

interface ConfirmationDelivery {
  bookingId: string;
  bookingNumber: string;
  ownerId: string;
  contactId: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  emailSubject: string;
  emailHtml: string;
  /** Plain text for SMS, and for WhatsApp when no approved template is set. */
  textMessage: string;
  /** {{2}} of the approved booking-update template ({{1}} is the first name). */
  templateUpdate: string;
  appTitle: string;
  appMessage: string;
}

async function deliverCustomerConfirmation(d: ConfirmationDelivery): Promise<void> {
  try {
    const template = d.phone ? await bookingUpdateTemplateName() : null;
    const phone = d.phone;
    const [email, sms, whatsapp, app] = await Promise.all([
      d.email
        ? settle(
            () => sendEmail({ to: d.email as string, subject: d.emailSubject, html: d.emailHtml }),
            (error) => EMAIL_SKIPS[error] ?? null
          )
        : Promise.resolve(skipped("no email address on file")),
      !phone
        ? Promise.resolve(skipped("no phone number on file"))
        : !isSmsConfigured()
          ? Promise.resolve(skipped("SMS is not configured"))
          : settle(() => sendSMS({ to: phone, message: d.textMessage })),
      !phone
        ? Promise.resolve(skipped("no phone number on file"))
        : settle(
            () =>
              template
                ? sendWhatsApp({ to: phone, template, params: { "1": d.firstName, "2": d.templateUpdate } })
                : sendWhatsApp({ to: phone, message: d.textMessage }),
            (error) => (error.startsWith("WhatsApp not configured") ? "WhatsApp is not configured" : null)
          ),
      notifyCustomer({
        contactId: d.contactId,
        bookingId: d.bookingId,
        type: "BOOKING_UPDATED",
        title: d.appTitle,
        message: d.appMessage,
        actionUrl: "/app/event",
      }).then(
        (logins): ChannelResult =>
          logins > 0
            ? { status: "sent", detail: `${logins} app login${logins === 1 ? "" : "s"}` }
            : skipped("no app login is linked to this customer")
      ),
    ]);

    const record = {
      email,
      sms,
      whatsapp: { ...whatsapp, via: phone ? (template ? `approved template ${template}` : "text message") : undefined },
      app,
    };
    await logActivity({
      userId: d.ownerId,
      action: "customer_confirmation_delivery",
      entityType: "Booking",
      entityId: d.bookingId,
      changes: { sentBy: "system", ...record },
    });

    const results = [email, sms, whatsapp, app];
    const reached = results.filter((r) => r.status === "sent").length;
    const trouble = results.some((r) => r.status === "failed" || r.status === "unconfirmed");
    if (reached === 0 || trouble) {
      notify({
        userId: d.ownerId,
        type: "SYSTEM",
        title:
          reached === 0
            ? `Customer not told yet: ${d.bookingNumber} is confirmed`
            : `Confirmation not fully delivered: ${d.bookingNumber}`,
        message: describeDelivery(record),
        actionUrl: `/bookings/${d.bookingId}`,
      });
    }
  } catch (e) {
    console.error("[CONFIRM_CUSTOMER_DELIVERY_ERROR]", e);
  }
}

/** After the response when inside a request (the payment call isn't held up); inline otherwise. */
function runAfterResponse(task: () => Promise<void>): Promise<void> {
  try {
    after(task);
    return Promise.resolve();
  } catch {
    return task();
  }
}

/**
 * BookMyShow-style auto-confirm: once a verified payment covers the 20%
 * booking advance, the HOLD booking flips to CONFIRMED — locking the slot —
 * and the customer is sent confirmations on every configured channel (email,
 * SMS, WhatsApp — through the approved booking-update template when one is set —
 * and an in-app notice). Idempotent (only acts on a HOLD booking) and
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
            contactId: true,
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

    // Post-sale SLA artifacts (24h handover + 48h guest-confirm) — best-effort,
    // idempotent, system-actored on the payment path.
    await initBookingConfirmationArtifacts(b.id, null);

    // booking.date is @db.Date (UTC midnight): format the day in IST.
    const dateStr = new Date(b.date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
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
    const venueName = b.venue?.name ?? "Veloria Grand";

    // Customer confirmations: every configured channel, each outcome recorded.
    await runAfterResponse(() =>
      deliverCustomerConfirmation({
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        ownerId: b.createdById,
        contactId: b.contactId,
        email: b.contact?.email ?? null,
        phone: b.contact?.phone ?? null,
        firstName: b.contact?.firstName ?? "there",
        emailSubject: `Booking Confirmed — ${b.bookingNumber}`,
        emailHtml: `<p>Dear ${name || "Guest"},</p><p>Your booking <strong>${b.bookingNumber}</strong> at <strong>${venueName}</strong> is <strong>confirmed</strong> for <strong>${dateStr}</strong> (${slot}).</p><p>We have received your booking advance and the slot is now locked in your name.</p>${
          poc?.name
            ? `<p><strong>Your point of contact:</strong> ${poc.name}${poc.phone ? ` · ${poc.phone}` : ""}${poc.email ? ` · ${poc.email}` : ""}</p>`
            : ""
        }<p>Warm regards,<br/>Veloria Grand</p>`,
        textMessage: `Hi ${b.contact?.firstName ?? "there"}, your booking ${b.bookingNumber} at ${venueName} is CONFIRMED for ${dateStr} (${slot}). Thank you for the advance payment.${pocLine} — Veloria Grand`,
        templateUpdate: `Your booking ${b.bookingNumber} at ${venueName} is confirmed for ${dateStr} (${slot}).`,
        appTitle: `Booking confirmed: ${b.eventName}`,
        appMessage: `${b.bookingNumber} at ${venueName} is confirmed for ${dateStr} (${slot}).`,
      })
    );

    // Shared event context for the ops + vendor triggers below.
    const eventInfo: BookingEventInfo = {
      bookingId: b.id,
      bookingNumber: b.bookingNumber,
      eventName: b.eventName,
      dateStr,
      slot,
      venueName: b.venue?.name ?? "the venue",
    };

    // Ops handoff: provision EVERY team's workspace off one EventOperation root
    // — execution plan + auto-routed tasks, BEO/function sheet, kitchen plan,
    // procurement requisitions, dispatch orders, and vendor-assignment records —
    // from the matched SOP template. Idempotent; on failure we ESCALATE to admins
    // (the reconcile-ops cron is the backstop) rather than failing silently, so a
    // confirmed booking can never end up with no ops checklist unnoticed.
    try {
      const prov = await provisionEventOperations(b.id, b.createdById, b.eventType);
      notifyOpsAssignees(prov.assignments, eventInfo);
    } catch (e) {
      console.error("[CONFIRM_OPS_PROVISION_ERROR]", e);
      await reportSystemFailure({
        area: "Ops provisioning",
        title: `Ops not fully provisioned for ${b.bookingNumber}`,
        detail: `Booking ${b.id}: ${(e as Error).message}. The reconcile-ops cron will retry.`,
        actionUrl: `/bookings/${b.id}`,
      }).catch(() => {});
    }

    // Vendor trigger: alert every attached vendor on their own channels and the
    // internal vendor-coordination team, so the vendor side is engaged on confirm.
    await triggerVendorsForBooking(b.id, eventInfo);
  } catch (e) {
    console.error("[CONFIRM_BOOKING_ON_PAYMENT_ERROR]", e);
  }
}
