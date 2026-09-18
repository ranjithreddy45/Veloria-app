import { describe, expect, it } from "vitest";
import { GUEST_TABS, isActiveTab, isRootTab, unreadBadgeText } from "./nav-items";

// The phone's bottom tab bar and the laptop's top bar render from this one
// list. These tests are the contract that keeps them from drifting apart:
// if a destination is added, renamed or re-pointed, it happens once, here.

describe("GUEST_TABS", () => {
  it("is the five roots of the customer app, in the designed order", () => {
    expect(GUEST_TABS.map((t) => t.href)).toEqual([
      "/app",
      "/app/venues",
      "/app/event",
      "/app/concierge",
      "/app/account",
    ]);
    expect(GUEST_TABS.map((t) => t.label)).toEqual(["Home", "Halls", "My event", "Concierge", "Account"]);
  });

  it("gives every tab its own href, label and icon", () => {
    expect(new Set(GUEST_TABS.map((t) => t.href)).size).toBe(GUEST_TABS.length);
    expect(new Set(GUEST_TABS.map((t) => t.label)).size).toBe(GUEST_TABS.length);
    expect(new Set(GUEST_TABS.map((t) => t.icon)).size).toBe(GUEST_TABS.length);
    for (const tab of GUEST_TABS) {
      expect(tab.href.startsWith("/app")).toBe(true);
      expect(tab.label.trim()).toBe(tab.label);
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });

  it("carries exactly one concierge tab, the only one that can show a badge", () => {
    expect(GUEST_TABS.filter((t) => t.icon === "concierge").map((t) => t.href)).toEqual(["/app/concierge"]);
  });
});

describe("isRootTab", () => {
  it("is true on each of the five roots", () => {
    for (const tab of GUEST_TABS) expect(isRootTab(tab.href)).toBe(true);
  });

  it("is false on inner screens, which carry a back button instead of a bar", () => {
    for (const path of [
      "/app/venues/hall-1",
      "/app/venues/compare",
      "/app/venues/hall-1/photos",
      "/app/book",
      "/app/event/guests",
      "/app/welcome",
      "/app/",
      "/appointments",
      "",
    ]) {
      expect(isRootTab(path)).toBe(false);
    }
  });
});

describe("isActiveTab", () => {
  it("marks the tab the customer is on, and only that one", () => {
    const active = GUEST_TABS.filter((t) => isActiveTab(t, "/app/venues"));
    expect(active.map((t) => t.href)).toEqual(["/app/venues"]);
  });

  it("does not mark Home on a screen that merely lives under /app", () => {
    const home = GUEST_TABS[0];
    expect(home.href).toBe("/app");
    expect(isActiveTab(home, "/app/venues")).toBe(false);
  });
});

describe("unreadBadgeText", () => {
  it("draws no badge at all when nothing is unread", () => {
    expect(unreadBadgeText(0)).toBeNull();
    expect(unreadBadgeText(-3)).toBeNull();
    expect(unreadBadgeText(Number.NaN)).toBeNull();
  });

  it("counts up to nine, then says 9+", () => {
    expect(unreadBadgeText(1)).toBe("1");
    expect(unreadBadgeText(9)).toBe("9");
    expect(unreadBadgeText(10)).toBe("9+");
    expect(unreadBadgeText(240)).toBe("9+");
  });

  it("never invents a fraction", () => {
    expect(unreadBadgeText(2.7)).toBe("2");
  });
});
