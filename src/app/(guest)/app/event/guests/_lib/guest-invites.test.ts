import { describe, it, expect } from "vitest";
import {
  canSendInvite,
  canShareRsvpLink,
  countInviteStates,
  guestInviteState,
  hasUsablePhone,
  inviteAllMessage,
  planInviteAll,
  summarizeInviteAll,
  type InviteFacts,
} from "./guest-invites";

const guest = (over: Partial<InviteFacts> = {}): InviteFacts => ({
  phone: "+919876543210",
  rsvpStatus: "PENDING",
  invitation: null,
  ...over,
});
const invitation = (invitationStatus: string, extra: { sentAt?: string | null; rsvpRespondedAt?: string | null } = {}) => ({
  invitationStatus,
  sentAt: null,
  rsvpRespondedAt: null,
  ...extra,
});
const SENT_AT = "2026-09-10T10:00:00.000Z";

describe("guestInviteState — the one true state per guest", () => {
  it("a guest with a phone and no invitation is not invited, and can be invited", () => {
    const g = guest();
    expect(guestInviteState(g)).toBe("NOT_INVITED");
    expect(canSendInvite(g)).toBe(true);
    expect(canShareRsvpLink(g)).toBe(true);
  });

  it("a guest without a phone is 'No phone': never invitable, but the link can be shared by hand", () => {
    const g = guest({ phone: null });
    expect(guestInviteState(g)).toBe("NO_PHONE");
    expect(canSendInvite(g)).toBe(false);
    expect(canShareRsvpLink(g)).toBe(true);
  });

  it("junk in the phone field is not a phone", () => {
    expect(hasUsablePhone("")).toBe(false);
    expect(hasUsablePhone("N/A")).toBe(false);
    expect(hasUsablePhone("123")).toBe(false);
    expect(hasUsablePhone("98765 43210")).toBe(true);
    expect(guestInviteState(guest({ phone: "N/A" }))).toBe("NO_PHONE");
  });

  it("a link copied or shared by hand (row still NOT_SENT) is never counted as sent", () => {
    const withPhone = guest({ invitation: invitation("NOT_SENT") });
    const noPhone = guest({ phone: null, invitation: invitation("NOT_SENT") });
    expect(guestInviteState(withPhone)).toBe("NOT_INVITED");
    expect(canSendInvite(withPhone)).toBe(true);
    expect(guestInviteState(noPhone)).toBe("NO_PHONE");
  });

  it("SENT, DELIVERED and OPENED all read 'Invite sent' — nothing claims delivery", () => {
    for (const status of ["SENT", "DELIVERED", "OPENED"]) {
      const g = guest({ invitation: invitation(status, { sentAt: SENT_AT }) });
      expect(guestInviteState(g)).toBe("INVITE_SENT");
      expect(canSendInvite(g)).toBe(false);
    }
  });

  it("an unknown future status is treated as sent, so nobody is invited twice", () => {
    expect(guestInviteState(guest({ invitation: invitation("QUEUED") }))).toBe("INVITE_SENT");
  });

  it("a reply recorded by hand is 'RSVP received', whether or not an invitation went out", () => {
    expect(guestInviteState(guest({ rsvpStatus: "ACCEPTED" }))).toBe("RSVP_RECEIVED");
    expect(guestInviteState(guest({ rsvpStatus: "DECLINED", invitation: invitation("SENT", { sentAt: SENT_AT }) }))).toBe("RSVP_RECEIVED");
    expect(guestInviteState(guest({ rsvpStatus: "ACCEPTED", phone: null }))).toBe("RSVP_RECEIVED");
  });

  it("a reply through a hand-shared link counts as received, not as sent", () => {
    const g = guest({ phone: null, rsvpStatus: "ACCEPTED", invitation: invitation("RSVP_ACCEPTED", { rsvpRespondedAt: SENT_AT }) });
    expect(guestInviteState(g)).toBe("RSVP_RECEIVED");
    expect(canShareRsvpLink(g)).toBe(false);
  });

  it("once the link has been used, resetting the RSVP by hand doesn't make the guest invitable again", () => {
    const g = guest({ rsvpStatus: "PENDING", invitation: invitation("RSVP_DECLINED", { rsvpRespondedAt: SENT_AT }) });
    expect(guestInviteState(g)).toBe("RSVP_RECEIVED");
    expect(canSendInvite(g)).toBe(false);
  });

  it("a sent invitation stays sent even if the phone is later removed", () => {
    expect(guestInviteState(guest({ phone: null, invitation: invitation("SENT", { sentAt: SENT_AT }) }))).toBe("INVITE_SENT");
  });
});

describe("planInviteAll — every guest lands in exactly one bucket", () => {
  const list = [
    guest(), // not invited
    guest({ phone: null }), // needs phone
    guest({ invitation: invitation("NOT_SENT") }), // not invited (copied link only)
    guest({ invitation: invitation("SENT", { sentAt: SENT_AT }) }), // already invited
    guest({ rsvpStatus: "ACCEPTED" }), // replied
    guest({ phone: "" }), // needs phone
    guest({ phone: "98765 43210" }), // not invited
  ];

  it("counts sendable, need-a-phone, already invited and replied guests", () => {
    const plan = planInviteAll(list);
    expect(plan.toSend).toHaveLength(3);
    expect(plan.needPhone).toBe(2);
    expect(plan.alreadyInvited).toBe(1);
    expect(plan.replied).toBe(1);
    expect(plan.later).toBe(0);
    expect(plan.toSend.length + plan.later + plan.needPhone + plan.alreadyInvited + plan.replied).toBe(list.length);
  });

  it("caps one press at the batch size, keeps list order, and says how many wait", () => {
    const five = [1, 2, 3, 4, 5].map((n) => ({ ...guest(), id: `g${n}` }));
    const plan = planInviteAll(five, 2);
    expect(plan.toSend.map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(plan.later).toBe(3);
  });

  it("a zero or negative batch sends nothing and defers everyone", () => {
    expect(planInviteAll([guest(), guest()], 0)).toMatchObject({ toSend: [], later: 2, limited: 0 });
    expect(planInviteAll([guest()], -3)).toMatchObject({ toSend: [], later: 1, limited: 0 });
  });

  it("holds back guests over the sending limit, and only tells the host to press again for ones a press can send", () => {
    const ten = Array.from({ length: 10 }, (_, n) => ({ ...guest(), id: `g${n}` }));
    // The limit allows 3: this press sends 2 (the batch), 1 waits for the next press, 7 are over the limit.
    const plan = planInviteAll(ten, 2, 3);
    expect(plan.toSend.map((g) => g.id)).toEqual(["g0", "g1"]);
    expect(plan).toMatchObject({ later: 1, limited: 7 });
    // A limit smaller than the batch: nothing waits for another press.
    expect(planInviteAll(ten, 50, 4)).toMatchObject({ later: 0, limited: 6 });
    expect(planInviteAll(ten, 50, 4).toSend).toHaveLength(4);
    // The limit is used up: nothing goes out and nobody is told to press again.
    expect(planInviteAll(ten, 50, 0)).toMatchObject({ toSend: [], later: 0, limited: 10 });
    // Every guest still lands in exactly one bucket.
    const mixed = planInviteAll(list, 50, 1);
    expect(mixed.toSend.length + mixed.later + mixed.limited + mixed.needPhone + mixed.alreadyInvited + mixed.replied).toBe(list.length);
    expect(planInviteAll(list)).toMatchObject({ limited: 0 });
  });
});

describe("summarizeInviteAll + inviteAllMessage — the exact words after Invite all", () => {
  const plan = { later: 0, needPhone: 2, alreadyInvited: 4, replied: 1 };

  it("counts only provider-accepted sends as sent", () => {
    const s = summarizeInviteAll(plan, ["SENT", "FAILED", "SENT", "SKIPPED"]);
    expect(s).toEqual({ sent: 2, failed: 1, skipped: 1, needPhone: 2, later: 0, limited: 0, alreadyInvited: 4, replied: 1 });
  });

  it("counts guests over the sending limit, whether planned out or stopped mid-run, and says to send them later", () => {
    const s = summarizeInviteAll({ ...plan, limited: 5 }, ["SENT", "LIMITED"]);
    expect(s).toMatchObject({ sent: 1, limited: 6, skipped: 0, failed: 0 });
    expect(inviteAllMessage(s)).toBe(
      "1 invitation sent · 2 guests need a phone number · 6 over the 24-hour sending limit — send them later"
    );
  });

  it("states how many were sent and how many need a phone", () => {
    expect(inviteAllMessage(summarizeInviteAll(plan, ["SENT", "SENT", "SENT"]))).toBe(
      "3 invitations sent · 2 guests need a phone number"
    );
  });

  it("uses the singular for one", () => {
    expect(inviteAllMessage(summarizeInviteAll({ ...plan, needPhone: 1 }, ["SENT"]))).toBe(
      "1 invitation sent · 1 guest needs a phone number"
    );
  });

  it("still gives both numbers when they are zero", () => {
    expect(inviteAllMessage(summarizeInviteAll({ ...plan, needPhone: 0 }, []))).toBe(
      "0 invitations sent · 0 guests need a phone number"
    );
  });

  it("adds failures, in-progress sends and the remainder only when there are some", () => {
    expect(inviteAllMessage(summarizeInviteAll({ ...plan, later: 12 }, ["SENT", "FAILED", "SKIPPED"]))).toBe(
      "1 invitation sent · 2 guests need a phone number · 1 couldn't be sent · 1 already in progress · 12 more to send — tap Invite all again"
    );
  });
});

describe("countInviteStates", () => {
  it("counts each invite state once", () => {
    expect(
      countInviteStates([guest(), guest({ phone: null }), guest({ rsvpStatus: "DECLINED" }), guest({ invitation: invitation("OPENED", { sentAt: SENT_AT }) })])
    ).toEqual({ NOT_INVITED: 1, NO_PHONE: 1, RSVP_RECEIVED: 1, INVITE_SENT: 1 });
  });
});
