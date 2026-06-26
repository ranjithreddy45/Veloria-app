"use server";

// ============================================================
// Revenue-share config + periodic payout accounting
// ============================================================
// Reuses computeVenuePnl (cash-basis, reconciles with Reports) to accrue a
// per-venue, per-period RevenueSharePayout. Idempotent on the
// @@unique[partnerId, venueId, period] key; never overwrites an APPROVED/PAID
// payout. Maker-checker on approve (creator ≠ approver, except SUPER_ADMIN);
// markPaid only from APPROVED. All money via Prisma.Decimal.
//
// Maker tracking: RevenueSharePayout has no createdById column (schema is
// fixed), so the maker's userId is recorded inside notes as a structured marker
// "[maker:<userId>]". approveRevenueSharePayout parses it to enforce
// segregation of duties.

import { auth } from "@/../auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { isValidCronSecret } from "@/lib/cron-auth";
import {
  revenueShareConfigSchema,
  recomputePayoutSchema,
  revenueSharePayoutActionSchema,
  type RevenueShareConfigInput,
  type RecomputePayoutInput,
} from "@/schemas/franchise.schema";
import {
  computeVenuePnl,
  computeShareAmount,
  type ShareBasis,
} from "@/lib/franchise/pnl";

function getRole(session: { user?: { role?: string } | null } | null): string {
  return ((session?.user as { role?: string })?.role ?? "") as string;
}

const MAKER_RE = /\[maker:([^\]]+)\]/;

function makerMarker(userId: string): string {
  return `[maker:${userId}]`;
}

function readMaker(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = MAKER_RE.exec(notes);
  return m ? m[1] : null;
}

// ============================================================
// Revenue-share config
// ============================================================

export async function getRevenueShareConfigs(partnerId?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const configs = await prisma.revenueShareConfig.findMany({
      where: partnerId ? { partnerId } : {},
      include: {
        venue: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return { success: true as const, data: serialize(configs) };
  } catch (error) {
    console.error("[GET_REVSHARE_CONFIGS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch configs" };
  }
}

export async function createRevenueShareConfig(input: RevenueShareConfigInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:revshare")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = revenueShareConfigSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const d = parsed.data;

    const config = await prisma.revenueShareConfig.create({
      data: {
        name: d.name,
        basis: d.basis,
        sharePct: new Prisma.Decimal(d.sharePct ?? 0),
        flatFeeAmount:
          d.flatFeeAmount != null ? new Prisma.Decimal(d.flatFeeAmount) : null,
        currency: d.currency ?? "INR",
        isActive: d.isActive ?? true,
        effectiveFrom: d.effectiveFrom ?? null,
        effectiveTo: d.effectiveTo ?? null,
        partnerId: d.partnerId,
        venueId: d.venueId || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "RevenueShareConfig",
      entityId: config.id,
    });

    revalidatePath(`/franchise/${d.partnerId}`);
    return { success: true as const, data: serialize(config) };
  } catch (error) {
    console.error("[CREATE_REVSHARE_CONFIG_ERROR]", error);
    return { success: false as const, error: "Failed to create config" };
  }
}

export async function updateRevenueShareConfig(
  id: string,
  input: RevenueShareConfigInput
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:revshare")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = revenueShareConfigSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const existing = await prisma.revenueShareConfig.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Config not found" };
    }
    const d = parsed.data;

    const config = await prisma.revenueShareConfig.update({
      where: { id },
      data: {
        name: d.name,
        basis: d.basis,
        sharePct: new Prisma.Decimal(d.sharePct ?? 0),
        flatFeeAmount:
          d.flatFeeAmount != null ? new Prisma.Decimal(d.flatFeeAmount) : null,
        currency: d.currency ?? "INR",
        isActive: d.isActive ?? true,
        effectiveFrom: d.effectiveFrom ?? null,
        effectiveTo: d.effectiveTo ?? null,
        venueId: d.venueId || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "RevenueShareConfig",
      entityId: id,
    });

    revalidatePath(`/franchise/${existing.partnerId}`);
    return { success: true as const, data: serialize(config) };
  } catch (error) {
    console.error("[UPDATE_REVSHARE_CONFIG_ERROR]", error);
    return { success: false as const, error: "Failed to update config" };
  }
}

export async function deactivateRevenueShareConfig(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:revshare")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    const existing = await prisma.revenueShareConfig.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Config not found" };
    }

    const config = await prisma.revenueShareConfig.update({
      where: { id },
      data: { isActive: false },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "RevenueShareConfig",
      entityId: id,
      changes: { isActive: false },
    });

    revalidatePath(`/franchise/${existing.partnerId}`);
    return { success: true as const, data: serialize(config) };
  } catch (error) {
    console.error("[DEACTIVATE_REVSHARE_CONFIG_ERROR]", error);
    return { success: false as const, error: "Failed to deactivate config" };
  }
}

// ============================================================
// Payouts
// ============================================================

export async function getRevenueSharePayouts(params?: {
  partnerId?: string;
  venueId?: string;
  period?: string;
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
    if (params?.partnerId) where.partnerId = params.partnerId;
    if (params?.venueId) where.venueId = params.venueId;
    if (params?.period) where.period = params.period;
    if (params?.status) where.status = params.status;

    const payouts = await prisma.revenueSharePayout.findMany({
      where,
      include: {
        venue: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
        config: { select: { id: true, name: true, basis: true } },
      },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    });
    return { success: true as const, data: serialize(payouts) };
  } catch (error) {
    console.error("[GET_REVSHARE_PAYOUTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch payouts" };
  }
}

/**
 * Pick the most relevant active config for a partner/venue:
 * venue-specific active config first, else partner-wide (venueId null) active.
 */
async function resolveActiveConfig(partnerId: string, venueId: string) {
  const venueScoped = await prisma.revenueShareConfig.findFirst({
    where: { partnerId, venueId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (venueScoped) return venueScoped;
  return prisma.revenueShareConfig.findFirst({
    where: { partnerId, venueId: null, isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Internal core used by both the action and the cron route. Writes money rows,
 * so as a top-level "use server" export it is independently dispatchable and
 * MUST gate itself rather than trust callers. Authorizes via session +
 * franchise:revshare (same gate as recomputePayoutForPeriod) and ignores any
 * caller-supplied makerUserId in favour of the authenticated user's id, so the
 * [maker:<id>] marker can't be forged to defeat maker-checker on approve.
 * Idempotent: upserts on @@unique[partnerId,venueId,period] and refuses to
 * overwrite an APPROVED/PAID/CANCELLED payout.
 */
export async function recomputePayoutCore(
  input: RecomputePayoutInput,
  makerUserId: string | null
): Promise<
  | { success: true; data: unknown; skipped?: false }
  | { success: true; data: unknown; skipped: true; reason: string }
  | { success: false; error: string }
> {
  // Authorize: either the trusted cron path (valid CRON_SECRET on the in-process
  // request) or an interactive user holding franchise:revshare. This closes the
  // standalone server-action endpoint while keeping the cron caller working.
  let cronAuthorized = false;
  try {
    const h = await headers();
    cronAuthorized = isValidCronSecret(h.get("authorization"));
  } catch {
    // headers() can throw outside a request scope — treat as not-cron.
    cronAuthorized = false;
  }

  if (!cronAuthorized) {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:revshare")) {
      return { success: false, error: "Insufficient permissions" };
    }
    // Never trust a caller-supplied maker id: the marker drives segregation of
    // duties in approveRevenueSharePayout, so bind it to the authenticated user.
    makerUserId = session.user.id as string;
  }

  const parsed = recomputePayoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed" };
  }
  const { partnerId, venueId, period } = parsed.data;

  const config = await resolveActiveConfig(partnerId, venueId);
  if (!config) {
    return {
      success: false,
      error: "No active revenue-share config for this partner/venue.",
    };
  }

  const pnl = await computeVenuePnl(venueId, period);
  const shareAmount = computeShareAmount(pnl, {
    basis: config.basis as ShareBasis,
    sharePct: config.sharePct,
    flatFeeAmount: config.flatFeeAmount,
  });

  const existing = await prisma.revenueSharePayout.findUnique({
    where: { partnerId_venueId_period: { partnerId, venueId, period } },
  });

  // Guard: never silently revert an approved/paid/cancelled accrual.
  if (existing && existing.status !== "PENDING") {
    return {
      success: true,
      data: serialize(existing),
      skipped: true,
      reason: `Payout already ${existing.status}; not recomputed.`,
    };
  }

  const baseNotes = makerUserId ? makerMarker(makerUserId) : null;

  const payout = await prisma.revenueSharePayout.upsert({
    where: { partnerId_venueId_period: { partnerId, venueId, period } },
    create: {
      partnerId,
      venueId,
      period,
      configId: config.id,
      grossRevenue: new Prisma.Decimal(pnl.grossRevenue),
      netRevenue: new Prisma.Decimal(pnl.netRevenue),
      shareAmount: new Prisma.Decimal(shareAmount),
      currency: config.currency,
      status: "PENDING",
      notes: baseNotes,
    },
    update: {
      configId: config.id,
      grossRevenue: new Prisma.Decimal(pnl.grossRevenue),
      netRevenue: new Prisma.Decimal(pnl.netRevenue),
      shareAmount: new Prisma.Decimal(shareAmount),
      currency: config.currency,
      // keep existing maker marker if present
      notes: existing?.notes ?? baseNotes,
    },
  });

  return { success: true, data: serialize(payout) };
}

export async function recomputePayoutForPeriod(input: RecomputePayoutInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:revshare")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const result = await recomputePayoutCore(
      input,
      session.user.id as string
    );
    if (!result.success) {
      return { success: false as const, error: result.error };
    }

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "RevenueSharePayout",
      entityId: input.venueId,
      changes: { period: input.period, partnerId: input.partnerId },
    });

    revalidatePath(`/franchise/${input.partnerId}`);
    return {
      success: true as const,
      data: result.data,
      skipped: "skipped" in result ? result.skipped : false,
    };
  } catch (error) {
    console.error("[RECOMPUTE_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to recompute payout" };
  }
}

export async function approveRevenueSharePayout(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:payout:approve")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.revenueSharePayout.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Payout not found" };
    }
    if (existing.status !== "PENDING") {
      return {
        success: false as const,
        error: "Only pending payouts can be approved",
      };
    }

    // Maker-checker: the maker cannot approve their own payout (except SUPER_ADMIN).
    const maker = readMaker(existing.notes);
    if (
      maker &&
      maker === (session.user.id as string) &&
      getRole(session) !== "SUPER_ADMIN"
    ) {
      return {
        success: false as const,
        error: "You can't approve a payout you computed.",
      };
    }

    const payout = await prisma.revenueSharePayout.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "RevenueSharePayout",
      entityId: id,
      changes: { status: "APPROVED" },
    });

    revalidatePath(`/franchise/${existing.partnerId}`);
    return { success: true as const, data: serialize(payout) };
  } catch (error) {
    console.error("[APPROVE_REVSHARE_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to approve payout" };
  }
}

export async function markRevenueSharePayoutPaid(
  id: string,
  input: { paymentRef?: string | null }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:payout:approve")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = revenueSharePayoutActionSchema
      .pick({ paymentRef: true })
      .safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Validation failed" };
    }

    const existing = await prisma.revenueSharePayout.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Payout not found" };
    }
    if (existing.status !== "APPROVED") {
      return {
        success: false as const,
        error: "Only approved payouts can be marked paid",
      };
    }

    const payout = await prisma.revenueSharePayout.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentRef: parsed.data.paymentRef || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "RevenueSharePayout",
      entityId: id,
      changes: { status: "PAID", paymentRef: parsed.data.paymentRef || null },
    });

    revalidatePath(`/franchise/${existing.partnerId}`);
    return { success: true as const, data: serialize(payout) };
  } catch (error) {
    console.error("[MARK_REVSHARE_PAYOUT_PAID_ERROR]", error);
    return { success: false as const, error: "Failed to mark payout paid" };
  }
}

export async function cancelRevenueSharePayout(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(getRole(session), "franchise:revshare")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.revenueSharePayout.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Payout not found" };
    }
    if (existing.status === "PAID") {
      return { success: false as const, error: "Paid payouts cannot be cancelled" };
    }

    const payout = await prisma.revenueSharePayout.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "RevenueSharePayout",
      entityId: id,
      changes: { status: "CANCELLED" },
    });

    revalidatePath(`/franchise/${existing.partnerId}`);
    return { success: true as const, data: serialize(payout) };
  } catch (error) {
    console.error("[CANCEL_REVSHARE_PAYOUT_ERROR]", error);
    return { success: false as const, error: "Failed to cancel payout" };
  }
}
