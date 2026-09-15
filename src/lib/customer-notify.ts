import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";

// ============================================================
// Notify the CUSTOMER side of a booking.
//
// Who: every sign-in linked to the contact (CustomerLink) and every verified
// sign-in whose email is the contact's email (the rule the guest app already
// uses to show them the booking, portal-identity); then, by the notice's
// audience, the people the host invited to the booking (BookingCollaborator,
// ACTIVE):
//   BOOKING (default)   every one of them, co-host or viewer
//   HOST_AND_CO_HOSTS   co-hosts only: the people who may read the concierge
//                       conversation (collaborator-permissions)
//   HOST_ONLY           none of them: anything private to the booking's own
//                       customer (money, documents, requests, account)
//
// How:
//  1. An in-app notification per sign-in (metadata.audience CUSTOMER), then a
//     web push to that person's subscribed devices. Push opens the customer
//     app, never the team's /notifications route.
//  2. WhatsApp, through the APPROVED booking-update template
//     (WhatsAppConfig.bookingUpdateTemplateName), to the contact's phone, when
//     a template is set, the customer has not switched WhatsApp updates off
//     (User.notificationPreferences) and no update went to that contact in the
//     last WHATSAPP_THROTTLE_MINUTES. Every attempt is written to
//     WhatsAppMessage, so the team's WhatsApp history shows exactly what the
//     customer was sent.
//
// Never throws. notifyCustomer keeps its contract (the number of sign-ins
// given an in-app notice) and returns as soon as those are saved; push and
// WhatsApp carry on in the background, so a payment capture or a booking
// confirmation is never held up by a provider. notifyCustomerDetailed waits
// for them (WhatsApp at most WHATSAPP_WAIT_MS) and reports what happened, for
// team screens that must tell staff the truth.
// ============================================================

/** Who on the customer side hears about a notice besides the contact's own sign-ins (see the header). */
export type CustomerAudience = "BOOKING" | "HOST_AND_CO_HOSTS" | "HOST_ONLY";

export interface CustomerNotice {
  contactId: string;
  bookingId?: string | null;
  type?: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
  /**
   * Default BOOKING: everyone the host invited to bookingId is told too. Pass
   * HOST_ONLY for anything private to the booking's own customer (money,
   * documents, requests, account) and HOST_AND_CO_HOSTS for the concierge
   * conversation. bookingId is recorded on the notice either way.
   */
  audience?: CustomerAudience;
}

export type WhatsAppSkipReason = "NO_CONTACT" | "NO_TEMPLATE" | "NO_PHONE" | "OPTED_OUT" | "RECENTLY_SENT";

export type WhatsAppDecision = { send: true; to: string; template: string } | { send: false; reason: WhatsAppSkipReason };

export type WhatsAppOutcome =
  /** The provider ACCEPTED the template message. Not a delivery or read receipt. */
  | { status: "SENT"; messageId: string | null }
  | { status: "FAILED"; error: string }
  /** No answer from the provider within WHATSAPP_WAIT_MS; the result is still logged when it comes. */
  | { status: "NO_ANSWER" }
  | { status: "SKIPPED"; reason: WhatsAppSkipReason };

export interface CustomerDeliveryReport {
  /** Customer sign-ins that now have an in-app notification. */
  inApp: number;
  whatsapp: WhatsAppOutcome;
}

export interface CustomerReach {
  /** Customer sign-ins that would get an in-app notice; null when it couldn't be checked. */
  appLogins: number | null;
  /** What WhatsApp would do now (throttle aside); null when it couldn't be checked. */
  whatsapp: WhatsAppDecision | null;
}

/** At most one WhatsApp update per contact in this many minutes. In-app notices are never held back. */
export const WHATSAPP_THROTTLE_MINUTES = 20;
export const WHATSAPP_WAIT_MS = 8000;
const CUSTOMER_DEFAULT_URL = "/app/notifications";

// ------------------------------------------------------------ pure rules (unit-tested)

/** Settings → Notifications preference key for a notification type. */
export function preferenceKeyFor(type: NotificationType | string | null | undefined): string {
  switch (type) {
    case "PAYMENT_RECEIVED":
      return "payment_received";
    case "PAYMENT_OVERDUE":
      return "payment_due";
    case "INVOICE_SENT":
      return "invoice_sent";
    case "INVITATION_SENT":
    case "RSVP_RECEIVED":
      return "event_reminder";
    default:
      return "booking_confirmed";
  }
}

function record(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * May this sign-in receive WhatsApp updates for `eventKey`? Only an explicit
 * `false` switches them off. No record means the default (on), the way
 * shouldSendNotification() treats a user with no preferences. Shapes read:
 *  - the Settings → Notifications array: [{ key, emailEnabled, smsEnabled, whatsappEnabled? }],
 *    where a row for this event key (or key "whatsapp") has whatsappEnabled: false
 *  - an object: { whatsapp: false } | { whatsappEnabled: false } |
 *    { channels: { whatsapp: false } } | { [eventKey]: { whatsapp: false } }
 * smsEnabled is NOT read as a WhatsApp switch.
 */
export function whatsappAllowedByPreferences(value: unknown, eventKey: string): boolean {
  if (Array.isArray(value)) {
    return !value.some((row) => {
      const r = record(row);
      return !!r && (r.key === eventKey || r.key === "whatsapp") && r.whatsappEnabled === false;
    });
  }
  const o = record(value);
  if (!o) return true;
  if (o.whatsapp === false || o.whatsappEnabled === false) return false;
  if (record(o.channels)?.whatsapp === false) return false;
  const perEvent = record(o[eventKey]);
  return !(perEvent && (perEvent.whatsapp === false || perEvent.whatsappEnabled === false));
}

/** Checked in order: template, phone, opt-out (any of the contact's sign-ins), throttle. */
export function decideWhatsAppDelivery(input: {
  templateName: string | null | undefined;
  phone: string | null | undefined;
  preferences: unknown[];
  eventKey: string;
  lastTemplateSentAt: Date | null;
  now: Date;
  throttleMinutes?: number;
}): WhatsAppDecision {
  const template = input.templateName?.trim();
  if (!template) return { send: false, reason: "NO_TEMPLATE" };
  const phone = input.phone?.trim() ?? "";
  if (phone.replace(/\D/g, "").length < 8) return { send: false, reason: "NO_PHONE" };
  if (input.preferences.some((p) => !whatsappAllowedByPreferences(p, input.eventKey))) {
    return { send: false, reason: "OPTED_OUT" };
  }
  const windowMs = (input.throttleMinutes ?? WHATSAPP_THROTTLE_MINUTES) * 60_000;
  if (input.lastTemplateSentAt && input.now.getTime() - input.lastTemplateSentAt.getTime() < windowMs) {
    return { send: false, reason: "RECENTLY_SENT" };
  }
  return { send: true, to: phone, template };
}

/** WhatsApp rejects template parameters with line breaks, tabs or runs of spaces: flatten and cap. */
export function sanitizeTemplateParam(value: string, max: number): string {
  const flat = value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/**
 * Body parameters for the booking-update template, in order:
 *   {{1}} the customer's first name ("there" when unknown)
 *   {{2}} the update, "<title>: <message>" on one line (at most 900 characters)
 * e.g. "Hi {{1}}, there's an update on your Veloria Grand booking. {{2}} Open the Veloria app for details."
 */
export function bookingUpdateTemplateParams(input: {
  firstName: string | null | undefined;
  title: string;
  message: string;
}): Record<string, string> {
  return {
    customerName: sanitizeTemplateParam(input.firstName ?? "", 60) || "there",
    update: sanitizeTemplateParam([input.title, input.message].filter(Boolean).join(": "), 900),
  };
}

// ------------------------------------------------------------ delivery

type LiveContact = { id: string; firstName: string; email: string | null; phone: string | null };

async function loadContact(contactId: string): Promise<LiveContact | null> {
  const c = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, firstName: true, email: true, phone: true, deletedAt: true },
  });
  return c && !c.deletedAt ? { id: c.id, firstName: c.firstName, email: c.email, phone: c.phone } : null;
}

function uniqueIds(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/** The invited people an audience reaches on a booking; null when none are told (HOST_ONLY). */
function invitedWhere(bookingId: string, audience: CustomerAudience): Prisma.BookingCollaboratorWhereInput | null {
  if (audience === "HOST_ONLY") return null;
  return { bookingId, status: "ACTIVE", userId: { not: null }, ...(audience === "HOST_AND_CO_HOSTS" ? { role: "CO_HOST" } : {}) };
}

async function customerLogins(
  contactId: string,
  contact: LiveContact | null,
  bookingId: string | null | undefined,
  audience: CustomerAudience = "BOOKING"
): Promise<{ contactUserIds: string[]; allUserIds: string[] }> {
  const invited = bookingId ? invitedWhere(bookingId, audience) : null;
  const [links, verified, collaborators] = await Promise.all([
    prisma.customerLink.findMany({ where: { contactId }, select: { userId: true } }),
    contact?.email
      ? prisma.user.findMany({
          where: { email: contact.email, emailVerified: { not: null }, isActive: true },
          select: { id: true },
        })
      : Promise.resolve([] as { id: string }[]),
    invited
      ? prisma.bookingCollaborator.findMany({ where: invited, select: { userId: true } })
      : Promise.resolve([] as { userId: string | null }[]),
  ]);
  const contactUserIds = uniqueIds([...links.map((l) => l.userId), ...verified.map((u) => u.id)]);
  return { contactUserIds, allUserIds: uniqueIds([...contactUserIds, ...collaborators.map((c) => c.userId)]) };
}

/** One notification row per sign-in; returns the sign-ins whose row was actually saved. */
async function createInApp(userIds: string[], n: CustomerNotice): Promise<string[]> {
  const metadata: Prisma.InputJsonValue = {
    audience: "CUSTOMER",
    contactId: n.contactId,
    ...(n.bookingId ? { bookingId: n.bookingId } : {}),
  };
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type: n.type ?? "BOOKING_UPDATED",
          title: n.title,
          message: n.message,
          actionUrl: n.actionUrl || null,
          metadata,
        },
        select: { userId: true },
      })
    )
  );
  const saved: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") saved.push(r.value.userId);
    else console.error("[CUSTOMER_NOTIFY] in-app notice failed", r.reason);
  }
  return saved;
}

async function customerPreferences(userIds: string[]): Promise<unknown[]> {
  if (userIds.length === 0) return [];
  const rows = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { notificationPreferences: true } });
  return rows.map((u) => u.notificationPreferences);
}

async function activeTemplateName(): Promise<string | null> {
  const config = await prisma.whatsAppConfig.findFirst({
    where: { isActive: true },
    select: { bookingUpdateTemplateName: true },
  });
  return config?.bookingUpdateTemplateName?.trim() || null;
}

type SendOutcome = { ok: true; messageId: string | null } | { ok: false; error: string };

async function deliverWhatsApp(contact: LiveContact, contactUserIds: string[], n: CustomerNotice): Promise<WhatsAppOutcome> {
  const templateName = await activeTemplateName();
  if (!templateName) return { status: "SKIPPED", reason: "NO_TEMPLATE" };
  const preferences = await customerPreferences(contactUserIds);
  const last = await prisma.whatsAppMessage.findFirst({
    where: { contactId: contact.id, direction: "OUTBOUND", templateName, status: { not: "FAILED" } },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  const decision = decideWhatsAppDelivery({
    templateName,
    phone: contact.phone,
    preferences,
    eventKey: preferenceKeyFor(n.type),
    lastTemplateSentAt: last?.sentAt ?? null,
    now: new Date(),
  });
  if (!decision.send) return { status: "SKIPPED", reason: decision.reason };

  const { to, template } = decision;
  const content = `${n.title}: ${n.message}`.slice(0, 1000);
  const attempt: Promise<SendOutcome> = sendWhatsApp({
    to,
    template,
    params: bookingUpdateTemplateParams({ firstName: contact.firstName, title: n.title, message: n.message }),
  })
    .then(
      (r): SendOutcome =>
        r.success
          ? { ok: true, messageId: r.messageId ?? null }
          : { ok: false, error: r.error || "The WhatsApp provider refused the message." },
      (e: unknown): SendOutcome => ({ ok: false, error: e instanceof Error ? e.message : "WhatsApp send failed." })
    )
    .then(async (o) => {
      // Logged whether or not anyone is still waiting, so the WhatsApp history is complete.
      await prisma.whatsAppMessage
        .create({
          data: {
            direction: "OUTBOUND",
            content,
            templateName: template,
            status: o.ok ? "SENT" : "FAILED",
            whatsappId: o.ok ? o.messageId : null,
            failureReason: o.ok ? null : o.error,
            contactId: contact.id,
          },
        })
        .catch((err) => console.error("[CUSTOMER_NOTIFY] WhatsApp log failed", err));
      return o;
    });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const noAnswer = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), WHATSAPP_WAIT_MS);
  });
  try {
    const o = await Promise.race([attempt, noAnswer]);
    if (!o) return { status: "NO_ANSWER" };
    return o.ok ? { status: "SENT", messageId: o.messageId } : { status: "FAILED", error: o.error };
  } finally {
    clearTimeout(timer);
  }
}

interface Prepared {
  contact: LiveContact | null;
  contactUserIds: string[];
  /** Sign-ins whose in-app notice was saved. */
  saved: string[];
}

/** Who to tell, and their in-app notices (awaited, so the count is real). */
async function prepare(n: CustomerNotice): Promise<Prepared> {
  const contact = await loadContact(n.contactId);
  const { contactUserIds, allUserIds } = await customerLogins(n.contactId, contact, n.bookingId, n.audience);
  const saved = await createInApp(allUserIds, n);
  return { contact, contactUserIds, saved };
}

/** Push to each notified sign-in, plus the WhatsApp update. Starts at once; the promise never rejects. */
function startChannels(n: CustomerNotice, p: Prepared): Promise<WhatsAppOutcome> {
  const url = n.actionUrl || CUSTOMER_DEFAULT_URL;
  const push = Promise.allSettled(p.saved.map((userId) => sendPushToUser(userId, { title: n.title, body: n.message, url })));
  const whatsapp: Promise<WhatsAppOutcome> = p.contact
    ? deliverWhatsApp(p.contact, p.contactUserIds, n).catch((err): WhatsAppOutcome => {
        console.error("[CUSTOMER_NOTIFY] WhatsApp step failed", err);
        return { status: "FAILED", error: err instanceof Error ? err.message : "WhatsApp step failed." };
      })
    : Promise.resolve({ status: "SKIPPED", reason: "NO_CONTACT" });
  return Promise.all([push, whatsapp]).then(([, outcome]) => outcome);
}

/**
 * Notify the customer side of a booking. Returns how many sign-ins got an
 * in-app notice, as soon as those are saved; push and WhatsApp continue in
 * the background. Never throws.
 */
export async function notifyCustomer(n: CustomerNotice): Promise<number> {
  let prepared: Prepared;
  try {
    prepared = await prepare(n);
  } catch (err) {
    console.error("[CUSTOMER_NOTIFY]", err);
    return 0;
  }
  try {
    startChannels(n, prepared).catch((err) => console.error("[CUSTOMER_NOTIFY]", err));
  } catch (err) {
    console.error("[CUSTOMER_NOTIFY]", err);
  }
  return prepared.saved.length;
}

/** Notify the customer side and wait to report exactly what happened on each channel. Never throws. */
export async function notifyCustomerDetailed(n: CustomerNotice): Promise<CustomerDeliveryReport> {
  let prepared: Prepared;
  try {
    prepared = await prepare(n);
  } catch (err) {
    console.error("[CUSTOMER_NOTIFY]", err);
    return { inApp: 0, whatsapp: { status: "FAILED", error: "Couldn't reach the notification service." } };
  }
  try {
    return { inApp: prepared.saved.length, whatsapp: await startChannels(n, prepared) };
  } catch (err) {
    console.error("[CUSTOMER_NOTIFY]", err);
    return { inApp: prepared.saved.length, whatsapp: { status: "FAILED", error: "WhatsApp step failed." } };
  }
}

/** How a message to this customer, for this audience, would reach them right now, for team screens. Never throws. */
export async function describeCustomerReach(
  contactId: string,
  bookingId?: string | null,
  audience: CustomerAudience = "BOOKING"
): Promise<CustomerReach> {
  try {
    const contact = await loadContact(contactId);
    const { contactUserIds, allUserIds } = await customerLogins(contactId, contact, bookingId, audience);
    if (!contact) return { appLogins: allUserIds.length, whatsapp: { send: false, reason: "NO_CONTACT" } };
    const [templateName, preferences] = await Promise.all([activeTemplateName(), customerPreferences(contactUserIds)]);
    return {
      appLogins: allUserIds.length,
      whatsapp: decideWhatsAppDelivery({
        templateName,
        phone: contact.phone,
        preferences,
        eventKey: preferenceKeyFor("BOOKING_UPDATED"),
        lastTemplateSentAt: null,
        now: new Date(),
      }),
    };
  } catch (err) {
    console.error("[CUSTOMER_NOTIFY] reach check failed", err);
    return { appLogins: null, whatsapp: null };
  }
}
