"use server";

// ============================================================
// Finance — Fixed Assets & Profitability.
// Asset register + a straight-line depreciation run that POSTS a balanced
// journal to the GL (Dep expense "5500" Dr / Accumulated depreciation "1590" Cr),
// plus venue/event P&L derived from posted journal lines.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { postWithinTx, fyForDate, periodForDate } from "@/lib/finance/ledger";
import { FIN_ACCOUNT_CODES } from "@/lib/finance/coa-seed";

const DEP_EXPENSE_CODE = FIN_ACCOUNT_CODES.depreciation ?? "5500";
const ACCUM_DEP_CODE = "1590";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

function canRead(role?: string) {
  return !!role && hasPermission(role, "finance:read");
}
function canWrite(role?: string) {
  return !!role && WRITE_ROLES.includes(role);
}

const n = (v: unknown) => Number(v ?? 0);

// ============================================================
// Reads
// ============================================================

export async function getAssets() {
  const u = await requireUser();
  if (!canRead(u?.role)) return [];

  const assets = await prisma.finAsset.findMany({
    orderBy: { createdAt: "desc" },
  });

  return assets.map((a) => {
    const cost = n(a.cost);
    const salvage = n(a.salvageValue);
    const accumulated = n(a.accumulatedDep);
    return {
      id: a.id,
      name: a.name,
      category: a.category ?? null,
      cost,
      salvageValue: salvage,
      purchaseDate: a.purchaseDate.toISOString(),
      usefulLifeMonths: a.usefulLifeMonths,
      method: a.method,
      accumulatedDep: accumulated,
      netBookValue: cost - accumulated,
      status: a.status,
      venueId: a.venueId ?? null,
    };
  });
}

export async function getVenueEventPnl() {
  const u = await requireUser();
  if (!canRead(u?.role)) return { byVenue: [], byEvent: [] };

  // Income = credit − debit; Expense = debit − credit. Posted entries only.
  const lines = await prisma.finJournalLine.findMany({
    where: { entry: { status: "POSTED" } },
    select: {
      debit: true,
      credit: true,
      venueId: true,
      eventId: true,
      account: { select: { type: true } },
    },
  });

  type Bucket = { income: number; expense: number };
  const venueMap = new Map<string, Bucket>();
  const eventMap = new Map<string, Bucket>();

  for (const l of lines) {
    const debit = n(l.debit);
    const credit = n(l.credit);
    const type = l.account?.type;
    if (!type) continue; // skip any line with a dangling account join

    const apply = (map: Map<string, Bucket>, key: string) => {
      const b = map.get(key) ?? { income: 0, expense: 0 };
      if (type === "INCOME") b.income += credit - debit;
      else if (type === "EXPENSE") b.expense += debit - credit;
      map.set(key, b);
    };

    if (l.venueId && (type === "INCOME" || type === "EXPENSE")) apply(venueMap, l.venueId);
    if (l.eventId && (type === "INCOME" || type === "EXPENSE")) apply(eventMap, l.eventId);
  }

  const toRows = (map: Map<string, Bucket>, key: "venueId" | "eventId") =>
    Array.from(map.entries())
      .map(([id, b]) => ({ [key]: id, income: b.income, expense: b.expense, net: b.income - b.expense }))
      .sort((a, b) => (b as { net: number }).net - (a as { net: number }).net);

  return {
    byVenue: toRows(venueMap, "venueId") as { venueId: string; income: number; expense: number; net: number }[],
    byEvent: toRows(eventMap, "eventId") as { eventId: string; income: number; expense: number; net: number }[],
  };
}

// ============================================================
// Writes
// ============================================================

export async function createAsset(input: {
  name: string;
  category?: string;
  cost: number;
  salvageValue?: number;
  purchaseDate: string;
  usefulLifeMonths: number;
  venueId?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Name is required." };

  const cost = Number(input.cost);
  if (!Number.isFinite(cost) || cost <= 0) return { success: false, error: "Cost must be a positive amount." };

  const salvage = Number(input.salvageValue ?? 0);
  if (!Number.isFinite(salvage) || salvage < 0) return { success: false, error: "Salvage value cannot be negative." };
  if (salvage >= cost) return { success: false, error: "Salvage value must be less than cost." };

  const life = Number(input.usefulLifeMonths);
  if (!Number.isInteger(life) || life <= 0) return { success: false, error: "Useful life (months) must be a positive whole number." };

  const purchaseDate = new Date(input.purchaseDate);
  if (isNaN(purchaseDate.getTime())) return { success: false, error: "Invalid purchase date." };

  const asset = await prisma.finAsset.create({
    data: {
      name,
      category: input.category?.trim() || null,
      cost,
      salvageValue: salvage,
      purchaseDate,
      usefulLifeMonths: life,
      venueId: input.venueId?.trim() || null,
      createdById: u!.id,
    },
  });

  revalidatePath("/finance/assets");
  return { success: true, data: { id: asset.id } };
}

export async function runDepreciation(assetId: string): Promise<Result<{ amount: number; fullyDepreciated: boolean }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  const asset = await prisma.finAsset.findUnique({ where: { id: assetId } });
  if (!asset) return { success: false, error: "Asset not found." };
  if (asset.status === "DISPOSED") return { success: false, error: "Asset is disposed." };
  if (asset.status === "FULLY_DEPRECIATED") return { success: false, error: "Asset is already fully depreciated." };

  // Fixed-point: do ALL depreciation arithmetic in integer paise so that
  // accumulated depreciation cannot drift across many months and the asset
  // settles to exactly its depreciable base on the final charge.
  const toPaise = (v: number) => Math.round(v * 100);
  const costP = toPaise(n(asset.cost));
  const salvageP = toPaise(n(asset.salvageValue));
  const accumulatedP = toPaise(n(asset.accumulatedDep));
  const depreciableBaseP = costP - salvageP;
  const remainingP = depreciableBaseP - accumulatedP;

  if (remainingP <= 0) {
    await prisma.finAsset.update({ where: { id: asset.id }, data: { status: "FULLY_DEPRECIATED" } });
    revalidatePath("/finance/assets");
    return { success: false, error: "Nothing left to depreciate." };
  }

  // Straight-line monthly charge (in paise), clamped to the remaining
  // depreciable amount so the last month absorbs any rounding residue exactly.
  const monthlyP = Math.round(depreciableBaseP / asset.usefulLifeMonths);
  const amountP = Math.min(monthlyP, remainingP);
  const amount = amountP / 100;
  if (amountP <= 0) return { success: false, error: "Computed depreciation is zero." };

  // Resolve GL accounts by code.
  const [expenseAcct, accumAcct] = await Promise.all([
    prisma.finAccount.findUnique({ where: { code: DEP_EXPENSE_CODE } }),
    prisma.finAccount.findUnique({ where: { code: ACCUM_DEP_CODE } }),
  ]);
  if (!expenseAcct) return { success: false, error: `Depreciation expense account (${DEP_EXPENSE_CODE}) not found. Seed the chart of accounts.` };
  if (!accumAcct) return { success: false, error: `Accumulated depreciation account (${ACCUM_DEP_CODE}) not found. Seed the chart of accounts.` };

  // Idempotency: one depreciation charge per (asset, accounting month). Deterministic
  // sourceRefId so re-running the same month is a no-op rather than a double-charge.
  const runDate = new Date();
  const period = `${fyForDate(runDate)}-P${periodForDate(runDate)}`;
  const sourceRefId = `${asset.id}:${period}`;

  // Exact integer comparison — no float epsilon fudge needed.
  const fullyDepreciated = accumulatedP + amountP >= depreciableBaseP;

  try {
    // ONE transaction: idempotency check + balanced JE post + depreciation-entry +
    // asset update. If anything fails, nothing is persisted (no orphaned JE).
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.finJournalEntry.findFirst({
        where: { sourceModule: "MANUAL", sourceRefId },
        select: { id: true },
      });
      if (existing) return { skipped: true as const };

      // Post a balanced JE (Σdebit = Σcredit) so it passes the DB balance trigger.
      const entry = await postWithinTx(tx, {
        date: runDate,
        narration: `Depreciation — ${asset.name} (${period})`,
        sourceModule: "MANUAL",
        sourceRefId,
        createdById: u!.id,
        lines: [
          { accountId: expenseAcct.id, debit: amount },
          { accountId: accumAcct.id, credit: amount },
        ],
      });

      await tx.finDepreciationEntry.create({
        data: { assetId: asset.id, date: runDate, amount, journalEntryId: entry.id },
      });
      await tx.finAsset.update({
        where: { id: asset.id },
        data: {
          accumulatedDep: { increment: amount },
          status: fullyDepreciated ? "FULLY_DEPRECIATED" : asset.status,
        },
      });
      return { skipped: false as const };
    });

    if (result.skipped) {
      return { success: false, error: `Depreciation for ${period} has already been posted for this asset.` };
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to post depreciation journal." };
  }

  revalidatePath("/finance/assets");
  return { success: true, data: { amount, fullyDepreciated } };
}
