"use server";

import { PrismaClient } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { revalidatePath } from "next/cache";
import {
  GUARDS,
  findGuard,
  createIndexSql,
  dropIndexSql,
  duplicateCountSql,
  duplicateSampleSql,
  indexStatusSql,
} from "@/lib/dedup/unique-guards";

// ============================================================
// Database unique guards — status + admin-driven apply.
// ------------------------------------------------------------
// Companion to src/lib/dedup/unique-guards.ts (the constant guard list and
// SQL builders) and the bootstrap block in prisma/bootstrap.ts (which applies
// the autoApply guards on every deploy once their table is clean). This file
// lets an admin SEE each guard's state on /settings/duplicates and apply one
// deliberately once the finder/merge tools have cleared its duplicates.
//
// Every SQL statement is built from the constant GUARDS list — the only
// caller-supplied value (`name`) is resolved through findGuard() and never
// reaches SQL.
// ============================================================

export type UniqueGuardStatus = {
  name: string;
  label: string;
  table: string;
  keyType: "phone" | "email";
  indexName: string;
  autoApply: boolean;
  /** The index exists (valid or not). */
  indexExists: boolean;
  /** The index exists AND finished building (an invalid husk is not protection). */
  indexValid: boolean;
  /** Distinct keys currently held by more than one live row. */
  duplicateGroups: number;
  /** Up to 5 of those keys, largest groups first. */
  samples: { key: string; count: number }[];
  /** Set when this guard's status query itself failed. */
  error?: string;
};

export type ApplyUniqueGuardResult =
  | {
      success: true;
      data: {
        /** true = the index was created by this call. */
        applied: boolean;
        /** true = it was already in place (nothing to do). */
        alreadyProtected: boolean;
        /** Duplicate groups blocking the apply (0 when applied). */
        duplicateGroups: number;
      };
    }
  | { success: false; error: string };

// ------------------------------------------------------------
// Auth gate — SUPER_ADMIN/ADMIN OR hasPermission(role, "settings:update")
// (the same roles that may open /settings/duplicates).
// ------------------------------------------------------------
async function authorize(): Promise<{ userId: string } | null> {
  try {
    const session = await auth();
    const role = session?.user?.role as string | undefined;
    const userId = session?.user?.id;
    if (!role || !userId) return null;
    if (role === "SUPER_ADMIN" || role === "ADMIN") return { userId };
    return hasPermission(role, "settings:update") ? { userId } : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// DDL connection. CREATE INDEX CONCURRENTLY cannot run inside a transaction,
// so it is always a single autocommit $executeRawUnsafe — never $transaction.
// The deploy scripts prefer Neon's DIRECT (unpooled) endpoint for schema
// operations; mirror that here when one is configured, on a throwaway client
// that is disconnected straight after. Otherwise the shared client is used:
// a single statement passes through the pooler unwrapped.
// ------------------------------------------------------------
function ddlUrl(): string | null {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || "";
  return url && url !== process.env.DATABASE_URL ? url : null;
}

async function runDdl(sql: string): Promise<void> {
  const url = ddlUrl();
  if (!url) {
    await prisma.$executeRawUnsafe(sql);
    return;
  }
  const client = new PrismaClient({ datasourceUrl: url, log: ["error"] });
  try {
    await client.$executeRawUnsafe(sql);
  } finally {
    await client.$disconnect();
  }
}

// ------------------------------------------------------------
// Per-guard probes (read-only)
// ------------------------------------------------------------
async function probeIndex(guard: (typeof GUARDS)[number]): Promise<{ exists: boolean; valid: boolean }> {
  const rows = await prisma.$queryRawUnsafe<{ valid: boolean }[]>(indexStatusSql(guard));
  const row = rows[0];
  return { exists: !!row, valid: !!row?.valid };
}

async function countDuplicates(guard: (typeof GUARDS)[number]): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ groups: number }[]>(duplicateCountSql(guard));
  return Number(rows[0]?.groups ?? 0);
}

async function sampleDuplicates(guard: (typeof GUARDS)[number]): Promise<{ key: string; count: number }[]> {
  const rows = await prisma.$queryRawUnsafe<{ key: string; count: number }[]>(duplicateSampleSql(guard, 5));
  return rows.map((r) => ({ key: String(r.key), count: Number(r.count) }));
}

// ============================================================
// getUniqueGuardStatus — one row per guard for the settings table.
// ============================================================
export async function getUniqueGuardStatus(): Promise<
  { success: true; data: UniqueGuardStatus[] } | { success: false; error: string }
> {
  try {
    const who = await authorize();
    if (!who) return { success: false, error: "Admins only" };

    const data = await Promise.all(
      GUARDS.map(async (guard): Promise<UniqueGuardStatus> => {
        const base = {
          name: guard.name,
          label: guard.label,
          table: guard.table,
          keyType: guard.keyType,
          indexName: guard.indexName,
          autoApply: guard.autoApply,
        };
        try {
          const index = await probeIndex(guard);
          // A valid unique index makes duplicates impossible — skip the scan.
          if (index.valid) {
            return { ...base, indexExists: true, indexValid: true, duplicateGroups: 0, samples: [] };
          }
          const [duplicateGroups, samples] = await Promise.all([countDuplicates(guard), sampleDuplicates(guard)]);
          return { ...base, indexExists: index.exists, indexValid: false, duplicateGroups, samples };
        } catch (error) {
          console.error(`[UNIQUE_GUARD_STATUS_ERROR] ${guard.name}`, error);
          return {
            ...base,
            indexExists: false,
            indexValid: false,
            duplicateGroups: 0,
            samples: [],
            error: "Could not read this guard's status",
          };
        }
      })
    );

    return { success: true, data };
  } catch (error) {
    console.error("[UNIQUE_GUARD_STATUS_ERROR]", error);
    return { success: false, error: "Failed to read database guard status" };
  }
}

// ============================================================
// applyUniqueGuard — create the index if (and only if) the table is clean.
// Returns the blocking duplicate-group count otherwise, so the UI can send the
// admin back to the merge tools.
// ============================================================
export async function applyUniqueGuard(name: string): Promise<ApplyUniqueGuardResult> {
  try {
    const who = await authorize();
    if (!who) return { success: false, error: "Admins only" };

    const guard = findGuard(name);
    if (!guard) return { success: false, error: "Unknown guard" };

    const index = await probeIndex(guard);
    if (index.valid) {
      return { success: true, data: { applied: false, alreadyProtected: true, duplicateGroups: 0 } };
    }
    if (index.exists) {
      // Husk of a CONCURRENTLY build that failed part-way. IF NOT EXISTS would
      // keep it forever, so clear it before rebuilding.
      await runDdl(dropIndexSql(guard));
    }

    const duplicateGroups = await countDuplicates(guard);
    if (duplicateGroups > 0) {
      return { success: true, data: { applied: false, alreadyProtected: false, duplicateGroups } };
    }

    await runDdl(createIndexSql(guard));

    // Confirm it actually finished valid (a concurrent insert of a duplicate
    // during the build would have failed the statement, but be explicit).
    const after = await probeIndex(guard);
    if (!after.valid) {
      return { success: false, error: "The index did not finish building — check for duplicates and retry" };
    }

    await logActivity({
      userId: who.userId,
      action: "UNIQUE_GUARD_CHECK",
      entityType: "SYSTEM",
      entityId: guard.name,
      changes: { duplicates: 0, indexCreated: true, source: "admin" },
    });

    revalidatePath("/settings/duplicates");
    return { success: true, data: { applied: true, alreadyProtected: false, duplicateGroups: 0 } };
  } catch (error) {
    console.error("[APPLY_UNIQUE_GUARD_ERROR]", error);
    return { success: false, error: "Failed to apply the database guard" };
  }
}
