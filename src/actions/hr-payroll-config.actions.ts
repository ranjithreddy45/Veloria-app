"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma, HrPayComponentKind, HrPayCalcType, HrStatutoryType } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

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

// Pay components are configured per legal entity. We default to the primary
// entity; the schema default matches this so single-entity setups just work.
const DEFAULT_ENTITY = "BILLION";

/** A pay component serialised for the client (Decimal rate -> number). */
export interface PayComponentRow {
  id: string;
  entityId: string;
  code: string;
  name: string;
  kind: HrPayComponentKind;
  calcType: HrPayCalcType;
  rate: number;
  taxable: boolean;
  partOfCtc: boolean;
  statutory: HrStatutoryType;
  order: number;
  active: boolean;
}

function serialize(c: {
  id: string; entityId: string; code: string; name: string;
  kind: HrPayComponentKind; calcType: HrPayCalcType; rate: Prisma.Decimal;
  taxable: boolean; partOfCtc: boolean; statutory: HrStatutoryType; order: number; active: boolean;
}): PayComponentRow {
  return {
    id: c.id,
    entityId: c.entityId,
    code: c.code,
    name: c.name,
    kind: c.kind,
    calcType: c.calcType,
    rate: Number(c.rate),
    taxable: c.taxable,
    partOfCtc: c.partOfCtc,
    statutory: c.statutory,
    order: c.order,
    active: c.active,
  };
}

// ============================================================
// List pay components for an entity (active + inactive, ordered).
// ============================================================
export async function listPayComponents(entityId: string = DEFAULT_ENTITY): Promise<PayComponentRow[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return [];
  const rows = await prisma.hrPayComponent.findMany({
    where: { entityId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(serialize);
}

// ============================================================
// Create or update a pay component. Code is unique per entity.
// ============================================================
export interface UpsertPayComponentInput {
  id?: string;
  entityId?: string;
  code: string;
  name: string;
  kind: HrPayComponentKind;
  calcType: HrPayCalcType;
  rate: number;
  taxable: boolean;
  partOfCtc: boolean;
  statutory?: HrStatutoryType;
  order?: number;
  active?: boolean;
}

export async function upsertPayComponent(input: UpsertPayComponentInput): Promise<Result<PayComponentRow>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const entityId = input.entityId?.trim() || DEFAULT_ENTITY;
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code) return { success: false, error: "Component code is required." };
  if (!name) return { success: false, error: "Component name is required." };

  const rate = Number.isFinite(input.rate) ? Math.max(0, input.rate) : 0;

  const data = {
    entityId,
    code,
    name,
    kind: input.kind,
    calcType: input.calcType,
    rate: new Prisma.Decimal(rate),
    taxable: input.taxable,
    partOfCtc: input.partOfCtc,
    statutory: input.statutory ?? HrStatutoryType.NONE,
    order: Number.isFinite(input.order) ? Number(input.order) : 0,
    active: input.active ?? true,
  };

  try {
    let row;
    if (input.id) {
      row = await prisma.hrPayComponent.update({ where: { id: input.id }, data });
    } else {
      // Guard against duplicate code within the entity.
      const existing = await prisma.hrPayComponent.findUnique({
        where: { entityId_code: { entityId, code } },
      });
      if (existing) return { success: false, error: `A component with code "${code}" already exists.` };
      row = await prisma.hrPayComponent.create({ data });
    }
    revalidatePath("/people/payroll/settings");
    return { success: true, data: serialize(row) };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: `A component with code "${code}" already exists.` };
    }
    return { success: false, error: "Could not save the pay component." };
  }
}

// ============================================================
// Activate / deactivate a component (never hard-delete — structures snapshot).
// ============================================================
export async function togglePayComponent(id: string, active: boolean): Promise<Result<PayComponentRow>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };
  try {
    const row = await prisma.hrPayComponent.update({ where: { id }, data: { active } });
    revalidatePath("/people/payroll/settings");
    return { success: true, data: serialize(row) };
  } catch {
    return { success: false, error: "Could not update the component." };
  }
}

// ============================================================
// Seed sensible Indian earning heads (idempotent). Statutory PF/ESI/PT/TDS
// are computed by the engine — they are NOT seeded as components here.
// ============================================================
export async function seedDefaultPayComponents(
  entityId: string = DEFAULT_ENTITY,
): Promise<Result<{ created: number }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:payroll")) return { success: false, error: "Not authorized." };

  const defaults: Array<Omit<UpsertPayComponentInput, "id" | "entityId">> = [
    { code: "HRA", name: "House Rent Allowance", kind: HrPayComponentKind.EARNING, calcType: HrPayCalcType.PCT_OF_BASIC, rate: 40, taxable: true, partOfCtc: true, statutory: HrStatutoryType.NONE, order: 10 },
    { code: "CONVEYANCE", name: "Conveyance Allowance", kind: HrPayComponentKind.EARNING, calcType: HrPayCalcType.FLAT, rate: 1600, taxable: true, partOfCtc: true, statutory: HrStatutoryType.NONE, order: 20 },
    { code: "MEDICAL", name: "Medical Allowance", kind: HrPayComponentKind.EARNING, calcType: HrPayCalcType.FLAT, rate: 1250, taxable: true, partOfCtc: true, statutory: HrStatutoryType.NONE, order: 30 },
    { code: "SPECIAL", name: "Special Allowance", kind: HrPayComponentKind.EARNING, calcType: HrPayCalcType.BALANCE, rate: 0, taxable: true, partOfCtc: true, statutory: HrStatutoryType.NONE, order: 90 },
  ];

  let created = 0;
  for (const d of defaults) {
    const existing = await prisma.hrPayComponent.findUnique({
      where: { entityId_code: { entityId, code: d.code } },
    });
    if (existing) continue;
    await prisma.hrPayComponent.create({
      data: {
        entityId,
        code: d.code,
        name: d.name,
        kind: d.kind,
        calcType: d.calcType,
        rate: new Prisma.Decimal(d.rate),
        taxable: d.taxable,
        partOfCtc: d.partOfCtc,
        statutory: d.statutory ?? HrStatutoryType.NONE,
        order: d.order ?? 0,
        active: true,
      },
    });
    created++;
  }
  revalidatePath("/people/payroll/settings");
  return { success: true, data: { created } };
}
