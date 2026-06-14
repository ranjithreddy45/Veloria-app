"use server";

// ============================================================
// Finance — E-Invoicing actions (SANDBOX).
// Joins the event-side Invoice table with its FinEInvoice e-invoice record and
// drives mock IRN generation / cancellation via the swappable einvoice-adapter.
// No real IRP/GSTN call is made — see einvoice-adapter.ts.
// Reads: finance:read. Writes: role ∈ SUPER_ADMIN | ADMIN | FINANCE.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { einvoiceAdapter } from "@/lib/finance/einvoice-adapter";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const FINANCE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

async function getRole(): Promise<string | undefined> {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role;
}
function canRead(role?: string) {
  return !!role && hasPermission(role, "finance:read");
}
function canWrite(role?: string) {
  return !!role && FINANCE_ROLES.includes(role);
}

export type EInvoiceStatus = "PENDING" | "GENERATED" | "CANCELLED" | "FAILED";

export interface EInvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  totalAmount: number;
  gstin: string | null;
  placeOfSupply: string | null;
  invoiceStatus: string;
  status: EInvoiceStatus;
  irn: string | null;
  ackNo: string | null;
  generatedAt: string | null;
  errorMsg: string | null;
}

// Invoice statuses that are eligible to be reported as e-invoices (issued docs).
const REPORTABLE_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;

// ------------------------------------------------------------
// Read — invoices joined with their FinEInvoice (PENDING when none exists yet).
// ------------------------------------------------------------
export async function getEInvoiceRows(): Promise<EInvoiceRow[]> {
  const role = await getRole();
  if (!canRead(role)) return [];

  const invoices = await prisma.invoice.findMany({
    where: { status: { in: [...REPORTABLE_STATUSES] } },
    orderBy: { issueDate: "desc" },
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      totalAmount: true,
      gstin: true,
      placeOfSupply: true,
      status: true,
    },
  });

  if (invoices.length === 0) return [];

  const records = await prisma.finEInvoice.findMany({
    where: { invoiceId: { in: invoices.map((i) => i.id) } },
  });
  const byInvoice = new Map(records.map((r) => [r.invoiceId, r]));

  return invoices.map((inv) => {
    const rec = byInvoice.get(inv.id);
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate.toISOString(),
      totalAmount: Number(inv.totalAmount),
      gstin: inv.gstin,
      placeOfSupply: inv.placeOfSupply,
      invoiceStatus: inv.status,
      status: (rec?.status ?? "PENDING") as EInvoiceStatus,
      irn: rec?.irn ?? null,
      ackNo: rec?.ackNo ?? null,
      generatedAt: rec?.generatedAt ? rec.generatedAt.toISOString() : null,
      errorMsg: rec?.errorMsg ?? null,
    };
  });
}

// ------------------------------------------------------------
// Generate — call the (mock) adapter and upsert a GENERATED FinEInvoice.
// ------------------------------------------------------------
export async function generateEInvoice(invoiceId: string): Promise<Result<{ irn: string }>> {
  const role = await getRole();
  if (!canWrite(role)) return { success: false, error: "Not authorized." };

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      gstin: true,
      placeOfSupply: true,
      issueDate: true,
    },
  });
  if (!invoice) return { success: false, error: "Invoice not found." };

  const existing = await prisma.finEInvoice.findUnique({ where: { invoiceId } });
  if (existing?.status === "GENERATED") {
    return { success: false, error: "E-invoice already generated for this invoice." };
  }

  try {
    const result = await einvoiceAdapter.generateIrn({
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: Number(invoice.totalAmount),
      gstin: invoice.gstin,
      placeOfSupply: invoice.placeOfSupply,
      issueDate: invoice.issueDate,
    });

    await prisma.finEInvoice.upsert({
      where: { invoiceId },
      create: {
        invoiceId,
        irn: result.irn,
        ackNo: result.ackNo,
        qrData: result.qrData,
        status: "GENERATED",
        errorMsg: null,
        generatedAt: new Date(),
        createdById: userId,
      },
      update: {
        irn: result.irn,
        ackNo: result.ackNo,
        qrData: result.qrData,
        status: "GENERATED",
        errorMsg: null,
        generatedAt: new Date(),
      },
    });

    revalidatePath("/finance/e-invoice");
    return { success: true, data: { irn: result.irn } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "IRN generation failed.";
    await prisma.finEInvoice.upsert({
      where: { invoiceId },
      create: { invoiceId, status: "FAILED", errorMsg: message, createdById: userId },
      update: { status: "FAILED", errorMsg: message },
    });
    revalidatePath("/finance/e-invoice");
    return { success: false, error: message };
  }
}

// ------------------------------------------------------------
// Cancel — mark the e-invoice CANCELLED (sandbox: no IRP cancel call).
// ------------------------------------------------------------
export async function cancelEInvoice(invoiceId: string): Promise<Result<{ invoiceId: string }>> {
  const role = await getRole();
  if (!canWrite(role)) return { success: false, error: "Not authorized." };

  const existing = await prisma.finEInvoice.findUnique({ where: { invoiceId } });
  if (!existing || existing.status !== "GENERATED") {
    return { success: false, error: "Only a generated e-invoice can be cancelled." };
  }

  await prisma.finEInvoice.update({
    where: { invoiceId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/finance/e-invoice");
  return { success: true, data: { invoiceId } };
}
