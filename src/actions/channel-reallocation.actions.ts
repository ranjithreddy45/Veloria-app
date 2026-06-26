"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { computeReallocationPlan } from "@/lib/marketing/reallocation-engine";
import {
  loadChannelBuckets,
  persistReallocationRun,
  resolveRange,
} from "@/lib/marketing/reallocation-buckets";
import type {
  ReallocationRangeParams,
  ReallocationRunView,
  ReallocationRecView,
} from "@/schemas/channel-reallocation.schema";
import { reallocationRangeSchema } from "@/schemas/channel-reallocation.schema";

// ============================================================
// Channel ROI Reallocator — server actions.
// ------------------------------------------------------------
// (1) getLatestReallocationRun — read the newest persisted snapshot.
// (2) computeReallocationRun  — recompute + persist a fresh snapshot.
// (3) getReallocationPreview  — live what-if plan, NOT persisted.
//
// Internal-only. Reads gated by analytics:read OR marketing:read (mirrors
// getChannelAttribution); recompute gated by marketing:manage. Money is
// summed in Decimal and only converted to Number at this Result boundary.
// ============================================================

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function canRead(role: string): boolean {
  return (
    hasPermission(role, "analytics:read") || hasPermission(role, "marketing:read")
  );
}

function dec(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

type RunWithRecs = Prisma.ChannelReallocationRunGetPayload<{
  include: { recommendations: true };
}>;

function toRunView(run: RunWithRecs): ReallocationRunView {
  const recommendations: ReallocationRecView[] = run.recommendations
    .map((r) => ({
      id: r.id,
      fromChannel: r.fromChannel,
      toChannel: r.toChannel,
      segment: r.segment,
      shiftAmount: dec(r.shiftAmount),
      currency: r.currency,
      expectedBookingDelta: r.expectedBookingDelta,
      rationale: r.rationale,
    }))
    // Biggest-impact first.
    .sort((a, b) => b.expectedBookingDelta - a.expectedBookingDelta);

  return {
    id: run.id,
    periodStart: run.periodStart.toISOString(),
    periodEnd: run.periodEnd.toISOString(),
    totalSpend: dec(run.totalSpend),
    currency: run.currency,
    projectedBookingLift: run.projectedBookingLift,
    projectedRoasLift: dec(run.projectedRoasLift),
    notes: run.notes,
    createdAt: run.createdAt.toISOString(),
    recommendations,
  };
}

// ------------------------------------------------------------
// (1) Latest persisted run (instant cockpit render).
// ------------------------------------------------------------
export async function getLatestReallocationRun(): Promise<
  Result<ReallocationRunView | null>
> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!canRead(session.user.role as string)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const run = await prisma.channelReallocationRun.findFirst({
      orderBy: { createdAt: "desc" },
      include: { recommendations: true },
    });

    return { success: true, data: run ? toRunView(run) : null };
  } catch (error) {
    console.error("[GET_LATEST_REALLOCATION_RUN_ERROR]", error);
    return { success: false, error: "Failed to load reallocation plan" };
  }
}

// ------------------------------------------------------------
// (2) Recompute + persist a fresh snapshot (gated: marketing:manage).
// ------------------------------------------------------------
export async function computeReallocationRun(
  params?: ReallocationRangeParams
): Promise<Result<ReallocationRunView>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!hasPermission(session.user.role as string, "marketing:manage")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = reallocationRangeSchema.safeParse(params ?? {});
    if (!parsed.success) {
      return { success: false, error: "Invalid parameters" };
    }

    const { runId } = await persistReallocationRun(
      parsed.data,
      session.user.id as string
    );

    const run = await prisma.channelReallocationRun.findUnique({
      where: { id: runId },
      include: { recommendations: true },
    });
    if (!run) {
      return { success: false, error: "Run was not saved" };
    }

    return { success: true, data: toRunView(run) };
  } catch (error) {
    console.error("[COMPUTE_REALLOCATION_RUN_ERROR]", error);
    return { success: false, error: "Failed to compute reallocation plan" };
  }
}

// ------------------------------------------------------------
// (3) Live preview — compute WITHOUT persisting (what-if for the panel).
// ------------------------------------------------------------
export async function getReallocationPreview(
  params?: ReallocationRangeParams
): Promise<Result<ReallocationRunView>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (!canRead(session.user.role as string)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const parsed = reallocationRangeSchema.safeParse(params ?? {});
    if (!parsed.success) {
      return { success: false, error: "Invalid parameters" };
    }

    const { periodStart, periodEnd } = resolveRange(parsed.data);
    const buckets = await loadChannelBuckets(parsed.data);
    const plan = computeReallocationPlan(buckets);

    const segmented = parsed.data.segmentByEventType === true;
    const view: ReallocationRunView = {
      id: "preview",
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalSpend: plan.totalSpend.toNumber(),
      currency: "INR",
      projectedBookingLift: plan.projectedBookingLift,
      projectedRoasLift: plan.projectedRoasLift.toNumber(),
      notes: `Live preview over ${buckets.length} bucket(s)${
        segmented ? " (segmented by event type)" : ""
      }. Not saved.`,
      createdAt: new Date().toISOString(),
      recommendations: plan.recommendations
        .map((r, i) => ({
          id: `preview-${i}`,
          fromChannel: r.fromChannel,
          toChannel: r.toChannel,
          segment: r.segment,
          shiftAmount: r.shiftAmount.toNumber(),
          currency: "INR",
          expectedBookingDelta: r.expectedBookingDelta,
          rationale: r.rationale,
        }))
        .sort((a, b) => b.expectedBookingDelta - a.expectedBookingDelta),
    };

    return { success: true, data: view };
  } catch (error) {
    console.error("[GET_REALLOCATION_PREVIEW_ERROR]", error);
    return { success: false, error: "Failed to preview reallocation plan" };
  }
}
