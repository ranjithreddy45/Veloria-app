"use server";

import { auth } from "@/../auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import {
  buildTallyExportFiles,
  indianFiscalYearRange,
  type TallyAccount,
  type TallyEntry,
  type TallyExportKind,
  type TallyCounts,
} from "@/lib/finance/tally-xml";

// ============================================================
// Finance · Tally Prime export — READ-only, GL-neutral.
// Pulls posted journal entries (POSTED + REVERSED originals; never DRAFT) for
// a date range and hands them to the pure XML builder. Nothing is written.
// All exports finance:read-gated.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

/** The ledger's single entity (FinAccount/FinJournalEntry default). */
const FIN_ENTITY_ID = "BILLION";
const FALLBACK_COMPANY = "Billion Events Hospitality Services Pvt Ltd";
/** Honest ceiling: beyond this the XML string is tens of MB and the server
 * action payload stops being a sensible transport — narrow the range instead. */
const MAX_LINES = 20_000;

async function role(): Promise<string | undefined> {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role;
}

function canRead(r: string | undefined): boolean {
  return !!r && hasPermission(r, "finance:read");
}

function parseIsoDay(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return d;
}

async function companyNameForEntity(): Promise<string> {
  try {
    const le = await prisma.legalEntity.findFirst({ where: { shortCode: FIN_ENTITY_ID }, select: { name: true } });
    return le?.name?.trim() || FALLBACK_COMPANY;
  } catch {
    return FALLBACK_COMPANY;
  }
}

export type TallyExportDefaults = { from: string; to: string; companyName: string };

/** Defaults for the export form: current Indian FY + the Tally company name
 * (the legal entity behind the ledger's entity code). */
export async function getTallyExportDefaults(): Promise<TallyExportDefaults> {
  const range = indianFiscalYearRange(new Date());
  if (!canRead(await role())) return { ...range, companyName: "" };
  return { ...range, companyName: await companyNameForEntity() };
}

export type TallyExportData = {
  masters: string | null;
  vouchers: string | null;
  counts: TallyCounts;
  from: string;
  to: string;
};

export async function buildTallyExport(input: {
  from: string;
  to: string;
  kind: TallyExportKind;
  companyName?: string;
}): Promise<Result<TallyExportData>> {
  if (!canRead(await role())) return { success: false, error: "Not authorized." };

  const kind = input.kind;
  if (kind !== "masters" && kind !== "vouchers" && kind !== "both") return { success: false, error: "Choose masters, vouchers or both." };

  const fromD = parseIsoDay(input.from);
  const toD = parseIsoDay(input.to);
  if (!fromD || !toD) return { success: false, error: "Dates must be valid YYYY-MM-DD values." };
  if (fromD.getTime() > toD.getTime()) return { success: false, error: "The from date must be on or before the to date." };
  const toEnd = new Date(toD.getTime() + 86_400_000 - 1);

  const companyName = input.companyName?.trim() || (await companyNameForEntity());

  const where: Prisma.FinJournalEntryWhereInput = {
    entityId: FIN_ENTITY_ID,
    status: { in: ["POSTED", "REVERSED"] },
    date: { gte: fromD, lte: toEnd },
  };

  const lineCount = await prisma.finJournalLine.count({ where: { entry: where } });
  if (lineCount > MAX_LINES) {
    return {
      success: false,
      error: `This range has ${lineCount.toLocaleString("en-IN")} journal lines; the export is capped at ${MAX_LINES.toLocaleString("en-IN")}. Export a shorter range (for example one quarter at a time).`,
    };
  }

  const [entryRows, accountRows] = await Promise.all([
    prisma.finJournalEntry.findMany({
      where,
      orderBy: [{ date: "asc" }, { entryNo: "asc" }],
      select: {
        id: true, entryNo: true, date: true, narration: true,
        lines: { orderBy: { lineOrder: "asc" }, select: { accountId: true, debit: true, credit: true, narration: true } },
      },
    }),
    prisma.finAccount.findMany({
      where: { entityId: FIN_ENTITY_ID },
      select: { id: true, code: true, name: true, type: true, subtype: true },
    }),
  ]);

  const entries: TallyEntry[] = entryRows.map((e) => ({
    id: e.id,
    entryNo: e.entryNo,
    date: e.date,
    narration: e.narration,
    lines: e.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit), narration: l.narration })),
  }));
  const accounts: TallyAccount[] = accountRows.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, subtype: a.subtype }));

  if (kind !== "masters" && entries.length === 0) {
    return { success: false, error: "No posted journal entries in that date range." };
  }

  try {
    const built = buildTallyExportFiles({ kind, companyName, accounts, entries });
    if (kind === "masters" && built.counts.ledgers === 0) {
      return { success: false, error: "No ledger accounts were used in that date range, so there are no masters to export." };
    }
    return { success: true, data: { ...built, from: input.from, to: input.to } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not build the Tally XML." };
  }
}
