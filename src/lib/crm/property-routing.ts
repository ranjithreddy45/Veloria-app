// ============================================================
// Property routing (Google Ads brief, Nov 2026)
// ------------------------------------------------------------
// Every new lead is resolved to a PROPERTY (hosa_road, electronic_city, hsr,
// indiranagar, bellandur, yelahanka, kr_puram, other) and assigned to that
// property's owner. The signals, strongest first:
//
//   1. an explicit property key — the website form's hidden field / dropdown;
//   2. the Google Ads campaign id — all nine campaigns share ONE lead form, so
//      the campaign is the only reliable signal on a Google lead;
//   3. free-text hints — a venue label from the landing page, a Meta ad-set
//      venue, a form's "location" answer — matched against matchTerms;
//   4. the lead's preferred venue, if it is (a hall of) a property's venue.
//
// Then the owner:
//   - property found, has an owner           -> that owner;
//   - corporate-only property (Bellandur) and the event is not corporate
//                                            -> shared queue, NOT_CORPORATE;
//   - property found but no usable owner     -> shared queue, NO_OWNER;
//   - no property                            -> shared queue, NO_PROPERTY.
// The shared queue is the owner of the "other" row.
//
// Routing is OFF until at least one property has an owner, so deploying this
// changes nothing until the table is filled in (Settings -> Property routing).
// When it is off, or the queue has no usable owner, the caller falls back to
// the existing chain (sales-team round robin -> assignment rules -> admin).
// This module only reads; it never throws to the caller.
// ============================================================

import { prisma } from "@/lib/prisma";
import { teamForEventType } from "@/lib/crm/sales-team";

export const PROPERTY_KEYS = [
  "hosa_road",
  "electronic_city",
  "hsr",
  "indiranagar",
  "bellandur",
  "yelahanka",
  "kr_puram",
  "other",
] as const;
export type PropertyKey = (typeof PROPERTY_KEYS)[number];
export const SHARED_QUEUE_KEY: PropertyKey = "other";

export type RoutingFlag = "NO_PROPERTY" | "NOT_CORPORATE" | "NO_OWNER";

export const ROUTING_FLAG_LABEL: Record<RoutingFlag, string> = {
  NO_PROPERTY: "No property — reassign",
  NOT_CORPORATE: "Not corporate — reassign",
  NO_OWNER: "Property has no owner — reassign",
};

export interface PropertyRoutingInput {
  /** Explicit property key or name (website form). */
  property?: string | null;
  /** Google Ads campaign id (digits). */
  campaignId?: string | null;
  /** Free text that may name the property: venue label, ad-set venue, location answer. */
  hints?: Array<string | null | undefined>;
  /** The lead's preferred venue, if already known. */
  venueId?: string | null;
  eventType?: string | null;
}

export interface PropertyRoutingResult {
  /** False when the routing table has no owners yet: caller keeps its old behaviour. */
  active: boolean;
  propertyKey: string | null;
  propertyName: string | null;
  /** Venue to fill into a blank preferred venue. */
  venueId: string | null;
  /** Who should own the lead (property owner or shared queue), validated. */
  ownerId: string | null;
  flag: RoutingFlag | null;
  via: "property" | "campaign" | "hint" | "venue" | null;
}

const ASSIGNABLE_ROLES = new Set([
  "SALES_EXEC",
  "SALES_HEAD",
  "EVENT_COORDINATOR",
  "ADMIN",
  "SUPER_ADMIN",
]);

type Row = {
  key: string;
  name: string;
  matchTerms: string[];
  corporateOnly: boolean;
  ownerId: string | null;
  venueId: string | null;
};

/** "KR Puram" / "kr-puram" / "K R Puram" -> "kr_puram" style key. */
export function normalisePropertyKey(raw: string | null | undefined): string | null {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return null;
  return s.replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || null;
}

/** Words of a text, lower-case, punctuation removed, single-spaced, padded for whole-word tests. */
function words(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/**
 * Best property for a piece of free text: the row whose longest match term
 * appears in it as whole words. "Veloria Grand KR Puram" -> kr_puram; "HSR
 * Layout" -> hsr. Ties go to the earlier row (table order).
 */
export function matchPropertyByText(text: string | null | undefined, rows: Row[]): Row | null {
  if (!text || !text.trim()) return null;
  const hay = words(text);
  let best: Row | null = null;
  let bestLen = 0;
  for (const r of rows) {
    if (r.key === SHARED_QUEUE_KEY) continue;
    const terms = [r.key.replace(/_/g, " "), ...r.matchTerms];
    for (const t of terms) {
      const needle = words(t);
      if (needle.trim().length < 3) continue; // never match on "a", "of" ...
      if (hay.includes(needle) && needle.length > bestLen) {
        best = r;
        bestLen = needle.length;
      }
    }
  }
  return best;
}

/** Campaign id from either a bare id or the old "gads-campaign-<id>" label. */
export function campaignIdFrom(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const m = String(v ?? "").match(/(\d{6,})/);
    if (m) return m[1];
  }
  return null;
}

async function isAssignableUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });
  return !!u && u.isActive && ASSIGNABLE_ROLES.has(String(u.role));
}

const OFF: PropertyRoutingResult = {
  active: false,
  propertyKey: null,
  propertyName: null,
  venueId: null,
  ownerId: null,
  flag: null,
  via: null,
};

export async function routeLeadToProperty(input: PropertyRoutingInput): Promise<PropertyRoutingResult> {
  try {
    const rows: Row[] = await prisma.leadProperty.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      select: { key: true, name: true, matchTerms: true, corporateOnly: true, ownerId: true, venueId: true },
    });
    if (rows.length === 0) return OFF;
    const active = rows.some((r) => !!r.ownerId);
    const byKey = new Map(rows.map((r) => [r.key, r]));

    let prop: Row | null = null;
    let via: PropertyRoutingResult["via"] = null;

    // 1. Explicit property (key or a name like "Veloria Grand Yelahanka").
    if (input.property) {
      prop = byKey.get(normalisePropertyKey(input.property) ?? "") ?? matchPropertyByText(input.property, rows);
      if (prop) via = "property";
    }

    // 2. Google Ads campaign id.
    if (!prop && input.campaignId) {
      const route = await prisma.leadCampaignRoute.findUnique({
        where: { campaignId: String(input.campaignId).trim() },
        select: { propertyKey: true, isActive: true },
      });
      if (route?.isActive && route.propertyKey) {
        prop = byKey.get(route.propertyKey) ?? null;
        if (prop) via = "campaign";
      }
    }

    // 3. Free-text hints (venue label, ad-set venue, location answer).
    if (!prop) {
      for (const h of input.hints ?? []) {
        prop = matchPropertyByText(h, rows);
        if (prop) {
          via = "hint";
          break;
        }
      }
    }

    // 4. Preferred venue (or the property that owns its parent venue).
    if (!prop && input.venueId) {
      prop = rows.find((r) => r.venueId === input.venueId) ?? null;
      if (!prop) {
        const v = await prisma.venue.findUnique({
          where: { id: input.venueId },
          select: { parentVenueId: true, name: true },
        });
        prop =
          (v?.parentVenueId ? rows.find((r) => r.venueId === v.parentVenueId) : null) ??
          matchPropertyByText(v?.name, rows);
      }
      if (prop) via = "venue";
    }

    const shared = byKey.get(SHARED_QUEUE_KEY) ?? null;
    const sharedOwner = (await isAssignableUser(shared?.ownerId ?? null)) ? shared!.ownerId : null;

    let ownerId: string | null = null;
    let flag: RoutingFlag | null = null;
    if (prop && prop.key !== SHARED_QUEUE_KEY) {
      if (prop.corporateOnly && teamForEventType(input.eventType) !== "CORPORATE") {
        ownerId = sharedOwner;
        flag = "NOT_CORPORATE";
      } else if (await isAssignableUser(prop.ownerId)) {
        ownerId = prop.ownerId;
      } else {
        ownerId = sharedOwner;
        flag = "NO_OWNER";
      }
    } else {
      ownerId = sharedOwner;
      flag = "NO_PROPERTY";
    }

    return {
      active,
      propertyKey: prop?.key ?? null,
      propertyName: prop?.name ?? null,
      venueId: prop?.venueId ?? null,
      ownerId,
      flag,
      via,
    };
  } catch (e) {
    console.error("[PropertyRouting] failed, falling back to the old chain:", e);
    return OFF;
  }
}
