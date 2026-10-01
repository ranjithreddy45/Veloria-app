import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { MODULES, MODULE_KEYS, isModuleKey, resolveModule, type ModuleKey } from "./modules";
import { sidebarNavigation, type NavItem } from "./navigation";

// ------------------------------------------------------------
// Route discovery: every page.tsx under an app route group, as a URL.
// ------------------------------------------------------------
const APP_DIR = fileURLToPath(new URL("../app/", import.meta.url));

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pageFiles(full));
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

/** app/(dashboard)/bookings/[bookingId]/menu/page.tsx -> /bookings/sample-id/menu */
function routeOf(file: string): string {
  const segments = path
    .relative(APP_DIR, path.dirname(file))
    .split(path.sep)
    .filter((s) => s && !(s.startsWith("(") && s.endsWith(")")) && !s.startsWith("@"))
    .map((s) => (s.startsWith("[") ? "sample-id" : s));
  return "/" + segments.join("/");
}

function routesIn(group: string): string[] {
  return pageFiles(path.join(APP_DIR, group)).map(routeOf).sort();
}

const DASHBOARD_ROUTES = routesIn("(dashboard)");

// ------------------------------------------------------------
// Sidebar icons by href (parent and leaf items alike).
// ------------------------------------------------------------
function navIconsByHref(items: NavItem[], into = new Map<string, Set<string>>()) {
  for (const item of items) {
    if (!into.has(item.href)) into.set(item.href, new Set());
    into.get(item.href)!.add(item.icon);
    if (item.children) navIconsByHref(item.children, into);
  }
  return into;
}
const NAV_ICONS = navIconsByHref(sidebarNavigation);
const LUCIDE = Lucide as unknown as Record<string, LucideIcon | undefined>;

/** Lucide's canonical name for an export (aliases such as CheckSquare -> SquareCheckBig). */
function glyphName(icon: LucideIcon | undefined): string | undefined {
  return icon?.displayName;
}

const keysWithHue = (hue: string) => MODULE_KEYS.filter((k) => MODULES[k].hue === hue);

describe("resolveModule: every page belongs to a module", () => {
  it("finds the (dashboard) pages", () => {
    expect(DASHBOARD_ROUTES.length).toBeGreaterThan(300);
    expect(DASHBOARD_ROUTES).toContain("/dashboard");
  });

  it("resolves every (dashboard) page except /dashboard", () => {
    const unresolved = DASHBOARD_ROUTES.filter((r) => r !== "/dashboard" && resolveModule(r) === null);
    expect(unresolved).toEqual([]);
    expect(resolveModule("/dashboard")).toBeNull();
  });

  it("gives the external portals no module", () => {
    const portalRoutes = [...routesIn("(portal)"), ...routesIn("(vendor-portal)")];
    expect(portalRoutes.length).toBeGreaterThan(0);
    expect(portalRoutes.filter((r) => resolveModule(r) !== null)).toEqual([]);
  });

  it("covers every top-level (dashboard) segment", () => {
    const segments = new Set(DASHBOARD_ROUTES.map((r) => r.split("/")[1]).filter((s) => s !== "dashboard"));
    for (const segment of segments) {
      const owners = MODULE_KEYS.filter((k) =>
        MODULES[k].prefixes.some((p) => p === "/" + segment || p.startsWith("/" + segment + "/"))
      );
      expect(owners.length, segment).toBeGreaterThan(0);
    }
  });
});

describe("resolveModule: matching rules", () => {
  it.each<[string | null | undefined, ModuleKey | null]>([
    // Acceptance examples
    ["/bookings/abc/menu", "bookings"],
    ["/portal/bookings", null],
    ["/leads/import?x=1", "leads"],
    // Every tab of a booking is bookings
    ["/bookings/calendar", "bookings"],
    ["/bookings/abc/operations", "bookings"],
    ["/bookings/new", "bookings"],
    // Longest prefix wins
    ["/people/payroll/fnf/abc", "people-payroll"],
    ["/people/leave/comp-off", "people-leave"],
    ["/people/attendance/muster", "people-attendance"],
    ["/people/shifts", "people-attendance"],
    ["/people/gratuity/report", "people-payroll"],
    ["/people/lms", "people"],
    ["/people/reports/attendance/punches", "people"],
    // Segment boundaries, not string prefixes
    ["/menu", "catalog"],
    ["/me/leave", "me"],
    ["/projects/abc/procurement", "projects"],
    ["/procurement/abc", "procurement"],
    ["/bookingsx", null],
    // Sub-pages match their URL parent
    ["/finance/command-center", "finance"],
    ["/settings/integrations/whatsapp", "settings"],
    ["/bd/deals", "bd"],
    ["/owners/abc/edit", "bd"],
    ["/whatsapp/console", "engagement"],
    ["/pipeline", "pipeline"],
    // Normalisation
    ["/leads/", "leads"],
    ["/leads#top", "leads"],
    ["https://app.example.com/quotations/new?lead=1", "quotations"],
    ["bookings", "bookings"], // a ModuleKey passes through
    // No module
    ["/dashboard", null],
    ["/dashboard?tab=1", null],
    ["/vendor-portal/bids", null],
    ["/", null],
    ["/no-such-module", null],
    ["", null],
    [null, null],
    [undefined, null],
    ["not a path", null],
  ])("%s -> %s", (input, expected) => {
    expect(resolveModule(input)).toBe(expected);
  });

  it("isModuleKey accepts keys only", () => {
    for (const key of MODULE_KEYS) expect(isModuleKey(key)).toBe(true);
    for (const bad of ["/leads", "Leads", "dashboard", "portal", "toString", "", null, undefined, 1]) {
      expect(isModuleKey(bad)).toBe(false);
    }
  });
});

describe("registry shape", () => {
  it("prefixes are clean, absolute and owned by exactly one module", () => {
    const seen = new Map<string, ModuleKey>();
    for (const key of MODULE_KEYS) {
      const { prefixes } = MODULES[key];
      expect(prefixes.length, key).toBeGreaterThan(0);
      for (const prefix of prefixes) {
        expect(prefix, key).toMatch(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/);
        expect(seen.get(prefix), `${prefix} is claimed twice`).toBeUndefined();
        seen.set(prefix, key);
        for (const reserved of ["/dashboard", "/portal", "/vendor-portal"]) {
          expect(prefix === reserved || prefix.startsWith(reserved + "/"), prefix).toBe(false);
        }
      }
    }
  });

  it("labels are sentence case", () => {
    for (const key of MODULE_KEYS) {
      const { label } = MODULES[key];
      expect(label.trim(), key).toBe(label);
      // Only the first word may be capitalised, except acronyms (BD, CRM, BEO, F&B).
      const rest = label.split(/\s+/).slice(1);
      for (const word of rest) {
        const isAcronym = /^[A-Z&()]+$/.test(word.replace(/[()]/g, "")) && word.length > 1;
        expect(isAcronym || word === word.toLowerCase(), `${key}: "${label}"`).toBe(true);
      }
    }
  });
});

describe("one module, one look (R3)", () => {
  it.each(MODULE_KEYS.filter((k) => MODULES[k].navHref))("%s: glyph is its sidebar icon", (key) => {
    const { navHref, icon } = MODULES[key];
    const navIcons = NAV_ICONS.get(navHref!);
    expect(navIcons, `${navHref} is not in navigation.ts`).toBeDefined();
    const navGlyphs = [...navIcons!].map((name) => {
      const component = LUCIDE[name];
      expect(component, `navigation.ts icon "${name}" is not a lucide-react export`).toBeDefined();
      return glyphName(component);
    });
    expect(navGlyphs).toContain(glyphName(icon));
  });

  it("the module's navHref belongs to the module itself", () => {
    for (const key of MODULE_KEYS) {
      const { navHref } = MODULES[key];
      if (navHref) expect(resolveModule(navHref), key).toBe(key);
    }
  });

  it("keeps the dashboard's approved anchor hues", () => {
    expect(MODULES.leads.hue).toBe("emerald");
    expect(MODULES.quotations.hue).toBe("indigo");
    expect(MODULES.payments.hue).toBe("cyan");
    expect(MODULES["site-visits"].hue).toBe("amber");
    expect(MODULES.availability.hue).toBe("pink");
  });

  it.each<[ModuleKey, string, string]>([
    // Dashboard anchors
    ["leads", "emerald", "UserPlus"],
    ["quotations", "indigo", "Calculator"],
    ["payments", "cyan", "CreditCard"],
    ["site-visits", "amber", "CalendarCheck"],
    ["availability", "pink", "CalendarClock"],
    // Landings
    ["bookings", "blue", "CalendarCheck"],
    ["pipeline", "teal", "Kanban"],
    ["contacts", "slate", "Users"],
    ["invoices", "gold", "FileText"],
    ["finance", "emerald", "Scale"],
    ["projects", "amber", "Building2"],
    ["tasks", "indigo", "CheckSquare"],
    ["beo", "emerald", "ClipboardList"],
    ["kitchen", "pink", "UtensilsCrossed"],
    ["vendors", "teal", "Store"],
    // Other seeded modules
    ["procurement", "cyan", "Package"],
    ["logistics", "slate", "Truck"],
    ["support", "blue", "Inbox"],
    ["people", "gold", "Users"],
    ["people-attendance", "blue", "Clock"],
    ["people-payroll", "emerald", "IndianRupee"],
    ["people-leave", "cyan", "CalendarCheck"],
    ["settings", "slate", "Settings"],
  ])("%s is %s %s", (key, hue, iconName) => {
    expect(MODULES[key].hue).toBe(hue);
    expect(glyphName(MODULES[key].icon)).toBe(glyphName(LUCIDE[iconName]));
  });

  it.each<[string, ModuleKey[]]>([
    ["Sales", ["leads", "pipeline", "quotations", "contacts", "bookings", "availability", "site-visits"]],
    ["Ops", ["projects", "tasks", "beo", "kitchen", "procurement", "logistics", "support", "vendors"]],
    ["Finance", ["finance", "invoices", "payments"]],
    ["People", ["people", "people-attendance", "people-payroll", "people-leave"]],
    // The wider sidebar bands where the palette allows it
    ["Finance band", ["finance", "invoices", "payments", "payouts"]],
    ["People band", ["recruitment", "me", "people", "people-attendance", "people-leave", "people-payroll"]],
  ])("%s: no two modules share a hue", (_set, keys) => {
    const hues = keys.map((k) => MODULES[k].hue);
    expect(new Set(hues).size, hues.join(", ")).toBe(keys.length);
  });

  it("no two modules share both glyph and hue", () => {
    const seen = new Map<string, ModuleKey>();
    for (const key of MODULE_KEYS) {
      const id = `${glyphName(MODULES[key].icon)}/${MODULES[key].hue}`;
      expect(seen.get(id), `${key} looks exactly like ${seen.get(id)}`).toBeUndefined();
      seen.set(id, key);
    }
  });

  it("never uses brand, rose or red, or the Sparkles mark", () => {
    expect(keysWithHue("brand")).toEqual([]);
    expect(keysWithHue("rose")).toEqual([]);
    expect(keysWithHue("red")).toEqual([]);
    const sparkles = glyphName(LUCIDE.Sparkles);
    expect(MODULE_KEYS.filter((k) => glyphName(MODULES[k].icon) === sparkles)).toEqual([]);
  });
});
