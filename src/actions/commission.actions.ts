"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  commissionRuleSchema,
  calculateCommissionSchema,
  type CommissionRuleInput,
  type CalculateCommissionInput,
} from "@/schemas/commission.schema";
import type { CommissionStatus } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { notify } from "@/lib/notify";
import { hasPermission } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

// Sentinel used to abort the Serializable transaction when a duplicate
// (bookingId, ruleId) commission is detected inside the critical section.
class DuplicateCommissionError extends Error {}

// Postgres serialization failures surface as Prisma error code P2034.
function isSerializationError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034"
  );
}

// ============================================================
// Get Commission Rules
// ============================================================

export async function getCommissionRules() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "commissions:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const rules = await prisma.commissionRule.findMany({
      include: {
        _count: {
          select: { entries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(rules) };
  } catch (error) {
    console.error("[GET_COMMISSION_RULES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch commission rules" };
  }
}

// ============================================================
// Create Commission Rule
// ============================================================

export async function createCommissionRule(data: CommissionRuleInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "commissions:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = commissionRuleSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const ruleData = parsed.data;

    const rule = await prisma.commissionRule.create({
      data: {
        name: ruleData.name,
        role: ruleData.role || null,
        userId: ruleData.userId || null,
        bookingType: ruleData.bookingType || null,
        percentage: ruleData.percentage,
        flatAmount: ruleData.flatAmount ?? null,
        isActive: ruleData.isActive,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "CommissionRule",
      entityId: rule.id,
    });

    revalidatePath("/commissions");
    revalidatePath("/settings/commissions");
    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[CREATE_COMMISSION_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to create commission rule" };
  }
}

// ============================================================
// Update Commission Rule
// ============================================================

export async function updateCommissionRule(id: string, data: CommissionRuleInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "commissions:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = commissionRuleSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.commissionRule.findUnique({
      where: { id },
    });
    if (!existing) {
      return { success: false as const, error: "Commission rule not found" };
    }

    const ruleData = parsed.data;

    const rule = await prisma.commissionRule.update({
      where: { id },
      data: {
        name: ruleData.name,
        role: ruleData.role || null,
        userId: ruleData.userId || null,
        bookingType: ruleData.bookingType || null,
        percentage: ruleData.percentage,
        flatAmount: ruleData.flatAmount ?? null,
        isActive: ruleData.isActive,
      },
    });

    logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "CommissionRule",
      entityId: rule.id,
    });

    revalidatePath("/commissions");
    revalidatePath("/settings/commissions");
    return { success: true as const, data: serialize(rule) };
  } catch (error) {
    console.error("[UPDATE_COMMISSION_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to update commission rule" };
  }
}

// ============================================================
// Delete Commission Rule
// ============================================================

export async function deleteCommissionRule(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Deleting a commission rule is destructive and irreversible — gate it
    // behind admins only. No dedicated "commissions:delete" permission exists
    // in the Permission union, so we restrict by role.
    const role = session.user.role as string;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.commissionRule.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });

    if (!existing) {
      return { success: false as const, error: "Commission rule not found" };
    }

    if (existing._count.entries > 0) {
      return {
        success: false as const,
        error: "Cannot delete rule with existing commission entries",
      };
    }

    await prisma.commissionRule.delete({ where: { id } });

    logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "CommissionRule",
      entityId: id,
    });

    revalidatePath("/commissions");
    revalidatePath("/settings/commissions");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_COMMISSION_RULE_ERROR]", error);
    return { success: false as const, error: "Failed to delete commission rule" };
  }
}

// ============================================================
// Get Commission Entries
// ============================================================

export async function getCommissionEntries(filters?: {
  status?: CommissionStatus;
  userId?: string;
  ruleId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "commissions:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.ruleId) {
      where.ruleId = filters.ruleId;
    }

    const entries = await prisma.commissionEntry.findMany({
      where,
      include: {
        rule: {
          select: { id: true, name: true, percentage: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(entries) };
  } catch (error) {
    console.error("[GET_COMMISSION_ENTRIES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch commission entries" };
  }
}

// ============================================================
// Calculate Commission
// ============================================================

export async function calculateCommission(data: CalculateCommissionInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "commissions:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = calculateCommissionSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { ruleId, userId, bookingId } = parsed.data;

    const rule = await prisma.commissionRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      return { success: false as const, error: "Commission rule not found" };
    }

    if (!rule.isActive) {
      return { success: false as const, error: "Commission rule is inactive" };
    }

    // Validate the beneficiary: the client-supplied userId must reference a
    // real, active user before we create a payable / notify them.
    const beneficiary = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!beneficiary || !beneficiary.isActive) {
      return { success: false as const, error: "Invalid or inactive commission beneficiary." };
    }

    // Derive the base amount from the BOOKING server-side — never trust a
    // client-supplied invoiceAmount (which could inflate a payout).
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { totalAmount: true },
    });
    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }
    const invoiceAmount = Number(booking.totalAmount);

    // Calculate commission: percentage of invoice amount + optional flat amount
    const percentageAmount = (invoiceAmount * Number(rule.percentage)) / 100;
    const flatAmount = rule.flatAmount ? Number(rule.flatAmount) : 0;
    const commissionAmount = percentageAmount + flatAmount;

    // Idempotency under concurrency: there is no DB @@unique on
    // (bookingId, ruleId), so the existence-check + create must run inside a
    // single Serializable transaction. Two concurrent calls cannot both pass
    // the guard — the loser fails serialization and is reported as a duplicate.
    let entry;
    try {
      entry = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.commissionEntry.findFirst({
            where: { bookingId, ruleId },
            select: { id: true },
          });
          if (existing) {
            throw new DuplicateCommissionError();
          }
          return tx.commissionEntry.create({
            data: {
              invoiceAmount,
              commissionAmount,
              status: "PENDING",
              ruleId,
              userId,
              bookingId,
            },
            include: {
              rule: { select: { id: true, name: true, percentage: true } },
            },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (txErr) {
      if (txErr instanceof DuplicateCommissionError) {
        return { success: false as const, error: "A commission already exists for this booking and rule." };
      }
      // Serialization failure from a concurrent insert of the same pair also
      // means a duplicate — surface it the same way rather than as a 500.
      if (isSerializationError(txErr)) {
        return { success: false as const, error: "A commission already exists for this booking and rule." };
      }
      throw txErr;
    }

    logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "CommissionEntry",
      entityId: entry.id,
      changes: {
        invoiceAmount,
        commissionAmount,
        ruleName: rule.name,
      },
    });

    notify({
      userId,
      type: "SYSTEM",
      title: "Commission Calculated",
      message: `A commission of ₹${commissionAmount.toLocaleString("en-IN")} has been calculated for you.`,
      actionUrl: "/commissions",
    });

    revalidatePath("/commissions");
    return { success: true as const, data: serialize(entry) };
  } catch (error) {
    console.error("[CALCULATE_COMMISSION_ERROR]", error);
    return { success: false as const, error: "Failed to calculate commission" };
  }
}

// ============================================================
// Approve Commission
// ============================================================

export async function approveCommission(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "commissions:approve")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.commissionEntry.findUnique({
      where: { id },
      select: { status: true, userId: true, commissionAmount: true },
    });

    if (!existing) {
      return { success: false as const, error: "Commission entry not found" };
    }

    if (existing.status !== "PENDING") {
      return {
        success: false as const,
        error: "Only pending commissions can be approved",
      };
    }

    const entry = await prisma.commissionEntry.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "CommissionEntry",
      entityId: id,
      changes: { from: "PENDING", to: "APPROVED" },
    });

    notify({
      userId: existing.userId,
      type: "SYSTEM",
      title: "Commission Approved",
      message: `Your commission of ₹${Number(existing.commissionAmount).toLocaleString("en-IN")} has been approved.`,
      actionUrl: "/commissions",
    });

    revalidatePath("/commissions");
    return { success: true as const, data: serialize(entry) };
  } catch (error) {
    console.error("[APPROVE_COMMISSION_ERROR]", error);
    return { success: false as const, error: "Failed to approve commission" };
  }
}

// ============================================================
// Mark Commission Paid
// ============================================================

export async function markCommissionPaid(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role, "commissions:approve")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.commissionEntry.findUnique({
      where: { id },
      select: { status: true, userId: true, commissionAmount: true },
    });

    if (!existing) {
      return { success: false as const, error: "Commission entry not found" };
    }

    if (existing.status !== "APPROVED") {
      return {
        success: false as const,
        error: "Only approved commissions can be marked as paid",
      };
    }

    const entry = await prisma.commissionEntry.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "CommissionEntry",
      entityId: id,
      changes: { from: "APPROVED", to: "PAID" },
    });

    notify({
      userId: existing.userId,
      type: "SYSTEM",
      title: "Commission Paid",
      message: `Your commission of ₹${Number(existing.commissionAmount).toLocaleString("en-IN")} has been paid.`,
      actionUrl: "/commissions",
    });

    revalidatePath("/commissions");
    return { success: true as const, data: serialize(entry) };
  } catch (error) {
    console.error("[MARK_COMMISSION_PAID_ERROR]", error);
    return { success: false as const, error: "Failed to mark commission as paid" };
  }
}
