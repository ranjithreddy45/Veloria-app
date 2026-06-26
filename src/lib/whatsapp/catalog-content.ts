// ============================================================
// WhatsApp Catalog — pure content / config (IO-free)
// ============================================================
// Single source of truth shared by the catalog engine AND the admin
// config surface, so they can never drift. No DB, no fetch — keeps the
// engine deterministic + testable and keeps fidelity with QUOTE_CATALOG
// food tiers (src/lib/sales/quotation-calc.ts).
//
// Meta caps interactive *reply buttons* at 3. The event-type set is 5
// (Wedding / Corporate / Birthday / Reception / Other), so the engine sends
// an interactive LIST message. This file describes both shapes; the engine
// picks list-vs-buttons by count.

import { QUOTE_CATALOG, type FoodPackage } from "@/lib/sales/quotation-calc";

// ------------------------------------------------------------
// Canonical phone normalization (ONE form for the session index).
// The webhook tries 6 contact formats and sendWhatsApp() strips +, maps
// 0→91 and 10-digit→91. To make WhatsAppCatalogSession.phone dedupe match
// across inbound + outbound we persist exactly ONE canonical form here:
// digits only, India-defaulted (no leading +). Mirrors the integration's
// normalizePhone so the @@index([phone]) lookup is stable.
// ------------------------------------------------------------
export function canonicalCatalogPhone(raw: string): string {
  let cleaned = (raw || "").replace(/[\s\-()]+/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("0")) cleaned = "91" + cleaned.slice(1);
  if (cleaned.length === 10 && /^\d+$/.test(cleaned)) cleaned = "91" + cleaned;
  return cleaned;
}

// ------------------------------------------------------------
// Stage machine — string-valued (additive-safe, mirrors schema default).
// ------------------------------------------------------------
export const CATALOG_STAGES = {
  PROMPTED: "PROMPTED",
  EVENT_SELECTED: "EVENT_SELECTED",
  CARDS_SENT: "CARDS_SENT",
  CTA_CLICKED: "CTA_CLICKED",
  CLOSED: "CLOSED",
} as const;

export type CatalogStage = (typeof CATALOG_STAGES)[keyof typeof CATALOG_STAGES];

// Re-prompt suppression window. If a session was PROMPTED inside this window
// we skip re-sending (Meta redelivers webhooks; the prompt is a NEW side
// effect that needs its own idempotency on top of capture's contact reuse).
export const CATALOG_REPROMPT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

// ------------------------------------------------------------
// Event types — the quick-reply set. Each maps a stable buttonId →
// { label, foodTierIds (into QUOTE_CATALOG.food), brochureSlugHint,
//   eventTypeEnum }. buttonId is what comes back in
// interactive.button_reply.id / list_reply.id, so it must be stable.
// ------------------------------------------------------------
export interface CatalogEventType {
  buttonId: string;
  label: string;
  /** Ordered premium-first: anchor tier first. IDs into QUOTE_CATALOG.food. */
  foodTierIds: string[];
  /** Hint used to resolve a DigitalBrochure.slug (eventType-scoped variant). */
  brochureSlugHint: string;
  /** Free-text intent keywords for the LLM-less fallback classifier. */
  keywords: string[];
  /** Human event-type label persisted on the session + lead linkage. */
  eventTypeEnum: string;
}

// Premium-first anchoring per the spec: Diamond/Platinum anchor → Gold → Silver.
// Weddings/Receptions anchor on the luxury non-veg + diamond veg; corporate
// leans premium veg; birthdays start gold (value-led). All ids exist in
// QUOTE_CATALOG.food.
export const CATALOG_EVENT_TYPES: CatalogEventType[] = [
  {
    buttonId: "evt_wedding",
    label: "Wedding",
    foodTierIds: ["veg_diamond", "nonveg_luxury", "veg_platinum"],
    brochureSlugHint: "wedding",
    keywords: ["wedding", "shaadi", "marriage", "nikah", "vivah", "bride", "groom"],
    eventTypeEnum: "WEDDING",
  },
  {
    buttonId: "evt_corporate",
    label: "Corporate / Conference",
    foodTierIds: ["veg_platinum", "nonveg_premium", "veg_gold"],
    brochureSlugHint: "corporate",
    keywords: ["corporate", "conference", "office", "company", "seminar", "meet", "team"],
    eventTypeEnum: "CORPORATE",
  },
  {
    buttonId: "evt_birthday",
    label: "Birthday",
    foodTierIds: ["veg_gold", "nonveg_classic", "veg_silver"],
    brochureSlugHint: "birthday",
    keywords: ["birthday", "bday", "b'day", "kids party", "1st birthday", "cake"],
    eventTypeEnum: "BIRTHDAY",
  },
  {
    buttonId: "evt_reception",
    label: "Reception / Engagement",
    foodTierIds: ["nonveg_luxury", "veg_diamond", "veg_platinum"],
    brochureSlugHint: "reception",
    keywords: ["reception", "engagement", "ring", "sangeet", "anniversary"],
    eventTypeEnum: "RECEPTION",
  },
  {
    buttonId: "evt_other",
    label: "Something else",
    foodTierIds: ["veg_gold", "veg_platinum", "nonveg_premium"],
    brochureSlugHint: "general",
    keywords: ["other", "puja", "naming", "babyshower", "baby shower", "get together"],
    eventTypeEnum: "OTHER",
  },
];

export function findEventType(buttonId: string | null | undefined): CatalogEventType | null {
  if (!buttonId) return null;
  return CATALOG_EVENT_TYPES.find((e) => e.buttonId === buttonId) ?? null;
}

// Keyword-based event-type guess from free inbound text (LLM-less fallback;
// mirrors the keyword-fallback shape of src/lib/ai/sentiment.ts so the flow
// degrades gracefully when no AI key is configured).
export function guessEventTypeFromText(text: string | null | undefined): CatalogEventType | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  let best: { evt: CatalogEventType; hits: number } | null = null;
  for (const evt of CATALOG_EVENT_TYPES) {
    let hits = 0;
    for (const kw of evt.keywords) {
      if (lower.includes(kw)) hits += 1;
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { evt, hits };
  }
  return best?.evt ?? null;
}

// ------------------------------------------------------------
// Copy templates — outbound bodies. Plain strings; the engine fills slots.
// ------------------------------------------------------------
export const CATALOG_COPY = {
  promptHeader: "Welcome to Veloria",
  promptBody:
    "Thanks for reaching out! We'd love to host your event. To send you the right packages, what are you planning?",
  promptFooter: "Tap an option below",
  listButtonText: "Choose event type",
  listSectionTitle: "Event types",

  cardsIntro: (eventLabel: string) =>
    `Here are our most-loved ${eventLabel} packages. Per-plate prices are indicative — your final quote depends on guest count, menu and date.`,

  // CTA when a brochure slug resolves.
  ctaBrochure: (label: string, url: string) =>
    `View the full ${label} experience (photos, menus & more): ${url}`,

  // CTA when no brochure is available — degrade to a human-callback promise.
  ctaFallback:
    "Reply with your event date and guest count and a consultant will send you a tailored quote shortly.",

  closingNudge:
    "Want an exact quote? Just reply with your date and guest count and we'll get right on it.",
} as const;

// ------------------------------------------------------------
// Pricing-card rendering — READ-ONLY display from QUOTE_CATALOG. No Decimal
// math, no persisted quote (any binding quote must go through
// computeQuotation/createSalesQuotation). Per-plate INR only, rendered as
// an indicative teaser.
// ------------------------------------------------------------
const TIER_RANK: Record<string, string> = {
  veg_diamond: "Signature",
  nonveg_luxury: "Signature",
  veg_platinum: "Premium",
  nonveg_premium: "Premium",
  veg_gold: "Classic",
  nonveg_classic: "Classic",
  veg_silver: "Value",
};

export function formatInr(amount: number): string {
  // Indian grouping, no decimals for whole rupees (teaser display only).
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

export interface PackageCard {
  tierId: string;
  label: string;
  rank: string;
  perPlate: number;
  perPlateDisplay: string;
  veg: boolean;
}

function findFood(id: string): FoodPackage | undefined {
  return QUOTE_CATALOG.food.find((f) => f.id === id);
}

// Premium-first cards for an event type, sourced from QUOTE_CATALOG.food.
export function buildPackageCardsFor(evt: CatalogEventType): PackageCard[] {
  const cards: PackageCard[] = [];
  for (const tierId of evt.foodTierIds) {
    const food = findFood(tierId);
    if (!food) continue;
    cards.push({
      tierId: food.id,
      label: food.label,
      rank: TIER_RANK[food.id] ?? "Package",
      perPlate: food.perPlate,
      perPlateDisplay: `${formatInr(food.perPlate)} / plate`,
      veg: food.veg,
    });
  }
  return cards;
}

// Render the cards into a single WhatsApp text body (the inbound 24h window
// allows free-form text; we keep it one message to avoid rate spikes).
export function renderCardsBody(evt: CatalogEventType, cards: PackageCard[]): string {
  const lines: string[] = [CATALOG_COPY.cardsIntro(evt.label), ""];
  for (const c of cards) {
    const diet = c.veg ? "Pure Veg" : "Veg + Non-veg";
    lines.push(`*${c.rank} — ${c.label}*`);
    lines.push(`${c.perPlateDisplay} · ${diet}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}
