// ============================================================
// Mint an advance invoice — server-only (NOT a "use server" action file).
// ------------------------------------------------------------
// The public self-serve configurator needs to create a payable invoice for the
// 20% booking advance WITHOUT a logged-in session. createInvoice() in
// invoice.actions.ts is auth-gated AND creates a DRAFT invoice — the public
// /pay page rejects DRAFT invoices ("not payable"). So this helper mints a
// SENT invoice directly, mirroring createInvoice's money math + numbering, so
// getPublicInvoiceForPayment + createPublicRazorpayOrder accept it.
//
// It is plain server code: it must only ever be called from trusted server
// paths (the public conversion action), never exposed as an action itself.
// ============================================================

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateInvoiceTotals } from "@/lib/invoice-calc";

/**
 * Sequential invoice number with a small count+attempt retry loop to survive
 * concurrent allocation — mirrors generateInvoiceNumber() in invoice.actions.ts
 * (which is private). Two public submissions could race; the retry on a taken
 * number (or a P2002 at create time) keeps numbering unique.
 */
async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });

    let nextNumber = 1;
    if (last) {
      const lastNum = parseInt(last.invoiceNumber.split("-").pop() || "0", 10);
      nextNumber = lastNum + 1;
    }

    const number = `${prefix}${String(nextNumber + attempt).padStart(4, "0")}`;
    const existing = await prisma.invoice.findFirst({ where: { invoiceNumber: number } });
    if (!existing) return number;
  }

  // Fallback: guaranteed-unique timestamp-based number.
  return `INV-${Date.now()}`;
}

/**
 * The advance invoice has no logged-in creator. Invoice.createdById is a
 * required FK, so attribute it to the system admin (same convention
 * lead-capture.ts uses for system-created records).
 */
async function getSystemUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });
  if (!admin?.id) {
    throw new Error("No system user available to own the advance invoice.");
  }
  return admin.id;
}

export interface MintAdvanceInvoiceInput {
  contactId: string;
  amount: number; // INR rupees (the 20% booking advance, already rounded)
  eventName: string; // used as the line-item description / event label
  description?: string; // optional override for the single line item
}

export interface MintAdvanceInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
}

/**
 * Create a SENT invoice with a single line item for the booking advance.
 *
 * Money: the advance is the line total. We feed it through
 * calculateInvoiceTotals as one line at quantity 1 with NO tax (the advance is
 * a percentage of an already-tax-inclusive grand total — re-taxing it would
 * overcharge). balanceDue = totalAmount = amount. Status SENT so the existing
 * public checkout (getPublicInvoiceForPayment / createPublicRazorpayOrder)
 * accepts it; those reject DRAFT/PAID/CANCELLED.
 */
export async function mintAdvanceInvoice(
  input: MintAdvanceInvoiceInput
): Promise<MintAdvanceInvoiceResult> {
  const amount = Math.round(Number(input.amount));
  if (!(amount >= 1)) {
    throw new Error("Advance amount must be at least ₹1.");
  }

  const description =
    input.description?.trim() ||
    `Booking advance${input.eventName ? ` — ${input.eventName}` : ""}`;

  // Single tax-free line whose total is the advance. cgst/sgst/igst forced to 0.
  const calc = calculateInvoiceTotals({
    lineItems: [{ description, quantity: 1, unitPrice: amount }],
    discountPercent: 0,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
  });

  const createdById = await getSystemUserId();

  // dueDate: today + 7 days (advance is collected up-front; this is just a
  // required field — the link is paid immediately).
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  for (let attempt = 0; attempt < 5; attempt++) {
    const invoiceNumber = await nextInvoiceNumber();
    try {
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          status: "SENT", // payable by the public /pay page
          issueDate: new Date(),
          dueDate,
          subtotal: new Prisma.Decimal(calc.subtotal),
          discountPercent: null,
          discountAmount: null,
          cgstRate: new Prisma.Decimal(0),
          sgstRate: new Prisma.Decimal(0),
          igstRate: new Prisma.Decimal(0),
          cgstAmount: new Prisma.Decimal(0),
          sgstAmount: new Prisma.Decimal(0),
          igstAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(calc.totalAmount),
          paidAmount: new Prisma.Decimal(0),
          balanceDue: new Prisma.Decimal(calc.totalAmount),
          notes: "Self-serve booking advance (configurator).",
          contactId: input.contactId,
          createdById,
          lineItems: {
            create: calc.lineItems.map((li) => ({
              description: li.description,
              quantity: new Prisma.Decimal(li.quantity),
              unitPrice: new Prisma.Decimal(li.unitPrice),
              amount: new Prisma.Decimal(li.amount),
              order: li.order,
            })),
          },
        },
        select: { id: true, invoiceNumber: true },
      });
      return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
    } catch (e) {
      // Unique collision on invoiceNumber under concurrency — retry with next.
      const code = !!e && typeof e === "object" ? (e as { code?: string }).code : undefined;
      if (code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }

  throw new Error("Failed to allocate a unique invoice number.");
}
