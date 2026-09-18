import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// notifyCustomer: who is told, how, and what is reported back.
// Prisma, push and the WhatsApp provider are mocked, so this runs without a
// database. The honesty rules pinned here: a notice that failed to save is
// not counted, a refused or unanswered WhatsApp message is never reported as
// sent, a slow provider never holds up the caller, and a failure never
// breaks the caller.
// ============================================================

const db = vi.hoisted(() => ({
  contact: { findUnique: vi.fn() },
  customerLink: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  bookingCollaborator: { findMany: vi.fn() },
  notification: { create: vi.fn() },
  whatsAppConfig: { findFirst: vi.fn() },
  whatsAppMessage: { findFirst: vi.fn(), create: vi.fn() },
}));
const sendWhatsApp = vi.hoisted(() => vi.fn());
const sendPushToUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db, default: db }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp }));
vi.mock("@/lib/push/send", () => ({ sendPushToUser }));

import {
  bookingUpdateTemplateParams,
  decideWhatsAppDelivery,
  describeCustomerReach,
  notifyCustomer,
  notifyCustomerDetailed,
  preferenceKeyFor,
  whatsappAllowedByPreferences,
  WHATSAPP_THROTTLE_MINUTES,
  WHATSAPP_WAIT_MS,
} from "./customer-notify";

interface World {
  template?: string | null;
  phone?: string | null;
  links?: string[];
  verified?: string[];
  cohosts?: string[];
  prefs?: Record<string, unknown>;
  lastSentMinutesAgo?: number | null;
}

function world(w: World = {}) {
  db.contact.findUnique.mockResolvedValue({
    id: "c1",
    firstName: "Priya",
    email: "priya@example.com",
    phone: w.phone === undefined ? "+91 98450 12345" : w.phone,
    deletedAt: null,
  });
  db.customerLink.findMany.mockResolvedValue((w.links ?? ["u1"]).map((userId) => ({ userId })));
  db.bookingCollaborator.findMany.mockResolvedValue((w.cohosts ?? []).map((userId) => ({ userId })));
  db.user.findMany.mockImplementation(async (args: { where: { email?: string; id?: { in: string[] } } }) => {
    if (args.where.email) return (w.verified ?? []).map((id) => ({ id }));
    return (args.where.id?.in ?? []).map((id) => ({ notificationPreferences: w.prefs?.[id] ?? null }));
  });
  db.notification.create.mockImplementation(async (args: { data: { userId: string } }) => ({ userId: args.data.userId }));
  db.whatsAppConfig.findFirst.mockResolvedValue(
    w.template === null ? null : { bookingUpdateTemplateName: w.template ?? "booking_update" }
  );
  db.whatsAppMessage.findFirst.mockResolvedValue(
    w.lastSentMinutesAgo == null ? null : { sentAt: new Date(Date.now() - w.lastSentMinutesAgo * 60_000) }
  );
  db.whatsAppMessage.create.mockResolvedValue({ id: "wm1" });
  sendWhatsApp.mockResolvedValue({ success: true, messageId: "wamid.1" });
  sendPushToUser.mockResolvedValue({ sent: 1, failed: 0, removed: 0, skipped: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("in-app notices", () => {
  it("gives each customer sign-in exactly one notice (linked, email-verified or co-host) and returns that count", async () => {
    world({ template: null, links: ["u1"], verified: ["u1", "u2"], cohosts: ["u3"] });
    const count = await notifyCustomer({ contactId: "c1", bookingId: "b1", title: "Reply", message: "Hello" });
    expect(count).toBe(3);
    const users = db.notification.create.mock.calls.map((c) => c[0].data.userId).sort();
    expect(users).toEqual(["u1", "u2", "u3"]);
    expect(db.notification.create.mock.calls[0][0].data.metadata).toMatchObject({ audience: "CUSTOMER", bookingId: "b1" });
  });

  it("opens the customer app from a push, never the team's notifications page", async () => {
    world({ template: null });
    await notifyCustomer({ contactId: "c1", title: "Reply", message: "Hello" });
    expect(sendPushToUser).toHaveBeenCalledWith("u1", expect.objectContaining({ url: "/app/notifications" }));
    await notifyCustomer({ contactId: "c1", title: "Reply", message: "Hello", actionUrl: "/app/concierge" });
    expect(sendPushToUser).toHaveBeenLastCalledWith("u1", expect.objectContaining({ url: "/app/concierge" }));
  });

  it("does not count, or push, a notice that failed to save", async () => {
    world({ template: null, links: ["u1", "u2"] });
    db.notification.create.mockImplementation(async (args: { data: { userId: string } }) => {
      if (args.data.userId === "u2") throw new Error("write failed");
      return { userId: args.data.userId };
    });
    expect(await notifyCustomer({ contactId: "c1", title: "t", message: "m" })).toBe(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
  });

  it("never throws, even when the database is unreachable", async () => {
    world({ template: null });
    db.contact.findUnique.mockRejectedValue(new Error("connection refused"));
    await expect(notifyCustomer({ contactId: "c1", title: "t", message: "m" })).resolves.toBe(0);
    const report = await notifyCustomerDetailed({ contactId: "c1", title: "t", message: "m" });
    expect(report.inApp).toBe(0);
    expect(report.whatsapp.status).toBe("FAILED");
  });

  it("returns once the in-app notices are saved, without waiting for a slow WhatsApp provider", async () => {
    vi.useFakeTimers();
    world();
    sendWhatsApp.mockImplementation(() => new Promise(() => undefined)); // the provider never answers
    await expect(notifyCustomer({ contactId: "c1", title: "t", message: "m" })).resolves.toBe(1);
  });
});

describe("audience", () => {
  it("by default also tells everyone the host invited to the booking", async () => {
    world({ template: null, links: ["u1"], cohosts: ["u3", "u4"] });
    expect(await notifyCustomer({ contactId: "c1", bookingId: "b1", title: "Booking confirmed", message: "See you soon" })).toBe(3);
    expect(db.bookingCollaborator.findMany).toHaveBeenCalledWith({
      where: { bookingId: "b1", status: "ACTIVE", userId: { not: null } },
      select: { userId: true },
    });
  });

  it("HOST_ONLY tells only the contact's own sign-ins, and never looks up who was invited", async () => {
    world({ template: null, links: ["u1"], verified: ["u2"], cohosts: ["u3"] });
    const count = await notifyCustomer({
      contactId: "c1",
      bookingId: "b1",
      title: "Your menu request: Accepted",
      message: "12 dishes are now on the menu. Note from the team: tasting on Friday.",
      audience: "HOST_ONLY",
    });
    expect(count).toBe(2);
    expect(db.bookingCollaborator.findMany).not.toHaveBeenCalled();
    expect(db.notification.create.mock.calls.map((c) => c[0].data.userId).sort()).toEqual(["u1", "u2"]);
    expect(sendPushToUser.mock.calls.map((c) => c[0]).sort()).toEqual(["u1", "u2"]);
    // The notice still names its booking.
    expect(db.notification.create.mock.calls[0][0].data.metadata).toMatchObject({ audience: "CUSTOMER", bookingId: "b1" });
  });

  it("HOST_AND_CO_HOSTS leaves invited viewers out", async () => {
    world({ template: null, links: ["u1"] });
    const invited = [
      { userId: "co", role: "CO_HOST" },
      { userId: "vw", role: "VIEWER" },
    ];
    db.bookingCollaborator.findMany.mockImplementation(async (args: { where: { role?: string } }) =>
      invited.filter((c) => !args.where.role || c.role === args.where.role).map(({ userId }) => ({ userId }))
    );
    const report = await notifyCustomerDetailed({
      contactId: "c1",
      bookingId: "b1",
      title: "Arjun from Veloria replied",
      message: "Hi",
      audience: "HOST_AND_CO_HOSTS",
    });
    expect(report.inApp).toBe(2);
    expect(db.notification.create.mock.calls.map((c) => c[0].data.userId).sort()).toEqual(["co", "u1"]);
  });

  it("the reach check counts the people that audience would tell", async () => {
    world({ template: null, links: ["u1"], cohosts: ["u3"] });
    expect((await describeCustomerReach("c1", "b1")).appLogins).toBe(2);
    expect((await describeCustomerReach("c1", "b1", "HOST_ONLY")).appLogins).toBe(1);
  });
});

describe("WhatsApp delivery", () => {
  it("sends the approved template with one-line parameters and logs it in the WhatsApp history", async () => {
    world();
    const report = await notifyCustomerDetailed({
      contactId: "c1",
      bookingId: "b1",
      title: "Reply from Arjun",
      message: "Your tasting is\nconfirmed",
    });
    expect(sendWhatsApp).toHaveBeenCalledWith({
      to: "+91 98450 12345",
      template: "booking_update",
      params: { customerName: "Priya", update: "Reply from Arjun: Your tasting is confirmed" },
    });
    expect(db.whatsAppMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ templateName: "booking_update", status: "SENT", whatsappId: "wamid.1", contactId: "c1" }),
    });
    expect(report).toEqual({ inApp: 1, whatsapp: { status: "SENT", messageId: "wamid.1" } });
  });

  it("reports a refusal from the provider as FAILED, never as sent, and logs the reason", async () => {
    world();
    sendWhatsApp.mockResolvedValue({ success: false, error: "Template not approved" });
    const report = await notifyCustomerDetailed({ contactId: "c1", title: "t", message: "m" });
    expect(report.whatsapp).toEqual({ status: "FAILED", error: "Template not approved" });
    expect(db.whatsAppMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "FAILED", failureReason: "Template not approved" }),
    });
  });

  it("reports NO_ANSWER, not sent, when the provider stays silent past the wait", async () => {
    vi.useFakeTimers();
    world();
    sendWhatsApp.mockImplementation(() => new Promise(() => undefined));
    const pending = notifyCustomerDetailed({ contactId: "c1", title: "t", message: "m" });
    await vi.waitFor(() => expect(sendWhatsApp).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(WHATSAPP_WAIT_MS);
    await expect(pending).resolves.toEqual({ inApp: 1, whatsapp: { status: "NO_ANSWER" } });
  });

  it("sends nothing on WhatsApp without an approved template, while the in-app notice still goes", async () => {
    world({ template: null });
    const report = await notifyCustomerDetailed({ contactId: "c1", title: "t", message: "m" });
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(report).toEqual({ inApp: 1, whatsapp: { status: "SKIPPED", reason: "NO_TEMPLATE" } });
  });

  it("respects a customer who switched WhatsApp updates off", async () => {
    world({ prefs: { u1: { whatsapp: false } } });
    const report = await notifyCustomerDetailed({ contactId: "c1", title: "t", message: "m" });
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(report.whatsapp).toEqual({ status: "SKIPPED", reason: "OPTED_OUT" });
  });

  it("holds back a second update inside the throttle window", async () => {
    world({ lastSentMinutesAgo: 5 });
    const report = await notifyCustomerDetailed({ contactId: "c1", title: "t", message: "m" });
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(report.whatsapp).toEqual({ status: "SKIPPED", reason: "RECENTLY_SENT" });
  });

  it("skips a contact without a usable phone number", async () => {
    world({ phone: null });
    const report = await notifyCustomerDetailed({ contactId: "c1", title: "t", message: "m" });
    expect(report.whatsapp).toEqual({ status: "SKIPPED", reason: "NO_PHONE" });
  });
});

describe("the WhatsApp decision", () => {
  const NOW = new Date("2026-09-16T06:30:00.000Z");
  const base = {
    templateName: "booking_update",
    phone: "9845012345",
    preferences: [] as unknown[],
    eventKey: "booking_confirmed",
    lastTemplateSentAt: null as Date | null,
    now: NOW,
  };

  it("sends when there is a template, a phone and no opt-out", () => {
    expect(decideWhatsAppDelivery(base)).toEqual({ send: true, to: "9845012345", template: "booking_update" });
  });

  it("checks template, then phone, then opt-out, then the throttle", () => {
    expect(decideWhatsAppDelivery({ ...base, templateName: "  ", phone: null })).toEqual({ send: false, reason: "NO_TEMPLATE" });
    expect(decideWhatsAppDelivery({ ...base, phone: "12-34", preferences: [{ whatsapp: false }] })).toEqual({
      send: false,
      reason: "NO_PHONE",
    });
    expect(decideWhatsAppDelivery({ ...base, preferences: [null, { whatsapp: false }], lastTemplateSentAt: NOW })).toEqual({
      send: false,
      reason: "OPTED_OUT",
    });
    expect(decideWhatsAppDelivery({ ...base, lastTemplateSentAt: new Date(NOW.getTime() - 5 * 60_000) })).toEqual({
      send: false,
      reason: "RECENTLY_SENT",
    });
  });

  it("sends again once the throttle window has passed", () => {
    const earlier = new Date(NOW.getTime() - (WHATSAPP_THROTTLE_MINUTES + 1) * 60_000);
    expect(decideWhatsAppDelivery({ ...base, lastTemplateSentAt: earlier }).send).toBe(true);
  });
});

describe("customer WhatsApp preference", () => {
  it("is on when there is no record or the record is unreadable", () => {
    for (const v of [null, undefined, "yes", 42, [], {}]) expect(whatsappAllowedByPreferences(v, "booking_confirmed")).toBe(true);
  });

  it("reads the Settings array shape per event, and never treats the SMS switch as WhatsApp", () => {
    const prefs = [{ key: "booking_confirmed", emailEnabled: true, smsEnabled: false, whatsappEnabled: false }];
    expect(whatsappAllowedByPreferences(prefs, "booking_confirmed")).toBe(false);
    expect(whatsappAllowedByPreferences(prefs, "payment_due")).toBe(true);
    expect(whatsappAllowedByPreferences([{ key: "booking_confirmed", smsEnabled: false }], "booking_confirmed")).toBe(true);
    expect(whatsappAllowedByPreferences([{ key: "whatsapp", whatsappEnabled: false }], "payment_due")).toBe(false);
  });

  it("reads a global or per-event switch in object form", () => {
    expect(whatsappAllowedByPreferences({ whatsapp: false }, "booking_confirmed")).toBe(false);
    expect(whatsappAllowedByPreferences({ whatsappEnabled: false }, "booking_confirmed")).toBe(false);
    expect(whatsappAllowedByPreferences({ channels: { whatsapp: false } }, "booking_confirmed")).toBe(false);
    expect(whatsappAllowedByPreferences({ booking_confirmed: { whatsapp: false } }, "booking_confirmed")).toBe(false);
    expect(whatsappAllowedByPreferences({ channels: { whatsapp: true } }, "booking_confirmed")).toBe(true);
  });

  it("maps notification types to preference keys", () => {
    expect(preferenceKeyFor("PAYMENT_RECEIVED")).toBe("payment_received");
    expect(preferenceKeyFor("PAYMENT_OVERDUE")).toBe("payment_due");
    expect(preferenceKeyFor("INVOICE_SENT")).toBe("invoice_sent");
    expect(preferenceKeyFor("BOOKING_UPDATED")).toBe("booking_confirmed");
    expect(preferenceKeyFor(undefined)).toBe("booking_confirmed");
  });
});

describe("template parameters", () => {
  it("puts the update on one line without runs of spaces, capped in length", () => {
    const p = bookingUpdateTemplateParams({ firstName: "Priya", title: "Update", message: `a\n\tb    c ${"x".repeat(2000)}` });
    expect(p.update.startsWith("Update: a b c x")).toBe(true);
    expect(p.update).not.toMatch(/[\n\t]| {2}/);
    expect(p.update.length).toBeLessThanOrEqual(900);
  });

  it("falls back to a neutral greeting without a name", () => {
    expect(bookingUpdateTemplateParams({ firstName: " ", title: "t", message: "m" }).customerName).toBe("there");
  });
});
