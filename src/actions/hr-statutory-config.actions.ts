"use server";

// ============================================================
// Per-entity statutory configuration (Config → Company → PF / ESI / PT / LWF).
// ------------------------------------------------------------
// These values drive every payslip's statutory maths, so writes are gated on
// hr:admin and audited. Reads are gated on hr:payroll (the payroll surface).
// A missing config row is NOT an error — the engine falls back to the code
// defaults, which is what every existing run already used.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) return null;
  return s.user as { id: string; role?: string };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

export interface StatutoryConfigInput {
  legalEntityId: string;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  tdsApplicable: boolean;
  lwfApplicable: boolean;
  pfRatePct: number;
  pfWageCeiling: number;
  pfOnFullBasic: boolean;
  employerPfRatePct: number;
  epsApplicable: boolean;
  epsRatePct: number;
  epsWageCeiling: number;
  edliRatePct: number;
  edliWageCeiling: number;
  pfAdminRatePct: number;
  esiRatePct: number;
  employerEsiRatePct: number;
  esiGrossCeiling: number;
  esiMinDailyWage: number;
  ptState?: string | null;
  ptAmount: number;
  ptGrossThreshold: number;
  lwfState?: string | null;
  lwfEmployee: number;
  lwfEmployer: number;
  lwfMonths: number[];
  gratuityDaysPerYear: number;
  gratuityMonthDivisor: number;
  gratuityMinYears: number;
}

export interface PtSlabInput {
  fromSalary: number;
  toSalary: number | null;
  ptAmount: number;
  additionalAmount: number;
}

/** Read the persisted config for an entity (null when unconfigured). Gate: hr:payroll. */
export async function getStatutoryConfig(legalEntityId: string) {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return null;
  return prisma.hrStatutoryConfig.findUnique({
    where: { legalEntityId },
    include: { ptSlabs: { orderBy: { order: "asc" } } },
  });
}

/** Every legal entity + whether it has a statutory config yet. Gate: hr:payroll. */
export async function listEntitiesWithConfig() {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return [];
  const entities = await prisma.legalEntity.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { id: true, name: true, shortCode: true, statutoryConfig: { select: { id: true, updatedAt: true } } },
  });
  return entities.map((e) => ({
    id: e.id,
    name: e.name,
    shortCode: e.shortCode,
    configured: !!e.statutoryConfig,
    updatedAt: e.statutoryConfig?.updatedAt ?? null,
  }));
}

/** Reject values that would silently corrupt every payslip. */
function validate(input: StatutoryConfigInput): string | null {
  const pct = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
  const amt = (n: number) => Number.isFinite(n) && n >= 0;

  if (!input.legalEntityId) return "Pick a legal entity.";
  if (!pct(input.pfRatePct) || !pct(input.employerPfRatePct) || !pct(input.epsRatePct))
    return "PF rates must be between 0 and 100.";
  if (!pct(input.edliRatePct) || !pct(input.pfAdminRatePct)) return "EDLI / admin rates must be between 0 and 100.";
  if (!pct(input.esiRatePct) || !pct(input.employerEsiRatePct)) return "ESI rates must be between 0 and 100.";
  // EPS is carved OUT of the employer's PF share — it can never exceed it, or the
  // EPF leg would go negative.
  if (input.epsApplicable && input.epsRatePct > input.employerPfRatePct)
    return "The pension (EPS) rate cannot exceed the employer PF rate.";
  if (![input.pfWageCeiling, input.epsWageCeiling, input.edliWageCeiling, input.esiGrossCeiling, input.esiMinDailyWage, input.ptAmount, input.ptGrossThreshold, input.lwfEmployee, input.lwfEmployer].every(amt))
    return "Ceilings and amounts must be zero or positive.";
  if (input.gratuityDaysPerYear <= 0 || input.gratuityMonthDivisor <= 0)
    return "Gratuity days/divisor must be positive.";
  if (input.gratuityMinYears < 0) return "Gratuity minimum years cannot be negative.";
  if (input.lwfMonths.some((m) => !Number.isInteger(m) || m < 1 || m > 12))
    return "LWF months must be calendar months 1–12.";
  return null;
}

/** Create or update an entity's statutory config. Gate: hr:admin. Audited. */
export async function upsertStatutoryConfig(input: StatutoryConfigInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const bad = validate(input);
  if (bad) return { success: false, error: bad };

  const entity = await prisma.legalEntity.findUnique({ where: { id: input.legalEntityId }, select: { id: true } });
  if (!entity) return { success: false, error: "That legal entity no longer exists." };

  const d = (n: number) => new Prisma.Decimal(n);
  const data = {
    pfApplicable: input.pfApplicable,
    esiApplicable: input.esiApplicable,
    ptApplicable: input.ptApplicable,
    tdsApplicable: input.tdsApplicable,
    lwfApplicable: input.lwfApplicable,
    pfRatePct: d(input.pfRatePct),
    pfWageCeiling: d(input.pfWageCeiling),
    pfOnFullBasic: input.pfOnFullBasic,
    employerPfRatePct: d(input.employerPfRatePct),
    epsApplicable: input.epsApplicable,
    epsRatePct: d(input.epsRatePct),
    epsWageCeiling: d(input.epsWageCeiling),
    edliRatePct: d(input.edliRatePct),
    edliWageCeiling: d(input.edliWageCeiling),
    pfAdminRatePct: d(input.pfAdminRatePct),
    esiRatePct: d(input.esiRatePct),
    employerEsiRatePct: d(input.employerEsiRatePct),
    esiGrossCeiling: d(input.esiGrossCeiling),
    esiMinDailyWage: d(input.esiMinDailyWage),
    ptState: input.ptState?.trim() || null,
    ptAmount: d(input.ptAmount),
    ptGrossThreshold: d(input.ptGrossThreshold),
    lwfState: input.lwfState?.trim() || null,
    lwfEmployee: d(input.lwfEmployee),
    lwfEmployer: d(input.lwfEmployer),
    lwfMonths: input.lwfMonths,
    gratuityDaysPerYear: input.gratuityDaysPerYear,
    gratuityMonthDivisor: input.gratuityMonthDivisor,
    gratuityMinYears: input.gratuityMinYears,
  };

  const row = await prisma.hrStatutoryConfig.upsert({
    where: { legalEntityId: input.legalEntityId },
    create: { legalEntityId: input.legalEntityId, ...data },
    update: data,
    select: { id: true },
  });

  await prisma.activityLog.create({
    data: {
      action: "STATUTORY_CONFIG_UPDATED",
      entityType: "LEGAL_ENTITY",
      entityId: input.legalEntityId,
      userId: u!.id,
      changes: data as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/people/payroll/statutory-config");
  return { success: true, data: { id: row.id } };
}

/** Replace an entity's PT slab table wholesale. Gate: hr:admin. Audited. */
export async function replacePtSlabs(legalEntityId: string, slabs: PtSlabInput[]): Promise<Result<{ count: number }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const cfg = await prisma.hrStatutoryConfig.findUnique({ where: { legalEntityId }, select: { id: true } });
  if (!cfg) return { success: false, error: "Save the statutory config for this entity first." };

  for (const s of slabs) {
    if (!Number.isFinite(s.fromSalary) || s.fromSalary < 0) return { success: false, error: "Slab 'from' must be zero or positive." };
    if (s.toSalary != null && s.toSalary < s.fromSalary) return { success: false, error: "Slab 'to' cannot be below 'from'." };
    if (!Number.isFinite(s.ptAmount) || s.ptAmount < 0) return { success: false, error: "Slab PT amount must be zero or positive." };
  }
  // Overlapping bands would make the resolved PT depend on row order — reject.
  const sorted = [...slabs].sort((a, b) => a.fromSalary - b.fromSalary);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (prev.toSalary == null || sorted[i].fromSalary <= prev.toSalary) {
      return { success: false, error: "Slab bands overlap. Each band must start above the previous band's 'to'." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.hrPtSlab.deleteMany({ where: { configId: cfg.id } });
    if (sorted.length) {
      await tx.hrPtSlab.createMany({
        data: sorted.map((s, i) => ({
          configId: cfg.id,
          fromSalary: new Prisma.Decimal(s.fromSalary),
          toSalary: s.toSalary == null ? null : new Prisma.Decimal(s.toSalary),
          ptAmount: new Prisma.Decimal(s.ptAmount),
          additionalAmount: new Prisma.Decimal(s.additionalAmount ?? 0),
          order: i,
        })),
      });
    }
    await tx.activityLog.create({
      data: {
        action: "PT_SLABS_REPLACED", entityType: "LEGAL_ENTITY", entityId: legalEntityId, userId: u!.id,
        changes: { count: sorted.length } as unknown as Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath("/people/payroll/statutory-config");
  return { success: true, data: { count: sorted.length } };
}
