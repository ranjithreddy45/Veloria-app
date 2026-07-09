"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { buildStructureLines, type PayComponentDef, type StructureLine } from "@/lib/hr/payroll-calc";

// --- auth / permission helpers (mirror hr-employee.actions.ts) ---------------
type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// Pay components default to the primary entity (see hr-payroll-config.actions.ts).
const DEFAULT_ENTITY = "BILLION";
const utcDate = (iso: string) => new Date(iso + "T00:00:00.000Z");

/** A salary structure serialised for the client (Decimals -> numbers). */
export interface SalaryStructureRow {
  id: string;
  employeeId: string;
  effectiveFrom: string; // ISO date
  annualCtc: number;
  monthlyCtc: number;
  basicPct: number;
  note: string | null;
  lines: StructureLine[];
  isCurrent: boolean;
  createdAt: string;
}

function serialize(s: {
  id: string; employeeId: string; effectiveFrom: Date; annualCtc: Prisma.Decimal;
  monthlyCtc: Prisma.Decimal; basicPct: number; note: string | null; lines: Prisma.JsonValue;
  isCurrent: boolean; createdAt: Date;
}): SalaryStructureRow {
  return {
    id: s.id,
    employeeId: s.employeeId,
    effectiveFrom: s.effectiveFrom.toISOString(),
    annualCtc: Number(s.annualCtc),
    monthlyCtc: Number(s.monthlyCtc),
    basicPct: s.basicPct,
    note: s.note,
    lines: (s.lines as unknown as StructureLine[]) ?? [],
    isCurrent: s.isCurrent,
    createdAt: s.createdAt.toISOString(),
  };
}

// ============================================================
// Current structure + full revision history for one employee.
// ============================================================
export async function getEmployeeCompensation(
  employeeId: string,
): Promise<{ current: SalaryStructureRow | null; history: SalaryStructureRow[] }> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { current: null, history: [] };

  const rows = await prisma.hrSalaryStructure.findMany({
    where: { employeeId },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
  const history = rows.map(serialize);
  const current = history.find((r) => r.isCurrent) ?? null;
  return { current, history };
}

// ============================================================
// Save a new salary structure revision. Resolves the monthly breakdown from
// the active pay components, supersedes the prior current row, inserts the new
// one as current — all in one transaction.
// ============================================================
export interface SaveSalaryStructureInput {
  annualCtc: number;
  basicPct: number;
  effectiveFrom: string; // yyyy-mm-dd
  note?: string;
}

export async function saveSalaryStructure(
  employeeId: string,
  input: SaveSalaryStructureInput,
): Promise<Result<SalaryStructureRow>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const annualCtc = Number(input.annualCtc);
  const basicPct = Number(input.basicPct);
  if (!Number.isFinite(annualCtc) || annualCtc <= 0) {
    return { success: false, error: "Enter a valid annual CTC." };
  }
  if (!Number.isFinite(basicPct) || basicPct <= 0 || basicPct > 100) {
    return { success: false, error: "Basic % must be between 1 and 100." };
  }
  if (!input.effectiveFrom) return { success: false, error: "Effective-from date is required." };

  // Read active pay components and map them into engine defs.
  const components = await prisma.hrPayComponent.findMany({
    where: { entityId: DEFAULT_ENTITY, active: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  const defs: PayComponentDef[] = components.map((c) => ({
    code: c.code,
    name: c.name,
    kind: c.kind,
    calcType: c.calcType,
    rate: Number(c.rate),
    taxable: c.taxable,
    partOfCtc: c.partOfCtc,
    statutory: c.statutory,
    order: c.order,
  }));

  const monthlyCtc = Math.round((annualCtc / 12) * 100) / 100;
  const lines = buildStructureLines(monthlyCtc, basicPct, defs);

  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.hrSalaryStructure.updateMany({
        where: { employeeId, isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.hrSalaryStructure.create({
        data: {
          employeeId,
          effectiveFrom: utcDate(input.effectiveFrom),
          annualCtc: new Prisma.Decimal(annualCtc),
          monthlyCtc: new Prisma.Decimal(monthlyCtc),
          basicPct: Math.round(basicPct),
          note: input.note?.trim() || null,
          lines: lines as unknown as Prisma.InputJsonValue,
          isCurrent: true,
          createdById: u?.id ?? null,
        },
      });
    });
    revalidatePath(`/people/${employeeId}`);
    return { success: true, data: serialize(row) };
  } catch {
    return { success: false, error: "Could not save the salary structure." };
  }
}
