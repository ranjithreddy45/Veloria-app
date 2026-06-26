"use server";

import { auth } from "@/../auth";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  insurancePolicySchema,
  type InsurancePolicyInput,
} from "@/schemas/insurance.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";

// ============================================================
// Expiry derivation: policies past their endDate are EXPIRED.
// Status is a stored column (the list filters on it directly and the UI
// exposes an EXPIRED filter), so we lazily persist the transition on read
// rather than relying on a manual status change. Idempotent: only flips
// ACTIVE rows whose endDate has passed; no-op once they are EXPIRED/CLAIMED.
// ============================================================

async function transitionExpiredPolicies(): Promise<void> {
  try {
    await prisma.insurancePolicy.updateMany({
      where: { status: "ACTIVE", endDate: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
  } catch (error) {
    // Non-fatal: never block a read if the write-back fails.
    console.error("[TRANSITION_EXPIRED_POLICIES_ERROR]", error);
  }
}

// ============================================================
// Get Insurance Policies (Filtered)
// ============================================================

export async function getInsurancePolicies(filters?: {
  status?: string;
  type?: string;
  search?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "insurance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await transitionExpiredPolicies();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.search?.trim()) {
      where.OR = [
        { provider: { contains: filters.search.trim(), mode: "insensitive" } },
        {
          policyNumber: {
            contains: filters.search.trim(),
            mode: "insensitive",
          },
        },
      ];
    }

    const policies = await prisma.insurancePolicy.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            eventName: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(policies) };
  } catch (error) {
    console.error("[GET_INSURANCE_POLICIES_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch insurance policies",
    };
  }
}

// ============================================================
// Get Single Insurance Policy
// ============================================================

export async function getInsurancePolicyById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "insurance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const policy = await prisma.insurancePolicy.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            eventName: true,
            date: true,
            status: true,
          },
        },
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!policy) {
      return { success: false as const, error: "Insurance policy not found" };
    }

    return { success: true as const, data: serialize(policy) };
  } catch (error) {
    console.error("[GET_INSURANCE_POLICY_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch insurance policy",
    };
  }
}

// ============================================================
// Create Insurance Policy
// ============================================================

export async function createInsurancePolicy(data: InsurancePolicyInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "insurance:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = insurancePolicySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const policyData = parsed.data;

    // Validate dates
    const startDate = new Date(policyData.startDate);
    const endDate = new Date(policyData.endDate);
    if (endDate <= startDate) {
      return {
        success: false as const,
        error: "End date must be after start date",
      };
    }

    // Validate linked references exist before associating
    if (policyData.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: policyData.bookingId },
        select: { id: true },
      });
      if (!booking) {
        return { success: false as const, error: "Linked booking not found" };
      }
    }
    if (policyData.venueId) {
      const venue = await prisma.venue.findUnique({
        where: { id: policyData.venueId },
        select: { id: true },
      });
      if (!venue) {
        return { success: false as const, error: "Linked venue not found" };
      }
    }

    const policy = await prisma.insurancePolicy.create({
      data: {
        provider: policyData.provider,
        policyNumber: policyData.policyNumber,
        type: policyData.type,
        coverageAmount: policyData.coverageAmount,
        premium: policyData.premium,
        startDate,
        endDate,
        bookingId: policyData.bookingId || null,
        venueId: policyData.venueId || null,
        documents: policyData.documents ?? undefined,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "InsurancePolicy",
      entityId: policy.id,
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Insurance Policy Created",
      message: `Policy ${policy.policyNumber} from ${policy.provider} has been created.`,
      actionUrl: `/insurance/${policy.id}`,
    });

    revalidatePath("/insurance");
    return { success: true as const, data: serialize(policy) };
  } catch (error) {
    console.error("[CREATE_INSURANCE_POLICY_ERROR]", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // FK violation: booking/venue was deleted in the race window between
      // the existence pre-check and this create.
      if (error.code === "P2003" || error.code === "P2025") {
        return {
          success: false as const,
          error:
            "The selected booking or venue is no longer available. Please refresh and try again.",
        };
      }
      // Unique constraint (e.g. duplicate policy number).
      if (error.code === "P2002") {
        return {
          success: false as const,
          error: "A policy with these details already exists.",
        };
      }
    }
    return {
      success: false as const,
      error: "Failed to create insurance policy",
    };
  }
}

// ============================================================
// Update Insurance Policy
// ============================================================

export async function updateInsurancePolicy(
  id: string,
  data: InsurancePolicyInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "insurance:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = insurancePolicySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.insurancePolicy.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Insurance policy not found" };
    }

    const policyData = parsed.data;

    const startDate = new Date(policyData.startDate);
    const endDate = new Date(policyData.endDate);
    if (endDate <= startDate) {
      return {
        success: false as const,
        error: "End date must be after start date",
      };
    }

    // Validate linked references exist before associating
    if (policyData.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: policyData.bookingId },
        select: { id: true },
      });
      if (!booking) {
        return { success: false as const, error: "Linked booking not found" };
      }
    }
    if (policyData.venueId) {
      const venue = await prisma.venue.findUnique({
        where: { id: policyData.venueId },
        select: { id: true },
      });
      if (!venue) {
        return { success: false as const, error: "Linked venue not found" };
      }
    }

    const policy = await prisma.insurancePolicy.update({
      where: { id },
      data: {
        provider: policyData.provider,
        policyNumber: policyData.policyNumber,
        type: policyData.type,
        coverageAmount: policyData.coverageAmount,
        premium: policyData.premium,
        startDate,
        endDate,
        bookingId: policyData.bookingId || null,
        venueId: policyData.venueId || null,
        documents: policyData.documents ?? undefined,
      },
    });

    logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "InsurancePolicy",
      entityId: policy.id,
    });

    revalidatePath("/insurance");
    revalidatePath(`/insurance/${id}`);
    return { success: true as const, data: serialize(policy) };
  } catch (error) {
    console.error("[UPDATE_INSURANCE_POLICY_ERROR]", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003" || error.code === "P2025") {
        return {
          success: false as const,
          error:
            "The selected booking or venue is no longer available. Please refresh and try again.",
        };
      }
      if (error.code === "P2002") {
        return {
          success: false as const,
          error: "A policy with these details already exists.",
        };
      }
    }
    return {
      success: false as const,
      error: "Failed to update insurance policy",
    };
  }
}

// ============================================================
// Delete Insurance Policy
// ============================================================

export async function deleteInsurancePolicy(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "insurance:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.insurancePolicy.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Insurance policy not found" };
    }

    await prisma.insurancePolicy.delete({ where: { id } });

    logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "InsurancePolicy",
      entityId: id,
    });

    revalidatePath("/insurance");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_INSURANCE_POLICY_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to delete insurance policy",
    };
  }
}

// ============================================================
// Get Expiring Policies (within N days, default 30)
// ============================================================

export async function getExpiringPolicies(daysAhead: number = 30) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "insurance:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    await transitionExpiredPolicies();

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const policies = await prisma.insurancePolicy.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        booking: {
          select: { id: true, bookingNumber: true, eventName: true },
        },
        venue: {
          select: { id: true, name: true },
        },
      },
      orderBy: { endDate: "asc" },
    });

    return { success: true as const, data: serialize(policies) };
  } catch (error) {
    console.error("[GET_EXPIRING_POLICIES_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch expiring policies",
    };
  }
}

// ============================================================
// Get Insurance Stats
// ============================================================

export async function getInsuranceStats() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    await transitionExpiredPolicies();

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [
      totalActive,
      expiringSoon,
      coverageAgg,
      premiumAgg,
    ] = await Promise.all([
      prisma.insurancePolicy.count({
        where: { status: "ACTIVE" },
      }),
      prisma.insurancePolicy.count({
        where: {
          status: "ACTIVE",
          endDate: {
            gte: now,
            lte: thirtyDaysFromNow,
          },
        },
      }),
      prisma.insurancePolicy.aggregate({
        _sum: { coverageAmount: true },
        where: { status: "ACTIVE" },
      }),
      prisma.insurancePolicy.aggregate({
        _sum: { premium: true },
        where: { status: "ACTIVE" },
      }),
    ]);

    return {
      success: true as const,
      data: serialize({
        totalActive,
        expiringSoon,
        totalCoverage: coverageAgg._sum.coverageAmount ?? 0,
        totalPremiums: premiumAgg._sum.premium ?? 0,
      }),
    };
  } catch (error) {
    console.error("[GET_INSURANCE_STATS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch insurance stats",
    };
  }
}

// ============================================================
// Mark Policy as Claimed
// ============================================================

export async function markAsClaimed(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "insurance:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.insurancePolicy.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Insurance policy not found" };
    }

    if (existing.status !== "ACTIVE") {
      return {
        success: false as const,
        error: "Only active policies can be marked as claimed",
      };
    }

    const policy = await prisma.insurancePolicy.update({
      where: { id },
      data: { status: "CLAIMED" },
    });

    logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "InsurancePolicy",
      entityId: id,
      changes: { status: "CLAIMED" },
    });

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Insurance Policy Claimed",
      message: `Policy ${policy.policyNumber} has been marked as claimed.`,
      actionUrl: `/insurance/${policy.id}`,
    });

    revalidatePath("/insurance");
    revalidatePath(`/insurance/${id}`);
    return { success: true as const, data: serialize(policy) };
  } catch (error) {
    console.error("[MARK_AS_CLAIMED_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to mark policy as claimed",
    };
  }
}
