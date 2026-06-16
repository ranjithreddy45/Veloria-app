// ============================================================
// Finance — Procurement sub-ledger bridge. When a Purchase Requisition is
// RECEIVED, accrue the expense + the payable to the vendor in the GL:
//   Dr Supplies & Consumables (5230)   (totalAmount)
//     Cr Accounts Payable / Creditors (2010)  (totalAmount)
// A later vendor payment (postPayoutPaid) settles the payable against Bank, so
// the expense is recognised once (on receipt) and never double-counted.
//
// Same discipline as the other bridges: idempotent (one JE per PR), resilient
// (no-op if Finance isn't set up; never throws into the host flow), and it
// self-seeds the 5230 expense account if it isn't in the chart yet.
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { postWithinTx, type JournalLineInput } from "./ledger";
import { FIN_ACCOUNT_CODES, COA_TEMPLATE } from "./coa-seed";

export type BridgeResult =
  | { posted: true; entryId: string; entryNo: string }
  | { posted: false; reason: string };

type Tx = Prisma.TransactionClient;

// Procurement entries are keyed under PAYABLE with a "PR:" prefix so they never
// collide with payout ids.
const sourceRef = (prId: string) => `PR:${prId}`;

async function alreadyPosted(tx: Tx, prId: string): Promise<boolean> {
  const e = await tx.finJournalEntry.findFirst({
    where: { sourceModule: "PAYABLE", sourceRefId: sourceRef(prId) },
    select: { id: true },
  });
  return !!e;
}

// Find an account by code; if it's a known template account that simply hasn't
// been seeded yet (e.g. 5230 added after the initial seed), create it so the
// bridge is self-healing on existing databases.
async function ensureAccount(tx: Tx, code: string): Promise<string | null> {
  const found = await tx.finAccount.findUnique({ where: { code }, select: { id: true } });
  if (found) return found.id;
  const tpl = COA_TEMPLATE.find((c) => c.code === code);
  if (!tpl) return null;
  const created = await tx.finAccount.create({
    data: {
      code: tpl.code,
      name: tpl.name,
      type: tpl.type,
      subtype: tpl.subtype ?? null,
      isControl: !!tpl.isControl,
      taxDefault: tpl.taxDefault ?? null,
      order: Number(tpl.code),
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Core accrual logic, run inside a caller-provided transaction. Returns a
 * BridgeResult for EXPECTED non-posts (not-seeded, already-posted, etc.) so the
 * caller's transaction can still commit, but lets unexpected DB errors THROW so
 * the caller can roll back. Keyed on the PR id; safe to call repeatedly.
 */
export async function postPurchaseReceivedWithinTx(
  tx: Tx,
  prId: string,
  byId?: string,
): Promise<BridgeResult> {
  const accountCount = await tx.finAccount.count();
  if (accountCount === 0) return { posted: false, reason: "not-seeded" };
  if (await alreadyPosted(tx, prId)) return { posted: false, reason: "already-posted" };

  const pr = await tx.purchaseRequisition.findUnique({
    where: { id: prId },
    select: { id: true, prNumber: true, totalAmount: true, status: true, vendorId: true },
  });
  if (!pr) return { posted: false, reason: "pr-not-found" };
  if (pr.status !== "RECEIVED") return { posted: false, reason: "not-received" };

  const amount = Number(pr.totalAmount);
  if (amount <= 0) return { posted: false, reason: "non-positive-amount" };

  const [expenseId, payableId] = await Promise.all([
    ensureAccount(tx, FIN_ACCOUNT_CODES.procurementExpense),
    ensureAccount(tx, FIN_ACCOUNT_CODES.creditors),
  ]);
  if (!expenseId || !payableId) return { posted: false, reason: "accounts-missing" };

  let vendorName = "vendor";
  if (pr.vendorId) {
    const v = await tx.vendor.findUnique({ where: { id: pr.vendorId }, select: { name: true } });
    if (v?.name) vendorName = v.name;
  }

  const lines: JournalLineInput[] = [
    { accountId: expenseId, debit: amount, narration: `${pr.prNumber} — ${vendorName}` },
    { accountId: payableId, credit: amount, narration: `Payable — ${vendorName} (${pr.prNumber})` },
  ];

  const res = await postWithinTx(tx, {
    date: new Date(),
    narration: `Procurement received — ${pr.prNumber}`,
    sourceModule: "PAYABLE",
    sourceRefId: sourceRef(pr.id),
    createdById: byId ?? null,
    lines,
  });
  return { posted: true, entryId: res.id, entryNo: res.entryNo };
}

/**
 * Standalone best-effort post (opens its own transaction, never throws).
 * Kept for retries/sweeps; the receipt action posts within its own txn instead.
 */
export async function postPurchaseReceived(prId: string, byId?: string): Promise<BridgeResult> {
  try {
    return await prisma.$transaction((tx) => postPurchaseReceivedWithinTx(tx, prId, byId));
  } catch (e) {
    return { posted: false, reason: e instanceof Error ? e.message : "post-failed" };
  }
}
