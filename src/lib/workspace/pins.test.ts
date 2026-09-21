import { describe, it, expect } from "vitest";
import {
  MAX_PINS,
  flattenPinnable,
  parseStoredPins,
  pinsStorageKey,
  resolvePins,
  sanitizePins,
  togglePin,
  type PinnableNavItem,
} from "./pins";

const nav: PinnableNavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  {
    title: "Sales",
    // Mirrors the real nav: a group's href duplicates its first child's.
    href: "/leads",
    icon: "Users",
    children: [
      { title: "Leads", href: "/leads", icon: "Users" },
      { title: "Pipeline", href: "/leads/pipeline", icon: "Kanban" },
    ],
  },
  { title: "Invoices", href: "/invoices", icon: "Receipt" },
];

const many = (n: number) => Array.from({ length: n }, (_, i) => `/m${i}`);

describe("flattenPinnable", () => {
  it("returns leaves and group children, never the group header", () => {
    const flat = flattenPinnable(nav);
    expect(flat.map((i) => i.href)).toEqual([
      "/dashboard",
      "/leads",
      "/leads/pipeline",
      "/invoices",
    ]);
    // The "/leads" entry is the child link, not the disclosure header.
    expect(flat.find((i) => i.href === "/leads")?.title).toBe("Leads");
  });

  it("dedupes repeated hrefs so one pin cannot render twice", () => {
    const flat = flattenPinnable([...nav, { title: "Dup", href: "/invoices", icon: "X" }]);
    expect(flat.filter((i) => i.href === "/invoices")).toHaveLength(1);
  });
});

describe("sanitizePins / parseStoredPins", () => {
  it("drops non-strings, external URLs, protocol-relative paths and duplicates", () => {
    expect(
      sanitizePins(["/leads", 7, null, "https://evil.test", "//evil.test", "/leads", "/invoices"])
    ).toEqual(["/leads", "/invoices"]);
  });

  it("re-applies the cap to a hand-edited value", () => {
    expect(sanitizePins(many(20))).toHaveLength(MAX_PINS);
  });

  it("treats corrupt or missing storage as nothing pinned", () => {
    expect(parseStoredPins(null)).toEqual([]);
    expect(parseStoredPins("")).toEqual([]);
    expect(parseStoredPins("{not json")).toEqual([]);
    expect(parseStoredPins('{"a":1}')).toEqual([]);
    expect(parseStoredPins('["/leads"]')).toEqual(["/leads"]);
  });
});

describe("togglePin", () => {
  it("adds to the end, preserving the user's order", () => {
    expect(togglePin(["/a"], "/b")).toEqual({ ok: true, pins: ["/a", "/b"], pinned: true });
  });

  it("removes an existing pin", () => {
    expect(togglePin(["/a", "/b"], "/a")).toEqual({ ok: true, pins: ["/b"], pinned: false });
  });

  it("does not mutate its input", () => {
    const pins = ["/a"];
    togglePin(pins, "/b");
    expect(pins).toEqual(["/a"]);
  });

  it("refuses the 9th pin with a reason instead of silently failing", () => {
    const full = many(MAX_PINS);
    const res = togglePin(full, "/ninth");
    expect(res).toEqual({ ok: false, pins: full, reason: "limit" });
  });

  it("still lets a user at the cap unpin", () => {
    const full = many(MAX_PINS);
    const res = togglePin(full, "/m0");
    expect(res.ok).toBe(true);
    expect(res.pins).toHaveLength(MAX_PINS - 1);
  });

  it("counts only VISIBLE pins toward the cap and evicts hidden ones to make room", () => {
    const full = many(MAX_PINS);
    // Role change: the user can now see only the first five of their pins.
    const allowed = new Set([...full.slice(0, 5), "/new"]);
    const res = togglePin(full, "/new", allowed);
    expect(res).toEqual({ ok: true, pins: [...full.slice(0, 5), "/new"], pinned: true });
  });

  it("keeps hidden pins when there is room without evicting them", () => {
    const res = togglePin(["/hidden", "/a"], "/b", new Set(["/a", "/b"]));
    expect(res.pins).toEqual(["/hidden", "/a", "/b"]);
  });

  it("enforces the cap when all eight are visible", () => {
    const full = many(MAX_PINS);
    const res = togglePin(full, "/new", new Set([...full, "/new"]));
    expect(res.ok).toBe(false);
  });
});

describe("resolvePins", () => {
  const allowed = flattenPinnable(nav);

  it("returns nav items in pin order", () => {
    expect(resolvePins(["/invoices", "/leads"], allowed).map((i) => i.title)).toEqual([
      "Invoices",
      "Leads",
    ]);
  });

  it("silently drops a pin the role can no longer see", () => {
    // Finance access revoked: /invoices is absent from the role-filtered nav.
    const withoutFinance = flattenPinnable(nav.filter((i) => i.href !== "/invoices"));
    expect(resolvePins(["/invoices", "/dashboard"], withoutFinance).map((i) => i.href)).toEqual([
      "/dashboard",
    ]);
  });

  it("never fabricates a link from a stored string that is not in the nav", () => {
    expect(resolvePins(["/admin/secret"], allowed)).toEqual([]);
  });
});

describe("pinsStorageKey", () => {
  it("is scoped per user so a shared machine does not leak pins", () => {
    expect(pinsStorageKey("u1")).not.toBe(pinsStorageKey("u2"));
  });
});
