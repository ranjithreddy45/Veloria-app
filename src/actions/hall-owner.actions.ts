"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { serialize } from "@/lib/utils";
import {
  hallOwnerSchema,
  hallOwnerStatusValues,
  type HallOwnerInput,
} from "@/schemas/hall-owner.schema";
import type { HallOwnerStatus } from "@prisma/client";

// Normalize "" → null and cast enum-ish strings safely.
function clean(data: HallOwnerInput) {
  const e = (v?: string) => (v ? v : null);
  return {
    ownerName: data.ownerName,
    companyName: e(data.companyName),
    email: e(data.email),
    phone: e(data.phone),
    whatsapp: e(data.whatsapp),
    gstin: e(data.gstin),
    numberOfHalls: data.numberOfHalls ?? null,
    totalCapacity: data.totalCapacity ?? null,
    propertyCity: e(data.propertyCity),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propertyType: (e(data.propertyType) as any) ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ownershipStatus: (e(data.ownershipStatus) as any) ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    commercialModel: (e(data.commercialModel) as any) ?? null,
    revenueSharePercent: data.revenueSharePercent ?? null,
    minimumMonthlyGuarantee: data.minimumMonthlyGuarantee ?? null,
    contractStatus: data.contractStatus as HallOwnerStatus,
    bdOwnerId: e(data.bdOwnerId),
    notes: e(data.notes),
  };
}

// ============================================================
// Annual pipeline metric (O-8)
// ------------------------------------------------------------
// "Annual lease pipeline" used to sum minimumMonthlyGuarantee × 12 for every
// owner regardless of commercial model. Revenue-share and management-fee owners
// have no fixed monthly figure, so they silently contributed ₹0 — materially
// understating the real pipeline.
//
// The HallOwner schema only carries two money fields: `minimumMonthlyGuarantee`
// (Decimal) and `revenueSharePercent` (Decimal). There is NO projected/annual
// revenue or GMV base on the model, and no dedicated management-fee amount.
// Without a revenue base we cannot honestly annualize a revenue-share %, so we
// do NOT fabricate one. Instead, per model:
//   • FIXED_LEASE / HYBRID  → minimumMonthlyGuarantee × 12 (the lease/floor).
//   • REVENUE_SHARE         → if a minimum monthly guarantee (floor) is set,
//                             annualize that floor (× 12); otherwise the owner
//                             is not estimable → excluded from the headline sum
//                             and counted under `notAnnualized`.
//   • MANAGEMENT_FEE        → same rule: annualize the monthly guarantee floor
//                             if present, else exclude + count.
// `notAnnualized` is surfaced in the UI as "+N owners (not annualized)" so the
// metric is honest rather than silently understated.
// ============================================================

type PipelineOwner = {
  contractStatus: string;
  commercialModel: string | null;
  minimumMonthlyGuarantee: number | string | null;
};

export function computeAnnualPipeline(owners: PipelineOwner[]): {
  total: number;
  notAnnualized: number;
} {
  let total = 0;
  let notAnnualized = 0;

  for (const o of owners) {
    if (o.contractStatus === "CHURNED") continue;

    // minimumMonthlyGuarantee is a Prisma Decimal — always Number() it.
    const monthlyFloor = Number(o.minimumMonthlyGuarantee ?? 0);
    const annualizedFloor = monthlyFloor * 12;

    switch (o.commercialModel) {
      case "FIXED_LEASE":
      case "HYBRID":
        // Lease / floor is the contractual annual contribution.
        total += annualizedFloor;
        break;
      case "REVENUE_SHARE":
      case "MANAGEMENT_FEE":
        // No revenue base on the model: annualize the guarantee floor if set,
        // otherwise this owner is not estimable — disclose, don't fake it.
        if (monthlyFloor > 0) total += annualizedFloor;
        else notAnnualized += 1;
        break;
      default:
        // Unknown / unset model: fall back to the floor if one exists.
        if (monthlyFloor > 0) total += annualizedFloor;
        break;
    }
  }

  return { total, notAnnualized };
}

// ============================================================
// List hall owners grouped by funnel stage
// ============================================================

export async function getHallOwners() {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:read"))
      return { success: false as const, error: "Insufficient permissions" };

    const owners = await prisma.hallOwner.findMany({
      where: { deletedAt: null },
      include: { bdOwner: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return { success: true as const, data: serialize(owners) };
  } catch (error) {
    console.error("[GET_HALL_OWNERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch hall owners" };
  }
}

export async function getHallOwner(id: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:read"))
      return { success: false as const, error: "Insufficient permissions" };

    const owner = await prisma.hallOwner.findUnique({
      where: { id },
      include: { bdOwner: { select: { id: true, name: true } } },
    });
    if (!owner) return { success: false as const, error: "Not found" };
    return { success: true as const, data: serialize(owner) };
  } catch (error) {
    console.error("[GET_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to fetch hall owner" };
  }
}

export async function createHallOwner(data: HallOwnerInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:create"))
      return { success: false as const, error: "Insufficient permissions" };

    const parsed = hallOwnerSchema.safeParse(data);
    if (!parsed.success)
      return { success: false as const, error: "Validation failed" };

    const owner = await prisma.hallOwner.create({ data: clean(parsed.data) });
    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "HallOwner",
      entityId: owner.id,
    });
    revalidatePath("/owners");
    return { success: true as const, data: serialize(owner) };
  } catch (error) {
    console.error("[CREATE_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to create hall owner" };
  }
}

export async function updateHallOwner(id: string, data: HallOwnerInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:update"))
      return { success: false as const, error: "Insufficient permissions" };

    const parsed = hallOwnerSchema.safeParse(data);
    if (!parsed.success)
      return { success: false as const, error: "Validation failed" };

    const owner = await prisma.hallOwner.update({
      where: { id },
      data: clean(parsed.data),
    });
    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "HallOwner",
      entityId: id,
    });
    revalidatePath("/owners");
    revalidatePath(`/owners/${id}`);
    return { success: true as const, data: serialize(owner) };
  } catch (error) {
    console.error("[UPDATE_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to update hall owner" };
  }
}

// Move an owner to a different funnel stage (board drag / quick action).
export async function moveHallOwnerStage(id: string, status: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:update"))
      return { success: false as const, error: "Insufficient permissions" };
    if (!(hallOwnerStatusValues as readonly string[]).includes(status))
      return { success: false as const, error: "Invalid stage" };

    await prisma.hallOwner.update({
      where: { id },
      data: { contractStatus: status as HallOwnerStatus },
    });
    await logActivity({
      userId: session.user.id as string,
      action: "stage_changed",
      entityType: "HallOwner",
      entityId: id,
      changes: { contractStatus: status },
    });
    revalidatePath("/owners");
    return { success: true as const };
  } catch (error) {
    console.error("[MOVE_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to move hall owner" };
  }
}

export async function deleteHallOwner(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "owners:delete"))
      return { success: false as const, error: "Insufficient permissions" };

    await prisma.hallOwner.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "HallOwner",
      entityId: id,
    });
    revalidatePath("/owners");
    return { success: true as const };
  } catch (error) {
    console.error("[DELETE_HALL_OWNER_ERROR]", error);
    return { success: false as const, error: "Failed to delete hall owner" };
  }
}
