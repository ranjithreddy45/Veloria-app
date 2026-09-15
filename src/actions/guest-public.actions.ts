"use server";

import { prisma } from "@/lib/prisma";

// ============================================================
// Guest app — PUBLIC reads (no session). Everything here is customer-safe by
// construction: only rows already marked public/approved/active, never
// internal pricing levers, never other customers' identities beyond a first
// name and initial. When there is nothing to show, these return empty — the
// screens render an honest empty state rather than fill the gap.
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

/**
 * Photos for the guest app, real ones only, in this order:
 *   1. GalleryItems marked public (optionally for one venue / tag)
 *   2. Property photos — PHOTO attachments on the acquisition deal of every
 *      property linked to a live venue. This is the same source the ERP's
 *      property page shows, so the halls carry the photos the team already has.
 * Returns [] when there is nothing; callers fall back to the default set.
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

export async function getGuestVenueSocial(venueId: string): Promise<GuestVenueSocial> {
  try {
    const where = { isPublic: true, isApproved: true, booking: { venueId } };
    const [agg, rows] = await Promise.all([
      prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          rating: true,
          content: true,
          contact: { select: { firstName: true, lastName: true } },
          booking: { select: { eventType: true, date: true } },
        },
      }),
    ]);
    return {
      rating: agg._count > 0 && agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null,
      count: agg._count,
      reviews: rows.map((r) => ({
        rating: r.rating,
        text: r.content,
        who: `${r.contact.firstName}${r.contact.lastName ? ` ${r.contact.lastName[0]}.` : ""}`,
        when: `${r.booking.eventType} · ${new Date(r.booking.date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`,
      })),
    };
  } catch {
    return { rating: null, count: 0, reviews: [] };
  }
}

/** Ratings for every venue at once (halls list). */
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
