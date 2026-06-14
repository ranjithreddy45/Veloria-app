"use server";

// ============================================================
// Finance — Tax & Compliance (W7). READ-ONLY / derived module. No GL posting.
// Every figure is computed live from the POSTED ledger (FinJournalLine /
// FinJournalEntry) plus the event-side Invoice table for outward supplies.
// GSTR-3B / TDS = account balances on the GST & TDS control accounts;
// GSTR-1 = invoice-wise outward supplies from prisma.invoice.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { fyForDate } from "@/lib/finance/ledger";
import { FIN_ACCOUNT_CODES } from "@/lib/finance/coa-seed";

async function requireRole(): Promise<string | undefined> {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role;
}
const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];
// AUDITOR holds finance:read (read-only accountant portal) and passes the page
// guard — read actions must honour that or the portal renders empty/zeroed.
const FINANCE_READ_ROLES = [...FINANCE_ROLES, "AUDITOR"];
function canFinance(role?: string) {
  return !!role && FINANCE_READ_ROLES.includes(role);
}

// FY-aware sum of POSTED debits/credits for a single account, looked up by code.
// Returns zeros (not null) when the account doesn't exist yet (un-seeded CoA).
async function accountBalance(code: string, fy?: string): Promise<{ debit: number; credit: number; net: number }> {
  const account = await prisma.finAccount.findUnique({ where: { code }, select: { id: true } });
  if (!account) return { debit: 0, credit: 0, net: 0 };
  const sum = await prisma.finJournalLine.aggregate({
    where: { accountId: account.id, entry: { status: "POSTED", ...(fy ? { fy } : {}) } },
    _sum: { debit: true, credit: true },
  });
  const debit = Number(sum._sum.debit ?? 0);
  const credit = Number(sum._sum.credit ?? 0);
  return { debit, credit, net: debit - credit };
}

export interface TaxSummary {
  fy: string;
  gstr3b: {
    outputGst: number; // credit balance on GST Output (2100)
    inputCredit: number; // debit balance on GST Input (1200)
    netPayable: number; // output − input (positive = pay; negative = carry-forward credit)
  };
  tds: {
    payable: number; // credit balance on TDS Payable (2110)
    receivable: number; // debit balance on TDS Receivable (1210)
  };
  gstr1: {
    invoices: {
      id: string;
      invoiceNumber: string;
      issueDate: string;
      status: string;
      gstin: string | null;
      placeOfSupply: string | null;
      taxable: number; // subtotal
      cgst: number;
      sgst: number;
      igst: number;
      total: number; // taxable + taxes
    }[];
    totals: { taxable: number; cgst: number; sgst: number; igst: number; total: number; count: number };
  };
}

// Outward-supply statuses that count as filed/recognised revenue for GSTR-1.
const OUTWARD_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;

export async function getTaxSummary(fy?: string): Promise<TaxSummary> {
  const role = await requireRole();
  const selectedFy = fy || fyForDate(new Date());
  if (!canFinance(role)) {
    return {
      fy: selectedFy,
      gstr3b: { outputGst: 0, inputCredit: 0, netPayable: 0 },
      tds: { payable: 0, receivable: 0 },
      gstr1: { invoices: [], totals: { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 } },
    };
  }

  const [gstOutput, gstInput, tdsPayable, tdsReceivable] = await Promise.all([
    accountBalance(FIN_ACCOUNT_CODES.gstOutput, selectedFy),
    accountBalance(FIN_ACCOUNT_CODES.gstInput, selectedFy),
    accountBalance(FIN_ACCOUNT_CODES.tdsPayable, selectedFy),
    accountBalance(FIN_ACCOUNT_CODES.tdsReceivable, selectedFy),
  ]);

  // GSTR-1: outward supplies from the event-side Invoice table, scoped to the
  // FY by issueDate (Indian FY = 1 Apr → 31 Mar).
  const fyStartYear = Number(selectedFy.slice(0, 4));
  const periodStart = new Date(Date.UTC(fyStartYear, 3, 1, 0, 0, 0)); // 1 Apr
  const periodEnd = new Date(Date.UTC(fyStartYear + 1, 3, 1, 0, 0, 0)); // 1 Apr next year (exclusive)

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: [...OUTWARD_STATUSES] },
      issueDate: { gte: periodStart, lt: periodEnd },
    },
    orderBy: { issueDate: "desc" },
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      status: true,
      gstin: true,
      placeOfSupply: true,
      subtotal: true,
      discountAmount: true,
      cgstAmount: true,
      sgstAmount: true,
      igstAmount: true,
    },
  });

  const rows = invoices.map((inv) => {
    // GST is charged on the post-discount value — net the discount out of the
    // taxable base so GSTR-1 outward value isn't overstated.
    const taxable = Math.max(0, Number(inv.subtotal) - Number(inv.discountAmount ?? 0));
    const cgst = Number(inv.cgstAmount);
    const sgst = Number(inv.sgstAmount);
    const igst = Number(inv.igstAmount);
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate.toISOString(),
      status: inv.status,
      gstin: inv.gstin,
      placeOfSupply: inv.placeOfSupply,
      taxable,
      cgst,
      sgst,
      igst,
      total: taxable + cgst + sgst + igst,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      taxable: acc.taxable + r.taxable,
      cgst: acc.cgst + r.cgst,
      sgst: acc.sgst + r.sgst,
      igst: acc.igst + r.igst,
      total: acc.total + r.total,
      count: acc.count + 1,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 },
  );

  return {
    fy: selectedFy,
    gstr3b: {
      outputGst: gstOutput.credit - gstOutput.debit, // net credit (liability) balance
      inputCredit: gstInput.debit - gstInput.credit, // net debit (asset) balance
      netPayable: (gstOutput.credit - gstOutput.debit) - (gstInput.debit - gstInput.credit),
    },
    tds: {
      payable: tdsPayable.credit - tdsPayable.debit,
      receivable: tdsReceivable.debit - tdsReceivable.credit,
    },
    gstr1: { invoices: rows, totals },
  };
}

// Distinct posted financial years for the year picker; always includes the
// current FY even before any postings exist.
export async function getTaxFiscalYears(): Promise<string[]> {
  const role = await requireRole();
  if (!canFinance(role)) return [fyForDate(new Date())];
  const rows = await prisma.finJournalEntry.findMany({
    where: { status: "POSTED" },
    distinct: ["fy"],
    select: { fy: true },
    orderBy: { fy: "desc" },
  });
  const list = rows.map((r) => r.fy);
  const current = fyForDate(new Date());
  if (!list.includes(current)) list.unshift(current);
  return list;
}
