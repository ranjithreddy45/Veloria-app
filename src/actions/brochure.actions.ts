"use server";

// ============================================================
// Digital brochure — INTERNAL gated CRUD + publish over DigitalBrochure.
// ------------------------------------------------------------
// Reads gated by marketing:read, writes by marketing:manage. Curated proof ids
// (galleryItemIds / reviewIds) are validated to exist + pass moderation before
// save; embed URLs are host-allowlisted. All mutations are audit-logged.
// Money is accepted as a Decimal-safe string and stored as Prisma.Decimal.
// ============================================================

import { auth } from "@/../auth";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { isAllowedEmbedUrl, slugify, SLUG_REGEX } from "@/lib/marketing/brochure-embed";
import {
  brochureCreateSchema,
  brochureUpdateSchema,
  type BrochureCreateInput,
  type BrochureUpdateInput,
} from "@/schemas/brochure.schema";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export interface BrochureListRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  venueId: string | null;
  venueName: string | null;
  eventType: string | null;
  isPublished: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  startingFromAmount: number | null;
  currency: string;
  publicUrl: string;
  updatedAt: string;
}

export interface BrochureDetail {
  id: string;
  slug: string;
  venueId: string | null;
  eventType: string | null;
  title: string;
  subtitle: string | null;
  seoDescription: string | null;
  heroImageUrl: string | null;
  videoEmbedUrl: string | null;
  tour360Url: string | null;
  galleryItemIds: string[];
  reviewIds: string[];
  startingFromAmount: number | null;
  currency: string;
  enabledCtas: string[];
  whatsappNumber: string | null;
  isPublished: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  publicUrl: string;
  updatedAt: string;
}

export interface BrochurePickerGalleryItem {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
  mediaType: string;
}
export interface BrochurePickerReview {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  authorFirstName: string;
}
export interface BrochureEditorOptions {
  venues: Array<{ id: string; name: string }>;
  galleryItems: BrochurePickerGalleryItem[];
  reviews: BrochurePickerReview[];
}

// ------------------------------------------------------------
// Auth helpers
// ------------------------------------------------------------
async function gate(perm: "marketing:read" | "marketing:manage"): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized." };
  if (!hasPermission(session.user.role as string, perm)) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  return { ok: true, userId: session.user.id };
}

function publicUrl(slug: string): string {
  return `${APP_URL}/v/${slug}`;
}

// ------------------------------------------------------------
// Reads
// ------------------------------------------------------------

export async function getBrochures(): Promise<Result<BrochureListRow[]>> {
  const g = await gate("marketing:read");
  if (!g.ok) return { success: false, error: g.error };
  try {
    const rows = await prisma.digitalBrochure.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        venueId: true,
        eventType: true,
        isPublished: true,
        viewCount: true,
        lastViewedAt: true,
        startingFromAmount: true,
        currency: true,
        updatedAt: true,
      },
    });

    const venueIds = [...new Set(rows.map((r) => r.venueId).filter((v): v is string => !!v))];
    const venues = venueIds.length
      ? await prisma.venue.findMany({
          where: { id: { in: venueIds } },
          select: { id: true, name: true },
        })
      : [];
    const venueName = new Map(venues.map((v) => [v.id, v.name]));

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        venueId: r.venueId,
        venueName: r.venueId ? venueName.get(r.venueId) ?? null : null,
        eventType: r.eventType,
        isPublished: r.isPublished,
        viewCount: r.viewCount,
        lastViewedAt: r.lastViewedAt ? r.lastViewedAt.toISOString() : null,
        startingFromAmount: r.startingFromAmount != null ? Number(r.startingFromAmount) : null,
        currency: r.currency,
        publicUrl: publicUrl(r.slug),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("[GET_BROCHURES_ERROR]", error);
    return { success: false, error: "Failed to load brochures." };
  }
}

export async function getBrochure(id: string): Promise<Result<BrochureDetail>> {
  const g = await gate("marketing:read");
  if (!g.ok) return { success: false, error: g.error };
  try {
    const b = await prisma.digitalBrochure.findUnique({ where: { id } });
    if (!b) return { success: false, error: "Brochure not found." };
    return {
      success: true,
      data: {
        id: b.id,
        slug: b.slug,
        venueId: b.venueId,
        eventType: b.eventType,
        title: b.title,
        subtitle: b.subtitle,
        seoDescription: b.seoDescription,
        heroImageUrl: b.heroImageUrl,
        videoEmbedUrl: b.videoEmbedUrl,
        tour360Url: b.tour360Url,
        galleryItemIds: b.galleryItemIds,
        reviewIds: b.reviewIds,
        startingFromAmount: b.startingFromAmount != null ? Number(b.startingFromAmount) : null,
        currency: b.currency,
        enabledCtas: b.enabledCtas as string[],
        whatsappNumber: b.whatsappNumber,
        isPublished: b.isPublished,
        viewCount: b.viewCount,
        lastViewedAt: b.lastViewedAt ? b.lastViewedAt.toISOString() : null,
        publicUrl: publicUrl(b.slug),
        updatedAt: b.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("[GET_BROCHURE_ERROR]", error);
    return { success: false, error: "Failed to load brochure." };
  }
}

/**
 * Editor option lists: active venues + public gallery items + approved/public
 * reviews (with first-name-only authors) for the curate pickers.
 */
export async function getBrochureEditorOptions(
  venueId?: string | null
): Promise<Result<BrochureEditorOptions>> {
  const g = await gate("marketing:read");
  if (!g.ok) return { success: false, error: g.error };
  try {
    const [venues, galleryItems, reviews] = await Promise.all([
      prisma.venue.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.galleryItem.findMany({
        where: { isPublic: true, ...(venueId ? { venueId } : {}) },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        take: 200,
        select: { id: true, url: true, thumbnailUrl: true, title: true, mediaType: true },
      }),
      prisma.review.findMany({
        where: { isApproved: true, isPublic: true },
        orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          contact: { select: { firstName: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        venues,
        galleryItems,
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          content: r.content,
          authorFirstName: (r.contact?.firstName ?? "Guest").trim().split(/\s+/)[0] || "Guest",
        })),
      },
    };
  } catch (error) {
    console.error("[GET_BROCHURE_EDITOR_OPTIONS_ERROR]", error);
    return { success: false, error: "Failed to load editor options." };
  }
}

// ------------------------------------------------------------
// Shared validation: curated ids must exist + pass moderation; embed hosts.
// ------------------------------------------------------------
async function validateCuration(
  galleryItemIds: string[],
  reviewIds: string[]
): Promise<string | null> {
  if (galleryItemIds.length) {
    const found = await prisma.galleryItem.count({
      where: { id: { in: galleryItemIds }, isPublic: true },
    });
    if (found !== new Set(galleryItemIds).size) {
      return "One or more selected photos are not public or no longer exist.";
    }
  }
  if (reviewIds.length) {
    const found = await prisma.review.count({
      where: { id: { in: reviewIds }, isApproved: true, isPublic: true },
    });
    if (found !== new Set(reviewIds).size) {
      return "One or more selected reviews are not approved or no longer exist.";
    }
  }
  return null;
}

function cleanEmbed(v: string | null | undefined): string | null {
  const trimmed = (v ?? "").trim();
  if (!trimmed) return null;
  return isAllowedEmbedUrl(trimmed) ? trimmed : null;
}

function decimalOrNull(v: string | null | undefined): Prisma.Decimal | null {
  const trimmed = (v ?? "").trim();
  if (!trimmed) return null;
  return new Prisma.Decimal(trimmed);
}

// ------------------------------------------------------------
// Create — auto-slugify with P2002 uniqueness retry.
// ------------------------------------------------------------
export async function createBrochure(
  input: BrochureCreateInput
): Promise<Result<{ id: string; slug: string }>> {
  const g = await gate("marketing:manage");
  if (!g.ok) return { success: false, error: g.error };

  const parsed = brochureCreateSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, error: first || "Please check the form and try again." };
  }
  const d = parsed.data;

  const curationError = await validateCuration(d.galleryItemIds, d.reviewIds);
  if (curationError) return { success: false, error: curationError };

  // Validate venue (if pinned) exists.
  if (d.venueId) {
    const venue = await prisma.venue.findUnique({ where: { id: d.venueId }, select: { id: true } });
    if (!venue) return { success: false, error: "Selected venue not found." };
  }

  // Determine the base slug (explicit or slugified from title).
  let base = (d.slug && d.slug.trim()) || slugify(d.title);
  if (!base || !SLUG_REGEX.test(base)) base = slugify(d.title) || "brochure";

  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      try {
        const created = await prisma.digitalBrochure.create({
          data: {
            slug: candidate,
            venueId: d.venueId ?? null,
            eventType: d.eventType ?? null,
            title: d.title,
            subtitle: d.subtitle ?? null,
            seoDescription: d.seoDescription ?? null,
            heroImageUrl: (d.heroImageUrl ?? "").trim() || null,
            videoEmbedUrl: cleanEmbed(d.videoEmbedUrl),
            tour360Url: cleanEmbed(d.tour360Url),
            galleryItemIds: d.galleryItemIds,
            reviewIds: d.reviewIds,
            startingFromAmount: decimalOrNull(d.startingFromAmount),
            currency: d.currency || "INR",
            enabledCtas: d.enabledCtas,
            whatsappNumber: (d.whatsappNumber ?? "").trim() || null,
            createdById: g.userId,
            isPublished: false,
          },
          select: { id: true, slug: true },
        });

        await logActivity({
          userId: g.userId,
          action: "created",
          entityType: "DigitalBrochure",
          entityId: created.id,
          changes: { slug: created.slug, title: d.title },
        });

        revalidatePath("/marketing/brochures");
        return { success: true, data: created };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          continue; // slug collision — try next suffix
        }
        throw e;
      }
    }
    return { success: false, error: "Could not allocate a unique slug — try a different title." };
  } catch (error) {
    console.error("[CREATE_BROCHURE_ERROR]", error);
    return { success: false, error: "Failed to create brochure." };
  }
}

// ------------------------------------------------------------
// Update — curate / pricing / media / CTAs.
// ------------------------------------------------------------
export async function updateBrochure(
  input: BrochureUpdateInput
): Promise<Result<{ id: string; slug: string }>> {
  const g = await gate("marketing:manage");
  if (!g.ok) return { success: false, error: g.error };

  const parsed = brochureUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, error: first || "Please check the form and try again." };
  }
  const d = parsed.data;

  const curationError = await validateCuration(d.galleryItemIds, d.reviewIds);
  if (curationError) return { success: false, error: curationError };

  if (d.venueId) {
    const venue = await prisma.venue.findUnique({ where: { id: d.venueId }, select: { id: true } });
    if (!venue) return { success: false, error: "Selected venue not found." };
  }

  try {
    const existing = await prisma.digitalBrochure.findUnique({
      where: { id: d.id },
      select: { id: true, slug: true },
    });
    if (!existing) return { success: false, error: "Brochure not found." };

    // Slug-change collision guard.
    if (d.slug !== existing.slug) {
      const clash = await prisma.digitalBrochure.findUnique({
        where: { slug: d.slug },
        select: { id: true },
      });
      if (clash && clash.id !== d.id) {
        return { success: false, error: "That slug is already in use." };
      }
    }

    const updated = await prisma.digitalBrochure.update({
      where: { id: d.id },
      data: {
        slug: d.slug,
        venueId: d.venueId ?? null,
        eventType: d.eventType ?? null,
        title: d.title,
        subtitle: d.subtitle ?? null,
        seoDescription: d.seoDescription ?? null,
        heroImageUrl: (d.heroImageUrl ?? "").trim() || null,
        videoEmbedUrl: cleanEmbed(d.videoEmbedUrl),
        tour360Url: cleanEmbed(d.tour360Url),
        galleryItemIds: d.galleryItemIds,
        reviewIds: d.reviewIds,
        startingFromAmount: decimalOrNull(d.startingFromAmount),
        currency: d.currency || "INR",
        enabledCtas: d.enabledCtas,
        whatsappNumber: (d.whatsappNumber ?? "").trim() || null,
      },
      select: { id: true, slug: true },
    });

    await logActivity({
      userId: g.userId,
      action: "updated",
      entityType: "DigitalBrochure",
      entityId: updated.id,
      changes: { slug: updated.slug, title: d.title },
    });

    revalidatePath("/marketing/brochures");
    revalidatePath(`/marketing/brochures/${updated.id}`);
    revalidatePath(`/v/${updated.slug}`);
    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "That slug is already in use." };
    }
    console.error("[UPDATE_BROCHURE_ERROR]", error);
    return { success: false, error: "Failed to update brochure." };
  }
}

// ------------------------------------------------------------
// Publish / unpublish toggles.
// ------------------------------------------------------------
async function setPublished(
  id: string,
  isPublished: boolean
): Promise<Result<{ id: string; isPublished: boolean }>> {
  const g = await gate("marketing:manage");
  if (!g.ok) return { success: false, error: g.error };
  try {
    const existing = await prisma.digitalBrochure.findUnique({
      where: { id },
      select: { id: true, slug: true, title: true },
    });
    if (!existing) return { success: false, error: "Brochure not found." };

    await prisma.digitalBrochure.update({ where: { id }, data: { isPublished } });

    await logActivity({
      userId: g.userId,
      action: "status_changed",
      entityType: "DigitalBrochure",
      entityId: id,
      changes: { isPublished },
    });

    revalidatePath("/marketing/brochures");
    revalidatePath(`/marketing/brochures/${id}`);
    revalidatePath(`/v/${existing.slug}`);
    return { success: true, data: { id, isPublished } };
  } catch (error) {
    console.error("[SET_BROCHURE_PUBLISHED_ERROR]", error);
    return { success: false, error: "Failed to update publish state." };
  }
}

export async function publishBrochure(id: string) {
  return setPublished(id, true);
}

export async function unpublishBrochure(id: string) {
  return setPublished(id, false);
}
