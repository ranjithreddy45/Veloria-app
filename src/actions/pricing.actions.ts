"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  pricingRuleSchema,
  type PricingRuleInput,
  ratePlanSchema,
  type RatePlanInput,
} from "@/schemas/pricing.schema";
import type { PricingRuleType } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get Pricing Rules (Paginated + Filtered)
// ============================================================

export async function getPricingRules(params?: {
  search?: string;
  ruleType?: PricingRuleType;
  venueId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    if (params?.ruleType) {
      where.ruleType = params.ruleType;
    }

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const [rules, total] = await Promise.all([
      prisma.pricingRule.findMany({
        where,
        include: {
          venue: { select: { id: true, name: true } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.pricingRule.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(rules),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_PRICING_RULES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch pricing rules" };
  }
}

// ============================================================
// Get Single Pricing Rule
// ============================================================

export async function getPricingRule(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const rule = await prisma.pricingRule.findUnique({
      where: { id },
      include: {
        venue: { select: { id: true, name: true } },
      },
    });

    if (!rule) {
      return { success: false as const, error: "Pricing rule not found" };
    }

    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[GET_PRICING_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch pricing rule" };
  }
}

// ============================================================
// Create Pricing Rule
// ============================================================

export async function createPricingRule(data: PricingRuleInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = pricingRuleSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const ruleData = parsed.data;

    const rule = await prisma.pricingRule.create({
      data: {
        name: ruleData.name,
        ruleType: ruleData.ruleType,
        multiplier: ruleData.multiplier,
        conditions: ruleData.conditions ?? undefined,
        startDate: ruleData.startDate ?? null,
        endDate: ruleData.endDate ?? null,
        dayOfWeek: ruleData.dayOfWeek ?? null,
        minDaysAhead: ruleData.minDaysAhead ?? null,
        isActive: ruleData.isActive,
        priority: ruleData.priority,
        venueId: ruleData.venueId,
      },
      include: {
        venue: { select: { id: true, name: true } },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "PricingRule",
      entityId: rule.id,
    });

    revalidatePath("/pricing");
    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[CREATE_PRICING_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to create pricing rule" };
  }
}

// ============================================================
// Update Pricing Rule
// ============================================================

export async function updatePricingRule(id: string, data: PricingRuleInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = pricingRuleSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.pricingRule.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Pricing rule not found" };
    }

    const ruleData = parsed.data;

    const rule = await prisma.pricingRule.update({
      where: { id },
      data: {
        name: ruleData.name,
        ruleType: ruleData.ruleType,
        multiplier: ruleData.multiplier,
        conditions: ruleData.conditions ?? undefined,
        startDate: ruleData.startDate ?? null,
        endDate: ruleData.endDate ?? null,
        dayOfWeek: ruleData.dayOfWeek ?? null,
        minDaysAhead: ruleData.minDaysAhead ?? null,
        isActive: ruleData.isActive,
        priority: ruleData.priority,
        venueId: ruleData.venueId,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "PricingRule",
      entityId: rule.id,
    });

    revalidatePath("/pricing");
    revalidatePath(`/pricing/${id}/edit`);
    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[UPDATE_PRICING_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to update pricing rule" };
  }
}

// ============================================================
// Delete Pricing Rule
// ============================================================

export async function deletePricingRule(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.pricingRule.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Pricing rule not found" };
    }

    await prisma.pricingRule.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "PricingRule",
      entityId: id,
    });

    revalidatePath("/pricing");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_PRICING_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to delete pricing rule" };
  }
}

// ============================================================
// Get Rate Plans
// ============================================================

export async function getRatePlans(params?: {
  search?: string;
  venueId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = params?.search?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    if (params?.venueId) {
      where.venueId = params.venueId;
    }

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const [plans, total] = await Promise.all([
      prisma.ratePlan.findMany({
        where,
        include: {
          venue: { select: { id: true, name: true } },
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.ratePlan.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        data: serialize(plans),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("[GET_RATE_PLANS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch rate plans" };
  }
}

// ============================================================
// Get Single Rate Plan
// ============================================================

export async function getRatePlan(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const plan = await prisma.ratePlan.findUnique({
      where: { id },
      include: {
        venue: { select: { id: true, name: true } },
      },
    });

    if (!plan) {
      return { success: false as const, error: "Rate plan not found" };
    }

    return { success: true as const, data: serialize(plan) };
  } catch (error) {
    console.error("[GET_RATE_PLAN_ERROR]", error);
    return { success: false as const, error: "Failed to fetch rate plan" };
  }
}

// ============================================================
// Create Rate Plan
// ============================================================

export async function createRatePlan(data: RatePlanInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = ratePlanSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const planData = parsed.data;

    // If setting as default, unset other defaults for this venue
    if (planData.isDefault) {
      await prisma.ratePlan.updateMany({
        where: {
          venueId: planData.venueId || null,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const plan = await prisma.ratePlan.create({
      data: {
        name: planData.name,
        description: planData.description || null,
        baseRate: planData.baseRate,
        perGuestRate: planData.perGuestRate,
        isDefault: planData.isDefault,
        isActive: planData.isActive,
        venueId: planData.venueId || null,
      },
      include: {
        venue: { select: { id: true, name: true } },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "RatePlan",
      entityId: plan.id,
    });

    revalidatePath("/pricing");
    revalidatePath("/pricing/rate-plans");
    return { success: true as const, data: serialize(plan) };
  } catch (error) {
    console.error("[CREATE_RATE_PLAN_ERROR]", error);
    return { success: false as const, error: "Failed to create rate plan" };
  }
}

// ============================================================
// Update Rate Plan
// ============================================================

export async function updateRatePlan(id: string, data: RatePlanInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = ratePlanSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.ratePlan.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Rate plan not found" };
    }

    const planData = parsed.data;

    // If setting as default, unset other defaults for this venue
    if (planData.isDefault && !existing.isDefault) {
      await prisma.ratePlan.updateMany({
        where: {
          venueId: planData.venueId || null,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const plan = await prisma.ratePlan.update({
      where: { id },
      data: {
        name: planData.name,
        description: planData.description || null,
        baseRate: planData.baseRate,
        perGuestRate: planData.perGuestRate,
        isDefault: planData.isDefault,
        isActive: planData.isActive,
        venueId: planData.venueId || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "RatePlan",
      entityId: plan.id,
    });

    revalidatePath("/pricing");
    revalidatePath("/pricing/rate-plans");
    return { success: true as const, data: serialize(plan) };
  } catch (error) {
    console.error("[UPDATE_RATE_PLAN_ERROR]", error);
    return { success: false as const, error: "Failed to update rate plan" };
  }
}

// ============================================================
// Delete Rate Plan
// ============================================================

export async function deleteRatePlan(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:manage")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    if (!id || typeof id !== "string") {
      return { success: false as const, error: "Invalid rate plan id" };
    }

    const existing = await prisma.ratePlan.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Rate plan not found" };
    }

    await prisma.ratePlan.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "RatePlan",
      entityId: id,
    });

    revalidatePath("/pricing");
    revalidatePath("/pricing/rate-plans");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_RATE_PLAN_ERROR]", error);
    return { success: false as const, error: "Failed to delete rate plan" };
  }
}

// ============================================================
// Calculate Dynamic Price
// ============================================================
// Gets the venue's base pricePerSlot, finds all active PricingRules
// for that venue, sorts by priority, applies multipliers cumulatively,
// and adds perGuestRate * guestCount from the default RatePlan.

export async function calculatePrice(
  venueId: string,
  date: Date,
  timeSlot: string,
  guestCount: number
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "pricing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // 1. Get venue base price
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true, pricePerSlot: true },
    });

    if (!venue) {
      return { success: false as const, error: "Venue not found" };
    }

    const basePrice = Number(venue.pricePerSlot);
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysAhead = Math.floor(
      (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 2. Find all active pricing rules for this venue
    const rules = await prisma.pricingRule.findMany({
      where: {
        venueId,
        isActive: true,
      },
      orderBy: { priority: "asc" },
    });

    // 3. Filter rules that apply to this booking
    const applicableRules = rules.filter((rule) => {
      switch (rule.ruleType) {
        case "SEASONAL":
          // Rule applies if booking date falls within start/end range
          if (rule.startDate && bookingDate < new Date(rule.startDate)) return false;
          if (rule.endDate && bookingDate > new Date(rule.endDate)) return false;
          return true;

        case "DAY_OF_WEEK":
          // Rule applies if the booking date is on the specified day
          return rule.dayOfWeek === dayOfWeek;

        case "PEAK_HOUR":
          // Rule applies based on time slot — check conditions or apply to all
          if (rule.conditions && typeof rule.conditions === "object") {
            const conditions = rule.conditions as { timeSlots?: string[] };
            if (conditions.timeSlots) {
              return conditions.timeSlots.includes(timeSlot);
            }
          }
          return true;

        case "EARLY_BIRD":
          // Rule applies if booking is made enough days ahead
          if (rule.minDaysAhead !== null && rule.minDaysAhead !== undefined) {
            return daysAhead >= rule.minDaysAhead;
          }
          return daysAhead >= 30; // Default 30 days

        case "LAST_MINUTE":
          // Rule applies if booking is made within minDaysAhead days
          if (rule.minDaysAhead !== null && rule.minDaysAhead !== undefined) {
            return daysAhead <= rule.minDaysAhead;
          }
          return daysAhead <= 7; // Default 7 days

        default:
          return false;
      }
    });

    // 4. Apply multipliers cumulatively
    let calculatedPrice = basePrice;
    const appliedRules: {
      id: string;
      name: string;
      ruleType: string;
      multiplier: number;
      priceAfter: number;
    }[] = [];

    for (const rule of applicableRules) {
      const multiplier = Number(rule.multiplier);
      calculatedPrice = calculatedPrice * multiplier;
      appliedRules.push({
        id: rule.id,
        name: rule.name,
        ruleType: rule.ruleType,
        multiplier,
        priceAfter: Math.round(calculatedPrice),
      });
    }

    // 5. Add per-guest rate from default RatePlan
    const defaultRatePlan = await prisma.ratePlan.findFirst({
      where: {
        OR: [
          { venueId, isDefault: true, isActive: true },
          { venueId: null, isDefault: true, isActive: true },
        ],
      },
      orderBy: { venueId: "desc" }, // Prefer venue-specific over global
    });

    let guestCharge = 0;
    if (defaultRatePlan) {
      guestCharge = Number(defaultRatePlan.perGuestRate) * guestCount;
    }

    const totalPrice = Math.round(calculatedPrice + guestCharge);

    return {
      success: true as const,
      data: {
        venueId: venue.id,
        venueName: venue.name,
        basePrice,
        calculatedSlotPrice: Math.round(calculatedPrice),
        guestCharge,
        guestCount,
        perGuestRate: defaultRatePlan ? Number(defaultRatePlan.perGuestRate) : 0,
        ratePlanName: defaultRatePlan?.name || null,
        totalPrice,
        appliedRules,
        rulesEvaluated: rules.length,
        rulesApplied: applicableRules.length,
      },
    };
  } catch (error) {
    console.error("[CALCULATE_PRICE_ERROR]", error);
    return { success: false as const, error: "Failed to calculate price" };
  }
}
