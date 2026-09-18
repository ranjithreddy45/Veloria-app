import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Staff guest invitations (invitation.actions.ts), without a database.
// GuestInvitation is a small in-memory table and WhatsApp is mocked. Pinned:
//  - SENT and sentAt are written only after WhatsApp accepted the message; a
//    refusal, an error or no answer leaves the invitation as it was, and the
//    caller gets the reason.
//  - An existing RSVP token is never replaced, so a link a host already shared
//    keeps working when the team sends or re-sends.
//  - The host path's rules hold for the team too: no send to a guest already
//    invited or who has replied, and no send while another request holds the
//    send lease.
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

interface GuestRecord {
  id: string;
  name: string;
  phone: string | null;
  rsvpStatus: string;
  guestList: { bookingId: string; booking: typeof BOOKING };
}

const h = vi.hoisted(() => {
  type Where = Record<string, unknown>;
  const rows: Row[] = [];
  const guests = new Map<string, GuestRecord>();

  /** The slice of Prisma's where-semantics the actions use. */
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
    guest: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; guestList: { bookingId: string } } }) => {
        const g = guests.get(where.id);
        return g && g.guestList.bookingId === where.guestList.bookingId ? g : null;
      }),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; guestList: { bookingId: string } } }) =>
        [...guests.values()].filter((g) => where.id.in.includes(g.id) && g.guestList.bookingId === where.guestList.bookingId)
      ),
    },
    guestInvitation: {
      findUnique: vi.fn(async ({ where, select }: { where: Where; select?: { guest?: unknown } }) => {
        const row = rows.find((x) => matches(x, where));
        if (!row) return null;
        return select?.guest ? { ...row, guest: guests.get(row.guestId) } : { ...row };
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
      count: vi.fn(async () => 0),
    },
    whatsAppConfig: { findFirst: vi.fn() },
    // Read only for customer quotas: a team send must never touch them.
    activityLog: { count: vi.fn(async () => 0) },
  };

  return {
    rows,
    guests,
    db,
    auth: vi.fn(),
    sendWhatsApp: vi.fn(),
    notify: vi.fn(),
    logActivity: vi.fn(async () => undefined),
    scheduleReminders: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db }));
vi.mock("@/../auth", () => ({ auth: () => h.auth() }));
vi.mock("@/lib/permissions", () => ({ hasPermission: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/integrations/whatsapp", () => ({ sendWhatsApp: h.sendWhatsApp }));
vi.mock("@/lib/push/send", () => ({ sendPushToUser: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: h.notify }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: h.logActivity }));
vi.mock("@/lib/reminder-engine", () => ({ scheduleReminders: h.scheduleReminders }));
vi.mock("@/lib/privacy/consent", () => ({ recordConsent: vi.fn() }));

import { bulkSendInvitations, resendInvitation, sendGuestInvitation } from "./invitation.actions";

const EVENT_DATE = new Date(Date.UTC(2030, 5, 20)); // a @db.Date: UTC midnight
const BOOKING = {
  id: "b1",
  eventName: "Asha & Rohan's Wedding",
  date: EVENT_DATE,
  startTime: new Date("2030-06-20T13:30:00.000Z"), // 7:00 pm in IST
  status: "CONFIRMED",
  venue: { name: "Grand Hall" },
  contact: { firstName: "Asha", lastName: "Rao" },
};

let phoneSeq = 0;
function addGuest(
  id: string,
  over: { name?: string; phone?: string | null; rsvpStatus?: string; bookingId?: string; bookingStatus?: string } = {}
) {
  const bookingId = over.bookingId ?? "b1";
  h.guests.set(id, {
    id,
    name: over.name ?? `Guest ${id}`,
    phone: over.phone !== undefined ? over.phone : `+9198765${String(++phoneSeq).padStart(5, "0")}`,
    rsvpStatus: over.rsvpStatus ?? "PENDING",
    guestList: { bookingId, booking: { ...BOOKING, id: bookingId, status: over.bookingStatus ?? BOOKING.status } },
  });
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

beforeEach(() => {
  vi.clearAllMocks();
  h.rows.length = 0;
  h.guests.clear();
  h.auth.mockReset().mockResolvedValue({ user: { id: "staff-1", role: "SALES_EXEC" } });
  h.db.whatsAppConfig.findFirst.mockReset().mockResolvedValue({ guestInviteTemplateName: null });
  h.sendWhatsApp.mockReset().mockResolvedValue({ success: true, messageId: "wamid.accepted" });
});

describe("sendGuestInvitation", () => {
  it("records SENT only once WhatsApp has accepted, keeping the RSVP token a host already shared", async () => {
    addGuest("g1", { name: "Priya Nair" });
    addInvitation("g1", { rsvpToken: "tok-shared-by-host" }); // the host copied the link by hand: NOT_SENT
    let duringSend: Row | undefined;
    h.sendWhatsApp.mockImplementation(async () => {
      duringSend = { ...invitationOf("g1")! };
      return { success: true, messageId: "wamid.accepted" };
    });

    const res = await sendGuestInvitation({ guestId: "g1", bookingId: "b1" });

    expect(res.success).toBe(true);
    // While WhatsApp was deciding, the row was only claimed, not marked sent.
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
  });

  it("leaves the invitation not sent and returns WhatsApp's reason when WhatsApp refuses", async () => {
    addGuest("g1", { name: "Priya Nair" });
    addInvitation("g1");
    h.sendWhatsApp.mockResolvedValue({ success: false, error: "Template not approved" });

    const res = await sendGuestInvitation({ guestId: "g1", bookingId: "b1" });

    expect(res.success).toBe(false);
    expect(res.success ? "" : res.error).toContain("still marked not sent");
    expect(res.success ? "" : res.error).toContain("Template not approved");
    expect(invitationOf("g1")).toMatchObject({
      invitationStatus: "NOT_SENT",
      sentAt: null,
      whatsappMessageId: null,
      rsvpToken: "tok-g1",
    });
    expect(h.scheduleReminders).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
  });

  it.each([
    { label: "no answer at all", arrange: () => h.sendWhatsApp.mockResolvedValue(undefined) },
    { label: "a thrown error", arrange: () => h.sendWhatsApp.mockRejectedValue(new Error("socket hang up")) },
  ])("treats $label from WhatsApp as not sent", async ({ arrange }) => {
    addGuest("g1");
    addInvitation("g1");
    arrange();

    const res = await sendGuestInvitation({ guestId: "g1", bookingId: "b1" });

    expect(res.success).toBe(false);
    expect(invitationOf("g1")).toMatchObject({ invitationStatus: "NOT_SENT", sentAt: null, whatsappMessageId: null });
  });

  it("creates a new token only for a guest who has none, and a retry after a refusal reuses it", async () => {
    addGuest("g2");
    h.sendWhatsApp.mockResolvedValueOnce({ success: false, error: "Rate limit hit" });

    const first = await sendGuestInvitation({ guestId: "g2", bookingId: "b1", customMessage: "Dinner at 8" });
    expect(first.success).toBe(false);
    const token = invitationOf("g2")!.rsvpToken;
    expect(token).toHaveLength(16);
    expect(invitationOf("g2")?.invitationStatus).toBe("NOT_SENT");

    const retry = await sendGuestInvitation({ guestId: "g2", bookingId: "b1", customMessage: "Dinner at 8" });
    expect(retry.success).toBe(true);
    expect(h.db.guestInvitation.create).toHaveBeenCalledTimes(1);
    expect(invitationOf("g2")).toMatchObject({ rsvpToken: token, invitationStatus: "SENT" });
    // Both attempts were text messages carrying the personal note and the same link.
    expect(h.sendWhatsApp).toHaveBeenCalledTimes(2);
    for (const [msg] of h.sendWhatsApp.mock.calls) {
      expect(msg.message).toContain(`/rsvp/${token}`);
      expect(msg.message).toContain("Dinner at 8");
    }
  });

  it("sends the approved invite template when one is set, with the host path's parameters, and says the note was left out", async () => {
    h.db.whatsAppConfig.findFirst.mockResolvedValue({ guestInviteTemplateName: " event_invite " });
    addGuest("g1", { name: "Priya Nair" });
    addInvitation("g1");

    const res = await sendGuestInvitation({ guestId: "g1", bookingId: "b1", customMessage: "Dinner at 8" });

    expect(res).toMatchObject({ success: true, notice: expect.stringContaining("personal note") });
    const [msg] = h.sendWhatsApp.mock.calls[0];
    expect(msg.template).toBe("event_invite");
    expect(msg.message).toBeUndefined();
    expect(Object.keys(msg.params)).toEqual([
      "guestName",
      "eventName",
      "eventDate",
      "eventTime",
      "venueName",
      "hostName",
      "rsvpLink",
    ]);
    expect(msg.params).toMatchObject({
      guestName: "Priya Nair",
      venueName: "Grand Hall",
      hostName: "Asha Rao",
      rsvpLink: expect.stringContaining("/rsvp/tok-g1"),
    });
    // The booking's own day, and the start time in IST.
    expect(msg.params.eventDate).toContain("20 June");
    expect(msg.params.eventTime).toMatch(/^7:00\s?pm$/i);
    expect(invitationOf("g1")?.messageContent).not.toContain("Dinner at 8");
  });

  it("doesn't send to a guest already invited, or to one who has already replied", async () => {
    addGuest("invited");
    addInvitation("invited", { invitationStatus: "SENT", sentAt: new Date() });
    addGuest("replied", { rsvpStatus: "ACCEPTED" }); // told the team by phone

    const a = await sendGuestInvitation({ guestId: "invited", bookingId: "b1" });
    const b = await sendGuestInvitation({ guestId: "replied", bookingId: "b1" });

    expect(a).toEqual({ success: false, error: "Invitation already sent" });
    expect(b).toMatchObject({ success: false, error: expect.stringContaining("already replied") });
    expect(h.sendWhatsApp).not.toHaveBeenCalled();
  });

  it("doesn't send while another request (a host, a second tab) holds the send lease", async () => {
    addGuest("g1");
    addInvitation("g1", { whatsappMessageId: "pending:host-tab", updatedAt: new Date() });

    const res = await sendGuestInvitation({ guestId: "g1", bookingId: "b1" });

    expect(res).toMatchObject({ success: false, error: expect.stringContaining("already being sent") });
    expect(h.sendWhatsApp).not.toHaveBeenCalled();
  });

  it("refuses a guest from another booking, or one without a phone WhatsApp can reach", async () => {
    addGuest("elsewhere", { bookingId: "b2" });
    addGuest("no-phone", { name: "Ravi", phone: "N/A" });

    expect(await sendGuestInvitation({ guestId: "elsewhere", bookingId: "b1" })).toEqual({
      success: false,
      error: "Guest not found",
    });
    expect(await sendGuestInvitation({ guestId: "no-phone", bookingId: "b1" })).toMatchObject({
      success: false,
      error: expect.stringContaining("phone number"),
    });
    expect(h.sendWhatsApp).not.toHaveBeenCalled();
    expect(h.rows).toHaveLength(0);
  });
});

describe("resendInvitation", () => {
  it("re-sends with the same RSVP link, and changes nothing unless WhatsApp accepts", async () => {
    const firstSentAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    addGuest("g1");
    addInvitation("g1", { invitationStatus: "DELIVERED", sentAt: firstSentAt, whatsappMessageId: "wamid.first" });

    h.sendWhatsApp.mockResolvedValueOnce({ success: false, error: "Outside the 24-hour window" });
    const refused = await resendInvitation("g1");
    expect(refused).toMatchObject({ success: false, error: expect.stringContaining("nothing was changed") });
    expect(invitationOf("g1")).toMatchObject({
      invitationStatus: "DELIVERED",
      sentAt: firstSentAt,
      whatsappMessageId: "wamid.first",
      rsvpToken: "tok-g1",
    });

    h.sendWhatsApp.mockResolvedValueOnce({ success: true, messageId: "wamid.second" });
    const resent = await resendInvitation("g1");
    expect(resent.success).toBe(true);
    const inv = invitationOf("g1")!;
    expect(inv).toMatchObject({ invitationStatus: "SENT", whatsappMessageId: "wamid.second", rsvpToken: "tok-g1" });
    expect(inv.sentAt!.getTime()).toBeGreaterThan(firstSentAt.getTime());
    expect(h.sendWhatsApp.mock.calls[1][0].message).toContain("/rsvp/tok-g1");
    // Reminders were scheduled with the first invitation; a re-send leaves them alone.
    expect(h.scheduleReminders).not.toHaveBeenCalled();
  });

  it("never re-sends to a guest who already replied through the link", async () => {
    addGuest("g1", { rsvpStatus: "ACCEPTED" });
    addInvitation("g1", { invitationStatus: "RSVP_ACCEPTED", sentAt: new Date(), rsvpRespondedAt: new Date() });

    const res = await resendInvitation("g1");

    expect(res).toMatchObject({ success: false, error: expect.stringContaining("already replied") });
    expect(invitationOf("g1")?.invitationStatus).toBe("RSVP_ACCEPTED");
    expect(h.sendWhatsApp).not.toHaveBeenCalled();
  });
});

describe("bulkSendInvitations", () => {
  it("counts only accepted sends as sent and gives the reasons for the rest", async () => {
    addGuest("ok");
    addGuest("refused", { phone: "+919811111111" });
    addGuest("no-phone", { phone: "123" });
    addGuest("invited");
    addInvitation("invited", { invitationStatus: "SENT", sentAt: new Date() });
    addGuest("elsewhere", { bookingId: "b2" });
    h.sendWhatsApp.mockImplementation(async ({ to }: { to: string }) =>
      to === "+919811111111"
        ? { success: false, error: "Number is not on WhatsApp" }
        : { success: true, messageId: `wamid.${to}` }
    );

    const res = await bulkSendInvitations({
      guestIds: ["ok", "refused", "no-phone", "invited", "elsewhere"],
      bookingId: "b1",
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    // The Guest Manager reads sent / alreadySent / failed: every guest lands in exactly one.
    expect(res.data).toMatchObject({
      sent: 1,
      alreadySent: 1,
      failed: 3,
      notAccepted: 1,
      needPhone: 1,
      notFound: 1,
      alreadyInvited: 1,
    });
    expect(res.data.message).toContain("Number is not on WhatsApp");
    expect(invitationOf("ok")?.invitationStatus).toBe("SENT");
    expect(invitationOf("refused")).toMatchObject({ invitationStatus: "NOT_SENT", sentAt: null });
    expect(invitationOf("invited")?.invitationStatus).toBe("SENT");
    expect(h.sendWhatsApp).toHaveBeenCalledTimes(2);
    expect(h.notify).toHaveBeenCalledTimes(1);
  });
});

describe("the booking status gate on the team's sends", () => {
  it.each(["HOLD", "CANCELLED", "COMPLETED"])(
    "refuses to send, re-send or send all for a %s booking, and says why",
    async (status) => {
      addGuest("g1", { bookingStatus: status });
      addGuest("g2", { bookingStatus: status });
      addInvitation("g2", { invitationStatus: "SENT", sentAt: new Date() });

      const one = await sendGuestInvitation({ guestId: "g1", bookingId: "b1" });
      const again = await resendInvitation("g2");
      const all = await bulkSendInvitations({ guestIds: ["g1", "g2"], bookingId: "b1" });

      for (const res of [one, again, all]) {
        expect(res.success).toBe(false);
        expect(res.success ? "" : res.error).toMatch(/can't be sent|once the booking is confirmed/);
      }
      expect(h.sendWhatsApp).not.toHaveBeenCalled();
      expect(invitationOf("g1")).toBeUndefined();
      expect(invitationOf("g2")?.invitationStatus).toBe("SENT");
    }
  );

  it("sends for a TENTATIVE booking, and a team send never reads the customer quotas", async () => {
    addGuest("g1", { bookingStatus: "TENTATIVE" });

    const res = await sendGuestInvitation({ guestId: "g1", bookingId: "b1" });

    expect(res.success).toBe(true);
    expect(h.db.guestInvitation.count).not.toHaveBeenCalled();
    expect(h.db.activityLog.count).not.toHaveBeenCalled();
  });
});

describe("what the team's invitation says", () => {
  it("carries the same capped, link-free names as the host path, with the personal note in a text message", async () => {
    addGuest("g1", { name: "Claim your prize at bit.ly/free-gift" });
    addInvitation("g1");

    const res = await sendGuestInvitation({ guestId: "g1", bookingId: "b1", customMessage: "See you there" });

    expect(res.success).toBe(true);
    const [msg] = h.sendWhatsApp.mock.calls[0];
    expect(msg.message).toContain("Dear *Claim your prize at*");
    expect(msg.message).not.toContain("bit.ly");
    expect(msg.message).toContain("See you there");
    expect(msg.message).toContain("/rsvp/tok-g1");
  });
});
