"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { COA_TEMPLATE } from "@/lib/finance/coa-seed";
import { postJournalEntry, reverseJournalEntry, fyForDate, periodForDate, type JournalLineInput } from "@/lib/finance/ledger";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
function canFinance(role?: string) { return !!role && FINANCE_ROLES.includes(role); }
function canFinanceAdmin(role?: string) { return role === "SUPER_ADMIN" || role === "ADMIN"; }

// ============================================================
// Setup — CoA seed + current period + DB-layer balance guard (Rule 1).
// ============================================================
export async function seedFinance(): Promise<Result<{ accounts: number; guard: boolean }>> {
  const u = await requireUser();
  if (!canFinanceAdmin(u?.role)) return { success: false, error: "Not authorized." };

  let accounts = 0;
  for (let i = 0; i < COA_TEMPLATE.length; i++) {
    const a = COA_TEMPLATE[i];
    const exists = await prisma.finAccount.findUnique({ where: { code: a.code } });
    if (!exists) {
      await prisma.finAccount.create({
        data: { code: a.code, name: a.name, type: a.type, subtype: a.subtype ?? null, isControl: !!a.isControl, taxDefault: a.taxDefault ?? null, order: i + 1 },
      });
      accounts++;
    }
  }

  const now = new Date();
  const fy = fyForDate(now), period = periodForDate(now);
  const p = await prisma.finPeriod.findUnique({ where: { fy_period: { fy, period } } });
  if (!p) await prisma.finPeriod.create({ data: { fy, period, status: "OPEN" } });

  const guard = await installLedgerGuard().then(() => true).catch(() => false);
  revalidatePath("/finance");
  return { success: true, data: { accounts, guard } };
}

// Install the deferred CONSTRAINT TRIGGER that enforces Σdebits=Σcredits at the
// DB layer for POSTED entries (drafts may be unbalanced). Idempotent. prisma db
// push can't create triggers, so this runs as an explicit admin setup step.
async function installLedgerGuard(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION fin_assert_entry_balanced() RETURNS trigger AS $func$
    DECLARE eid text; st text; d numeric; c numeric;
    BEGIN
      eid := COALESCE(NEW."entryId", OLD."entryId");
      SELECT status INTO st FROM "FinJournalEntry" WHERE id = eid;
      IF st = 'POSTED' THEN
        SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO d, c FROM "FinJournalLine" WHERE "entryId" = eid;
        IF d <> c THEN RAISE EXCEPTION 'Finance balance violation on entry %: debits % <> credits %', eid, d, c; END IF;
      END IF;
      RETURN NULL;
    END; $func$ LANGUAGE plpgsql;
  `);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS fin_balance_check ON "FinJournalLine";`);
  await prisma.$executeRawUnsafe(`
    CREATE CONSTRAINT TRIGGER fin_balance_check
      AFTER INSERT OR UPDATE OR DELETE ON "FinJournalLine"
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
      EXECUTE FUNCTION fin_assert_entry_balanced();
  `);
}

// ============================================================
// Reads
// ============================================================
export async function getFinAccounts() {
  const u = await requireUser();
  if (!canFinance(u?.role)) return [];
  return prisma.finAccount.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
}

export async function getCurrentPeriod() {
  const u = await requireUser();
  if (!canFinance(u?.role)) return null;
  const now = new Date();
  const fy = fyForDate(now), period = periodForDate(now);
  const p = await prisma.finPeriod.findUnique({ where: { fy_period: { fy, period } } });
  return { fy, period, status: p?.status ?? "OPEN", seeded: (await prisma.finAccount.count()) > 0 };
}

export async function getJournalEntries(limit = 50) {
  const u = await requireUser();
  if (!canFinance(u?.role)) return [];
  const entries = await prisma.finJournalEntry.findMany({
    orderBy: { date: "desc" }, take: limit,
    include: { lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { lineOrder: "asc" } } },
  });
  return entries.map((e) => ({
    id: e.id, entryNo: e.entryNo, date: e.date, narration: e.narration, status: e.status, sourceModule: e.sourceModule,
    total: e.lines.reduce((s, l) => s + Number(l.debit), 0),
    lines: e.lines.map((l) => ({ account: `${l.account.code} ${l.account.name}`, debit: Number(l.debit), credit: Number(l.credit), narration: l.narration })),
  }));
}

// Trial balance — net per account from POSTED lines; must always balance.
export async function getTrialBalance() {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { rows: [], totalDebit: 0, totalCredit: 0, balanced: true };
  const grouped = await prisma.finJournalLine.groupBy({
    by: ["accountId"],
    where: { entry: { status: "POSTED" } },
    _sum: { debit: true, credit: true },
  });
  const accounts = await prisma.finAccount.findMany({ select: { id: true, code: true, name: true, type: true } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows = grouped.map((g) => {
    const a = byId.get(g.accountId);
    const debit = Number(g._sum.debit ?? 0), credit = Number(g._sum.credit ?? 0);
    const net = debit - credit;
    return { code: a?.code ?? "?", name: a?.name ?? "?", type: a?.type ?? "", debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
  }).filter((r) => r.debit !== 0 || r.credit !== 0).sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, totalDebit, totalCredit, balanced: Math.round((totalDebit - totalCredit) * 100) === 0 };
}

// ============================================================
// Manual journal + reversal
// ============================================================
export async function createManualJournal(input: { date: string; narration: string; lines: { accountId: string; debit?: number; credit?: number; narration?: string }[] }): Promise<Result<{ id: string; entryNo: string }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.date) return { success: false, error: "Date is required." };
  const lines: JournalLineInput[] = (input.lines || []).filter((l) => l.accountId && ((l.debit ?? 0) > 0 || (l.credit ?? 0) > 0));
  try {
    const res = await postJournalEntry({
      date: new Date(input.date + "T00:00:00.000Z"),
      narration: input.narration?.trim() || null,
      sourceModule: "MANUAL", createdById: u!.id, lines,
    });
    revalidatePath("/finance");
    return { success: true, data: res };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not post the entry." };
  }
}

export async function reverseEntry(entryId: string, reason: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canFinance(u?.role)) return { success: false, error: "Not authorized." };
  if (!reason?.trim()) return { success: false, error: "A reason is required for a reversal." };
  try {
    const res = await reverseJournalEntry(entryId, reason.trim(), u!.id);
    revalidatePath("/finance");
    return { success: true, data: { id: res.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not reverse." };
  }
}

// ============================================================
// Period close / reopen (admin, logged) — Rule 2.
// ============================================================
export async function setPeriodStatus(fy: string, period: number, status: "OPEN" | "CLOSED" | "LOCKED"): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!canFinanceAdmin(u?.role)) return { success: false, error: "Not authorized." };
  const p = await prisma.finPeriod.upsert({
    where: { fy_period: { fy, period } },
    create: { fy, period, status, closedById: status !== "OPEN" ? u!.id : null, closedAt: status !== "OPEN" ? new Date() : null },
    update: { status, closedById: status !== "OPEN" ? u!.id : null, closedAt: status !== "OPEN" ? new Date() : null },
  });
  await prisma.activityLog.create({ data: { action: `FIN_PERIOD_${status}`, entityType: "FIN_PERIOD", entityId: p.id, userId: u!.id, changes: { fy, period } } });
  revalidatePath("/finance");
  return { success: true, data: { ok: true } };
}
