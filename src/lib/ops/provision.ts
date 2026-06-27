// ============================================================
// Event-ops provisioning — stand up EVERY team's workspace when a booking is
// confirmed, off one EventOperation aggregate root.
// ------------------------------------------------------------
// Previously confirmation only created an ExecutionPlan + a BEO; Kitchen,
// Procurement, Logistics and the EventOperation hub itself were left for
// someone to create by hand. This orchestrator provisions all of them from the
// matched SOP template's seeds and links each child to the operation root, so
// "confirm a booking → every team is triggered and assigned" is actually true.
//
// Guarantees:
//   • Idempotent — every step is findFirst-before-create; a re-run fills only
//     the gaps. Safe to call from the confirm path AND the reconcile cron.
//   • Gap-filling on partial failure — each step has its own try; a failure is
//     collected and rethrown at the end (so the caller can escalate), but the
//     steps that DID succeed persist, and opsProvisionedAt is only stamped when
//     the whole run is clean — so reconcile keeps retrying until it is.
//   • Never silent — the caller (confirm path / cron) escalates on throw.
// ============================================================

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { instantiateExecutionPlanFromSOP } from "@/lib/sales/ops-handoff";
import type { OpsAssignment } from "@/lib/sales/ops-assignment";

export interface ProvisionSummary {
  operationId: string;
  alreadyProvisioned: boolean;
  created: {
    operation: boolean;
    executionPlan: boolean;
    beo: boolean;
    kitchen: boolean;
    requisitions: number;
    dispatch: boolean;
    vendors: number;
  };
  assignments: OpsAssignment[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// --- SOP template selection (mirrors ops-handoff: event-type → default → any).
async function selectTemplate(eventType?: string | null) {
  const evt = eventType || undefined;
  return (
    (evt
      ? await prisma.sOPTemplate.findFirst({
          where: { isActive: true, eventType: { equals: evt, mode: "insensitive" } },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          select: { id: true, kitchenSeed: true, procurementSeed: true, dispatchSeed: true, beoDefaults: true },
        })
      : null) ??
    (await prisma.sOPTemplate.findFirst({
      where: { isActive: true, isDefault: true },
      select: { id: true, kitchenSeed: true, procurementSeed: true, dispatchSeed: true, beoDefaults: true },
    })) ??
    (await prisma.sOPTemplate.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, kitchenSeed: true, procurementSeed: true, dispatchSeed: true, beoDefaults: true },
    }))
  );
}

// --- Sequential document-number allocation (count()+attempt, P2002-retry).
async function createWithNumber<T>(
  prefix: string,
  countMatch: string,
  countFn: (where: { startsWith: string }) => Promise<number>,
  createFn: (num: string) => Promise<T>
): Promise<T> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const n = await countFn({ startsWith: `${prefix}-${year}-` });
    const num = `${prefix}-${year}-${String(n + 1 + attempt).padStart(3, "0")}`;
    try {
      return await createFn(num);
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") continue; // number raced — retry
      throw e;
    }
  }
  throw new Error(`Could not allocate a ${prefix} number after retries (${countMatch}).`);
}

/** Ensure the EventOperation root exists for a booking (idempotent). */
async function ensureOperation(
  bookingId: string,
  createdById: string
): Promise<{ id: string; opsProvisionedAt: Date | null; created: boolean }> {
  const existing = await prisma.eventOperation.findUnique({
    where: { bookingId },
    select: { id: true, opsProvisionedAt: true },
  });
  if (existing) return { ...existing, created: false };
  try {
    const op = await prisma.eventOperation.create({
      data: { bookingId, createdById, status: "PLANNING" },
      select: { id: true, opsProvisionedAt: true },
    });
    return { ...op, created: true };
  } catch (e) {
    // Lost a create race (bookingId @unique) — re-read the winner.
    if ((e as { code?: string })?.code === "P2002") {
      const op = await prisma.eventOperation.findUnique({
        where: { bookingId },
        select: { id: true, opsProvisionedAt: true },
      });
      if (op) return { ...op, created: false };
    }
    throw e;
  }
}

interface KitchenSeedItem { name: string; category?: string; quantity?: number; unit?: string; estUnitCost?: number }

interface BookingMenu {
  items: { name: string; category: string; quantity: number; unit: string; estUnitCost: number }[];
  estFoodCost: number;
  menuNotes: string;
}

/**
 * The kitchen team needs THIS customer's actual menu, not a generic template.
 * Pull the F&B lines (Food / Cake / Drinks) from the booking's frozen quotation
 * snapshot and turn them into kitchen-plan items + a readable BEO menu note.
 * Returns null when there's no quotation / no F&B (caller falls back to the
 * template's kitchenSeed). Never throws.
 */
async function loadBookingMenu(bookingId: string, covers: number): Promise<BookingMenu | null> {
  try {
    const q = await prisma.salesQuotation.findFirst({
      where: { bookingId },
      orderBy: { updatedAt: "desc" },
      select: { outputsJson: true, inputsJson: true, guestCount: true },
    });
    const out = q?.outputsJson as unknown as { lines?: { particulars: string; plan: string; amount: number }[] } | null;
    const lines = Array.isArray(out?.lines) ? out!.lines : [];
    if (lines.length === 0) return null;

    const input = (q?.inputsJson ?? {}) as { cakeKg?: number };
    const guests = Math.max(1, covers || q?.guestCount || 1);
    const FNB: Record<string, string> = { "Food Plan": "Food", "Cake Plan": "Cake", "Drinks Plan": "Drinks" };

    const items: BookingMenu["items"] = [];
    for (const l of lines) {
      const cat = FNB[l.particulars];
      if (!cat || !(Number(l.amount) > 0)) continue;
      let quantity = guests;
      let unit = "plate";
      if (cat === "Cake") { quantity = Math.max(1, Number(input.cakeKg) || 1); unit = "kg"; }
      const estUnitCost = round2(Number(l.amount) / quantity);
      const name = l.plan && l.plan !== "—" ? `${cat}: ${l.plan}` : cat;
      items.push({ name, category: cat, quantity, unit, estUnitCost });
    }
    if (items.length === 0) return null;

    const estFoodCost = round2(items.reduce((s, it) => s + it.quantity * it.estUnitCost, 0));
    const menuNotes =
      `Menu for ${guests} guests (from the customer's quotation):\n` +
      items.map((it) => `• ${it.name} — ${it.quantity} ${it.unit}`).join("\n");
    return { items, estFoodCost, menuNotes };
  } catch {
    return null;
  }
}
interface ProcurementSeedItem { name: string; quantity?: number; unit?: string; unitPrice?: number }
interface ProcurementSeed { title: string; department?: string; neededByOffsetDays?: number; items?: ProcurementSeedItem[] }
interface DispatchSeed { fromLocation?: string; toLocation?: string; items?: { name: string; quantity?: number; returnable?: boolean }[] }
interface BeoDefaults {
  menuNotes?: string; floorPlanNotes?: string; avNotes?: string;
  decorNotes?: string; staffingNotes?: string; specialInstructions?: string;
}

/**
 * Provision (or finish provisioning) every team workspace for a confirmed
 * booking. Idempotent + gap-filling. Throws (after persisting what it could) if
 * any step fails, so the caller escalates and the reconcile cron retries.
 */
export async function provisionEventOperations(
  bookingId: string,
  createdById: string,
  eventType?: string | null
): Promise<ProvisionSummary> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, date: true, eventType: true, guestCount: true },
  });
  if (!booking) throw new Error(`Booking ${bookingId} not found for ops provisioning.`);

  const op = await ensureOperation(bookingId, createdById);
  const summary: ProvisionSummary = {
    operationId: op.id,
    alreadyProvisioned: !!op.opsProvisionedAt,
    created: { operation: op.created, executionPlan: false, beo: false, kitchen: false, requisitions: 0, dispatch: false, vendors: 0 },
    assignments: [],
  };
  if (op.opsProvisionedAt) return summary; // fully done already — fast idempotent exit

  const template = await selectTemplate(eventType || booking.eventType);
  // The customer's actual chosen menu (from their quotation) drives the kitchen
  // plan + BEO menu note — so the kitchen team gets THE order, not a template.
  const bookingMenu = await loadBookingMenu(bookingId, booking.guestCount ?? 0);
  const errors: string[] = [];

  // 1) Execution plan + tasks (existing engine; idempotent) → then link to root.
  try {
    summary.assignments = await instantiateExecutionPlanFromSOP(bookingId, createdById, eventType || booking.eventType);
    const linked = await prisma.executionPlan.updateMany({
      where: { bookingId, operationId: null },
      data: { operationId: op.id },
    });
    summary.created.executionPlan = linked.count > 0 || summary.assignments.length > 0;
  } catch (e) {
    errors.push(`execution plan: ${(e as Error).message}`);
  }

  // 2) BEO / function sheet (one per booking) seeded from template defaults.
  try {
    const existing = await prisma.beo.findFirst({ where: { bookingId }, select: { id: true, operationId: true } });
    if (existing) {
      if (!existing.operationId)
        await prisma.beo.update({ where: { id: existing.id }, data: { operationId: op.id } });
    } else {
      const d = (template?.beoDefaults ?? null) as BeoDefaults | null;
      // Prefer the customer's actual menu for the function sheet; fall back to
      // the template's standard menu note.
      const menuNotes = bookingMenu?.menuNotes ?? d?.menuNotes ?? null;
      await createWithNumber(
        "BEO",
        bookingId,
        (w) => prisma.beo.count({ where: { beoNumber: w } }),
        (beoNumber) =>
          prisma.beo.create({
            data: {
              beoNumber, bookingId, operationId: op.id, status: "DRAFT", covers: booking.guestCount ?? null, createdById,
              menuNotes, floorPlanNotes: d?.floorPlanNotes, avNotes: d?.avNotes,
              decorNotes: d?.decorNotes, staffingNotes: d?.staffingNotes, specialInstructions: d?.specialInstructions,
            },
          })
      );
      summary.created.beo = true;
    }
  } catch (e) {
    errors.push(`BEO: ${(e as Error).message}`);
  }

  // 3) Kitchen plan (one per booking): the customer's ACTUAL menu from their
  //    quotation drives it; only if there's no quotation menu do we fall back to
  //    the template's standard kitchenSeed.
  try {
    const existing = await prisma.kitchenPlan.findFirst({ where: { bookingId }, select: { id: true, operationId: true } });
    if (existing) {
      if (!existing.operationId)
        await prisma.kitchenPlan.update({ where: { id: existing.id }, data: { operationId: op.id } });
    } else {
      const seedItems = (template?.kitchenSeed as unknown as KitchenSeedItem[] | null) ?? [];
      const menuItems = bookingMenu?.items ?? seedItems.map((it) => ({
        name: it.name, category: it.category ?? "Food", quantity: Number(it.quantity) || 0,
        unit: it.unit ?? "unit", estUnitCost: round2(Number(it.estUnitCost) || 0),
      }));
      if (menuItems.length > 0) {
        const est = bookingMenu?.estFoodCost
          ?? round2(menuItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.estUnitCost) || 0), 0));
        await prisma.kitchenPlan.create({
          data: {
            bookingId, operationId: op.id, covers: booking.guestCount ?? 0, status: "PLANNED", estFoodCost: est, createdById,
            notes: bookingMenu ? "Auto-generated from the customer's quotation menu." : "Auto-generated from the SOP template.",
            items: {
              create: menuItems.map((it) => ({
                name: it.name, category: it.category ?? null, quantity: Number(it.quantity) || 0,
                unit: it.unit ?? null, estUnitCost: round2(Number(it.estUnitCost) || 0),
              })),
            },
          },
        });
        summary.created.kitchen = true;
      }
    }
  } catch (e) {
    errors.push(`kitchen: ${(e as Error).message}`);
  }

  // 4) Procurement requisitions from procurementSeed (one PR per seed title).
  try {
    const seeds = (template?.procurementSeed as unknown as ProcurementSeed[] | null) ?? [];
    for (const seed of seeds) {
      const exists = await prisma.purchaseRequisition.findFirst({
        where: { bookingId, title: seed.title }, select: { id: true },
      });
      if (exists) continue;
      const items = seed.items ?? [];
      const total = round2(items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0));
      const neededBy = seed.neededByOffsetDays != null
        ? new Date(new Date(booking.date).getTime() - seed.neededByOffsetDays * 86400000)
        : null;
      await createWithNumber(
        "PR",
        bookingId,
        (w) => prisma.purchaseRequisition.count({ where: { prNumber: w } }),
        (prNumber) =>
          prisma.purchaseRequisition.create({
            data: {
              prNumber, title: seed.title, status: "PENDING", bookingId, operationId: op.id,
              department: seed.department ?? null, neededBy, totalAmount: total, requestedById: createdById,
              items: {
                create: items.map((it) => ({
                  name: it.name, quantity: Number(it.quantity) || 0, unit: it.unit ?? null,
                  unitPrice: round2(Number(it.unitPrice) || 0),
                })),
              },
            },
          })
      );
      summary.created.requisitions++;
    }
  } catch (e) {
    errors.push(`procurement: ${(e as Error).message}`);
  }

  // 5) Dispatch order(s) from dispatchSeed.
  try {
    const seeds = (template?.dispatchSeed as unknown as DispatchSeed[] | null) ?? [];
    for (const seed of seeds) {
      const exists = await prisma.dispatchOrder.findFirst({
        where: { bookingId, toLocation: seed.toLocation ?? null }, select: { id: true },
      });
      if (exists) continue;
      const items = seed.items ?? [];
      await createWithNumber(
        "DSP",
        bookingId,
        (w) => prisma.dispatchOrder.count({ where: { dispatchNumber: w } }),
        (dispatchNumber) =>
          prisma.dispatchOrder.create({
            data: {
              dispatchNumber, bookingId, operationId: op.id, status: "PLANNED",
              fromLocation: seed.fromLocation ?? null, toLocation: seed.toLocation ?? null,
              scheduledAt: booking.date, createdById,
              items: {
                create: items.map((it) => ({
                  name: it.name, quantity: Number(it.quantity) || 0, returnable: !!it.returnable,
                })),
              },
            },
          })
      );
      summary.created.dispatch = true;
    }
  } catch (e) {
    errors.push(`logistics: ${(e as Error).message}`);
  }

  // 6) Vendor assignment records (NOTIFIED) for every vendor on the booking.
  try {
    const bookingVendors = await prisma.bookingVendor.findMany({
      where: { bookingId }, select: { id: true },
    });
    for (const bv of bookingVendors) {
      const exists = await prisma.operationVendorAssignment.findFirst({
        where: { operationId: op.id, bookingVendorId: bv.id }, select: { id: true },
      });
      if (exists) continue;
      await prisma.operationVendorAssignment.create({
        data: { operationId: op.id, bookingVendorId: bv.id, status: "NOTIFIED", respondToken: randomUUID().replace(/-/g, "") },
      });
      summary.created.vendors++;
    }
  } catch (e) {
    errors.push(`vendors: ${(e as Error).message}`);
  }

  if (errors.length > 0) {
    await prisma.eventOperation
      .update({ where: { id: op.id }, data: { provisioningError: errors.join(" | ").slice(0, 1000) } })
      .catch(() => {});
    throw new Error(`Ops provisioning incomplete for booking ${bookingId}: ${errors.join(" | ")}`);
  }

  // Clean run — stamp the provisioning flag so the backstop skips this booking.
  await prisma.eventOperation.update({
    where: { id: op.id },
    data: { opsProvisionedAt: new Date(), provisioningError: null },
  });
  return summary;
}

export interface ReconcileResult {
  scanned: number;
  reprovisioned: number;
  failed: { bookingId: string; error: string }[];
}

/**
 * Backstop: find CONFIRMED/IN_PROGRESS bookings whose ops were never fully
 * provisioned (no EventOperation, or one with opsProvisionedAt still null) and
 * re-run provisioning. The cron route escalates via reportSystemFailure when
 * any booking still fails after this pass.
 */
export async function reconcileOpsProvisioning(limit = 50): Promise<ReconcileResult> {
  // Bookings that are live but have no fully-provisioned operation.
  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      OR: [{ operation: { is: null } }, { operation: { opsProvisionedAt: null } }],
    },
    select: { id: true, createdById: true, eventType: true },
    orderBy: { date: "asc" },
    take: limit,
  });

  const result: ReconcileResult = { scanned: candidates.length, reprovisioned: 0, failed: [] };
  for (const b of candidates) {
    try {
      const s = await provisionEventOperations(b.id, b.createdById, b.eventType);
      if (!s.alreadyProvisioned) result.reprovisioned++;
    } catch (e) {
      result.failed.push({ bookingId: b.id, error: (e as Error).message });
    }
  }
  return result;
}
