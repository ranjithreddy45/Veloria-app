// ============================================================
// Module registry: the single source of a module's identity.
// ------------------------------------------------------------
// Every page under src/app/(dashboard) belongs to exactly one module (except
// /dashboard, the hub). A module has one glyph and one hue, and that pair is
// what the page-header chip shows on the module's landing, its record pages
// and tabs, its forms, and on any action pill that links into it. Pages never
// pick a chip icon or colour by hand.
//
// How a route finds its module: resolveModule() matches the path against every
// module's `prefixes` on segment boundaries, and the longest prefix wins. So
// /people/payroll/fnf is people-payroll, not people, and /menu is never /me.
//
// The rules (pinned by modules.test.ts):
// - glyph = the module's sidebar icon in src/config/navigation.ts (the nav
//   item, parent or leaf, whose href is `navHref`). Fix a glyph in the nav and
//   the chip follows.
// - The dashboard's approved hues are anchors and never move: leads emerald,
//   quotations indigo, payments cyan, site-visits amber, availability pink.
// - Within each neighbourhood (Sales, Ops, Finance, People) no two modules
//   share a hue, and across the whole app no two modules share glyph AND hue.
// - Never brand (reserved for the primary action), never rose or red (semantic
//   states only), never Sparkles (the AI assistant's mark).
// - External portals (/portal, /vendor-portal) have no module and no chip.
//
// Grouping: one module per sidebar product area. Where the sidebar files a
// differently-named top-level segment under a group (Hall Owners under BD CRM,
// WhatsApp under Engagement, Win-back/Referrals under Marketing), that segment
// shares the group's module. A nested URL belongs to its URL parent's module
// (all of /finance/* is Finance, all of /settings/* is Settings), except where a
// module claims a longer prefix (people-attendance, people-leave,
// people-payroll).
// ============================================================

import {
  Activity,
  Banknote,
  BarChart3,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  Clock,
  Contact,
  CreditCard,
  FileSignature,
  FileText,
  FolderOpen,
  Gauge,
  Gift,
  Image as ImageIcon,
  Inbox,
  IndianRupee,
  Kanban,
  Megaphone,
  MessagesSquare,
  Network,
  Package,
  Scale,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  UserCog,
  UserPlus,
  Users,
  UtensilsCrossed,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Hue } from "@/lib/ui/hues";

/** Hues a module may wear. brand, rose and red are never a module identity. */
export type ModuleHue = Exclude<Hue, "brand" | "rose" | "red">;

export interface ModuleDef {
  /** Display name, sentence case, agreeing with the sidebar title. */
  label: string;
  /** Route prefixes this module owns. Matched on segment boundaries. */
  prefixes: readonly string[];
  /** The module's sidebar glyph. */
  icon: LucideIcon;
  hue: ModuleHue;
  /** The sidebar href whose nav icon this module's glyph must equal. */
  navHref?: string;
}

const MODULE_DEFS = {
  // ---- Hub ---------------------------------------------------
  "my-work": { label: "My work", prefixes: ["/my-work"], icon: ClipboardList, hue: "indigo", navHref: "/my-work" },
  chat: { label: "Team chat", prefixes: ["/chat"], icon: MessagesSquare, hue: "blue", navHref: "/chat" },
  playbook: { label: "Playbook", prefixes: ["/playbook"], icon: Workflow, hue: "teal", navHref: "/playbook" },
  // Not in the sidebar; reached from the header bell.
  notifications: { label: "Notifications", prefixes: ["/notifications"], icon: Bell, hue: "slate" },

  // ---- Sales & CRM -------------------------------------------
  bd: { label: "BD CRM", prefixes: ["/bd", "/owners"], icon: Building2, hue: "cyan", navHref: "/bd/dashboard" },
  sales: { label: "Sales analytics", prefixes: ["/sales"], icon: BarChart3, hue: "gold", navHref: "/sales/reports" },
  calendar: { label: "My calendar", prefixes: ["/calendar"], icon: Calendar, hue: "indigo", navHref: "/calendar" },
  contacts: { label: "Enquiry", prefixes: ["/contacts"], icon: Users, hue: "slate", navHref: "/contacts" },
  leads: { label: "Leads", prefixes: ["/leads"], icon: UserPlus, hue: "emerald", navHref: "/leads" },
  inquiries: { label: "Web inquiries", prefixes: ["/inquiries"], icon: Inbox, hue: "cyan", navHref: "/inquiries" },
  pipeline: { label: "Pipeline", prefixes: ["/pipeline"], icon: Kanban, hue: "teal", navHref: "/pipeline" },
  quotations: { label: "Quotations", prefixes: ["/quotations"], icon: Calculator, hue: "indigo", navHref: "/quotations" },
  contracts: { label: "Contracts", prefixes: ["/contracts"], icon: FileSignature, hue: "amber", navHref: "/contracts" },
  approvals: { label: "Approvals", prefixes: ["/approvals"], icon: ShieldCheck, hue: "slate", navHref: "/approvals" },
  engagement: { label: "Engagement", prefixes: ["/crm", "/whatsapp"], icon: Activity, hue: "emerald", navHref: "/crm/cadences" },
  // Owns every /bookings/* page: the calendar, blackouts, new, and every tab of
  // a single booking (/bookings/[id]/menu, /operations, ...), so a record never
  // repaints its chip per tab.
  bookings: { label: "Bookings", prefixes: ["/bookings"], icon: CalendarCheck, hue: "blue", navHref: "/bookings" },
  availability: { label: "Slot availability", prefixes: ["/availability"], icon: CalendarClock, hue: "pink", navHref: "/availability" },
  "site-visits": { label: "Site visits", prefixes: ["/site-visits"], icon: CalendarCheck, hue: "amber", navHref: "/site-visits" },
  "guest-draw": { label: "Guest draw", prefixes: ["/admin/draw"], icon: Gift, hue: "gold", navHref: "/admin/draw" },
  concierge: { label: "Customer concierge", prefixes: ["/concierge"], icon: MessagesSquare, hue: "teal", navHref: "/concierge" },

  // ---- Delivery & Ops ----------------------------------------
  projects: { label: "Projects", prefixes: ["/projects"], icon: Building2, hue: "amber", navHref: "/projects" },
  tasks: { label: "Tasks", prefixes: ["/tasks"], icon: CheckSquare, hue: "indigo", navHref: "/tasks" },
  vendors: { label: "Vendors", prefixes: ["/vendors"], icon: Store, hue: "teal", navHref: "/vendors" },
  resources: { label: "Resources", prefixes: ["/resources"], icon: Boxes, hue: "gold", navHref: "/resources" },
  staff: { label: "Staff", prefixes: ["/staff"], icon: UserCog, hue: "cyan", navHref: "/staff" },
  beo: { label: "Function sheets (BEO)", prefixes: ["/beo"], icon: ClipboardList, hue: "emerald", navHref: "/beo" },
  kitchen: { label: "Kitchen & F&B", prefixes: ["/kitchen"], icon: UtensilsCrossed, hue: "pink", navHref: "/kitchen" },
  procurement: { label: "Procurement", prefixes: ["/procurement"], icon: Package, hue: "cyan", navHref: "/procurement" },
  logistics: { label: "Logistics & dispatch", prefixes: ["/logistics"], icon: Truck, hue: "slate", navHref: "/logistics" },
  support: { label: "Support", prefixes: ["/support"], icon: Inbox, hue: "blue", navHref: "/support" },

  // ---- People ------------------------------------------------
  recruitment: { label: "Recruitment", prefixes: ["/recruitment"], icon: Briefcase, hue: "teal", navHref: "/recruitment" },
  // Employee self-service. Lives under /me because /people/* is hr:read-gated.
  me: { label: "My HR", prefixes: ["/me"], icon: Contact, hue: "indigo", navHref: "/me/attendance" },
  people: { label: "People", prefixes: ["/people"], icon: Users, hue: "gold", navHref: "/people" },
  "people-attendance": {
    label: "Time & attendance",
    prefixes: ["/people/attendance", "/people/shifts", "/people/timesheets"],
    icon: Clock,
    hue: "blue",
    navHref: "/people/attendance",
  },
  "people-leave": { label: "Leave", prefixes: ["/people/leave"], icon: CalendarCheck, hue: "cyan", navHref: "/people/leave" },
  "people-payroll": {
    label: "Payroll",
    prefixes: ["/people/payroll", "/people/gratuity"],
    icon: IndianRupee,
    hue: "emerald",
    navHref: "/people/payroll",
  },

  // ---- Catalog -----------------------------------------------
  catalog: {
    label: "Catalog",
    prefixes: ["/packages", "/menu", "/pricing", "/inventory", "/rentals"],
    icon: Package,
    hue: "pink",
    navHref: "/packages",
  },

  // ---- Finance -----------------------------------------------
  // All of /finance/* (ledger, command centre, cash flow, reports, finance
  // payroll and assets) is Finance, so a sub-page always matches its parent.
  finance: { label: "Finance", prefixes: ["/finance"], icon: Scale, hue: "emerald", navHref: "/finance" },
  invoices: { label: "Invoices", prefixes: ["/invoices"], icon: FileText, hue: "gold", navHref: "/invoices" },
  payments: { label: "Payments", prefixes: ["/payments"], icon: CreditCard, hue: "cyan", navHref: "/payments" },
  payouts: {
    label: "Payables & assets",
    prefixes: ["/payouts", "/commissions", "/insurance"],
    icon: Banknote,
    hue: "teal",
    navHref: "/payouts",
  },

  // ---- Marketing & insights ----------------------------------
  marketing: {
    label: "Marketing",
    prefixes: ["/campaigns", "/marketing", "/accounts", "/loyalty", "/referrals"],
    icon: Megaphone,
    hue: "amber",
    navHref: "/campaigns",
  },
  analytics: {
    label: "Analytics",
    prefixes: ["/reports", "/analytics", "/quality", "/competitors", "/surveys", "/reviews", "/feedback"],
    icon: BarChart3,
    hue: "indigo",
    navHref: "/reports",
  },
  performance: { label: "Performance", prefixes: ["/performance"], icon: Gauge, hue: "gold", navHref: "/performance" },

  // ---- Workspace & system ------------------------------------
  documents: { label: "Documents", prefixes: ["/documents"], icon: FolderOpen, hue: "amber", navHref: "/documents" },
  gallery: { label: "Gallery", prefixes: ["/gallery"], icon: ImageIcon, hue: "pink", navHref: "/gallery" },
  franchise: { label: "Franchise", prefixes: ["/franchise"], icon: Network, hue: "cyan", navHref: "/franchise" },
  settings: { label: "Settings", prefixes: ["/settings"], icon: Settings, hue: "slate", navHref: "/settings" },
} satisfies Record<string, ModuleDef>;

export type ModuleKey = keyof typeof MODULE_DEFS;

export const MODULES: Readonly<Record<ModuleKey, ModuleDef>> = MODULE_DEFS;

export const MODULE_KEYS = Object.keys(MODULE_DEFS) as ModuleKey[];

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MODULE_DEFS, value);
}

/** Routes that never show a module chip: the hub and the external portals. */
const NO_MODULE_PREFIXES = ["/dashboard", "/portal", "/vendor-portal"] as const;

// Every (prefix, module) pair, longest prefix first, so the first match wins.
const PREFIX_INDEX: ReadonlyArray<{ prefix: string; key: ModuleKey }> = MODULE_KEYS.flatMap((key) =>
  MODULES[key].prefixes.map((prefix) => ({ prefix, key }))
).sort((a, b) => b.prefix.length - a.prefix.length);

function onSegment(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

function toPath(pathOrHref: string): string | null {
  let value = pathOrHref.trim();
  if (!value) return null;
  if (!value.startsWith("/")) {
    // An absolute URL: keep only its path.
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }
  // Drop ?query and #hash, then any trailing slash.
  value = value.split("?")[0].split("#")[0];
  if (value.length > 1) value = value.replace(/\/+$/, "");
  return value || "/";
}

/**
 * The module a route or link belongs to, or null when it has none (the
 * /dashboard hub, the external portals, or an unknown path).
 *
 * Accepts a pathname (`usePathname()`), an href with ?query/#hash, an absolute
 * URL, or a ModuleKey (returned as-is, so `resolveModule(module ?? href)` works).
 */
export function resolveModule(pathOrHref: string | null | undefined): ModuleKey | null {
  if (!pathOrHref) return null;
  if (isModuleKey(pathOrHref)) return pathOrHref;
  const path = toPath(pathOrHref);
  if (!path) return null;
  if (NO_MODULE_PREFIXES.some((prefix) => onSegment(path, prefix))) return null;
  for (const { prefix, key } of PREFIX_INDEX) {
    if (onSegment(path, prefix)) return key;
  }
  return null;
}
