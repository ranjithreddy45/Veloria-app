"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { competitorSchema, type CompetitorInput } from "@/schemas/competitor.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Competitors (Paginated + Search)
// ============================================================

export async function getCompetitors(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "competitors:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    const [competitors, total] = await Promise.all([
      prisma.competitor.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.competitor.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(competitors),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_COMPETITORS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch competitors" };
  }
}

// ============================================================
// Get Single Competitor
// ============================================================

export async function getCompetitor(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "competitors:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const competitor = await prisma.competitor.findUnique({
      where: { id },
    });

    if (!competitor) {
      return { success: false as const, error: "Competitor not found" };
    }

    return { success: true as const, data: serialize(competitor) };
  } catch (error) {
    console.error("[GET_COMPETITOR_ERROR]", error);
    return { success: false as const, error: "Failed to fetch competitor" };
  }
}

// ============================================================
// Create Competitor
// ============================================================

export async function createCompetitor(data: CompetitorInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "competitors:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = competitorSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const input = parsed.data;

    const competitor = await prisma.competitor.create({
      data: {
        name: input.name,
        website: input.website || null,
        location: input.location || null,
        venueTypes: input.venueTypes ?? [],
        priceRange: input.priceRange || null,
        rating: input.rating ?? null,
        strengths: input.strengths || null,
        weaknesses: input.weaknesses || null,
        notes: input.notes || null,
        lastUpdated: new Date(),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Competitor",
      entityId: competitor.id,
    });

    revalidatePath("/competitors");
    return { success: true as const, data: serialize(competitor) };
  } catch (error) {
    console.error("[CREATE_COMPETITOR_ERROR]", error);
    return { success: false as const, error: "Failed to create competitor" };
  }
}

// ============================================================
// Update Competitor
// ============================================================

export async function updateCompetitor(id: string, data: CompetitorInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "competitors:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = competitorSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.competitor.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Competitor not found" };
    }

    const input = parsed.data;

    const competitor = await prisma.competitor.update({
      where: { id },
      data: {
        name: input.name,
        website: input.website || null,
        location: input.location || null,
        venueTypes: input.venueTypes ?? [],
        priceRange: input.priceRange || null,
        rating: input.rating ?? null,
        strengths: input.strengths || null,
        weaknesses: input.weaknesses || null,
        notes: input.notes || null,
        lastUpdated: new Date(),
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Competitor",
      entityId: competitor.id,
    });

    revalidatePath("/competitors");
    return { success: true as const, data: serialize(competitor) };
  } catch (error) {
    console.error("[UPDATE_COMPETITOR_ERROR]", error);
    return { success: false as const, error: "Failed to update competitor" };
  }
}

// ============================================================
// Delete Competitor
// ============================================================

export async function deleteCompetitor(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "competitors:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.competitor.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Competitor not found" };
    }

    await prisma.competitor.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Competitor",
      entityId: id,
    });

    revalidatePath("/competitors");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_COMPETITOR_ERROR]", error);
    return { success: false as const, error: "Failed to delete competitor" };
  }
}

// ============================================================
// Get Competitor Comparison (SWOT-style)
// ============================================================

export async function getCompetitorComparison() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "competitors:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const competitors = await prisma.competitor.findMany({
      orderBy: { rating: "desc" },
    });

    const comparison = competitors.map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
      location: c.location,
      venueTypes: c.venueTypes,
      priceRange: c.priceRange,
      rating: c.rating,
      strengths: c.strengths,
      weaknesses: c.weaknesses,
      notes: c.notes,
      lastUpdated: c.lastUpdated,
    }));

    return { success: true as const, data: serialize(comparison) };
  } catch (error) {
    console.error("[GET_COMPETITOR_COMPARISON_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch competitor comparison",
    };
  }
}
