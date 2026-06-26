"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
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
