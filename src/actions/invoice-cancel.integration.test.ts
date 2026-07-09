// ============================================================
// Payment cancellation (maker-checker) — integration test.
// Mocks auth + next/cache and drives the REAL approvePaymentCancellation
// against the local Postgres DB to prove that cancelling a COMPLETED payment
// exactly reverses the invoice paidAmount / balanceDue / status and flips the
// payment to CANCELLED (spec §6a). The payment's cash-receipt GL entry is posted
// first so the reversal path is exercised whether or not Finance is seeded.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// --- mocks must be declared before importing the action ---
const authMock = vi.fn();
vi.mock("@/../auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { approvePaymentCancellation } from "./invoice-cancel.actions";
import { postPaymentReceived } from "@/lib/finance/receivables";

const U = Date.now();
let adminId: string;
let contactId: string;
let invoiceId: string;
let paymentId: string;

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: { name: "Cancel Admin", email: `cancel-admin-${U}@t.local`, role: "ADMIN", isActive: true },
    select: { id: true },
  });
  adminId = admin.id;
  authMock.mockResolvedValue({ user: { id: adminId, role: "ADMIN", name: "Cancel Admin" } });

  const contact = await prisma.contact.create({
    data: { firstName: "Cancel", lastName: "Tester", phone: `+9194${String(U).slice(-8)}` },
    select: { id: true },
  });
  contactId = contact.id;

  // Invoice: total 10000, one 4000 payment already applied → PARTIALLY_PAID.
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-CANCELTEST-${U}`,
      status: "PARTIALLY_PAID",
      dueDate: new Date(Date.UTC(2030, 0, 15)), // far-future → not OVERDUE after reversal
      subtotal: "10000",
      totalAmount: "10000",
      paidAmount: "4000",
      balanceDue: "6000",
      contactId,
      createdById: adminId,
    },
    select: { id: true },
  });
  invoiceId = invoice.id;

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount: "4000",
      method: "CASH",
      status: "COMPLETED",
      receiptNumber: `RCP-CANCELTEST-${U}`,
      paidAt: new Date(),
    },
    select: { id: true },
  });
  paymentId = payment.id;

  // Post the cash receipt so there is a GL entry to reverse (no-op if Finance
  // isn't seeded locally — the cancel path handles both).
  await postPaymentReceived(paymentId, adminId);
});

afterAll(async () => {
  // The cancel + GL-reversal path writes ActivityLog rows (FK → User) and
  // FinJournal entries; clear them before deleting the invoice/user so the
  // foreign-key constraints (ActivityLog_userId_fkey) aren't tripped.
  // FinJournalLine cascades from its entry, so deleting entries is enough.
  await prisma.activityLog.deleteMany({ where: { userId: adminId } });
  await prisma.finJournalEntry.deleteMany({ where: { sourceRefId: { in: [invoiceId, paymentId] } } });
  await prisma.payment.deleteMany({ where: { invoiceId } });
  await prisma.installment.deleteMany({ where: { invoiceId } });
  await prisma.invoice.deleteMany({ where: { id: invoiceId } });
  await prisma.contact.deleteMany({ where: { id: contactId } });
  await prisma.user.deleteMany({ where: { id: adminId } });
});

describe("approvePaymentCancellation", () => {
  it("reverses the payment and restores the invoice balance exactly", async () => {
    const res = await approvePaymentCancellation(paymentId);
    expect(res.success).toBe(true);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe("CANCELLED");
    expect(payment?.cancelledById).toBe(adminId);
    expect(payment?.cancelPending).toBe(false);

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    // 4000 removed → nothing paid, full 10000 outstanding, reverts to SENT.
    expect(Number(invoice?.paidAmount)).toBe(0);
    expect(Number(invoice?.balanceDue)).toBe(10000);
    expect(invoice?.status).toBe("SENT");
  });

  it("is idempotent — a second approve is refused, balance unchanged", async () => {
    const res = await approvePaymentCancellation(paymentId);
    expect(res.success).toBe(false);

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(Number(invoice?.paidAmount)).toBe(0);
    expect(Number(invoice?.balanceDue)).toBe(10000);
  });
});
