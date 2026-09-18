import { describe, expect, it } from "vitest";
import { canCollaborator } from "@/lib/customer-app/collaborator-permissions";
import {
  cleanMessageBody,
  customerAccess,
  excerpt,
  firstNameOf,
  initialsOf,
  isUnreadFor,
  lastOwnIndex,
  mayViewRequestKind,
  mergeTimeline,
  pickThread,
  receiptFor,
  requestEntries,
  shouldPingTeam,
  taskActionForCustomerMessage,
  taskStatusAfterTeamReply,
  unreadCount,
  visibleRequestEntries,
  REQUEST_PREVIEW_PERMISSIONS,
  TEAM_PING_QUIET_MINUTES,
} from "./concierge-rules";

// ============================================================
// The rules both sides of a concierge conversation share. The customer screen
// and the team inbox read the same rows; these tests pin how "unread",
// "seen", "which thread", "who may write" and "who gets pinged" are worked
// out from them.
// ============================================================

const T0 = new Date("2026-09-16T05:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const conversation = [
  { authorType: "CUSTOMER", customerReadAt: null, staffReadAt: null }, // 0: not opened by the team
  { authorType: "CUSTOMER", customerReadAt: null, staffReadAt: at(3) }, // 1: opened by the team
  { authorType: "STAFF", customerReadAt: null, staffReadAt: null }, // 2: not opened by the customer
  { authorType: "STAFF", customerReadAt: at(9), staffReadAt: null }, // 3: opened by the customer
  { authorType: "SYSTEM", customerReadAt: null, staffReadAt: null }, // 4: "marked as resolved"
];

describe("unread", () => {
  it("the customer counts only team messages they have not opened", () => {
    expect(unreadCount(conversation, "CUSTOMER")).toBe(1);
    expect(isUnreadFor(conversation[2], "CUSTOMER")).toBe(true);
    expect(isUnreadFor(conversation[0], "CUSTOMER")).toBe(false);
  });

  it("the team counts only customer messages nobody on the team has opened", () => {
    expect(unreadCount(conversation, "STAFF")).toBe(1);
    expect(isUnreadFor(conversation[0], "STAFF")).toBe(true);
    expect(isUnreadFor(conversation[2], "STAFF")).toBe(false);
  });

  it("SYSTEM lines are never unread for either side", () => {
    expect(isUnreadFor(conversation[4], "CUSTOMER")).toBe(false);
    expect(isUnreadFor(conversation[4], "STAFF")).toBe(false);
  });
});

describe("read receipts", () => {
  it("a customer's message is 'sent' until the team opens it, then 'seen' at that time", () => {
    expect(receiptFor(conversation[0], "CUSTOMER")).toEqual({ state: "SENT", at: null });
    expect(receiptFor(conversation[1], "CUSTOMER")).toEqual({ state: "SEEN", at: at(3).toISOString() });
  });

  it("a team message is 'seen' only once the customer has opened it", () => {
    expect(receiptFor(conversation[2], "STAFF")).toEqual({ state: "SENT", at: null });
    expect(receiptFor(conversation[3], "STAFF")).toEqual({ state: "SEEN", at: at(9).toISOString() });
  });

  it("there is no receipt on the other side's messages or on SYSTEM lines", () => {
    expect(receiptFor(conversation[2], "CUSTOMER")).toBeNull();
    expect(receiptFor(conversation[0], "STAFF")).toBeNull();
    expect(receiptFor(conversation[4], "CUSTOMER")).toBeNull();
    expect(receiptFor(conversation[4], "STAFF")).toBeNull();
  });

  it("the receipt goes under the viewer's side's latest message", () => {
    expect(lastOwnIndex(conversation, "CUSTOMER")).toBe(1);
    expect(lastOwnIndex(conversation, "STAFF")).toBe(3);
    expect(lastOwnIndex([], "CUSTOMER")).toBe(-1);
  });
});

describe("who may read and write on the customer side", () => {
  it("the host and invited co-hosts read, write and mark messages as seen", () => {
    expect(customerAccess({ preview: false })).toEqual({ access: "HOST", canRead: true, canSend: true, marksSeen: true });
    expect(customerAccess({ preview: false, collaboratorRole: "CO_HOST" })).toEqual({
      access: "CO_HOST",
      canRead: true,
      canSend: true,
      marksSeen: true,
    });
  });

  it("an invited viewer has no concierge access at all, and neither has an unrecognised collaborator role", () => {
    expect(customerAccess({ preview: false, collaboratorRole: "VIEWER" })).toEqual({
      access: "VIEWER",
      canRead: false,
      canSend: false,
      marksSeen: false,
    });
    expect(customerAccess({ preview: false, collaboratorRole: "SOMETHING_NEW" })).toMatchObject({ canRead: false, canSend: false });
  });

  it("follows the shared collaborator permission matrix", () => {
    for (const role of ["CO_HOST", "VIEWER", "SOMETHING_NEW"]) {
      expect(customerAccess({ preview: false, collaboratorRole: role }).canRead).toBe(canCollaborator(role, "concierge:message"));
    }
  });

  it("a team member previewing the host view only reads", () => {
    expect(customerAccess({ preview: true, collaboratorRole: "CO_HOST" })).toEqual({
      access: "PREVIEW",
      canRead: true,
      canSend: false,
      marksSeen: false,
    });
  });
});

describe("thread selection", () => {
  const thread = (id: string, contactId: string, bookingId: string | null, status = "OPEN", minute = 0) => ({
    id,
    contactId,
    bookingId,
    status,
    lastMessageAt: at(minute),
  });

  it("uses the booking's own thread when there is one", () => {
    const threads = [thread("pre", "c1", null, "OPEN", 50), thread("wed", "c1", "b1", "OPEN", 10)];
    expect(pickThread(threads, { bookingId: "b1", contactIds: ["c1"] })).toEqual({ thread: threads[1], attachBooking: false });
  });

  it("carries a pre-booking thread over to the booking rather than starting a second conversation", () => {
    const threads = [thread("pre", "c1", null)];
    expect(pickThread(threads, { bookingId: "b1", contactIds: ["c1"] })).toEqual({ thread: threads[0], attachBooking: true });
  });

  it("for an invited collaborator, uses only the booking's thread and never the host's pre-booking conversation", () => {
    const onlyPre = [thread("pre", "c1", null)];
    expect(pickThread(onlyPre, { bookingId: "b1", contactIds: ["c1"], bookingOnly: true })).toEqual({ thread: null, attachBooking: false });
    const both = [thread("pre", "c1", null, "OPEN", 50), thread("wed", "c1", "b1", "OPEN", 1)];
    expect(pickThread(both, { bookingId: "b1", contactIds: ["c1"], bookingOnly: true }).thread?.id).toBe("wed");
  });

  it("without a booking, uses only the pre-booking thread and never borrows a booking's thread", () => {
    const threads = [thread("wed", "c1", "b1", "OPEN", 90), thread("pre", "c1", null, "OPEN", 5)];
    expect(pickThread(threads, { bookingId: null, contactIds: ["c1"] }).thread?.id).toBe("pre");
    expect(pickThread([threads[0]], { bookingId: null, contactIds: ["c1"] })).toEqual({ thread: null, attachBooking: false });
  });

  it("does not reuse another booking's thread for this booking", () => {
    const threads = [thread("other", "c1", "b2")];
    expect(pickThread(threads, { bookingId: "b1", contactIds: ["c1"] })).toEqual({ thread: null, attachBooking: false });
  });

  it("never picks a thread that belongs to a different contact", () => {
    const threads = [thread("stranger", "c9", "b1"), thread("stranger-pre", "c9", null)];
    expect(pickThread(threads, { bookingId: "b1", contactIds: ["c1"] }).thread).toBeNull();
    expect(pickThread(threads, { bookingId: null, contactIds: ["c1"] }).thread).toBeNull();
  });

  it("resolves a rare duplicate to the open thread first, then the most recent", () => {
    const threads = [
      thread("closed-newest", "c1", "b1", "CLOSED", 99),
      thread("open-older", "c1", "b1", "OPEN", 1),
      thread("open-newer", "c1", "b1", "OPEN", 20),
    ];
    expect(pickThread(threads, { bookingId: "b1", contactIds: ["c1"] }).thread?.id).toBe("open-newer");
    expect(pickThread([threads[0]], { bookingId: "b1", contactIds: ["c1"] }).thread?.id).toBe("closed-newest");
  });
});

describe("pinging the team", () => {
  it("pings for the first message in a conversation", () => {
    expect(shouldPingTeam({ previousCustomerAt: null, lastStaffAt: null, now: at(0) })).toBe(true);
  });

  it("does not ping again for lines typed in a burst", () => {
    expect(shouldPingTeam({ previousCustomerAt: at(0), lastStaffAt: null, now: at(2) })).toBe(false);
  });

  it("pings when the team has replied since the customer's previous message (a new turn)", () => {
    expect(shouldPingTeam({ previousCustomerAt: at(0), lastStaffAt: at(1), now: at(2) })).toBe(true);
  });

  it("pings again after a quiet spell", () => {
    expect(shouldPingTeam({ previousCustomerAt: at(0), lastStaffAt: null, now: at(TEAM_PING_QUIET_MINUTES) })).toBe(true);
    expect(shouldPingTeam({ previousCustomerAt: at(0), lastStaffAt: null, now: at(TEAM_PING_QUIET_MINUTES - 1) })).toBe(false);
  });
});

describe("the work-queue task", () => {
  it("a customer message updates the open task and opens a new one only after the last is done", () => {
    expect(taskActionForCustomerMessage(null)).toBe("CREATE");
    expect(taskActionForCustomerMessage({ status: "TODO" })).toBe("UPDATE");
    expect(taskActionForCustomerMessage({ status: "IN_PROGRESS" })).toBe("UPDATE");
    expect(taskActionForCustomerMessage({ status: "DONE" })).toBe("CREATE");
  });

  it("a team reply moves to-do to in progress and never completes or reopens a task", () => {
    expect(taskStatusAfterTeamReply("TODO")).toBe("IN_PROGRESS");
    expect(taskStatusAfterTeamReply("IN_REVIEW")).toBe("IN_REVIEW");
    expect(taskStatusAfterTeamReply("DONE")).toBe("DONE");
  });
});

describe("requests shown in the conversation", () => {
  const task = (id: string, metadata: unknown, status = "TODO", minute = 0) => ({
    id,
    title: `Title ${id}`,
    description: `Asked for ${id}`,
    status,
    createdAt: at(minute),
    metadata,
  });

  it("shows package and redemption requests with the customer wording of their live status", () => {
    const entries = requestEntries([
      task("pk", { kind: "PACKAGES" }, "IN_PROGRESS"),
      task("rd", { kind: "REDEEM" }, "DONE"),
      task("old", null, "TODO"),
    ]);
    expect(entries.map((e) => [e.id, e.label, e.statusLabel])).toEqual([
      ["pk", "Package request", "The team is on it"],
      ["rd", "Reward redemption", "Done"],
      ["old", "Request to the team", "Sent to the team"],
    ]);
  });

  it("skips tasks that only mirror a conversation, so nothing is shown twice", () => {
    expect(requestEntries([task("mirror", { kind: "MESSAGE", threadId: "t1" })])).toEqual([]);
  });

  it("merges requests into the message timeline in time order", () => {
    const merged = mergeTimeline(
      [
        { id: "m1", createdAt: at(0).toISOString() },
        { id: "m2", createdAt: at(10).toISOString() },
      ],
      [{ id: "r1", createdAt: at(5).toISOString() }, { id: "r2", createdAt: at(10).toISOString() }]
    );
    expect(merged.map((x) => x.item.id)).toEqual(["m1", "r1", "m2", "r2"]);
  });
});

describe("who sees the requests", () => {
  const entries = requestEntries([
    { id: "pk", title: "Packages requested", description: "Please add to my booking: • Decor (₹90,000)", status: "TODO", createdAt: at(0), metadata: { kind: "PACKAGES" } },
    { id: "rd", title: "Reward redemption", description: "Use 500 of 1,200 loyalty points: decor", status: "TODO", createdAt: at(1), metadata: { kind: "REDEEM" } },
    { id: "old", title: "Message from host", description: "Can we visit on Sunday?", status: "DONE", createdAt: at(2), metadata: null },
    { id: "new", title: "Something newer", description: "Hold 12 December", status: "TODO", createdAt: at(3), metadata: { kind: "HOLD" } },
  ]);
  const ids = (list: { id: string }[]) => list.map((e) => e.id);
  const grants = (...perms: string[]) => (permission: string) => perms.includes(permission);

  it("the booking's own customer sees every request", () => {
    expect(ids(visibleRequestEntries(entries, "HOST", grants()))).toEqual(["pk", "rd", "old", "new"]);
  });

  it("invited co-hosts and viewers see none, whatever permissions are passed", () => {
    expect(visibleRequestEntries(entries, "CO_HOST", () => true)).toEqual([]);
    expect(visibleRequestEntries(entries, "VIEWER", () => true)).toEqual([]);
  });

  it("a staff preview sees points requests only with loyalty:read", () => {
    expect(ids(visibleRequestEntries(entries, "PREVIEW", grants("bookings:read")))).toEqual(["old"]);
    expect(ids(visibleRequestEntries(entries, "PREVIEW", grants("bookings:read", "loyalty:read")))).toEqual(["rd", "old"]);
  });

  it("a staff preview sees package requests only with the package catalogue and the work queue", () => {
    expect(REQUEST_PREVIEW_PERMISSIONS.PACKAGES).toEqual(["packages:read", "tasks:read"]);
    expect(mayViewRequestKind("PREVIEW", "PACKAGES", grants("packages:read"))).toBe(false);
    expect(mayViewRequestKind("PREVIEW", "PACKAGES", grants("tasks:read"))).toBe(false);
    expect(ids(visibleRequestEntries(entries, "PREVIEW", grants("packages:read", "tasks:read")))).toEqual(["pk", "old"]);
  });

  it("a request kind nobody has classified never shows in a preview", () => {
    expect(mayViewRequestKind("PREVIEW", "HOLD", () => true)).toBe(false);
    expect(mayViewRequestKind("PREVIEW", "toString", () => true)).toBe(false);
  });
});

describe("message text", () => {
  it("trims, drops control characters and collapses blank runs but keeps line breaks", () => {
    expect(cleanMessageBody("  Hello  there\r\n\r\n\r\n\r\nSecond line  ")).toBe("Hello there\n\nSecond line");
  });

  it("is empty for blank or non-text input and capped at the maximum", () => {
    expect(cleanMessageBody("   \n\t ")).toBe("");
    expect(cleanMessageBody(42)).toBe("");
    expect(cleanMessageBody("x".repeat(50), 10)).toBe("x".repeat(10));
  });

  it("names and excerpts", () => {
    expect(excerpt("a  b\nc", 10)).toBe("a b c");
    expect(excerpt("abcdefghij", 5)).toBe("abcd…");
    expect(firstNameOf("  Priya Sharma ")).toBe("Priya");
    expect(firstNameOf(null)).toBeNull();
    expect(initialsOf("Priya Sharma")).toBe("PS");
    expect(initialsOf("")).toBe("V");
  });
});
