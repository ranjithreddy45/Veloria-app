import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// The one WhatsApp invite path (invitation-send.ts), without a database.
// GuestInvitation is a small in-memory table; WhatsApp, reminders and the
// activity log are mocked. Every caller is exercised: the host portal
// ("portal"), the guest app ("guest-app") and the team ("team"). Pinned:
//  - only a TENTATIVE, CONFIRMED or IN_PROGRESS booking sends, on every path;
//  - SENT and sentAt only after WhatsApp accepted; a refusal restores the row;
//  - an RSVP token is never replaced; a fresh send lease blocks a second sender;
//  - customer sends stop at the 24-hour quotas; team sends don't;
//  - names in the message are capped and carry no links;
//  - bulk sends run at most four at a time and count every guest once.
// ============================================================

interface Row {
  id: string;
  guestId: string;
  bookingId: string;
  rsvpToken: string;
  invitationStatus: string;
  sentAt: Date | null;
  rsvpRespondedAt: Date | null;
  whatsappMessageId: string | null;
  messageContent: string | null;
  updatedAt: Date;
}

const h = vi.hoisted(() => {
  type Where = Record<string, unknown>;
  const rows: Row[] = [];

  /** The slice of Prisma's where-semantics the module uses. */
  function matches(record: object, where: Where): boolean {
    const r = record as Record<string, unknown>;
    return Object.entries(where).every(([key, want]) => {
      if (key === "OR") return (want as Where[]).some((w) => matches(record, w));
      if (key === "NOT") return !matches(record, want as Where);
      const have = r[key];
      if (want === null) return have === null;
      if (typeof want === "object" && !(want instanceof Date)) {
        const op = want as { in?: unknown[]; startsWith?: string; lt?: Date };
        if (op.in && !op.in.includes(have)) return false;
        if (op.startsWith !== undefined && !(typeof have === "string" && have.startsWith(op.startsWith))) return false;
        if (op.lt && !(have instanceof Date && have < op.lt)) return false;
        return true;
      }
      return have === want;
    });
  }

  let created = 0;
  const write = (row: Row, data: Partial<Row>) => Object.assign(row, data, { updatedAt: new Date() });

  const db = {
    guestInvitation: {
      findUnique: vi.fn(async ({ where }: { where: Where }) => {
        const row = rows.find((x) => matches(x, where));
        return row ? { ...row } : null;
      }),
      create: vi.fn(async ({ data }: { data: Pick<Row, "guestId" | "bookingId" | "rsvpToken" | "invitationStatus"> }) => {
        if (rows.some((x) => x.guestId === data.guestId)) {
          throw Object.assign(new Error("Unique constraint failed on guestId"), { code: "P2002" });
        }
        const row: Row = {
          id: `inv-new-${++created}`,
          sentAt: null,
          rsvpRespondedAt: null,
          whatsappMessageId: null,
          messageContent: null,
          updatedAt: new Date(),
          ...data,
        };
        rows.push(row);
        return { ...row };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Where; data: Partial<Row> }) => {
        const hits = rows.filter((x) => matches(x, where));
        for (const row of hits) write(row, data);
        return { count: hits.length };
      }),
      update: vi.fn(async ({ where, data }: { where: Where; data: Partial<Row> }) => {
        const row = rows.find((x) => matches(x, where));
        if (!row) throw Object.assign(new Error("Record to update not found"), { code: "P2025" });
        return { ...write(row, data) };
      }),
      count: vi.fn(),
    },
    activityLog: { count: vi.fn() },
    whatsAppConfig: { findFirst: vi.fn() },
  };

  return {
    rows,
    db,
    sendWhatsApp: vi.fn(),
    logActivity: vi.fn(async () => undefined),
    scheduleReminders: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: h.sendWhatsApp }));
vi.mock("@/lib/push/send", () => ({ sendPushToUser: vi.fn() }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: h.logActivity }));
vi.mock("@/lib/reminder-engine", () => ({ scheduleReminders: h.scheduleReminders }));

import {
  BULK_SEND_CONCURRENCY,
  BULK_SEND_ERROR,
  CUSTOMER_INVITES_PER_BOOKING,
  CUSTOMER_INVITES_PER_USER,
  DAILY_LIMIT_MESSAGE,
  INVITE_NAME_MAX,
  INVITE_QUOTA_WINDOW_MS,
  LEASE_STALE_MS,
  bookingInviteRefusal,
  buildInviteContent,
  customerInviteAllowance,
  deliverInvitation,
  ensureInvitation,
  inviteDetails,
  inviteName,
  inviteOutcomeKind,
  quotaRemaining,
  sendInBulk,
  stripLinks,
  tallySendOutcomes,
  type BulkSendOutcome,
  type InviteBooking,
  type InviteVia,
  type SendGuest,
} from "./invitation-send";

const EVENT_DATE = new Date(Date.UTC(2030, 5, 20)); // a @db.Date: UTC midnight

function booking(over: Partial<InviteBooking> = {}): InviteBooking {
  return {
    id: "b1",
    eventName: "Asha & Rohan's Wedding",
    date: EVENT_DATE,
    startTime: new Date("2030-06-20T13:30:00.000Z"), // 7:00 pm in IST
    status: "CONFIRMED",
    venue: { name: "Grand Hall" },
    contact: { firstName: "Asha", lastName: "Rao" },
    ...over,
  };
}

let phoneSeq = 0;
function guest(id: string, over: { name?: string; phone?: string | null; rsvpStatus?: string } = {}): SendGuest {
  return {
    id,
    name: over.name ?? `Guest ${id}`,
    phone: over.phone !== undefined ? over.phone : `+9198765${String(++phoneSeq).padStart(5, "0")}`,
    rsvpStatus: over.rsvpStatus ?? "PENDING",
  };
}

function addInvitation(guestId: string, over: Partial<Row> = {}) {
  h.rows.push({
    id: `inv-${guestId}`,
    guestId,
    bookingId: "b1",
    rsvpToken: `tok-${guestId}`,
    invitationStatus: "NOT_SENT",
    sentAt: null,
    rsvpRespondedAt: null,
    whatsappMessageId: null,
    messageContent: null,
    updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    ...over,
  });
}

const invitationOf = (guestId: string) => h.rows.find((r) => r.guestId === guestId);
const TEXT = { templateName: null };

function send(g: SendGuest, via: InviteVia, extra: { mode?: "send" | "resend"; actorId?: string } = {}) {
  return deliverInvitation({ guest: g, booking: booking(), channel: TEXT, actorId: extra.actorId ?? "user-1", via, mode: extra.mode });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  h.rows.length = 0;
  h.sendWhatsApp.mockReset().mockResolvedValue({ success: true, messageId: "wamid.accepted" });
  h.db.guestInvitation.count.mockReset().mockResolvedValue(0);
  h.db.activityLog.count.mockReset().mockResolvedValue(0);
});

describe("the booking status gate: every path", () => {
  it("lets only a committed booking send: TENTATIVE, CONFIRMED or IN_PROGRESS", () => {
    for (const status of ["TENTATIVE", "CONFIRMED", "IN_PROGRESS"]) expect(bookingInviteRefusal(status), status).toBeNull();
    expect(bookingInviteRefusal("HOLD")).toMatch(/once the booking is confirmed/);
    expect(bookingInviteRefusal("CANCELLED")).toMatch(/cancelled/);
    expect(bookingInviteRefusal("COMPLETED")).toMatch(/already taken place/);
    expect(bookingInviteRefusal("A_STATUS_ADDED_LATER")).not.toBeNull();
  });

  it.each(["portal", "guest-app", "team"] as const)(
    "refuses a HOLD, CANCELLED or COMPLETED booking before creating anything or calling WhatsApp (%s)",
    async (via) => {
      for (const status of ["HOLD", "CANCELLED", "COMPLETED"] as const) {
        const res = await deliverInvitation({
          guest: guest(`g-${status}`),
          booking: booking({ status }),
          channel: TEXT,
          actorId: "user-1",
          via,
        });
        expect(res, status).toEqual({ outcome: "SKIPPED", reason: "BOOKING_NOT_ACTIVE" });
      }
      expect(h.db.guestInvitation.create).not.toHaveBeenCalled();
      expect(h.db.guestInvitation.updateMany).not.toHaveBeenCalled();
      expect(h.sendWhatsApp).not.toHaveBeenCalled();
      expect(h.rows).toHaveLength(0);
    }
  );

  it("sends for a TENTATIVE or IN_PROGRESS booking", async () => {
    for (const status of ["TENTATIVE", "IN_PROGRESS"] as const) {
      const res = await deliverInvitation({ guest: guest(`g-${status}`), booking: booking({ status }), channel: TEXT, actorId: "user-1", via: "portal" });
      expect(res.outcome, status).toBe("SENT");
    }
  });
});

describe("deliverInvitation: the honest send, for hosts and the team alike", () => {
  it("records SENT only once WhatsApp accepted, keeping the RSVP token a host already shared", async () => {
    addInvitation("g1", { rsvpToken: "tok-shared-by-host" }); // the link was copied by hand: NOT_SENT
    let duringSend: Row | undefined;
    h.sendWhatsApp.mockImplementation(async () => {
      duringSend = { ...invitationOf("g1")! };
      return { success: true, messageId: "wamid.accepted" };
    });

    const res = await send(guest("g1", { name: "Priya Nair" }), "guest-app");

    expect(res).toEqual({ outcome: "SENT", invitationId: "inv-g1", noteLeftOut: false });
    expect(duringSend).toMatchObject({ invitationStatus: "NOT_SENT", sentAt: null });
    expect(duringSend?.whatsappMessageId).toMatch(/^pending:/);
    expect(invitationOf("g1")).toMatchObject({
      invitationStatus: "SENT",
      whatsappMessageId: "wamid.accepted",
      rsvpToken: "tok-shared-by-host",
    });
    expect(invitationOf("g1")?.sentAt).toBeInstanceOf(Date);
    expect(h.db.guestInvitation.create).not.toHaveBeenCalled();
    expect(h.sendWhatsApp.mock.calls[0][0].message).toContain("/rsvp/tok-shared-by-host");
    expect(h.scheduleReminders).toHaveBeenCalledWith("g1", "b1", EVENT_DATE);
    expect(h.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "sent_invitation",
        changes: expect.objectContaining({ via: "guest-app", channel: "WHATSAPP_TEXT" }),
      })
    );
  });

  it.each([
    {
      label: "a refusal",
      arrange: () => h.sendWhatsApp.mockResolvedValue({ success: false, error: "Template   not\napproved" }),
      error: "Template not approved",
    },
    { label: "no answer", arrange: () => h.sendWhatsApp.mockResolvedValue(undefined), error: "WhatsApp gave no answer." },
    {
      label: "a thrown error",
      arrange: () => h.sendWhatsApp.mockRejectedValue(new Error("socket hang up")),
      error: "socket hang up",
    },
  ])("leaves the invitation as it was after $label", async ({ arrange, error }) => {
    addInvitation("g1");
    arrange();

    const res = await send(guest("g1"), "portal");

    expect(res).toEqual({ outcome: "FAILED", error });
    expect(invitationOf("g1")).toMatchObject({
      invitationStatus: "NOT_SENT",
      sentAt: null,
      whatsappMessageId: null,
      rsvpToken: "tok-g1",
    });
    expect(h.scheduleReminders).not.toHaveBeenCalled();
    expect(h.logActivity).not.toHaveBeenCalled();
  });

  it("restores the last real message id when a team re-send is refused", async () => {
    const firstSentAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    addInvitation("g1", { invitationStatus: "DELIVERED", sentAt: firstSentAt, whatsappMessageId: "wamid.first" });
    h.sendWhatsApp.mockResolvedValueOnce({ success: false, error: "Outside the 24-hour window" });

    const res = await send(guest("g1"), "team", { mode: "resend", actorId: "staff-1" });

    expect(res.outcome).toBe("FAILED");
    expect(invitationOf("g1")).toMatchObject({
      invitationStatus: "DELIVERED",
      sentAt: firstSentAt,
      whatsappMessageId: "wamid.first",
    });
  });

  it("keeps a reply that came in through the link while the invitation was sending", async () => {
    addInvitation("g1");
    h.sendWhatsApp.mockImplementation(async () => {
      Object.assign(invitationOf("g1")!, { invitationStatus: "RSVP_ACCEPTED", rsvpRespondedAt: new Date() });
      return { success: true, messageId: "wamid.accepted" };
    });

    const res = await send(guest("g1"), "guest-app");

    expect(res.outcome).toBe("SENT");
    expect(invitationOf("g1")).toMatchObject({ invitationStatus: "RSVP_ACCEPTED", whatsappMessageId: "wamid.accepted" });
    expect(invitationOf("g1")?.sentAt).toBeInstanceOf(Date);
  });

  it("doesn't send under a fresh lease held by another request, but takes over an abandoned one", async () => {
    addInvitation("fresh", { whatsappMessageId: "pending:other-tab", updatedAt: new Date() });
    addInvitation("stale", {
      whatsappMessageId: "pending:request-died",
      updatedAt: new Date(Date.now() - LEASE_STALE_MS - 1000),
    });

    expect(await send(guest("fresh"), "portal")).toEqual({ outcome: "SKIPPED", reason: "IN_PROGRESS" });
    expect(await send(guest("stale"), "team")).toMatchObject({ outcome: "SENT" });
    expect(h.sendWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("applies the invite rule: no phone, already invited or replied means no send; a team re-send reaches an invited guest", async () => {
    addInvitation("invited", { invitationStatus: "SENT", sentAt: new Date() });

    expect(await send(guest("invited"), "guest-app")).toEqual({ outcome: "SKIPPED", reason: "ALREADY_INVITED" });
    expect(await send(guest("told-us", { rsvpStatus: "DECLINED" }), "team")).toEqual({ outcome: "SKIPPED", reason: "REPLIED" });
    expect(await send(guest("no-phone", { phone: "N/A" }), "portal")).toEqual({ outcome: "SKIPPED", reason: "NO_PHONE" });
    expect(h.sendWhatsApp).not.toHaveBeenCalled();

    const resent = await send(guest("invited"), "team", { mode: "resend", actorId: "staff-1" });
    expect(resent.outcome).toBe("SENT");
    // Reminders were scheduled with the first invitation; a re-send leaves them alone.
    expect(h.scheduleReminders).not.toHaveBeenCalled();
    expect(h.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "resent_invitation" }));
  });

  it("uses the row another request created at the same moment, and its token", async () => {
    h.db.guestInvitation.findUnique.mockImplementationOnce(async () => null); // our first read saw nothing...
    addInvitation("g1", { rsvpToken: "tok-created-by-the-other-request" }); // ...the other request created it

    const inv = await ensureInvitation("g1", "b1");

    expect(inv.rsvpToken).toBe("tok-created-by-the-other-request");
    expect(h.rows).toHaveLength(1);
  });

  it("formats the booking's own day and the start time in India", () => {
    const d = inviteDetails(booking());
    expect(d.eventDate).toContain("20 June");
    expect(d.eventTime).toMatch(/^7:00\s?pm$/i);
    expect(d.hostName).toBe("Asha Rao");
  });
});

describe("customer quotas", () => {
  it("leaves the smaller of the two quotas, never below zero, at wedding-friendly sizes", () => {
    expect(quotaRemaining({ booking: 0, user: 0 })).toBe(Math.min(CUSTOMER_INVITES_PER_BOOKING, CUSTOMER_INVITES_PER_USER));
    expect(quotaRemaining({ booking: CUSTOMER_INVITES_PER_BOOKING - 5, user: 0 })).toBe(5);
    expect(quotaRemaining({ booking: 0, user: CUSTOMER_INVITES_PER_USER - 2 })).toBe(2);
    expect(quotaRemaining({ booking: CUSTOMER_INVITES_PER_BOOKING + 50, user: 0 })).toBe(0);
    // Hundreds of guests is a normal wedding.
    expect(CUSTOMER_INVITES_PER_BOOKING).toBeGreaterThanOrEqual(500);
    expect(CUSTOMER_INVITES_PER_USER).toBeGreaterThanOrEqual(CUSTOMER_INVITES_PER_BOOKING);
  });

  it("counts the last 24 hours: every invitation sent for the booking, and this user's own sends", async () => {
    const now = new Date("2030-06-01T12:00:00.000Z");
    h.db.guestInvitation.count.mockResolvedValue(10);
    h.db.activityLog.count.mockResolvedValue(CUSTOMER_INVITES_PER_USER - 5);

    expect(await customerInviteAllowance("b1", "user-1", now)).toBe(5);

    const since = new Date(now.getTime() - INVITE_QUOTA_WINDOW_MS);
    expect(h.db.guestInvitation.count).toHaveBeenCalledWith({ where: { bookingId: "b1", sentAt: { gte: since } } });
    expect(h.db.activityLog.count).toHaveBeenCalledWith({
      where: { userId: "user-1", entityType: "GuestInvitation", action: "sent_invitation", createdAt: { gte: since } },
    });
  });

  it.each(["portal", "guest-app"] as const)(
    "stops a customer send at either quota, before claiming the row or calling WhatsApp (%s)",
    async (via) => {
      addInvitation("g1");

      h.db.guestInvitation.count.mockResolvedValue(CUSTOMER_INVITES_PER_BOOKING);
      expect(await send(guest("g1"), via)).toEqual({ outcome: "SKIPPED", reason: "DAILY_LIMIT" });

      h.db.guestInvitation.count.mockResolvedValue(0);
      h.db.activityLog.count.mockResolvedValue(CUSTOMER_INVITES_PER_USER);
      expect(await send(guest("g1"), via)).toEqual({ outcome: "SKIPPED", reason: "DAILY_LIMIT" });

      expect(h.db.guestInvitation.updateMany).not.toHaveBeenCalled();
      expect(h.sendWhatsApp).not.toHaveBeenCalled();
      expect(invitationOf("g1")).toMatchObject({ invitationStatus: "NOT_SENT", whatsappMessageId: null });
      expect(DAILY_LIMIT_MESSAGE).toContain(String(CUSTOMER_INVITES_PER_BOOKING));
      expect(DAILY_LIMIT_MESSAGE).toContain(String(CUSTOMER_INVITES_PER_USER));
    }
  );

  it("sends a customer invitation while quota is left", async () => {
    addInvitation("g1");
    h.db.guestInvitation.count.mockResolvedValue(CUSTOMER_INVITES_PER_BOOKING - 1);
    expect((await send(guest("g1"), "portal")).outcome).toBe("SENT");
  });

  it("doesn't hold team sends to the customer quotas", async () => {
    addInvitation("g1");
    h.db.guestInvitation.count.mockResolvedValue(CUSTOMER_INVITES_PER_BOOKING * 2);
    h.db.activityLog.count.mockResolvedValue(CUSTOMER_INVITES_PER_USER * 2);

    expect((await send(guest("g1"), "team", { actorId: "staff-1" })).outcome).toBe("SENT");
    expect(h.db.guestInvitation.count).not.toHaveBeenCalled();
    expect(h.db.activityLog.count).not.toHaveBeenCalled();
  });
});

describe("what the invitation says", () => {
  it("takes out links: http(s), www., bare domains, shorteners, IP addresses, and links split or disguised", () => {
    const hostile = [
      "Priya https://evil.example/login",
      "Visit www.evil-offers.net now",
      "bit.ly/claim-prize",
      "Rohan (tinyurl.com/x9)",
      "wa.me/919876543210",
      "evil.co.in/pay",
      "HTTP://EVIL.COM",
      "192.168.10.1/login",
      "evil​.com/pay",
      "evil．com",
      "hxxps://evil",
    ];
    for (const text of hostile) {
      expect(stripLinks(text), text).not.toMatch(/:\/\/|www\.|\.(com|net|ly|me|in)\b|\d+\.\d+\.\d+\.\d+/i);
    }
  });

  it("keeps the names people actually write, initials and all", () => {
    for (const name of [
      "A.K. Sharma",
      "Dr.Rao",
      "K.Venkat Reddy",
      "Mr.Sharma & Family",
      "Asha & Rohan's Wedding",
      "St. Mary's Reception",
      "प्रिया शर्मा",
      "D'Souza family (VIP)",
      "Rao.Dev",
    ]) {
      expect(inviteName(name, "Guest"), name).toBe(name);
    }
  });

  it("caps a name at 60 characters on one line, and falls back when nothing but a link was typed", () => {
    const capped = inviteName("A".repeat(80), "Guest");
    expect(capped).toHaveLength(INVITE_NAME_MAX);
    expect(capped.endsWith("…")).toBe(true);
    expect(inviteName("https://evil.example/claim", "Guest")).toBe("Guest");
    expect(inviteName("  \n ", "Your host")).toBe("Your host");
    expect(inviteName("Priya\nNair\t(bit.ly/x)", "Guest")).toBe("Priya Nair");
  });

  it("builds the text message and the template from the same capped, link-free names; the RSVP link passes through", () => {
    const details = inviteDetails(
      booking({ eventName: "Grand sale at www.evil.com", contact: { firstName: "Visit", lastName: "bit.ly/win" } })
    );
    const rsvpLink = "https://veloriagrand.com/rsvp/tok-1";
    const text = buildInviteContent({ guestName: `${"Z".repeat(70)} http://phish.example`, details, rsvpLink, templateName: null });
    const template = buildInviteContent({ guestName: "Priya", details, rsvpLink, templateName: "event_invite", customMessage: "Dinner at 8" });

    for (const out of [text.messageContent, ...Object.values(template.templateParams)]) {
      expect(out.replace(rsvpLink, "")).not.toMatch(/https?:|www\.|bit\.ly|phish|evil\.com/i);
    }
    expect(text.messageContent).toContain(rsvpLink);
    expect(text.messageContent).toContain(`${"Z".repeat(INVITE_NAME_MAX - 1)}…`);
    expect(template.templateParams).toMatchObject({ rsvpLink, eventName: "Grand sale at", hostName: "Visit", guestName: "Priya" });
    // A template's wording is fixed: the note is left out, and said to be.
    expect(template.noteLeftOut).toBe(true);
    expect(template.messageContent).not.toContain("Dinner at 8");
    expect(buildInviteContent({ guestName: "Priya", details, rsvpLink, templateName: null, customMessage: "Dinner at 8" })).toMatchObject({
      noteLeftOut: false,
      messageContent: expect.stringContaining("Dinner at 8"),
    });
  });

  it("never lets a hostile guest name reach WhatsApp, on the template or in the stored message", async () => {
    addInvitation("g1");

    await deliverInvitation({
      guest: guest("g1", { name: "Win ₹5000 at bit.ly/claim now" }),
      booking: booking(),
      channel: { templateName: "event_invite" },
      actorId: "user-1",
      via: "portal",
    });

    const [msg] = h.sendWhatsApp.mock.calls[0];
    expect(msg.template).toBe("event_invite");
    expect(msg.params.guestName).toBe("Win ₹5000 at now");
    expect(invitationOf("g1")?.messageContent).not.toContain("bit.ly");
  });
});

describe("bulk sends", () => {
  it("run at most four at once, and a send that throws counts as failed, never sent", async () => {
    let running = 0;
    let peak = 0;
    const outcomes = await sendInBulk(
      Array.from({ length: 10 }, (_, i) => i),
      async (i): Promise<BulkSendOutcome> => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running--;
        if (i === 3) throw new Error("boom");
        return { outcome: "SENT", invitationId: `inv-${i}`, noteLeftOut: false };
      },
      "[TEST_BULK_ERR]"
    );

    expect(BULK_SEND_CONCURRENCY).toBe(4);
    expect(peak).toBe(BULK_SEND_CONCURRENCY);
    expect(outcomes).toHaveLength(10);
    expect(outcomes[3]).toEqual({ outcome: "FAILED", error: BULK_SEND_ERROR });
    expect(outcomes.filter((o) => o.outcome === "SENT")).toHaveLength(9);
  });

  it("count every guest exactly once, with WhatsApp's first three different reasons", () => {
    const outcomes: BulkSendOutcome[] = [
      { outcome: "SENT", invitationId: "a", noteLeftOut: false },
      { outcome: "SENT", invitationId: "b", noteLeftOut: true },
      { outcome: "FAILED", error: "Number is not on WhatsApp" },
      { outcome: "FAILED", error: "Number is not on WhatsApp" },
      { outcome: "FAILED", error: "Rate limit hit" },
      { outcome: "FAILED", error: "Template paused" },
      { outcome: "FAILED", error: "A fourth reason" },
      { outcome: "SKIPPED", reason: "NO_PHONE" },
      { outcome: "SKIPPED", reason: "NOT_FOUND" },
      { outcome: "SKIPPED", reason: "ALREADY_INVITED" },
      { outcome: "SKIPPED", reason: "IN_PROGRESS" },
      { outcome: "SKIPPED", reason: "REPLIED" },
      { outcome: "SKIPPED", reason: "BOOKING_NOT_ACTIVE" },
      { outcome: "SKIPPED", reason: "DAILY_LIMIT" },
    ];

    const t = tallySendOutcomes(outcomes);

    expect(t.counts).toEqual({
      sent: 2,
      notAccepted: 5,
      needPhone: 1,
      notFound: 1,
      alreadyInvited: 1,
      inProgress: 1,
      replied: 1,
      bookingNotActive: 1,
      overLimit: 1,
    });
    expect(t.reasons).toEqual(["Number is not on WhatsApp", "Rate limit hit", "Template paused"]);
    expect(t.alreadySent).toBe(3);
    expect(t.failed).toBe(9);
    expect(t.counts.sent + t.alreadySent + t.failed).toBe(outcomes.length);
    expect(t.noteLeftOut).toBe(true);
  });

  it("map onto the host's Invite all summary without calling a refusal 'in progress'", () => {
    expect(inviteOutcomeKind({ outcome: "SENT", invitationId: "a", noteLeftOut: false })).toBe("SENT");
    expect(inviteOutcomeKind({ outcome: "FAILED", error: "x" })).toBe("FAILED");
    expect(inviteOutcomeKind({ outcome: "SKIPPED", reason: "DAILY_LIMIT" })).toBe("LIMITED");
    expect(inviteOutcomeKind({ outcome: "SKIPPED", reason: "BOOKING_NOT_ACTIVE" })).toBe("FAILED");
    expect(inviteOutcomeKind({ outcome: "SKIPPED", reason: "IN_PROGRESS" })).toBe("SKIPPED");
  });
});
