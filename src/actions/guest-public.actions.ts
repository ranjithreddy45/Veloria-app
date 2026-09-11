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

/**
 * Public gallery photos. Prefers the thumbnail: uploads are stored as base64
 * data URLs, so a full-size original can be megabytes — one oversized item
 * without a thumbnail is dropped rather than shipped to a phone.
 */
export async function getGuestPhotos(params?: { venueId?: string; limit?: number; tag?: string }): Promise<GuestPhoto[]> {
  try {
    const rows = await prisma.galleryItem.findMany({
      where: {
        isPublic: true,
        mediaType: "PHOTO",
        ...(params?.venueId ? { venueId: params.venueId } : {}),
        ...(params?.tag ? { tags: { has: params.tag } } : {}),
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: Math.min(params?.limit ?? 24, 60),
      select: { id: true, url: true, thumbnailUrl: true, title: true, tags: true, venueId: true },
    });
    return rows
      .map((r) => ({ id: r.id, url: r.thumbnailUrl || r.url, title: r.title, tags: r.tags, venueId: r.venueId }))
      .filter((r) => r.url.length < 400_000);
  } catch {
    return [];
  }
}

/** Distinct public tags, for the gallery filter chips. */
export async function getGuestPhotoTags(): Promise<string[]> {
  try {
    const rows = await prisma.galleryItem.findMany({ where: { isPublic: true }, select: { tags: true }, take: 500 });
    const counts = new Map<string, number>();
    for (const r of rows) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 8);
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
