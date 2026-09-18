// ============================================================
// Customer menu requests — PURE rules (no IO; safe in client components).
// ------------------------------------------------------------
// One module decides what a host may pick, how a request's status may move and
// what accepting it writes, so the guest app (guest-menu.actions.ts) and the
// team's review (menu-request-review.actions.ts) can never disagree.
//
// It leans on the team's sources of truth and copies none of them:
//   - dishes are MenuItem rows (the team's /menu catalog);
//   - the booking's package is the Food Plan on its quotation, looked up in
//     QUOTE_CATALOG and priced by computeQuotation (the quote builder's engine).
//     "Vegetarian package" is the one package rule the team's data carries, so
//     it is the one enforced for hosts (the team sees it as a warning);
//   - menu pricing is the team's booking-menu rule from the menu builder and
//     saveBookingMenu: per head = Σ (customPrice ?? pricePerHead) × quantity,
//     total = per head × guest count.
// ============================================================

import { computeQuotation, QUOTE_CATALOG } from "@/lib/sales/quotation-calc";
import { MENU_CATEGORIES } from "@/lib/constants";

// ------------------------------------------------------------ statuses

export const MENU_REQUEST_STATUSES = ["SUBMITTED", "ACCEPTED", "DECLINED", "WITHDRAWN"] as const;
export type MenuRequestStatus = (typeof MENU_REQUEST_STATUSES)[number];
export type MenuRequestAction = "ACCEPT" | "DECLINE" | "WITHDRAW";
export type MenuRequestActor = "TEAM" | "CUSTOMER";

const TRANSITIONS: Record<MenuRequestAction, { to: MenuRequestStatus; by: MenuRequestActor }> = {
  ACCEPT: { to: "ACCEPTED", by: "TEAM" },
  DECLINE: { to: "DECLINED", by: "TEAM" },
  WITHDRAW: { to: "WITHDRAWN", by: "CUSTOMER" },
};

const CLOSED_REASON: Record<Exclude<MenuRequestStatus, "SUBMITTED">, string> = {
  ACCEPTED: "This menu request has already been accepted.",
  DECLINED: "This menu request has already been declined.",
  WITHDRAWN: "This menu request was withdrawn.",
};

export function isMenuRequestStatus(value: unknown): value is MenuRequestStatus {
  return typeof value === "string" && (MENU_REQUEST_STATUSES as readonly string[]).includes(value);
}

/** Only a SUBMITTED request is open: it is the one the team still has to review. */
export function isOpenMenuRequest(status: string): boolean {
  return status === "SUBMITTED";
}

export type MenuRequestTransition =
  | { ok: true; from: "SUBMITTED"; to: MenuRequestStatus }
  | { ok: false; error: string };

/**
 * The whole state machine: SUBMITTED → ACCEPTED | DECLINED (the team) or
 * WITHDRAWN (the customer). Every other status is final.
 */
export function menuRequestTransition(current: string, action: MenuRequestAction, actor: MenuRequestActor): MenuRequestTransition {
  const t = TRANSITIONS[action];
  if (!t) return { ok: false, error: "Unknown action." };
  if (t.by !== actor) {
    return {
      ok: false,
      error: actor === "CUSTOMER" ? "Only the Veloria team can accept or decline a menu request." : "Only the customer can withdraw their menu request.",
    };
  }
  if (current === "SUBMITTED") return { ok: true, from: "SUBMITTED", to: t.to };
  if (isMenuRequestStatus(current)) return { ok: false, error: CLOSED_REASON[current as Exclude<MenuRequestStatus, "SUBMITTED">] };
  return { ok: false, error: "This menu request can no longer change." };
}

// ------------------------------------------------------------ shapes + limits

export const MENU_REQUEST_LIMITS = {
  maxItems: 60,
  maxQuantity: 10,
  maxItemNote: 200,
  maxNotes: 1000,
  maxReviewNote: 1000,
  /** Requests a booking may send in 24 hours (withdraw-and-resend included). */
  maxPerDay: 10,
} as const;

/** What the browser sends. */
export interface MenuRequestItem {
  menuItemId: string;
  quantity?: number;
  note?: string;
}

/** What MenuSelectionRequest.items stores. */
export interface StoredMenuRequestItem {
  menuItemId: string;
  quantity: number;
  note?: string;
}

export interface MenuCatalogEntry {
  id: string;
  name: string;
  category: string;
  cuisine: string | null;
  dietaryTags: string[];
  pricePerHead: number;
  isActive: boolean;
}

// ------------------------------------------------------------ package rules

export type QuotedFoodMode = "WITH_FOOD" | "HALL_ONLY";

export interface MenuPackageRules {
  /** QUOTE_CATALOG.food id of the booking's quoted food package. */
  packageId: string | null;
  packageLabel: string | null;
  /** One plate as the quote engine prices it (includes a negotiated override). */
  perPlate: number | null;
  vegOnly: boolean;
  /** How the quotation charges food; null when the booking has no quotation. */
  foodMode: QuotedFoodMode | null;
}

export const NO_PACKAGE_RULES: MenuPackageRules = { packageId: null, packageLabel: null, perPlate: null, vegOnly: false, foodMode: null };

/** Package rules from a quotation's stored QuotationInput (SalesQuotation.inputsJson). */
export function packageRulesFromQuotation(inputsJson: unknown): MenuPackageRules {
  if (!inputsJson || typeof inputsJson !== "object" || Array.isArray(inputsJson)) return NO_PACKAGE_RULES;
  const input = inputsJson as { foodMode?: unknown; foodPackageId?: unknown; foodPerPlateOverride?: unknown };
  if (input.foodMode === "HALL_ONLY") return { ...NO_PACKAGE_RULES, foodMode: "HALL_ONLY" };
  const food = typeof input.foodPackageId === "string" ? QUOTE_CATALOG.food.find((f) => f.id === input.foodPackageId) : undefined;
  if (!food) return { ...NO_PACKAGE_RULES, foodMode: "WITH_FOOD" };
  const o = input.foodPerPlateOverride;
  const override = typeof o === "number" && Number.isFinite(o) && o >= 0 ? o : null;
  const perPlate = computeQuotation({ guestCount: 1, foodPackageId: food.id, foodPerPlateOverride: override }).subtotal;
  return { packageId: food.id, packageLabel: food.label, perPlate, vegOnly: food.veg, foodMode: "WITH_FOOD" };
}

/** True for dishes the team tagged "Non-Vegetarian". */
export function isNonVegetarian(tags: readonly string[]): boolean {
  return tags.some((t) => t.trim().toLowerCase().replace(/[\s_]+/g, "-") === "non-vegetarian");
}

/** Whether the booking's package allows this dish (vegetarian packages exclude non-veg dishes). */
export function packageAllows(dish: Pick<MenuCatalogEntry, "dietaryTags">, rules: MenuPackageRules): boolean {
  return !(rules.vegOnly && isNonVegetarian(dish.dietaryTags));
}

// ------------------------------------------------------------ validation

export type MenuSelectionResult = { ok: true; items: StoredMenuRequestItem[] } | { ok: false; errors: string[] };

/**
 * Check a host's picks against the live catalog and the package rules, and
 * normalise them for storage (quantity defaults to 1, notes trimmed). Rejects
 * duplicates because a booking menu holds each dish once.
 */
export function validateMenuSelection(raw: unknown, catalog: ReadonlyMap<string, MenuCatalogEntry>, rules: MenuPackageRules): MenuSelectionResult {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, errors: ["Pick at least one dish."] };
  if (raw.length > MENU_REQUEST_LIMITS.maxItems) {
    return { ok: false, errors: [`A menu request can hold up to ${MENU_REQUEST_LIMITS.maxItems} dishes.`] };
  }
  const errors: string[] = [];
  const seen = new Set<string>();
  const items: StoredMenuRequestItem[] = [];
  for (const entry of raw) {
    const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const id = typeof e.menuItemId === "string" ? e.menuItemId.trim() : "";
    if (!id) {
      errors.push("One of the dishes couldn't be read. Please pick it again.");
      continue;
    }
    const dish = catalog.get(id);
    if (seen.has(id)) {
      errors.push(`"${dish?.name ?? "A dish"}" is in your selection more than once.`);
      continue;
    }
    seen.add(id);
    if (!dish) {
      errors.push("A dish you picked is no longer on the menu.");
      continue;
    }
    if (!dish.isActive) {
      errors.push(`"${dish.name}" is no longer on the menu.`);
      continue;
    }
    if (!packageAllows(dish, rules)) {
      errors.push(`"${dish.name}" isn't vegetarian, and ${rules.packageLabel ?? "your package"} is a vegetarian package.`);
      continue;
    }
    let quantity = 1;
    if (e.quantity !== undefined && e.quantity !== null) {
      const q = e.quantity;
      if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MENU_REQUEST_LIMITS.maxQuantity) {
        errors.push(`Quantity for "${dish.name}" must be a whole number from 1 to ${MENU_REQUEST_LIMITS.maxQuantity}.`);
        continue;
      }
      quantity = q;
    }
    let note: string | undefined;
    if (e.note !== undefined && e.note !== null) {
      if (typeof e.note !== "string") {
        errors.push(`The note for "${dish.name}" couldn't be read.`);
        continue;
      }
      const clean = e.note.trim();
      if (clean.length > MENU_REQUEST_LIMITS.maxItemNote) {
        errors.push(`Keep the note for "${dish.name}" under ${MENU_REQUEST_LIMITS.maxItemNote} characters.`);
        continue;
      }
      if (clean) note = clean;
    }
    items.push(note ? { menuItemId: id, quantity, note } : { menuItemId: id, quantity });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, items };
}

/** Overall notes: optional, trimmed, bounded. */
export function cleanMenuNotes(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Your notes couldn't be read." };
  const value = raw.trim();
  if (value.length > MENU_REQUEST_LIMITS.maxNotes) return { ok: false, error: `Keep your notes under ${MENU_REQUEST_LIMITS.maxNotes} characters.` };
  return { ok: true, value: value || null };
}

/** Read MenuSelectionRequest.items back defensively (it is JSON). */
export function parseStoredItems(json: unknown): StoredMenuRequestItem[] {
  if (!Array.isArray(json)) return [];
  const out: StoredMenuRequestItem[] = [];
  for (const raw of json) {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (typeof r.menuItemId !== "string" || !r.menuItemId) continue;
    const quantity = typeof r.quantity === "number" && Number.isInteger(r.quantity) && r.quantity >= 1 ? r.quantity : 1;
    const note = typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined;
    out.push(note ? { menuItemId: r.menuItemId, quantity, note } : { menuItemId: r.menuItemId, quantity });
  }
  return out;
}

// ------------------------------------------------------------ pricing (the team's booking-menu rule)

export interface MenuPricingLine {
  pricePerHead: number;
  quantity: number;
  customPrice?: number | null;
}

export interface MenuPricing {
  pricePerHead: number;
  guestCount: number;
  totalPrice: number;
}

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * The menu builder's figures: per head = Σ (customPrice ?? pricePerHead) × quantity,
 * total = per head × guest count, kept to the paise like BookingMenu's Decimal(12,2).
 */
export function computeMenuPricing(lines: readonly MenuPricingLine[], guestCount: number): MenuPricing {
  const perHead = money(lines.reduce((sum, l) => sum + (l.customPrice ?? l.pricePerHead) * l.quantity, 0));
  const guests = Number.isFinite(guestCount) ? Math.max(0, Math.floor(guestCount)) : 0;
  return { pricePerHead: perHead, guestCount: guests, totalPrice: money(perHead * guests) };
}

// ------------------------------------------------------------ the team's review

export interface MenuReviewItem {
  menuItemId: string;
  name: string;
  category: string;
  dietaryTags: string[];
  quantity: number;
  note: string | null;
  /** Today's list price; null when the dish no longer exists. */
  pricePerHead: number | null;
  /** Negotiated price already on the booking's menu for this dish, carried over on accept. */
  customPrice: number | null;
  available: boolean;
}

export interface MenuReviewComputation {
  items: MenuReviewItem[];
  /** Reasons the request can't be accepted as it stands. */
  blockers: string[];
  /** Package-rule notes the team may override. */
  warnings: string[];
  /** What accepting would write: today's list prices, the booking's guest count. */
  pricing: MenuPricing;
}

export function reviewMenuRequest(
  stored: readonly StoredMenuRequestItem[],
  catalog: ReadonlyMap<string, MenuCatalogEntry>,
  currentCustomPrices: ReadonlyMap<string, number>,
  rules: MenuPackageRules,
  guestCount: number
): MenuReviewComputation {
  const items: MenuReviewItem[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const lines: MenuPricingLine[] = [];
  const seen = new Set<string>();
  if (stored.length === 0) blockers.push("This request has no dishes.");
  for (const s of stored) {
    const dish = catalog.get(s.menuItemId);
    const name = dish?.name ?? "Removed dish";
    const available = !!dish && dish.isActive;
    const customPrice = currentCustomPrices.get(s.menuItemId) ?? null;
    if (seen.has(s.menuItemId)) blockers.push(`"${name}" appears more than once.`);
    seen.add(s.menuItemId);
    if (!dish) blockers.push("A dish in this request no longer exists in the menu catalog.");
    else if (!dish.isActive) blockers.push(`"${dish.name}" is inactive in the menu catalog.`);
    if (dish && !packageAllows(dish, rules)) {
      warnings.push(`"${dish.name}" is non-vegetarian, but the booking's quoted package (${rules.packageLabel ?? "food package"}) is vegetarian.`);
    }
    items.push({
      menuItemId: s.menuItemId,
      name,
      category: dish?.category ?? "Other",
      dietaryTags: dish?.dietaryTags ?? [],
      quantity: s.quantity,
      note: s.note ?? null,
      pricePerHead: dish ? dish.pricePerHead : null,
      customPrice,
      available,
    });
    if (dish && available) lines.push({ pricePerHead: dish.pricePerHead, quantity: s.quantity, customPrice });
  }
  return { items, blockers, warnings, pricing: computeMenuPricing(lines, guestCount) };
}

export interface MenuSelectionWrite {
  menuItemId: string;
  quantity: number;
  customPrice: number | null;
  order: number;
}

/** BookingMenuSelection rows for an accepted request, in the host's order (as the menu builder saves them). */
export function selectionsToWrite(stored: readonly StoredMenuRequestItem[], currentCustomPrices: ReadonlyMap<string, number>): MenuSelectionWrite[] {
  return stored.map((s, index) => ({
    menuItemId: s.menuItemId,
    quantity: s.quantity,
    customPrice: currentCustomPrices.get(s.menuItemId) ?? null,
    order: index,
  }));
}

export const CUSTOMER_NOTES_HEADING = "Customer's menu notes (from the Veloria app):";
/** saveBookingMenuSchema caps special instructions at 5000 characters. */
export const SPECIAL_INSTRUCTIONS_MAX = 5000;

/**
 * The booking menu's special instructions after an accept: the team's own text
 * stays, and the customer's notes replace any earlier customer block (so
 * accepting a second request doesn't stack stale notes).
 */
export function mergeSpecialInstructions(
  existing: string | null | undefined,
  notes: string | null | undefined,
  itemNotes: readonly { name: string; note: string }[]
): string | null {
  const base = (existing ?? "").split(CUSTOMER_NOTES_HEADING)[0].trim();
  const lines: string[] = [];
  if (notes?.trim()) lines.push(notes.trim());
  for (const n of itemNotes) if (n.note.trim()) lines.push(`• ${n.name}: ${n.note.trim()}`);
  if (lines.length === 0) return base || null;
  const block = [CUSTOMER_NOTES_HEADING, ...lines].join("\n");
  const joined = base ? `${base}\n\n${block}` : block;
  return joined.length > SPECIAL_INSTRUCTIONS_MAX ? `${joined.slice(0, SPECIAL_INSTRUCTIONS_MAX - 1)}…` : joined;
}

// ------------------------------------------------------------ small helpers

/**
 * Quotation statuses a host has actually been given (internal drafts, pending
 * approvals and rejected versions never set their package rules).
 */
export const CUSTOMER_VISIBLE_QUOTE_STATUSES = ["APPROVED", "SENT", "CONVERTED"] as const;

/** True when the event date (a @db.Date, stored at UTC midnight) is before today in India. */
export function eventDateHasPassed(eventDate: Date | string, now: Date = new Date()): boolean {
  const event = new Date(eventDate).toISOString().slice(0, 10);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return event < today;
}

/** The public visit scheduler, set to a menu tasting at the booking's hall. */
export function menuTastingHref(venueId: string | null | undefined): string {
  const p = new URLSearchParams({ kind: "MENU_TASTING" });
  if (venueId) p.set("venue", venueId);
  return `/visit?${p.toString()}`;
}

/** Menu categories in the team's order (MENU_CATEGORIES), unknown ones last. */
export function menuCategoryRank(category: string): number {
  const i = (MENU_CATEGORIES as readonly string[]).indexOf(category);
  return i === -1 ? MENU_CATEGORIES.length : i;
}

export function groupByMenuCategory<T extends { category: string; name: string }>(rows: readonly T[]): { category: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.category, [...(map.get(r.category) ?? []), r]);
  return [...map.entries()]
    .sort((a, b) => menuCategoryRank(a[0]) - menuCategoryRank(b[0]) || a[0].localeCompare(b[0]))
    .map(([category, list]) => ({ category, rows: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
}

// ------------------------------------------------------------ view shapes

export interface GuestMenuDish {
  id: string;
  name: string;
  description: string | null;
  category: string;
  cuisine: string | null;
  dietaryTags: string[];
  pricePerHead: number;
}

export interface GuestMenuRequestView {
  id: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  notes: string | null;
  items: { menuItemId: string; name: string; category: string; quantity: number; note: string | null }[];
}

/** The team's BookingMenu as the host sees it: dishes and covers, no internal instructions. */
export interface GuestBookingMenu {
  guestCount: number;
  updatedAt: string;
  selections: { menuItemId: string; name: string; category: string; quantity: number; dietaryTags: string[] }[];
}

export interface GuestMenuView {
  booking: { id: string; eventName: string; date: string; guestCount: number; venueId: string; venueName: string | null; status: string };
  preview: boolean;
  /** Set when this login is an invited collaborator: view-only, the menu on the booking and nothing else. */
  collaborator: "CO_HOST" | "VIEWER" | null;
  rules: MenuPackageRules;
  catalog: GuestMenuDish[];
  bookingMenu: GuestBookingMenu | null;
  /** Newest first. */
  requests: GuestMenuRequestView[];
  /** Why a new request can't be sent right now; null when it can. */
  blockedReason: string | null;
  tastingHref: string;
}

export interface MenuReviewRequestView extends MenuReviewComputation {
  id: string;
  status: string;
  createdAt: string;
  submittedBy: string | null;
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface MenuReviewData {
  bookingId: string;
  bookingNumber: string;
  guestCount: number;
  canReview: boolean;
  rules: MenuPackageRules;
  currentMenu: { selectionCount: number; pricePerHead: number; totalPrice: number; guestCount: number; updatedAt: string } | null;
  /** Open (SUBMITTED) requests first, then newest first. */
  requests: MenuReviewRequestView[];
}
