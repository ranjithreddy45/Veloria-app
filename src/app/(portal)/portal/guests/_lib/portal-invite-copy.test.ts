import { describe, expect, it } from "vitest";
import { INVITE_ALL_BATCH } from "@/app/(guest)/app/event/guests/_lib/guest-invites";
import { importResultMessage, sendAllLabel, sendAllNote, sendAllResult } from "./portal-invite-copy";

const none = { sent: 0, failed: 0, needPhone: 0, later: 0, limited: 0 };

describe("importResultMessage — what a pasted import added", () => {
  it("counts the guests added", () => {
    expect(importResultMessage({ count: 1, duplicates: 0 })).toBe("1 guest imported.");
    expect(importResultMessage({ count: 12, duplicates: 0 })).toBe("12 guests imported.");
  });

  it("says how many rows were left out because their number is already on the list", () => {
    expect(importResultMessage({ count: 10, duplicates: 1 })).toBe(
      "10 guests imported · 1 left out: that number is already on your list."
    );
    expect(importResultMessage({ count: 1, duplicates: 3 })).toBe(
      "1 guest imported · 3 left out: those numbers are already on your list."
    );
  });
});

describe("sendAllResult — the toast after Send all", () => {
  it("a clean run is a success that counts accepted sends only", () => {
    expect(sendAllResult({ ...none, sent: 12 })).toEqual({ tone: "success", message: "12 invitations sent" });
    expect(sendAllResult({ ...none, sent: 1, needPhone: 2 })).toEqual({
      tone: "success",
      message: "1 invitation sent · 2 guests need a phone number",
    });
  });

  it("names what didn't go out: refused, still to send, over the 24-hour limit", () => {
    expect(sendAllResult({ sent: 50, failed: 2, needPhone: 1, later: 30, limited: 4 })).toEqual({
      tone: "warning",
      message:
        "50 invitations sent · 1 guest needs a phone number · 2 couldn't be sent · 30 more to send — press Send again · 4 over the 24-hour sending limit — send them later",
    });
    expect(sendAllResult({ ...none, sent: 5, limited: 1 }).tone).toBe("warning");
  });

  it("is an error when WhatsApp refused everything, and never a success when nothing went out", () => {
    expect(sendAllResult({ ...none, failed: 3 })).toEqual({ tone: "error", message: "0 invitations sent · 3 couldn't be sent" });
    expect(sendAllResult({ ...none, limited: 2 }).tone).toBe("warning");
    expect(sendAllResult(none)).toEqual({ tone: "info", message: "0 invitations sent" });
  });
});

describe("sendAllLabel / sendAllNote — never offer more than one press sends", () => {
  it("offers everyone when one press can send them all", () => {
    expect(sendAllLabel(1)).toBe("Send all invitations (1)");
    expect(sendAllLabel(INVITE_ALL_BATCH)).toBe(`Send all invitations (${INVITE_ALL_BATCH})`);
    expect(sendAllNote(INVITE_ALL_BATCH)).toBeNull();
  });

  it("offers one batch when more are waiting, and says how many", () => {
    expect(sendAllLabel(INVITE_ALL_BATCH + 70)).toBe(`Send ${INVITE_ALL_BATCH} invitations`);
    expect(sendAllNote(INVITE_ALL_BATCH + 70)).toBe(
      `${INVITE_ALL_BATCH + 70} guests not invited yet. Up to ${INVITE_ALL_BATCH} invitations go out each time you press Send.`
    );
  });
});
