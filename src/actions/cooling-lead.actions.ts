"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import type { WinbackStatus } from "@prisma/client";
import {
  catchCoolingLeads,
  COOLING_SCORE_THRESHOLD,
  COOLING_QUIET_DAYS,
} from "@/lib/winback/cooling-lead-catch";

// ============================================================
// Cooling-lead cockpit — read-only stats + manual on-demand sweep trigger.
// getCoolingLeadStats / listCoolingTargets gated by leads:read;
// runCoolingLeadCatchNow gated by settings:read (matches bulkRecalculateScores /
// enrollEntity convention). Exports only async functions. No money mutation.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

const COOLING_STATUSES = ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CoolingLeadStats {
  atRiskBacklog: number; // matches cooling predicate, not yet enrolled
  enrolled: number;
  contacted: number;
  recovered: number;
  exhausted: number;
  recoveryRate: number;
  threshold: number;
  quietDays: number;
}

export interface CoolingTargetRow {
  id: string;
  status: WinbackStatus;
  leadId: string | null;
  leadTitle: string | null;
  score: number | null;
  assigneeName: string | null;
  cadenceId: string | null;
  attempts: number;
  recoveredAt: string | null;
  lastAttemptAt: string | null;
  createdAt: string;
}

export interface CoolingTargetsPage {
  rows: CoolingTargetRow[];
  total: number;
}

/**
 * Stats for the cooling cockpit: status funnel over WinbackTarget
 * (kind=COOLING_LEAD), the live "at-risk" backlog (leads matching the cooling
 * predicate not yet enrolled), and a recovery rate.
 */
export async function getCoolingLeadStats(): Promise<Result<CoolingLeadStats>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const quietBefore = new Date(Date.now() - COOLING_QUIET_DAYS * DAY_MS);

    const [grouped, atRiskBacklog] = await Promise.all([
      prisma.winbackTarget.groupBy({
        by: ["status"],
        where: { kind: "COOLING_LEAD" },
        _count: { _all: true },
      }),
      prisma.lead.count({
        where: {
          deletedAt: null,
          status: { in: [...COOLING_STATUSES] },
          coolingEnrolledAt: null,
          score: { lt: COOLING_SCORE_THRESHOLD },
          updatedAt: { lt: quietBefore },
        },
      }),
    ]);

    const get = (s: WinbackStatus): number =>
      grouped.find((g) => g.status === s)?._count._all ?? 0;

    const enrolled = get("ENROLLED");
    const contacted = get("CONTACTED");
    const recovered = get("RECOVERED");
    const exhausted = get("EXHAUSTED");
    const reachable = enrolled + contacted + recovered;
    const recoveryRate = reachable > 0 ? Math.round((recovered / reachable) * 100) : 0;

    return {
      success: true as const,
      data: {
        atRiskBacklog,
        enrolled,
        contacted,
        recovered,
        exhausted,
        recoveryRate,
        threshold: COOLING_SCORE_THRESHOLD,
        quietDays: COOLING_QUIET_DAYS,
      },
    };
  } catch (error) {
    console.error("getCoolingLeadStats error:", error);
    return { success: false as const, error: "Failed to load cooling-lead stats" };
  }
}

/**
 * Paginated WinbackTarget(kind=COOLING_LEAD) list joined to lead title/score/
 * assignee for the cockpit table.
 */
export async function listCoolingTargets(params?: {
  status?: WinbackStatus;
  page?: number;
  limit?: number;
}): Promise<Result<CoolingTargetsPage>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 25));

    const where = {
      kind: "COOLING_LEAD" as const,
      ...(params?.status ? { status: params.status } : {}),
    };

    const [targets, total] = await Promise.all([
      prisma.winbackTarget.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.winbackTarget.count({ where }),
    ]);

    // Batch-join the lead detail (avoid N+1).
    const leadIds = Array.from(
      new Set(targets.map((t) => t.leadId).filter(Boolean))
    ) as string[];
    const leads = leadIds.length
      ? await prisma.lead.findMany({
          where: { id: { in: leadIds } },
          select: {
            id: true,
            title: true,
            score: true,
            assignedTo: { select: { name: true } },
          },
        })
      : [];
    const leadMap = new Map(leads.map((l) => [l.id, l]));

    const rows: CoolingTargetRow[] = targets.map((t) => {
      const lead = t.leadId ? leadMap.get(t.leadId) : undefined;
      return {
        id: t.id,
        status: t.status,
        leadId: t.leadId,
        leadTitle: lead?.title ?? null,
        score: lead?.score ?? null,
        assigneeName: lead?.assignedTo?.name ?? null,
        cadenceId: t.cadenceId,
        attempts: t.attempts,
        recoveredAt: t.recoveredAt ? t.recoveredAt.toISOString() : null,
        lastAttemptAt: t.lastAttemptAt ? t.lastAttemptAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
      };
    });

    return { success: true as const, data: { rows: serialize(rows) as unknown as CoolingTargetRow[], total } };
  } catch (error) {
    console.error("listCoolingTargets error:", error);
    return { success: false as const, error: "Failed to load cooling targets" };
  }
}

/**
 * Manual on-demand sweep trigger for ops (settings:read gated). Delegates to
 * the same engine the cron uses; the cron path stays auth-free.
 */
export async function runCoolingLeadCatchNow(): Promise<
  Result<{ scanned: number; enrolled: number; skipped: number; noCadence: boolean }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "settings:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const data = await catchCoolingLeads();
    return { success: true as const, data };
  } catch (error) {
    console.error("runCoolingLeadCatchNow error:", error);
    return { success: false as const, error: "Failed to run cooling-lead sweep" };
  }
}
