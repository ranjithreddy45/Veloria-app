"use server";

// ============================================================
// Vendor BILL — accounts-payable accrual layer.
// ------------------------------------------------------------
// Bridges the gap the audit found: payouts settle a vendor (Dr AP / Cr Bank) but
// nothing ever ACCRUED the liability, so vendor cost never hit P&L and payout
// amounts were hand-typed with no "amount owed" ledger. A VendorBill captures what
// a vendor is owed for a booking (defaulted from BookingVendor.agreedRate), accrues
// it to the GL on approval (Dr event-cost expense / Cr Accounts Payable 2010), and
// is reconciled against its linked PAID payouts (paid/outstanding are DERIVED, so
// nothing drifts). Maker-checker: the approver can't be the creator. Money crosses
// the boundary via Number()-out / Prisma.Decimal-in.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { postWithinTx, fyForDate } from "@/lib/finance/ledger";
import { FIN_ACCOUNT_CODES } from "@/lib/finance/coa-seed";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const AP_CODE = FIN_ACCOUNT_CODES.creditors; // 2010 Accounts Payable

async function gate(perm: string) {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id || !hasPermission(u.role ?? "", perm)) return null;
  return { id: u.id, role: u.role ?? "" };
}

function genBillNumber(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VB-${y}${m}-${rand}`;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Serialize a bill row + derive paid/outstanding/effectiveStatus. Settled = linked
 * PAID payouts + netted advances (both reduce what's still owed). */
function serializeBill(
  b: { id: string; billNumber: string; vendorId: string; bookingId: string | null; description: string | null; amount: Prisma.Decimal; expenseCode: string; status: string; accrualJournalEntryId: string | null; nettedAdvanceAmount: Prisma.Decimal; notes: string | null; approvedAt: Date | null; createdAt: Date; payouts: { amount: Prisma.Decimal; status: string }[] },
  vendorName: string,
) {
  const amount = Number(b.amount);
  const paid = r2(b.payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0));
  const nettedAdvance = r2(Number(b.nettedAdvanceAmount ?? 0));
  const settled = r2(paid + nettedAdvance);
  const outstanding = r2(Math.max(0, amount - settled));
  const effectiveStatus: "DRAFT" | "APPROVED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" =
    b.status === "CANCELLED" ? "CANCELLED"
    : b.status === "DRAFT" ? "DRAFT"
    : settled >= amount - 0.005 ? "PAID"
    : settled > 0 ? "PARTIALLY_PAID"
    : "APPROVED";
  return {
    id: b.id, billNumber: b.billNumber, vendorId: b.vendorId, vendorName, bookingId: b.bookingId,
    description: b.description, amount, expenseCode: b.expenseCode, status: b.status, effectiveStatus,
    paid, nettedAdvance, outstanding, accrued: !!b.accrualJournalEntryId, notes: b.notes, approvedAt: b.approvedAt, createdAt: b.createdAt,
  };
}

// ============================================================
// Reads
// ============================================================
export async function listVendorBills(filter?: { status?: string }) {
  const u = await gate("payouts:read");
  if (!u) return [];
  const where: Prisma.VendorBillWhereInput = {};
  if (filter?.status && filter.status !== "ALL") where.status = filter.status;
  const bills = await prisma.vendorBill.findMany({
    where, orderBy: { createdAt: "desc" },
    include: { payouts: { select: { amount: true, status: true } } },
  });
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: Array.from(new Set(bills.map((b) => b.vendorId))) } },
    select: { id: true, name: true },
  });
  const byId = new Map(vendors.map((v) => [v.id, v.name]));
  return bills.map((b) => serializeBill(b, byId.get(b.vendorId) ?? "Unknown vendor"));
}

/** BookingVendor lines with an agreed rate that don't yet have a bill — the create picker. */
export async function getBillableBookingVendors() {
  const u = await gate("payouts:read");
  if (!u) return [];
  const billed = await prisma.vendorBill.findMany({ where: { bookingVendorId: { not: null } }, select: { bookingVendorId: true } });
  const billedIds = new Set(billed.map((b) => b.bookingVendorId));
  const rows = await prisma.bookingVendor.findMany({
    where: { agreedRate: { not: null } },
    select: {
      id: true, agreedRate: true, role: true,
      vendor: { select: { id: true, name: true } },
      booking: { select: { id: true, bookingNumber: true, eventName: true, date: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .filter((r) => !billedIds.has(r.id))
    .map((r) => ({
      bookingVendorId: r.id, vendorId: r.vendor.id, vendorName: r.vendor.name, role: r.role,
      agreedRate: Number(r.agreedRate), bookingId: r.booking.id, bookingNumber: r.booking.bookingNumber,
      eventName: r.booking.eventName, eventDate: r.booking.date,
    }));
}

/** APPROVED bills with an outstanding balance — for the payout form's bill selector. */
export async function getBillsForPayout(vendorId?: string) {
  const u = await gate("payouts:read");
  if (!u) return [];
  const bills = await prisma.vendorBill.findMany({
    where: { status: "APPROVED", ...(vendorId ? { vendorId } : {}) },
    include: { payouts: { select: { amount: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
  return bills
    .map((b) => {
      const amount = Number(b.amount);
      const paid = b.payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
      const settled = paid + Number(b.nettedAdvanceAmount ?? 0);
      return { id: b.id, billNumber: b.billNumber, vendorId: b.vendorId, amount, outstanding: r2(Math.max(0, amount - settled)) };
    })
    .filter((b) => b.outstanding > 0.005);
}

// ============================================================
// Create / approve / cancel
// ============================================================
export interface CreateVendorBillInput {
  vendorId?: string;
  bookingId?: string;
  bookingVendorId?: string;
  amount?: number;
  expenseCode?: string;
  description?: string;
  notes?: string;
}

const EXPENSE_CODES = ["5010", "5020", "5030", "5040", "5230"]; // Catering / Décor / Staffing / AV / Procurement

export async function createVendorBill(input: CreateVendorBillInput): Promise<Result<{ id: string }>> {
  const u = await gate("payouts:create");
  if (!u) return { success: false, error: "Not authorized." };

  let vendorId = input.vendorId;
  let bookingId = input.bookingId ?? null;
  let amount = Number(input.amount);

  // Derive from an agreed BookingVendor line when given.
  if (input.bookingVendorId) {
    const bv = await prisma.bookingVendor.findUnique({
      where: { id: input.bookingVendorId },
      select: { vendorId: true, bookingId: true, agreedRate: true },
    });
    if (!bv) return { success: false, error: "That booking-vendor line no longer exists." };
    vendorId = bv.vendorId;
    bookingId = bv.bookingId;
    if (!Number.isFinite(amount) || amount <= 0) amount = Number(bv.agreedRate ?? 0);
    // Guard: one bill per booking-vendor line.
    const existing = await prisma.vendorBill.findFirst({ where: { bookingVendorId: input.bookingVendorId }, select: { id: true } });
    if (existing) return { success: false, error: "This booking-vendor line is already billed." };
  }

  if (!vendorId) return { success: false, error: "Select a vendor." };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Bill amount must be greater than zero." };
  const expenseCode = input.expenseCode && EXPENSE_CODES.includes(input.expenseCode) ? input.expenseCode : "5230";

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) return { success: false, error: "Vendor not found." };

  try {
    const bill = await prisma.vendorBill.create({
      data: {
        billNumber: genBillNumber(), vendorId, bookingId, bookingVendorId: input.bookingVendorId || null,
        description: input.description?.trim() || null, amount: new Prisma.Decimal(amount.toFixed(2)),
        expenseCode, notes: input.notes?.trim() || null, createdById: u.id,
      },
      select: { id: true },
    });
    revalidatePath("/payouts/bills");
    return { success: true, data: { id: bill.id } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // billNumber collision — retry once with a fresh number.
      const bill = await prisma.vendorBill.create({
        data: {
          billNumber: genBillNumber(), vendorId, bookingId, bookingVendorId: input.bookingVendorId || null,
          description: input.description?.trim() || null, amount: new Prisma.Decimal(amount.toFixed(2)),
          expenseCode, notes: input.notes?.trim() || null, createdById: u.id,
        },
        select: { id: true },
      });
      revalidatePath("/payouts/bills");
      return { success: true, data: { id: bill.id } };
    }
    return { success: false, error: "Could not create the bill." };
  }
}

export async function approveVendorBill(id: string): Promise<Result<{ entryNo: string }>> {
  const u = await gate("payouts:approve");
  if (!u) return { success: false, error: "Not authorized." };

  const bill = await prisma.vendorBill.findUnique({ where: { id } });
  if (!bill) return { success: false, error: "Bill not found." };
  if (bill.status !== "DRAFT") return { success: false, error: "Only a draft bill can be approved." };
  if (bill.accrualJournalEntryId) return { success: false, error: "This bill is already accrued." };
  // Maker-checker: the approver must not be the creator.
  if (bill.createdById && bill.createdById === u.id) return { success: false, error: "You created this bill — a different approver must accrue it." };

  const date = new Date();
  const codes = [bill.expenseCode, AP_CODE];
  const accounts = await prisma.finAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const need = (code: string, label: string) => {
    const accId = idByCode.get(code);
    if (!accId) throw new Error(`${label} account (${code}) is missing — seed the chart of accounts in Finance first.`);
    return accId;
  };
  const amount = Number(bill.amount);

  try {
    const entryNo = await prisma.$transaction(async (tx) => {
      const fresh = await tx.vendorBill.findUnique({ where: { id }, select: { status: true, accrualJournalEntryId: true } });
      if (!fresh || fresh.status !== "DRAFT" || fresh.accrualJournalEntryId) throw new Error("Bill already accrued or not draft.");
      const entry = await postWithinTx(tx, {
        date,
        narration: `Vendor bill ${bill.billNumber}`,
        sourceModule: "PAYABLE",
        sourceRefId: bill.id,
        createdById: u.id,
        lines: [
          { accountId: need(bill.expenseCode, "Event cost"), debit: amount, narration: "Vendor cost accrual" },
          { accountId: need(AP_CODE, "Accounts Payable"), credit: amount, narration: `Payable to vendor` },
        ],
      });
      await tx.vendorBill.update({
        where: { id },
        data: { status: "APPROVED", accrualJournalEntryId: entry.id, approvedById: u.id, approvedAt: new Date() },
      });
      return entry.entryNo;
    });
    // Auto-net any paid vendor advances (sitting in 1300) against this bill.
    await netAdvancesAgainstBill(bill.id, bill.vendorId, Number(bill.amount), u.id).catch((e) =>
      console.error("[VENDOR_BILL_NET_ADVANCE_ERR]", bill.id, e),
    );
    revalidatePath("/payouts/bills");
    revalidatePath("/finance");
    return { success: true, data: { entryNo } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not accrue the bill." };
  }
}

export interface UpdateVendorBillInput {
  amount?: number;
  description?: string;
  expenseCode?: string;
  notes?: string;
}

export async function updateVendorBill(id: string, input: UpdateVendorBillInput): Promise<Result<{ id: string }>> {
  const u = await gate("payouts:create");
  if (!u) return { success: false, error: "Not authorized." };

  const bill = await prisma.vendorBill.findUnique({ where: { id }, select: { status: true } });
  if (!bill) return { success: false, error: "Bill not found." };
  // A draft is the only editable state — once approved the amount is accrued to the GL.
  if (bill.status !== "DRAFT") return { success: false, error: "Only a draft bill can be edited" };

  const data: Prisma.VendorBillUpdateInput = {};

  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Bill amount must be greater than zero." };
    data.amount = new Prisma.Decimal(amount.toFixed(2));
  }
  if (input.expenseCode !== undefined) {
    if (!EXPENSE_CODES.includes(input.expenseCode)) return { success: false, error: "Invalid expense account." };
    data.expenseCode = input.expenseCode;
  }
  if (input.description !== undefined) data.description = input.description.trim() || null;
  if (input.notes !== undefined) data.notes = input.notes.trim() || null;

  try {
    await prisma.vendorBill.update({ where: { id }, data });
    revalidatePath("/payouts/bills");
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not update the bill." };
  }
}

export async function cancelVendorBill(id: string): Promise<Result<{ id: string }>> {
  const u = await gate("payouts:approve");
  if (!u) return { success: false, error: "Not authorized." };
  const bill = await prisma.vendorBill.findUnique({ where: { id }, select: { status: true } });
  if (!bill) return { success: false, error: "Bill not found." };
  // Only a DRAFT bill can be cancelled here; an APPROVED bill has a GL accrual that
  // must be reversed in Finance first (avoids an unbalanced silent cancel).
  if (bill.status !== "DRAFT") return { success: false, error: "Only a draft bill can be cancelled. Reverse the accrual in Finance to void an approved bill." };
  await prisma.vendorBill.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/payouts/bills");
  return { success: true, data: { id } };
}

// Net paid vendor ADVANCES (sitting in Advances-to-Vendors 1300) against a newly
// approved bill: Dr AP 2010 / Cr 1300 for the netted amount. Each advance carries
// a nettedAmount (how much has been consumed), so a partial or an oversized advance
// (larger than one bill) nets what fits here and keeps its residual available for
// later bills — nothing strands. The netted total is stamped on the bill
// (nettedAdvanceAmount) so its outstanding drops by exactly what was applied,
// preventing a double payment on top of the advance. Idempotent (re-run computes
// the bill's remaining from the stored total and nets 0 more) and never negative
// (netted ≤ bill's remaining). Best-effort; never throws.
async function netAdvancesAgainstBill(billId: string, vendorId: string, billAmount: number, actorId: string): Promise<void> {
  const accounts = await prisma.finAccount.findMany({ where: { code: { in: [AP_CODE, "1300"] } }, select: { id: true, code: true } });
  const idByCode = new Map(accounts.map((a) => [a.code, a.id]));
  const apId = idByCode.get(AP_CODE);
  const advId = idByCode.get("1300");
  if (!apId || !advId) return; // finance not seeded

  await prisma.$transaction(async (tx) => {
    // Bill's remaining capacity for netting = amount − already-netted − PAID payouts.
    const bill = await tx.vendorBill.findUnique({
      where: { id: billId },
      select: { nettedAdvanceAmount: true, payouts: { select: { amount: true, status: true } } },
    });
    if (!bill) return;
    const paid = bill.payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
    let remaining = r2(billAmount - Number(bill.nettedAdvanceAmount ?? 0) - paid);
    if (remaining <= 0.005) return;

    // Advances with an available balance, oldest first.
    const advances = await tx.payout.findMany({
      where: { vendorId, isAdvance: true, status: "PAID" },
      orderBy: { createdAt: "asc" },
      select: { id: true, amount: true, nettedAmount: true },
    });

    let netTotal = 0;
    for (const a of advances) {
      if (remaining <= 0.005) break;
      const available = r2(Number(a.amount) - Number(a.nettedAmount ?? 0));
      if (available <= 0.005) continue;
      const apply = r2(Math.min(available, remaining));
      if (apply <= 0.005) continue;
      const newNetted = r2(Number(a.nettedAmount ?? 0) + apply);
      // Consume this slice of the advance; mark fully-netted advances for the legacy flag.
      await tx.payout.update({
        where: { id: a.id },
        data: {
          nettedAmount: new Prisma.Decimal(newNetted.toFixed(2)),
          ...(newNetted >= Number(a.amount) - 0.005 ? { nettedBillId: billId } : {}),
        },
      });
      remaining = r2(remaining - apply);
      netTotal = r2(netTotal + apply);
    }
    if (netTotal <= 0.005) return;

    await tx.vendorBill.update({
      where: { id: billId },
      data: { nettedAdvanceAmount: { increment: new Prisma.Decimal(netTotal.toFixed(2)) } },
    });
    await postWithinTx(tx, {
      date: new Date(),
      narration: `Vendor advance netting — bill ${billId}`,
      sourceModule: "PAYABLE",
      sourceRefId: `net_${billId}`,
      createdById: actorId,
      lines: [
        { accountId: apId, debit: netTotal, narration: "Net advance vs payable" },
        { accountId: advId, credit: netTotal, narration: "Advance applied to bill" },
      ],
    });
  });
}
