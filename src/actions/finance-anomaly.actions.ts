"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// ------------------------------------------------------------
// Finance · Anomalies — lightweight fraud/anomaly detection over payments and
// the general ledger, plus a simple accountant-facing review queue. Detection
// is idempotent: an OPEN anomaly with the same (type, refId) is never created
// twice, so re-running is safe.
// ------------------------------------------------------------

const WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

type Result<T> = { success: true; data: T } | { success: false; error: string };

type Severity = "LOW" | "MEDIUM" | "HIGH";
type AnomalyStatus = "OPEN" | "RESOLVED" | "IGNORED";

async function currentUser() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  return user ?? null;
}

function canRead(role?: string) {
  return !!role && hasPermission(role, "finance:read");
}
function canWrite(role?: string) {
  return !!role && WRITE_ROLES.includes(role);
}

// Public-facing shape for the page/table.
export type AnomalyRow = {
  id: string;
  type: string;
  severity: Severity;
  message: string;
  refType: string | null;
  refId: string | null;
  amount: number | null;
  status: AnomalyStatus;
  detectedAt: string;
};

// ------------------------------------------------------------
// Detection — scans payments + ledger and upserts OPEN anomalies. Each check
// is isolated in try/catch so a single failing query can't abort the rest.
// ------------------------------------------------------------
export async function detectAnomalies(): Promise<Result<{ created: number; checks: Record<string, number> }>> {
  const user = await currentUser();
  if (!canWrite(user?.role)) return { success: false, error: "Not authorized." };

  // Existing OPEN anomalies keyed by `${type}::${refId}` for dedupe.
  const existingOpen = await prisma.finAnomaly.findMany({
    where: { status: "OPEN" },
    select: { type: true, refId: true },
  });
  const seen = new Set(existingOpen.map((a) => `${a.type}::${a.refId ?? ""}`));

  const toCreate: Prisma.FinAnomalyCreateManyInput[] = [];
  const checks: Record<string, number> = { DUPLICATE_PAYMENT: 0, ROUND_AMOUNT: 0, WEEKEND_LARGE: 0 };

  const push = (row: {
    type: string;
    severity: Severity;
    message: string;
    refType: string;
    refId: string;
    amount: number | null;
  }) => {
    const key = `${row.type}::${row.refId}`;
    if (seen.has(key)) return;
    seen.add(key);
    toCreate.push({
      type: row.type,
      severity: row.severity,
      message: row.message,
      refType: row.refType,
      refId: row.refId,
      amount: row.amount === null ? null : new Prisma.Decimal(row.amount.toFixed(2)),
      status: "OPEN",
    });
    checks[row.type] = (checks[row.type] ?? 0) + 1;
  };

  // --- Check 1: DUPLICATE_PAYMENT — same (invoiceId, amount) COMPLETED > 1 → HIGH
  try {
    const groups = await prisma.payment.groupBy({
      by: ["invoiceId", "amount"],
      where: { status: "COMPLETED" },
      _count: { _all: true },
      having: { invoiceId: { _count: { gt: 1 } } },
    });
    for (const g of groups) {
      const count = g._count._all;
      if (count <= 1) continue;
      const amount = Number(g.amount);
      // Anchor the anomaly to the invoice so re-runs dedupe cleanly.
      push({
        type: "DUPLICATE_PAYMENT",
        severity: "HIGH",
        message: `${count} completed payments of ${formatAmount(amount)} on the same invoice — possible double charge.`,
        refType: "INVOICE",
        refId: g.invoiceId,
        amount,
      });
    }
  } catch {
    // Ignore — keep other checks running.
  }

  // --- Check 2: ROUND_AMOUNT — posted JE total ≥ 100000 & exact multiple of 50000 → LOW
  try {
    const entries = await prisma.finJournalEntry.findMany({
      where: { status: "POSTED" },
      select: { id: true, entryNo: true, lines: { select: { debit: true } } },
    });
    for (const e of entries) {
      const total = e.lines.reduce((sum, l) => sum + Number(l.debit), 0);
      if (total < 100000) continue;
      if (total % 50000 !== 0) continue;
      push({
        type: "ROUND_AMOUNT",
        severity: "LOW",
        message: `Journal ${e.entryNo} totals exactly ${formatAmount(total)} — suspiciously round.`,
        refType: "JOURNAL",
        refId: e.id,
        amount: total,
      });
    }
  } catch {
    // Ignore.
  }

  // --- Check 3: WEEKEND_LARGE — posted JE dated Sat/Sun & total ≥ 100000 → MEDIUM
  try {
    const entries = await prisma.finJournalEntry.findMany({
      where: { status: "POSTED" },
      select: { id: true, entryNo: true, date: true, lines: { select: { debit: true } } },
    });
    for (const e of entries) {
      const day = e.date.getDay(); // 0 = Sun, 6 = Sat
      if (day !== 0 && day !== 6) continue;
      const total = e.lines.reduce((sum, l) => sum + Number(l.debit), 0);
      if (total < 100000) continue;
      const dayName = day === 0 ? "Sunday" : "Saturday";
      push({
        type: "WEEKEND_LARGE",
        severity: "MEDIUM",
        message: `Journal ${e.entryNo} of ${formatAmount(total)} posted on a ${dayName} — large weekend entry.`,
        refType: "JOURNAL",
        refId: e.id,
        amount: total,
      });
    }
  } catch {
    // Ignore.
  }

  let created = 0;
  if (toCreate.length > 0) {
    const res = await prisma.finAnomaly.createMany({ data: toCreate });
    created = res.count;
  }

  revalidatePath("/finance/anomalies");
  return { success: true, data: { created, checks } };
}

// ------------------------------------------------------------
// List — newest first, optionally filtered by status.
// ------------------------------------------------------------
export async function getAnomalies(status?: AnomalyStatus): Promise<AnomalyRow[]> {
  const user = await currentUser();
  if (!canRead(user?.role)) return [];

  const rows = await prisma.finAnomaly.findMany({
    where: status ? { status } : undefined,
    orderBy: { detectedAt: "desc" },
    take: 500,
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    severity: (r.severity as Severity) ?? "MEDIUM",
    message: r.message,
    refType: r.refType,
    refId: r.refId,
    amount: r.amount === null ? null : Number(r.amount),
    status: r.status as AnomalyStatus,
    detectedAt: r.detectedAt.toISOString(),
  }));
}

// ------------------------------------------------------------
// Status change — resolve / ignore / reopen. Records the resolver.
// ------------------------------------------------------------
export async function setAnomalyStatus(
  id: string,
  status: AnomalyStatus,
): Promise<Result<{ ok: true }>> {
  const user = await currentUser();
  if (!canWrite(user?.role)) return { success: false, error: "Not authorized." };
  if (!["OPEN", "RESOLVED", "IGNORED"].includes(status)) {
    return { success: false, error: "Invalid status." };
  }

  try {
    await prisma.finAnomaly.update({
      where: { id },
      data: {
        status,
        resolvedById: status === "OPEN" ? null : user?.id ?? null,
      },
    });
  } catch {
    return { success: false, error: "Anomaly not found." };
  }

  revalidatePath("/finance/anomalies");
  return { success: true, data: { ok: true } };
}

// ------------------------------------------------------------
// Stats — OPEN counts by severity (drives the StatTiles).
// ------------------------------------------------------------
export async function getAnomalyStats(): Promise<{ open: number; high: number; medium: number; low: number }> {
  const user = await currentUser();
  if (!canRead(user?.role)) return { open: 0, high: 0, medium: 0, low: 0 };

  const grouped = await prisma.finAnomaly.groupBy({
    by: ["severity"],
    where: { status: "OPEN" },
    _count: { _all: true },
  });

  let high = 0;
  let medium = 0;
  let low = 0;
  for (const g of grouped) {
    if (g.severity === "HIGH") high = g._count._all;
    else if (g.severity === "MEDIUM") medium = g._count._all;
    else if (g.severity === "LOW") low = g._count._all;
  }

  return { open: high + medium + low, high, medium, low };
}

// Plain INR string for embedding in stored messages (no JSX/util dependency).
function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
