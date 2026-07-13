"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import type { WinbackKind, WinbackStatus } from "@prisma/client";

// ============================================================
// Win-back cockpit — read-only dashboard actions over WinbackTarget.
// Gated by marketing:read. No money mutation, no cron logic (crons call the
// engine lib directly to stay unauthed). Exports only async functions.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface WinbackTargetRow {
  id: string;
  kind: WinbackKind;
  status: WinbackStatus;
  leadId: string | null;
  contactId: string | null;
  shareLinkId: string | null;
  lostReason: string | null;
  eventDate: string | null;
  coolOffUntil: string | null;
  cadenceId: string | null;
  enrollmentId: string | null;
  whatsappMessageId: string | null;
  recoveredLeadId: string | null;
  recoveredAt: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
}

export interface WinbackTargetsPage {
  rows: WinbackTargetRow[];
  total: number;
  page: number;
  limit: number;
}

export interface WinbackStats {
  byKind: Array<{
    kind: WinbackKind;
    pending: number;
    enrolled: number;
    contacted: number;
    recovered: number;
    exhausted: number;
    suppressed: number;
    total: number;
  }>;
  totals: {
    targets: number;
    enrolled: number;
    contacted: number;
    recovered: number;
    recoveryRate: number; // recovered / (enrolled + contacted + recovered)
  };
}

const ALL_KINDS: WinbackKind[] = [
  "ABANDONED_QUOTE",
  "LOST_LEAD_REVIVAL",
  "EVENT_DATE_PROXIMITY",
  "COOLING_LEAD",
  "CORPORATE_FARMING",
];

/**
 * Paginated WinbackTarget list for the cockpit. Filterable by kind + status.
 */
export async function getWinbackTargets(params?: {
  kind?: WinbackKind;
  status?: WinbackStatus;
  page?: number;
  limit?: number;
}): Promise<Result<WinbackTargetsPage>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "marketing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 25));

    const where = {
      ...(params?.kind ? { kind: params.kind } : {}),
      ...(params?.status ? { status: params.status } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.winbackTarget.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.winbackTarget.count({ where }),
    ]);

    return {
      success: true as const,
      data: {
        rows: serialize(rows) as unknown as WinbackTargetRow[],
        total,
        page,
        limit,
      },
    };
  } catch (error) {
    console.error("getWinbackTargets error:", error);
    return { success: false as const, error: "Failed to load win-back targets" };
  }
}

/**
 * Aggregate funnel counts per WinbackKind + status, plus an overall recovery
 * rate. Drives the cockpit StatTiles.
 */
export async function getWinbackStats(): Promise<Result<WinbackStats>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "marketing:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const grouped = await prisma.winbackTarget.groupBy({
      by: ["kind", "status"],
      _count: { _all: true },
    });

    const map = new Map<string, number>();
    for (const g of grouped) {
      map.set(`${g.kind}:${g.status}`, g._count._all);
    }
    const get = (kind: WinbackKind, status: WinbackStatus): number =>
      map.get(`${kind}:${status}`) ?? 0;

    const byKind = ALL_KINDS.map((kind) => {
      const pending = get(kind, "PENDING");
      const enrolled = get(kind, "ENROLLED");
      const contacted = get(kind, "CONTACTED");
      const recovered = get(kind, "RECOVERED");
      const exhausted = get(kind, "EXHAUSTED");
      const suppressed = get(kind, "SUPPRESSED");
      return {
        kind,
        pending,
        enrolled,
        contacted,
        recovered,
        exhausted,
        suppressed,
        total: pending + enrolled + contacted + recovered + exhausted + suppressed,
      };
    });

    const totalEnrolled = byKind.reduce((s, k) => s + k.enrolled, 0);
    const totalContacted = byKind.reduce((s, k) => s + k.contacted, 0);
    const totalRecovered = byKind.reduce((s, k) => s + k.recovered, 0);
    const reachable = totalEnrolled + totalContacted + totalRecovered;
    const recoveryRate = reachable > 0 ? Math.round((totalRecovered / reachable) * 100) : 0;

    return {
      success: true as const,
      data: {
        byKind,
        totals: {
          targets: byKind.reduce((s, k) => s + k.total, 0),
          enrolled: totalEnrolled,
          contacted: totalContacted,
          recovered: totalRecovered,
          recoveryRate,
        },
      },
    };
  } catch (error) {
    console.error("getWinbackStats error:", error);
    return { success: false as const, error: "Failed to load win-back stats" };
  }
}

// ============================================================
// Operator actions — make the cockpit actionable. Gated by marketing:manage
// (the write counterpart of the marketing:read the reads use). State lives on
// WinbackTarget.status (WinbackStatus enum). The engine only ever re-dispatches
// PENDING targets (see winback-engine.ts: any non-PENDING existing target is
// skipped), so moving a target off PENDING is what durably takes it out of the
// send rotation. Best-effort activity log; revalidate the cockpit path.
// ============================================================

async function requireWinbackManager(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role as string, "marketing:manage")) {
    return { ok: false, error: "Insufficient permissions" };
  }
  return { ok: true, userId: session.user.id };
}

/**
 * Suppress a win-back target — permanently exclude it from future win-back
 * sends. Sets WinbackTarget.status = "SUPPRESSED"; the engine skips any existing
 * target whose status is not PENDING, so this is the durable opt-out flag the
 * model natively supports. Idempotent on an already-terminal target.
 */
export async function suppressWinbackTarget(
  targetId: string,
): Promise<Result<{ id: string; status: WinbackStatus }>> {
  try {
    if (!targetId) return { success: false as const, error: "Missing target id" };

    const gate = await requireWinbackManager();
    if (!gate.ok) return { success: false as const, error: gate.error };

    const target = await prisma.winbackTarget.findUnique({
      where: { id: targetId },
      select: { id: true, status: true, kind: true },
    });
    if (!target) return { success: false as const, error: "Win-back target not found" };

    if (target.status === "SUPPRESSED") {
      return { success: true as const, data: { id: target.id, status: "SUPPRESSED" } };
    }
    if (target.status === "RECOVERED") {
      return {
        success: false as const,
        error: "Target is already marked recovered — nothing to suppress",
      };
    }

    const updated = await prisma.winbackTarget.update({
      where: { id: targetId },
      data: { status: "SUPPRESSED" },
      select: { id: true, status: true },
    });

    await logActivity({
      userId: gate.userId,
      action: "WINBACK_SUPPRESS",
      entityType: "winback_target",
      entityId: targetId,
      changes: { kind: target.kind, from: target.status, to: "SUPPRESSED" },
    });

    revalidatePath("/marketing/winback");
    return { success: true as const, data: updated };
  } catch (error) {
    console.error("suppressWinbackTarget error:", error);
    return { success: false as const, error: "Failed to suppress win-back target" };
  }
}

/**
 * Mark a win-back target as recovered/won so it drops off the active list. Sets
 * WinbackTarget.status = "RECOVERED" and stamps recoveredAt (and recoveredLeadId
 * from the target's own leadId when present). RECOVERED is a terminal status the
 * engine never re-dispatches. Idempotent on an already-recovered target.
 */
export async function markWinbackRecovered(
  targetId: string,
): Promise<Result<{ id: string; status: WinbackStatus }>> {
  try {
    if (!targetId) return { success: false as const, error: "Missing target id" };

    const gate = await requireWinbackManager();
    if (!gate.ok) return { success: false as const, error: gate.error };

    const target = await prisma.winbackTarget.findUnique({
      where: { id: targetId },
      select: { id: true, status: true, kind: true, leadId: true, recoveredLeadId: true },
    });
    if (!target) return { success: false as const, error: "Win-back target not found" };

    if (target.status === "RECOVERED") {
      return { success: true as const, data: { id: target.id, status: "RECOVERED" } };
    }

    const updated = await prisma.winbackTarget.update({
      where: { id: targetId },
      data: {
        status: "RECOVERED",
        recoveredAt: new Date(),
        recoveredLeadId: target.recoveredLeadId ?? target.leadId ?? null,
      },
      select: { id: true, status: true },
    });

    await logActivity({
      userId: gate.userId,
      action: "WINBACK_RECOVERED",
      entityType: "winback_target",
      entityId: targetId,
      changes: { kind: target.kind, from: target.status, to: "RECOVERED" },
    });

    revalidatePath("/marketing/winback");
    return { success: true as const, data: updated };
  } catch (error) {
    console.error("markWinbackRecovered error:", error);
    return { success: false as const, error: "Failed to mark win-back target recovered" };
  }
}
