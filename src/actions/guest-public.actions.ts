"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicContact } from "@/lib/public/business-contact";
import type { YieldRuleInput } from "@/lib/pricing/yield-engine";
import { addDaysISO, FROM_PRICE_WINDOW_DAYS, hallFromPrice, istTodayISO, type HallDemandSignal } from "@/app/(guest)/app/venues/_lib/hall-pricing";
import { resolveHallAddress, safeHttpUrl, textOrNull, type ResolvedAddress } from "@/app/(guest)/app/venues/_lib/hall-info";
import { videoTarget, type VideoTarget } from "@/app/(guest)/app/venues/_lib/video";

// ============================================================
// Guest app — PUBLIC reads (no session). Everything here is customer-safe by
// construction: only rows already marked public/approved/active, never
// internal pricing levers (prices leave as final figures only), never other
// customers' identities beyond a first name and initial. When there is
// nothing to show, these return empty — the screens render an honest empty
// state rather than fill the gap.
// ============================================================

export interface GuestPhoto {
  id: string;
  url: string;
  title: string | null;
  tags: string[];
  venueId: string | null;
}

/** Make a stored url loadable by a phone: data URLs are served by the photo route, everything else passes through. */
function servable(url: string | null | undefined, kind: "g" | "p", id: string): string | null {
  if (!url) return null;
  if (url.startsWith("data:image/")) return `/api/guest/photo/${kind}/${id}`;
  if (/^https?:\/\//.test(url) || url.startsWith("/")) return url;
  return null;
}

/** Venue ids from a caller: strings only, de-duplicated, capped. undefined → null, meaning every active hall. */
function cleanIds(ids: unknown): string[] | null {
  if (ids === undefined) return null;
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64))].slice(0, 50);
}

/**
 * Photos for the guest app, real ones only, in this order:
 *   1. GalleryItems marked public (optionally for one venue / tag)
 *   2. Property photos — PHOTO attachments on the acquisition deal of every
 *      property linked to a live venue. This is the same source the ERP's
 *      property page shows, so the halls carry the photos the team already has.
 * Returns [] when there is nothing; callers fall back to labelled illustrations.
 */
export async function getGuestPhotos(params?: { venueId?: string; limit?: number; tag?: string }): Promise<GuestPhoto[]> {
  const limit = Math.min(params?.limit ?? 24, 80);
  try {
    const [gallery, props] = await Promise.all([
      prisma.galleryItem.findMany({
        where: {
          isPublic: true,
          mediaType: "PHOTO",
          ...(params?.venueId ? { venueId: params.venueId } : {}),
          ...(params?.tag ? { tags: { has: params.tag } } : {}),
        },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: limit,
        select: { id: true, url: true, thumbnailUrl: true, title: true, tags: true, venueId: true },
      }),
      prisma.acqProperty.findMany({
        where: { deletedAt: null, venueId: params?.venueId ? params.venueId : { not: null } },
        select: {
          venueId: true, propertyName: true,
          deal: { select: { attachments: { where: { kind: "PHOTO" }, orderBy: { createdAt: "asc" }, select: { id: true, url: true, label: true } } } },
        },
      }),
    ]);
    const venueIds = [...new Set(props.map((p) => p.venueId).filter((v): v is string => !!v))];
    const venues = venueIds.length ? await prisma.venue.findMany({ where: { id: { in: venueIds }, isActive: true }, select: { id: true, name: true } }) : [];
    const venueName = new Map(venues.map((v) => [v.id, v.name]));

    const out: GuestPhoto[] = [];
    for (const r of gallery) {
      const url = servable(r.thumbnailUrl || r.url, "g", r.id);
      if (url) out.push({ id: r.id, url, title: r.title, tags: r.tags, venueId: r.venueId });
    }
    for (const p of props) {
      if (!p.venueId || !venueName.has(p.venueId)) continue; // property not linked to a live hall
      const name = venueName.get(p.venueId)!;
      if (params?.tag && params.tag !== name) continue;
      for (const a of p.deal.attachments) {
        const url = servable(a.url, "p", a.id);
        if (url) out.push({ id: a.id, url, title: a.label || name, tags: [name], venueId: p.venueId });
      }
    }
    const seen = new Set<string>();
    return out.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true))).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * The first real photo of each hall, in getGuestPhotos' order (the hall's
 * public GalleryItems first, then its property photos), for hall cards and
 * heroes. Every hall's own photos are looked up, so a hall is never shown an
 * illustration just because other halls have many photos. Halls without a
 * real photo are absent from the result.
 */
export async function getGuestHallCovers(venueIds?: string[]): Promise<Record<string, string>> {
  try {
    const ids = cleanIds(venueIds);
    if (ids && ids.length === 0) return {};
    const venues = await prisma.venue.findMany({ where: { isActive: true, ...(ids ? { id: { in: ids } } : {}) }, select: { id: true } });
    const out: Record<string, string> = {};
    const gallery = await Promise.all(
      venues.map((v) =>
        prisma.galleryItem.findMany({
          where: { isPublic: true, mediaType: "PHOTO", venueId: v.id },
          orderBy: [{ order: "asc" }, { createdAt: "desc" }],
          take: 3,
          select: { id: true, url: true, thumbnailUrl: true },
        })
      )
    );
    venues.forEach((v, i) => {
      for (const g of gallery[i]) {
        const url = servable(g.thumbnailUrl || g.url, "g", g.id);
        if (url) {
          out[v.id] = url;
          break;
        }
      }
    });
    const missing = venues.map((v) => v.id).filter((id) => !out[id]);
    if (missing.length > 0) {
      const props = await prisma.acqProperty.findMany({
        where: { deletedAt: null, venueId: { in: missing } },
        select: { venueId: true, deal: { select: { attachments: { where: { kind: "PHOTO" }, orderBy: { createdAt: "asc" }, take: 3, select: { id: true, url: true } } } } },
      });
      for (const p of props) {
        if (!p.venueId || out[p.venueId]) continue;
        for (const a of p.deal.attachments) {
          const url = servable(a.url, "p", a.id);
          if (url) {
            out[p.venueId] = url;
            break;
          }
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Distinct public tags, for the gallery filter chips. */
export async function getGuestPhotoTags(): Promise<string[]> {
  try {
    const [rows, props] = await Promise.all([
      prisma.galleryItem.findMany({ where: { isPublic: true }, select: { tags: true }, take: 500 }),
      prisma.acqProperty.findMany({
        where: { deletedAt: null, venueId: { not: null }, deal: { attachments: { some: { kind: "PHOTO" } } } },
        select: { venueId: true },
      }),
    ]);
    const counts = new Map<string, number>();
    for (const r of rows) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    const ids = [...new Set(props.map((p) => p.venueId).filter((v): v is string => !!v))];
    const venues = ids.length ? await prisma.venue.findMany({ where: { id: { in: ids }, isActive: true }, select: { name: true } }) : [];
    const names = venues.map((v) => v.name);
    return [...names, ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)].filter((t, i, arr) => arr.indexOf(t) === i).slice(0, 10);
  } catch {
    return [];
  }
}

// ------------------------------------------------------------ hall prices

export interface GuestHallPrice {
  venueId: string;
  /** Lowest slot price the team's pricing engine gives this hall over the next twelve months; null = no usable price. */
  fromSlotPrice: number | null;
  /** Per-guest rate from the default rate plan the engine adds (0 = none). */
  perGuestRate: number;
}

/** Rule types that read a VenueDemandSignal's occupancy / demand score. */
const SIGNAL_RULE_TYPES = new Set(["OCCUPANCY", "DEMAND"]);

/**
 * "From" prices for halls, from the same engine and the same rows as the
 * team's price simulator (calculateYieldPrice): Venue.pricePerSlot, the hall's
 * active PricingRules, its VenueDemandSignals and the default RatePlan, run
 * through computeYieldPrice for every date and slot a customer can book. Only
 * the resulting figures are returned — never the rules or multipliers.
 */
export async function getGuestHallPrices(venueIds?: string[]): Promise<Record<string, GuestHallPrice>> {
  try {
    const ids = cleanIds(venueIds);
    if (ids && ids.length === 0) return {};
    const venues = await prisma.venue.findMany({
      where: { isActive: true, ...(ids ? { id: { in: ids } } : {}) },
      select: { id: true, name: true, pricePerSlot: true },
    });
    if (venues.length === 0) return {};
    const hallIds = venues.map((v) => v.id);
    const startISO = istTodayISO();
    const endISO = addDaysISO(startISO, FROM_PRICE_WINDOW_DAYS);

    const [rules, plans] = await Promise.all([
      prisma.pricingRule.findMany({
        where: { venueId: { in: hallIds }, isActive: true },
        orderBy: { priority: "asc" },
        select: { id: true, name: true, ruleType: true, multiplier: true, conditions: true, startDate: true, endDate: true, dayOfWeek: true, minDaysAhead: true, venueId: true },
      }),
      // The exact default-plan lookup calculateYieldPrice runs, hall by hall, so both always pick the same plan.
      Promise.all(
        venues.map((v) =>
          prisma.ratePlan.findFirst({
            where: { OR: [{ venueId: v.id, isDefault: true, isActive: true }, { venueId: null, isDefault: true, isActive: true }] },
            orderBy: { venueId: "desc" },
            select: { name: true, perGuestRate: true },
          })
        )
      ),
    ]);

    // A signal only changes a price through its manual override, or through an OCCUPANCY / DEMAND rule.
    const readsSignals = [...new Set(rules.filter((r) => SIGNAL_RULE_TYPES.has(r.ruleType)).map((r) => r.venueId))];
    const signals = await prisma.venueDemandSignal.findMany({
      where: {
        venueId: { in: hallIds },
        date: { gte: new Date(`${startISO}T00:00:00.000Z`), lt: new Date(`${endISO}T00:00:00.000Z`) },
        OR: [{ manualMultiplier: { not: null } }, ...(readsSignals.length > 0 ? [{ venueId: { in: readsSignals } }] : [])],
      },
      select: { venueId: true, date: true, timeSlot: true, occupancyPct: true, demandScore: true, manualMultiplier: true, source: true },
    });

    const rulesByHall = new Map<string, YieldRuleInput[]>();
    for (const r of rules) {
      const list = rulesByHall.get(r.venueId) ?? [];
      list.push({
        id: r.id,
        name: r.name,
        ruleType: r.ruleType,
        multiplier: Number(r.multiplier),
        conditions: r.conditions,
        startDate: r.startDate,
        endDate: r.endDate,
        dayOfWeek: r.dayOfWeek,
        minDaysAhead: r.minDaysAhead,
      });
      rulesByHall.set(r.venueId, list);
    }
    const signalsByHall = new Map<string, HallDemandSignal[]>();
    for (const s of signals) {
      const list = signalsByHall.get(s.venueId) ?? [];
      list.push({
        dateISO: s.date.toISOString().slice(0, 10),
        timeSlot: s.timeSlot,
        occupancyPct: Number(s.occupancyPct),
        demandScore: Number(s.demandScore),
        manualMultiplier: s.manualMultiplier !== null ? Number(s.manualMultiplier) : null,
        source: s.source,
      });
      signalsByHall.set(s.venueId, list);
    }

    const out: Record<string, GuestHallPrice> = {};
    venues.forEach((v, i) => {
      const plan = plans[i];
      const price = hallFromPrice(
        {
          venueId: v.id,
          venueName: v.name,
          basePrice: Number(v.pricePerSlot),
          rules: rulesByHall.get(v.id) ?? [],
          signals: signalsByHall.get(v.id) ?? [],
          ratePlan: plan ? { name: plan.name, perGuestRate: Number(plan.perGuestRate) } : null,
        },
        { startISO }
      );
      out[v.id] = { venueId: v.id, fromSlotPrice: price.fromSlotPrice, perGuestRate: price.perGuestRate };
    });
    return out;
  } catch {
    return {};
  }
}

// ------------------------------------------------------------ hall practical info

export interface GuestHallInfo {
  venueId: string;
  /** The hall's own address (source HALL), else the venue-wide address (source VENUE), else null. */
  address: ResolvedAddress | null;
  parkingInfo: string | null;
  directionsNote: string | null;
  /** YouTube/Vimeo embed, or a plain link for any other web address. */
  video: VideoTarget | null;
  virtualTourHref: string | null;
  /** Venue.inHouseCateringRequired — the flag the quote builder warns reps with. */
  inHouseCateringRequired: boolean;
  inHouseCateringNote: string | null;
}

type HallInfoRow = {
  id: string;
  publicAddress: string | null;
  mapUrl: string | null;
  parkingInfo: string | null;
  directionsNote: string | null;
  videoUrl: string | null;
  virtualTourUrl: string | null;
  inHouseCateringRequired: boolean;
  inHouseCateringNote: string | null;
};

/**
 * Practical information for halls, straight from the Venue record the team
 * edits (plus Settings → Business contact for the venue-wide address). URLs
 * are re-checked so only plain web links reach the page. Empty values stay
 * null so the screen hides the section.
 */
export async function getGuestHallInfo(venueIds: string[]): Promise<Record<string, GuestHallInfo>> {
  const ids = cleanIds(venueIds) ?? [];
  if (ids.length === 0) return {};
  let rows: HallInfoRow[];
  try {
    rows = await prisma.venue.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, publicAddress: true, mapUrl: true, parkingInfo: true, directionsNote: true, videoUrl: true, virtualTourUrl: true, inHouseCateringRequired: true, inHouseCateringNote: true },
    });
  } catch {
    // The practical-information columns may not be in this database yet — keep the catering facts.
    try {
      const legacy = await prisma.venue.findMany({
        where: { id: { in: ids }, isActive: true },
        select: { id: true, inHouseCateringRequired: true, inHouseCateringNote: true },
      });
      rows = legacy.map((v) => ({ ...v, publicAddress: null, mapUrl: null, parkingInfo: null, directionsNote: null, videoUrl: null, virtualTourUrl: null }));
    } catch {
      return {};
    }
  }
  const contact = await getPublicContact().catch(() => null);
  return Object.fromEntries(
    rows.map((v): [string, GuestHallInfo] => [
      v.id,
      {
        venueId: v.id,
        address: resolveHallAddress(v, contact),
        parkingInfo: textOrNull(v.parkingInfo),
        directionsNote: textOrNull(v.directionsNote),
        video: videoTarget(v.videoUrl),
        virtualTourHref: safeHttpUrl(v.virtualTourUrl),
        inHouseCateringRequired: v.inHouseCateringRequired,
        inHouseCateringNote: v.inHouseCateringRequired ? textOrNull(v.inHouseCateringNote) : null,
      },
    ])
  );
}

// ------------------------------------------------------------ reviews

export interface GuestReview {
  rating: number;
  text: string;
  who: string;
  when: string;
}
export interface GuestVenueSocial {
  /** null until there is at least one approved public review — never a placeholder. */
  rating: number | null;
  count: number;
  reviews: GuestReview[];
}

/** The reviews customers may see for a hall: approved by the team at /reviews AND left public by the reviewer. */
function publicReviewWhere(venueId: string): Prisma.ReviewWhereInput {
  return { isPublic: true, isApproved: true, booking: { venueId } };
}

function averageRating(avg: number | null, count: number): number | null {
  return count > 0 && avg != null ? Math.round(avg * 10) / 10 : null;
}

type ReviewRow = { rating: number; content: string; contact: { firstName: string; lastName: string | null }; booking: { eventType: string; date: Date } };

function shapeReview(r: ReviewRow): GuestReview {
  return {
    rating: r.rating,
    text: r.content,
    who: `${r.contact.firstName}${r.contact.lastName ? ` ${r.contact.lastName[0]}.` : ""}`,
    // Booking.date is a @db.Date (UTC midnight): format on the Indian calendar.
    when: `${r.booking.eventType} · ${r.booking.date.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`,
  };
}

const REVIEW_SELECT = {
  rating: true,
  content: true,
  contact: { select: { firstName: true, lastName: true } },
  booking: { select: { eventType: true, date: true } },
} as const;

export async function getGuestVenueSocial(venueId: string): Promise<GuestVenueSocial> {
  try {
    const where = publicReviewWhere(venueId);
    const [agg, rows] = await Promise.all([
      prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
      prisma.review.findMany({ where, orderBy: { createdAt: "desc" }, take: 6, select: REVIEW_SELECT }),
    ]);
    return { rating: averageRating(agg._avg.rating, agg._count), count: agg._count, reviews: rows.map(shapeReview) };
  } catch {
    return { rating: null, count: 0, reviews: [] };
  }
}

export interface GuestReviewItem extends GuestReview {
  id: string;
  title: string | null;
}
export interface GuestReviewPage {
  /** Average of the approved public reviews (one decimal); null when there are none. */
  rating: number | null;
  count: number;
  /** Real review counts per star rating, 5 → 1. */
  distribution: { stars: number; count: number }[];
  reviews: GuestReviewItem[];
  page: number;
  pageCount: number;
}

const REVIEWS_PAGE_SIZE = 20;
const STAR_VALUES = [5, 4, 3, 2, 1];

/** Every approved public review of a hall, newest first, a page at a time — the rows the team moderates at /reviews. */
export async function getGuestVenueReviews(venueId: string, page = 1): Promise<GuestReviewPage> {
  const empty: GuestReviewPage = { rating: null, count: 0, distribution: STAR_VALUES.map((stars) => ({ stars, count: 0 })), reviews: [], page: 1, pageCount: 1 };
  if (typeof venueId !== "string" || !venueId) return empty;
  try {
    const where = publicReviewWhere(venueId);
    const [agg, groups] = await Promise.all([
      prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
      prisma.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
    ]);
    const count = agg._count;
    if (count === 0) return empty;
    const pageCount = Math.max(1, Math.ceil(count / REVIEWS_PAGE_SIZE));
    const current = Math.min(Math.max(1, Math.floor(Number(page)) || 1), pageCount);
    const rows = await prisma.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (current - 1) * REVIEWS_PAGE_SIZE,
      take: REVIEWS_PAGE_SIZE,
      select: { id: true, title: true, ...REVIEW_SELECT },
    });
    return {
      rating: averageRating(agg._avg.rating, count),
      count,
      distribution: STAR_VALUES.map((stars) => ({ stars, count: groups.find((g) => g.rating === stars)?._count._all ?? 0 })),
      reviews: rows.map((r) => ({ ...shapeReview(r), id: r.id, title: textOrNull(r.title) })),
      page: current,
      pageCount,
    };
  } catch {
    return empty;
  }
}

/** Ratings for every venue at once (halls list, compare). */
export async function getGuestVenueRatings(): Promise<Record<string, { rating: number; count: number }>> {
  try {
    const rows = await prisma.review.findMany({
      where: { isPublic: true, isApproved: true },
      select: { rating: true, booking: { select: { venueId: true } } },
    });
    const acc: Record<string, { sum: number; n: number }> = {};
    for (const r of rows) {
      const k = r.booking.venueId;
      acc[k] = { sum: (acc[k]?.sum ?? 0) + r.rating, n: (acc[k]?.n ?? 0) + 1 };
    }
    return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, { rating: Math.round((v.sum / v.n) * 10) / 10, count: v.n }]));
  } catch {
    return {};
  }
}

/** Which venue has genuinely hosted the most events — drives the single "Most booked" badge. */
export async function getGuestMostBookedVenueId(): Promise<string | null> {
  try {
    const rows = await prisma.booking.groupBy({
      by: ["venueId"],
      where: { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
      _count: true,
      orderBy: { _count: { venueId: "desc" } },
      take: 1,
    });
    return rows[0]?.venueId ?? null;
  } catch {
    return null;
  }
}

export interface GuestPeakDate {
  dateISO: string;
  label: string;
  type: string;
}

/**
 * Active peak/auspicious dates in a window — labels only. The premium
 * percentage is a pricing lever and stays internal.
 * PeakDate.date is a @db.Date (UTC midnight), so the window is built in UTC.
 */
export async function getGuestPeakDates(fromISO: string, toISO: string, venueId?: string): Promise<GuestPeakDate[]> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromISO) || !/^\d{4}-\d{2}-\d{2}$/.test(toISO)) return [];
    const rows = await prisma.peakDate.findMany({
      where: {
        isActive: true,
        date: { gte: new Date(`${fromISO}T00:00:00Z`), lte: new Date(`${toISO}T23:59:59Z`) },
        OR: [{ venueId: null }, ...(venueId ? [{ venueId }] : [])],
      },
      select: { date: true, label: true, type: true },
      orderBy: { date: "asc" },
    });
    return rows.map((r) => ({ dateISO: r.date.toISOString().slice(0, 10), label: r.label, type: r.type }));
  } catch {
    return [];
  }
}
