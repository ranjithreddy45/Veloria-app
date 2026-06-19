"use server";

// ============================================================
// Franchise partner + franchise-venue CRUD + onboarding wizard
// ============================================================
// Internal (gated) server actions. Every export is async and returns a
// discriminated Result ({ success: true, data } | { success: false, error }).
// RBAC: franchise:read for getters, franchise:manage for venue/partner
// mutations, franchise:onboard for the wizard.

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import {
  franchisePartnerSchema,
  franchiseOnboardingStepSchema,
  franchiseVenueSchema,
  franchiseVenueUpdateSchema,
  franchiseStatusValues,
  type FranchisePartnerInput,
  type FranchiseOnboardingStepInput,
  type FranchiseVenueInput,
  type FranchiseVenueUpdateInput,
} from "@/schemas/franchise.schema";
import { toStorefrontSlug, validateStorefrontSlug } from "@/lib/franchise/slug";

type Role = string;

function getRole(session: { user?: { role?: string } | null } | null): Role {
  return ((session?.user as { role?: string })?.role ?? "") as Role;
}

// Required onboardingData keys before a partner can be marked ACTIVE.
const REQUIRED_ONBOARDING_KEYS = ["legal", "bank"] as const;

// ============================================================
// Getters (franchise:read)
// ============================================================

export async function getFranchisePartners(params?: {
  search?: string;
  status?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    const search = params?.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { legalName: { contains: search, mode: "insensitive" } },
        { contactEmail: { contains: search, mode: "insensitive" } },
      ];
    }
    if (
      params?.status &&
      (franchiseStatusValues as readonly string[]).includes(params.status)
    ) {
      where.status = params.status;
    }

    const partners = await prisma.franchisePartner.findMany({
      where,
      include: {
        ownerUser: { select: { id: true, name: true, email: true } },
        _count: { select: { venues: true, revenueShareConfigs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(partners) };
  } catch (error) {
    console.error("[GET_FRANCHISE_PARTNERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch partners" };
  }
}

export async function getFranchisePartner(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const partner = await prisma.franchisePartner.findUnique({
      where: { id },
      include: {
        ownerUser: { select: { id: true, name: true, email: true } },
        venues: {
          include: { venue: { select: { id: true, name: true, isActive: true } } },
          orderBy: { createdAt: "asc" },
        },
        revenueShareConfigs: {
          include: { venue: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { venues: true, revenueSharePayouts: true } },
      },
    });

    if (!partner) {
      return { success: false as const, error: "Partner not found" };
    }
    return { success: true as const, data: serialize(partner) };
  } catch (error) {
    console.error("[GET_FRANCHISE_PARTNER_ERROR]", error);
    return { success: false as const, error: "Failed to fetch partner" };
  }
}

export async function listFranchiseVenues(partnerId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const rows = await prisma.franchiseVenue.findMany({
      where: { partnerId },
      include: { venue: { select: { id: true, name: true, isActive: true } } },
      orderBy: { createdAt: "asc" },
    });
    return { success: true as const, data: serialize(rows) };
  } catch (error) {
    console.error("[LIST_FRANCHISE_VENUES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch franchise venues" };
  }
}

/**
 * Venues that can be attached to a partner (active, not already attached).
 * Provided here gated by franchise:manage so the wizard does not need
 * bookings:read (which getVenues in booking.actions requires).
 */
export async function getAttachableVenues(partnerId?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const attached = partnerId
      ? (
          await prisma.franchiseVenue.findMany({
            where: { partnerId },
            select: { venueId: true },
          })
        ).map((v) => v.venueId)
      : [];

    const venues = await prisma.venue.findMany({
      where: { isActive: true, ...(attached.length ? { id: { notIn: attached } } : {}) },
      select: { id: true, name: true, capacity: true },
      orderBy: { name: "asc" },
    });
    return { success: true as const, data: serialize(venues) };
  } catch (error) {
    console.error("[GET_ATTACHABLE_VENUES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch venues" };
  }
}

// ============================================================
// Partner mutations (franchise:manage)
// ============================================================

export async function createFranchisePartner(input: FranchisePartnerInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = franchisePartnerSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const d = parsed.data;

    const partner = await prisma.franchisePartner.create({
      data: {
        name: d.name,
        legalName: d.legalName || null,
        contactEmail: d.contactEmail || null,
        contactPhone: d.contactPhone || null,
        ownerUserId: d.ownerUserId || null,
        notes: d.notes || null,
        status: d.status ?? "DRAFT",
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "FranchisePartner",
      entityId: partner.id,
    });

    revalidatePath("/franchise");
    return { success: true as const, data: serialize(partner) };
  } catch (error) {
    console.error("[CREATE_FRANCHISE_PARTNER_ERROR]", error);
    return { success: false as const, error: "Failed to create partner" };
  }
}

export async function updateFranchisePartner(
  id: string,
  input: FranchisePartnerInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = franchisePartnerSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const existing = await prisma.franchisePartner.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Partner not found" };
    }
    const d = parsed.data;

    const partner = await prisma.franchisePartner.update({
      where: { id },
      data: {
        name: d.name,
        legalName: d.legalName || null,
        contactEmail: d.contactEmail || null,
        contactPhone: d.contactPhone || null,
        ownerUserId: d.ownerUserId || null,
        notes: d.notes || null,
        status: d.status ?? existing.status,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "FranchisePartner",
      entityId: id,
    });

    revalidatePath("/franchise");
    revalidatePath(`/franchise/${id}`);
    return { success: true as const, data: serialize(partner) };
  } catch (error) {
    console.error("[UPDATE_FRANCHISE_PARTNER_ERROR]", error);
    return { success: false as const, error: "Failed to update partner" };
  }
}

export async function setPartnerStatus(id: string, status: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    if (!(franchiseStatusValues as readonly string[]).includes(status)) {
      return { success: false as const, error: "Invalid status" };
    }
    const existing = await prisma.franchisePartner.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Partner not found" };
    }

    const partner = await prisma.franchisePartner.update({
      where: { id },
      data: { status: status as FranchisePartnerInput["status"] },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "FranchisePartner",
      entityId: id,
      changes: { status },
    });

    revalidatePath("/franchise");
    revalidatePath(`/franchise/${id}`);
    return { success: true as const, data: serialize(partner) };
  } catch (error) {
    console.error("[SET_PARTNER_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to update status" };
  }
}

// ============================================================
// Onboarding wizard (franchise:onboard)
// ============================================================

export async function saveOnboardingStep(
  id: string,
  input: FranchiseOnboardingStepInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:onboard")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = franchiseOnboardingStepSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.franchisePartner.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Partner not found" };
    }

    const prev =
      existing.onboardingData &&
      typeof existing.onboardingData === "object" &&
      !Array.isArray(existing.onboardingData)
        ? (existing.onboardingData as Record<string, unknown>)
        : {};
    const mergedData = { ...prev, ...parsed.data.data };

    // Advance the cursor monotonically; never regress a saved step.
    const nextStep = Math.max(existing.onboardingStep, parsed.data.step);

    const partner = await prisma.franchisePartner.update({
      where: { id },
      data: {
        onboardingData: mergedData as Prisma.InputJsonValue,
        onboardingStep: nextStep,
        // Only move DRAFT → IN_PROGRESS; never demote ACTIVE/SUSPENDED.
        status: existing.status === "DRAFT" ? "IN_PROGRESS" : existing.status,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "FranchisePartner",
      entityId: id,
      changes: { onboardingStep: nextStep },
    });

    revalidatePath(`/franchise/${id}`);
    return { success: true as const, data: serialize(partner) };
  } catch (error) {
    console.error("[SAVE_ONBOARDING_STEP_ERROR]", error);
    return { success: false as const, error: "Failed to save onboarding step" };
  }
}

export async function completeOnboarding(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:onboard")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.franchisePartner.findUnique({
      where: { id },
      include: { _count: { select: { venues: true } } },
    });
    if (!existing) {
      return { success: false as const, error: "Partner not found" };
    }

    const data =
      existing.onboardingData &&
      typeof existing.onboardingData === "object" &&
      !Array.isArray(existing.onboardingData)
        ? (existing.onboardingData as Record<string, unknown>)
        : {};

    const missing = REQUIRED_ONBOARDING_KEYS.filter(
      (k) => !data[k] || (typeof data[k] === "object" && Object.keys(data[k] as object).length === 0)
    );
    if (missing.length) {
      return {
        success: false as const,
        error: `Onboarding incomplete — missing: ${missing.join(", ")}`,
      };
    }
    if (existing._count.venues === 0) {
      return {
        success: false as const,
        error: "Attach at least one venue before completing onboarding.",
      };
    }

    const partner = await prisma.franchisePartner.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "FranchisePartner",
      entityId: id,
      changes: { status: "ACTIVE" },
    });

    revalidatePath("/franchise");
    revalidatePath(`/franchise/${id}`);
    return { success: true as const, data: serialize(partner) };
  } catch (error) {
    console.error("[COMPLETE_ONBOARDING_ERROR]", error);
    return { success: false as const, error: "Failed to complete onboarding" };
  }
}

// ============================================================
// Franchise venue (white-label) mutations (franchise:manage)
// ============================================================

async function assertSlugAvailable(
  slug: string,
  excludeId?: string
): Promise<string | null> {
  const slugErr = validateStorefrontSlug(slug);
  if (slugErr) return slugErr;
  const clash = await prisma.franchiseVenue.findUnique({
    where: { storefrontSlug: slug },
    select: { id: true },
  });
  if (clash && clash.id !== excludeId) {
    return "That storefront slug is already taken.";
  }
  return null;
}

export async function attachVenueToPartner(input: FranchiseVenueInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = franchiseVenueSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const d = parsed.data;

    // Guard the @@unique[partnerId, venueId] join up front for a clean error.
    const dupe = await prisma.franchiseVenue.findUnique({
      where: { partnerId_venueId: { partnerId: d.partnerId, venueId: d.venueId } },
      select: { id: true },
    });
    if (dupe) {
      return {
        success: false as const,
        error: "This venue is already attached to this partner.",
      };
    }

    let slug = d.storefrontSlug?.trim() || null;
    if (slug) {
      slug = toStorefrontSlug(slug);
      const slugErr = await assertSlugAvailable(slug);
      if (slugErr) return { success: false as const, error: slugErr };
    }

    const row = await prisma.franchiseVenue.create({
      data: {
        partnerId: d.partnerId,
        venueId: d.venueId,
        storefrontSlug: slug,
        brandName: d.brandName || null,
        logoUrl: d.logoUrl || null,
        primaryColor: d.primaryColor || null,
        customDomain: d.customDomain || null,
        storefrontConfig: (d.storefrontConfig ?? {}) as Prisma.InputJsonValue,
        isStorefrontLive: d.isStorefrontLive ?? false,
      },
      include: { venue: { select: { id: true, name: true } } },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "FranchiseVenue",
      entityId: row.id,
      changes: { partnerId: d.partnerId, venueId: d.venueId },
    });

    revalidatePath(`/franchise/${d.partnerId}`);
    return { success: true as const, data: serialize(row) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false as const,
        error: "Duplicate venue/slug — already attached or slug in use.",
      };
    }
    console.error("[ATTACH_VENUE_TO_PARTNER_ERROR]", error);
    return { success: false as const, error: "Failed to attach venue" };
  }
}

export async function updateFranchiseVenue(
  id: string,
  input: FranchiseVenueUpdateInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = franchiseVenueUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const existing = await prisma.franchiseVenue.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Franchise venue not found" };
    }
    const d = parsed.data;

    let slug = d.storefrontSlug?.trim() || null;
    if (slug) {
      slug = toStorefrontSlug(slug);
      const slugErr = await assertSlugAvailable(slug, id);
      if (slugErr) return { success: false as const, error: slugErr };
    }

    // Cannot go live without a slug — the slug IS the public access token.
    if (d.isStorefrontLive && !slug) {
      return {
        success: false as const,
        error: "Set a storefront slug before going live.",
      };
    }

    const row = await prisma.franchiseVenue.update({
      where: { id },
      data: {
        storefrontSlug: slug,
        brandName: d.brandName || null,
        logoUrl: d.logoUrl || null,
        primaryColor: d.primaryColor || null,
        customDomain: d.customDomain || null,
        storefrontConfig: (d.storefrontConfig ?? {}) as Prisma.InputJsonValue,
        isStorefrontLive: d.isStorefrontLive ?? false,
      },
      include: { venue: { select: { id: true, name: true } } },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "FranchiseVenue",
      entityId: id,
    });

    revalidatePath(`/franchise/${existing.partnerId}`);
    return { success: true as const, data: serialize(row) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false as const, error: "That storefront slug is already taken." };
    }
    console.error("[UPDATE_FRANCHISE_VENUE_ERROR]", error);
    return { success: false as const, error: "Failed to update franchise venue" };
  }
}

export async function detachVenue(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.franchiseVenue.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Franchise venue not found" };
    }

    await prisma.franchiseVenue.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "FranchiseVenue",
      entityId: id,
    });

    revalidatePath(`/franchise/${existing.partnerId}`);
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DETACH_VENUE_ERROR]", error);
    return { success: false as const, error: "Failed to detach venue" };
  }
}
