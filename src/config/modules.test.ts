import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/lib/constants";
import { PROJECTS_MODULE_ENABLED } from "./feature-flags";
import {
  MODULES,
  MODULE_KEYS,
  MODULE_SECTIONS,
  isModuleKey,
  moduleEyebrowText,
  resolveModule,
  sameDisplayName,
  type ModuleKey,
} from "./modules";
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

/**
 * Modules whose whole sidebar band a feature flag can hide
 * (src/config/feature-flags.ts). With PROJECTS_MODULE_ENABLED = false the
 * Projects band leaves navigation.ts and its pages 404, so its navHref has no
 * sidebar icon to compare; its routes still resolve to the module.
 */
const NAV_FLAGS: Partial<Record<ModuleKey, boolean>> = { projects: PROJECTS_MODULE_ENABLED };
const shownInNav = (key: ModuleKey) => NAV_FLAGS[key] !== false;
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
    ["/people/leave", "people-attendance"],
    ["/people/leave/comp-off", "people-attendance"],
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
  it.each(MODULE_KEYS.filter((k) => MODULES[k].navHref && shownInNav(k)))("%s: glyph is its sidebar icon", (key) => {
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
    ["settings", "slate", "Settings"],
  ])("%s is %s %s", (key, hue, iconName) => {
    expect(MODULES[key].hue).toBe(hue);
    expect(glyphName(MODULES[key].icon)).toBe(glyphName(LUCIDE[iconName]));
  });

  it.each<[string, ModuleKey[]]>([
    ["Sales", ["leads", "pipeline", "quotations", "contacts", "bookings", "availability", "site-visits"]],
    ["Ops", ["projects", "tasks", "beo", "kitchen", "procurement", "logistics", "support", "vendors"]],
    ["Finance", ["finance", "invoices", "payments"]],
    ["People", ["people", "people-attendance", "people-payroll"]],
    // The wider sidebar bands where the palette allows it
    ["Finance band", ["finance", "invoices", "payments", "payouts"]],
    ["People band", ["recruitment", "me", "people", "people-attendance", "people-payroll"]],
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

// ------------------------------------------------------------
// Sidebar bands: app-sidebar.tsx's SECTIONS map (top-level nav href -> band).
// ------------------------------------------------------------
const SIDEBAR_FILE = fileURLToPath(new URL("../components/layout/app-sidebar.tsx", import.meta.url));

function sidebarSections(): Map<string, string> {
  const src = readFileSync(SIDEBAR_FILE, "utf8");
  const block = src.match(/const SECTIONS: Record<string, string> = \{([\s\S]*?)\n\};/);
  if (!block) throw new Error("app-sidebar.tsx: the SECTIONS map has moved; update sidebarSections()");
  const entries = block[1].replace(/\/\/.*$/gm, "").matchAll(/"([^"]+)":\s*"([^"]+)"/g);
  return new Map([...entries].map((m) => [m[1], m[2]] as [string, string]));
}
const SIDEBAR_SECTIONS = sidebarSections();

/**
 * The band each top-level sidebar row sits under, as the sidebar draws it: a
 * band's header renders the first time the band appears in nav order, and a
 * row without a SECTIONS entry sits under the last header drawn. Rows above
 * the first band (the hub) have none.
 */
function bandsOfTopLevelRows(): Map<NavItem, string | undefined> {
  const out = new Map<NavItem, string | undefined>();
  let current: string | undefined;
  for (const item of sidebarNavigation) {
    current = SIDEBAR_SECTIONS.get(item.href) ?? current;
    out.set(item, current);
  }
  return out;
}
const TOP_LEVEL_BANDS = bandsOfTopLevelRows();

const inSubtree = (item: NavItem, href: string): boolean =>
  item.href === href || (item.children ?? []).some((child) => inSubtree(child, href));

/** The top-level row a module's nav entry lives in: its own row first, else the first row whose subtree holds it. */
function topLevelRowOf(href: string): NavItem | undefined {
  return sidebarNavigation.find((item) => item.href === href) ?? sidebarNavigation.find((item) => inSubtree(item, href));
}

/** Rows above the first band (My work, Team chat, Playbook) and modules outside the sidebar take this. */
const UNBANDED_SECTION = "Workspace";

// ------------------------------------------------------------
// PageHeader call sites in (dashboard) page.tsx files.
// ------------------------------------------------------------
interface HeaderUse {
  route: string;
  /** The literal title, or null when it is an expression. */
  title: string | null;
  /** The literal `module` override: a key, `false`, or undefined. */
  module: string | false | undefined;
  /** An `eyebrow` prop (or a spread that may carry one) replaces the default. */
  hasEyebrow: boolean;
}

function literalOf(init: ts.JsxAttributeValue | undefined): string | boolean | null {
  if (!init) return true;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (e.kind === ts.SyntaxKind.FalseKeyword) return false;
  }
  return null;
}

function pageHeaderUses(): HeaderUse[] {
  const uses: HeaderUse[] = [];
  for (const file of pageFiles(path.join(APP_DIR, "(dashboard)"))) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("<PageHeader")) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(sf) === "PageHeader") {
        const use: HeaderUse = { route: routeOf(file), title: null, module: undefined, hasEyebrow: false };
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)) {
            use.hasEyebrow = true; // {...props}: can't tell, so don't judge it
            continue;
          }
          const name = attr.name.getText(sf);
          const value = literalOf(attr.initializer);
          if (name === "eyebrow") use.hasEyebrow = true;
          if (name === "title" && typeof value === "string") use.title = value;
          if (name === "module" && (typeof value === "string" || value === false)) use.module = value;
        }
        uses.push(use);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return uses;
}

describe("sections and the default eyebrow", () => {
  it("MODULE_SECTIONS are the sidebar's bands, spelled and ordered as the sidebar has them", () => {
    expect(SIDEBAR_SECTIONS.size).toBeGreaterThan(0);
    expect([...MODULE_SECTIONS]).toEqual([...new Set(SIDEBAR_SECTIONS.values())]);
  });

  it("every module has a non-empty section", () => {
    for (const key of MODULE_KEYS) {
      const { section } = MODULES[key];
      expect(typeof section === "string" && section.trim().length > 0, key).toBe(true);
      expect(section.trim(), key).toBe(section);
      expect(MODULE_SECTIONS as readonly string[], key).toContain(section);
    }
  });

  it.each(MODULE_KEYS)("%s: section is the sidebar band it sits under", (key) => {
    const { navHref, section } = MODULES[key];
    const row = navHref ? topLevelRowOf(navHref) : undefined;
    if (row) {
      expect(section).toBe(TOP_LEVEL_BANDS.get(row) ?? UNBANDED_SECTION);
    } else if (navHref && SIDEBAR_SECTIONS.has(navHref)) {
      // A band a feature flag hides (Projects): the sidebar still files it.
      expect(section).toBe(SIDEBAR_SECTIONS.get(navHref));
    } else {
      // Not in the sidebar at all (Notifications, from the header bell).
      expect(section).toBe(UNBANDED_SECTION);
    }
  });

  it("the People sub-modules share the People band", () => {
    for (const key of ["people", "people-attendance", "people-payroll"] as const) {
      expect(MODULES[key].section, key).toBe("People");
    }
  });

  it.each<[string, string, boolean]>([
    ["Team chat", "Team Chat", true],
    ["Resources", "  resources ", true],
    ["Time & attendance", "Time and Attendance", true],
    ["Logistics & dispatch", "Logistics and dispatch", true],
    ["Kitchen & F&B", "Kitchen and F and B", true],
    ["Speed-to-lead", "Speed to Lead", true],
    ["Leads", "Leads", true],
    ["Leads", "Lead", false],
    ["Leave", "Leave types", false],
    ["Payroll", "Payroll settings", false],
    ["Finance", "Financial reports", false],
  ])("sameDisplayName(%j, %j) is %s", (a, b, expected) => {
    expect(sameDisplayName(a, b)).toBe(expected);
    expect(sameDisplayName(b, a)).toBe(expected);
  });

  it.each<[ModuleKey, string | null | undefined, string]>([
    // The label, when it doesn't repeat the title
    ["leads", "SLA War-Room", "Leads"],
    ["people-attendance", "Leave types", "Time & attendance"],
    ["settings", "Integrations", "Settings"],
    ["resources", undefined, "Resources"],
    ["resources", "", "Resources"],
    // The section, when the label is the title
    ["resources", "Resources", "Delivery & Ops"],
    ["people-payroll", "Payroll", "People"],
    ["people-attendance", "Time & Attendance", "People"],
    ["chat", "Team Chat", "Workspace"],
    ["notifications", "Notifications", "Workspace"],
    ["engagement", "engagement", "Sales & CRM"],
    ["marketing", "Marketing", "Marketing & Insights"],
    ["settings", "Settings", "System"],
    // The app, when the label and the section both are the title
    ["people", "People", APP_NAME],
    ["catalog", "Catalog", APP_NAME],
    ["finance", "Finance", APP_NAME],
  ])("moduleEyebrowText(%s, %j) is %j", (key, title, expected) => {
    expect(moduleEyebrowText(key, title)).toBe(expected);
  });

  it("never repeats the title, for any module and any title equal to its label or section", () => {
    for (const key of MODULE_KEYS) {
      for (const title of [MODULES[key].label, MODULES[key].section, MODULES[key].label.toUpperCase()]) {
        const text = moduleEyebrowText(key, title);
        expect(text.trim().length, `${key} / ${title}`).toBeGreaterThan(0);
        expect(sameDisplayName(text, title), `${key} / "${title}" -> "${text}"`).toBe(false);
      }
    }
  });

  // The loading skeleton reserves one eyebrow line. 24 characters of 11px
  // uppercase type is about 210px, inside the title column's 280px minimum.
  it("is one short line (the skeleton reserves one eyebrow line)", () => {
    for (const key of MODULE_KEYS) {
      for (const text of [MODULES[key].label, MODULES[key].section, APP_NAME]) {
        expect(text, key).not.toMatch(/\n/);
        expect(text.length, `${key}: "${text}"`).toBeLessThanOrEqual(24);
      }
    }
  });

  describe("on the real pages", () => {
    const uses = pageHeaderUses();
    // The headers that show the default eyebrow: no `eyebrow`, a module, and a
    // literal title to compare with.
    const byDefault: { route: string; title: string; key: ModuleKey }[] = [];
    for (const use of uses) {
      if (use.hasEyebrow || use.module === false || use.title === null) continue;
      const key = isModuleKey(use.module) ? use.module : resolveModule(use.route);
      if (key) byDefault.push({ route: use.route, title: use.title, key });
    }

    it("finds the PageHeaders with a literal title and no eyebrow", () => {
      expect(uses.length).toBeGreaterThan(250);
      expect(byDefault.length).toBeGreaterThan(100);
    });

    it("finds the pages whose title is their module's label", () => {
      const repeats = byDefault.filter((u) => sameDisplayName(MODULES[u.key].label, u.title)).map((u) => u.route);
      // The cases that read "RESOURCES" over "Resources" before the fix.
      expect(repeats).toEqual(expect.arrayContaining(["/resources", "/people/payroll"]));
    });

    it("no default eyebrow repeats its page title", () => {
      const repeated = byDefault
        .map((u) => ({ route: u.route, title: u.title, eyebrow: moduleEyebrowText(u.key, u.title) }))
        .filter((u) => sameDisplayName(u.eyebrow, u.title));
      expect(repeated).toEqual([]);
    });
  });
});
