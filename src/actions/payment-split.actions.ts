"use server";

// ============================================================
// Split payments — several people paying parts of ONE amount due.
// ------------------------------------------------------------
// Parent = the Invoice (parentLinkId = Invoice.id; the public pay link is
// /pay/<invoice.id>). Creation is gated on staff `payments:create` OR the
// portal host who owns the invoice (verified-contact choke-point). The public
// token routes validate the token server-side and mirror the EXISTING Razorpay
// order guards exactly (amount ≤ balanceDue, payable invoice, live booking).
// Paying a split records a normal Payment on the invoice, so receipts, GL,
// installment allocation and auto-confirm all flow through applyRazorpayCapture
// unchanged; that path then flips the split PAID (settleSplitOnCapture).
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { getVerifiedContactIds } from "@/lib/portal-identity";
import { logActivity } from "@/lib/activity-logger";
import { razorpayConfigured, razorpayKeyId, razorpayKeySecret } from "@/lib/payments/razorpay-creds";
import {
  MIN_SPLIT_PAISE,
  SPLIT_LINK_TTL_DAYS,
  SPLIT_PAYABLE_INVOICE_STATUSES,
  newSplitToken,
  splitLinkUrl,
  sumReservedPaise,
  toSplitRow,
} from "@/lib/payments/split-payments";
import {
  formatPaise,
  paiseToRupees,
  rupeesToPaise,
  splitEffectiveStatus,
  type CreateSplitPayerInput,
  type PublicSplitView,
  type SplitRow,
  type SplitTarget,
} from "@/lib/payments/split-format";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_PAYERS = 20;

function isPayableStatus(status: string): boolean {
  return (SPLIT_PAYABLE_INVOICE_STATUSES as readonly string[]).includes(status);
}

// ============================================================
// Authorization — ONE gate for every host/staff action here.
// Staff: the RBAC permission. Host: the invoice's contact must be one of the
// caller's VERIFIED contacts (C9 — never an unverified email match).
// ============================================================
type Actor = { kind: "STAFF" | "HOST"; userId: string };

async function authorizeInvoice(
  invoiceId: string,
  need: "read" | "create"
): Promise<{ actor: Actor; invoice: { id: string; contactId: string; bookingId: string | null } } | null> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid || !invoiceId) return null;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, contactId: true, bookingId: true },
  });
  if (!invoice) return null;
  const role = (session.user as { role?: string }).role ?? "";
  if (hasPermission(role, need === "create" ? "payments:create" : "payments:read")) {
    return { actor: { kind: "STAFF", userId: uid }, invoice };
  }
  const contactIds = await getVerifiedContactIds(uid);
  if (contactIds.includes(invoice.contactId)) {
    return { actor: { kind: "HOST", userId: uid }, invoice };
  }
  return null;
}

/** Serializable tx with a small retry on Postgres serialization failure (P2034). */
async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (e) {
      lastErr = e;
      if ((e as { code?: string }).code !== "P2034") throw e;
    }
  }
  throw lastErr ?? new Error("Transaction failed");
}

// ============================================================
// Target builder — open invoices + their splits → SplitTarget[]
// ============================================================
type InvoiceForTarget = {
  id: string;
  invoiceNumber: string;
  bookingId: string | null;
  paidAmount: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
  booking: { eventName: string } | null;
  installments: { label: string; amount: Prisma.Decimal; status: string }[];
};

async function buildTargets(invoices: InvoiceForTarget[]): Promise<SplitTarget[]> {
  if (invoices.length === 0) return [];
  const splits = await prisma.paymentSplit.findMany({
    where: { parentLinkId: { in: invoices.map((i) => i.id) } },
    orderBy: { createdAt: "asc" },
  });
  const byInvoice = new Map<string, typeof splits>();
  for (const s of splits) {
    const list = byInvoice.get(s.parentLinkId) ?? [];
    list.push(s);
    byInvoice.set(s.parentLinkId, list);
  }
  return invoices.map((inv) => {
    const outstandingPaise = Math.max(0, rupeesToPaise(Number(inv.balanceDue)));
    const mine = byInvoice.get(inv.id) ?? [];
    const reservedPaise = sumReservedPaise(mine);
    // Earliest installment not yet covered by paidAmount (oldest-first, the
    // same allocation the capture path uses), minus whatever of it is already
    // paid, clamped to the balance — a truthful "due now" default.
    let remainingPaid = rupeesToPaise(Number(inv.paidAmount));
    let nextDue: SplitTarget["nextDue"] = null;
    for (const inst of inv.installments) {
      const amt = rupeesToPaise(Number(inst.amount));
      if (!(amt > 0)) continue;
      if (remainingPaid >= amt) {
        remainingPaid -= amt;
        continue;
      }
      const due = Math.min(amt - remainingPaid, outstandingPaise);
      if (due > 0) nextDue = { label: inst.label, amountPaise: due };
      break;
    }
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      bookingId: inv.bookingId,
      eventName: inv.booking?.eventName ?? null,
      outstandingPaise,
      reservedPaise,
      availablePaise: Math.max(0, outstandingPaise - reservedPaise),
      nextDue,
      splits: mine.map(toSplitRow),
    };
  });
}

const TARGET_INVOICE_SELECT = {
  id: true,
  invoiceNumber: true,
  bookingId: true,
  paidAmount: true,
  balanceDue: true,
  booking: { select: { eventName: true } },
  installments: {
    select: { label: true, amount: true, status: true },
    orderBy: { dueDate: "asc" as const },
  },
} satisfies Prisma.InvoiceSelect;

// ============================================================
// HOST: the amounts due on my invoices, with their splits.
// ============================================================
export async function getHostSplitTargets(): Promise<SplitTarget[]> {
  try {
    const session = await auth();
    const uid = session?.user?.id;
    if (!uid) return [];
    const contactIds = await getVerifiedContactIds(uid);
    if (contactIds.length === 0) return [];
    const invoices = await prisma.invoice.findMany({
      where: {
        contactId: { in: contactIds },
        status: { in: [...SPLIT_PAYABLE_INVOICE_STATUSES] },
        balanceDue: { gt: 0 },
      },
      orderBy: { dueDate: "asc" },
      select: TARGET_INVOICE_SELECT,
    });
    return await buildTargets(invoices);
  } catch (error) {
    console.error("[GET_HOST_SPLIT_TARGETS_ERROR]", error);
    return [];
  }
}

// ============================================================
// STAFF: the amounts due on one booking, with their splits.
// ============================================================
export async function getBookingSplitTargets(bookingId: string): Promise<SplitTarget[]> {
  try {
    const session = await auth();
    if (!session?.user) return [];
    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "payments:read")) return [];
    const invoices = await prisma.invoice.findMany({
      where: {
        bookingId,
        status: { in: [...SPLIT_PAYABLE_INVOICE_STATUSES] },
        balanceDue: { gt: 0 },
      },
      orderBy: { dueDate: "asc" },
      select: TARGET_INVOICE_SELECT,
    });
    return await buildTargets(invoices);
  } catch (error) {
    console.error("[GET_BOOKING_SPLIT_TARGETS_ERROR]", error);
    return [];
  }
}

// ============================================================
// Create splits (host or staff)
// ============================================================
export async function createPaymentSplits(input: {
  invoiceId: string;
  payers: CreateSplitPayerInput[];
}): Promise<Result<{ splits: SplitRow[]; invoiceNumber: string; eventName: string | null }>> {
  try {
    const authz = await authorizeInvoice(input.invoiceId, "create");
    if (!authz) return { success: false, error: "You can't split payments on this invoice." };
    const { actor } = authz;

    // ---- Validate payers (server is the authority; the dialog only helps) ----
    const payers = Array.isArray(input.payers) ? input.payers : [];
    if (payers.length === 0) return { success: false, error: "Add at least one payer." };
    if (payers.length > MAX_PAYERS) return { success: false, error: `At most ${MAX_PAYERS} payers per split.` };
    const clean: { name: string; phone: string | null; email: string | null; amountPaise: number }[] = [];
    for (const p of payers) {
      const name = String(p?.name ?? "").trim().slice(0, 80);
      if (!name) return { success: false, error: "Every payer needs a name." };
      const phoneRaw = String(p?.phone ?? "").trim();
      const phone = phoneRaw ? phoneRaw.replace(/[^\d+]/g, "") : "";
      if (phone && !/^\+?\d{8,15}$/.test(phone)) {
        return { success: false, error: `${name}: enter a valid phone number.` };
      }
      const email = String(p?.email ?? "").trim().toLowerCase().slice(0, 120);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: `${name}: enter a valid email.` };
      }
      const amountPaise = Number(p?.amountPaise);
      if (!Number.isInteger(amountPaise) || amountPaise < MIN_SPLIT_PAISE) {
        return { success: false, error: `${name}: amount must be at least ${formatPaise(MIN_SPLIT_PAISE)}.` };
      }
      clean.push({ name, phone: phone || null, email: email || null, amountPaise });
    }
    const newTotalPaise = clean.reduce((s, p) => s + p.amountPaise, 0);

    const expiresAt = new Date(Date.now() + SPLIT_LINK_TTL_DAYS * 86_400_000);
    const token = () => newSplitToken();

    // ---- Atomic rule check + insert (Serializable: two concurrent creators
    // can't both pass the same "available" read and over-reserve) ----
    const created = await serializable(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          balanceDue: true,
          bookingId: true,
          booking: { select: { status: true, eventName: true } },
        },
      });
      if (!invoice) throw new Error("NOT_FOUND");
      if (!isPayableStatus(invoice.status)) throw new Error("NOT_PAYABLE");
      if (invoice.booking && invoice.booking.status === "CANCELLED") throw new Error("BOOKING_CANCELLED");

      const outstandingPaise = Math.max(0, rupeesToPaise(Number(invoice.balanceDue)));
      const existing = await tx.paymentSplit.findMany({
        where: { parentLinkId: invoice.id },
        select: { amountPaise: true, status: true, expiresAt: true },
      });
      const reservedPaise = sumReservedPaise(existing);
      const availablePaise = outstandingPaise - reservedPaise;
      // THE rule: Σ PENDING (unexpired) + new ≤ outstanding. Outstanding is
      // already net of PAID splits (they're real Payments), so this is exactly
      // "PENDING + PAID never exceeds what was owed".
      if (newTotalPaise > availablePaise) throw new Error(`EXCEEDS:${Math.max(0, availablePaise)}`);

      const rows: Awaited<ReturnType<typeof tx.paymentSplit.create>>[] = [];
      for (const p of clean) {
        rows.push(
          await tx.paymentSplit.create({
            data: {
              parentLinkId: invoice.id,
              invoiceId: invoice.id,
              bookingId: invoice.bookingId,
              token: token(),
              payerName: p.name,
              payerPhone: p.phone,
              payerEmail: p.email,
              amountPaise: p.amountPaise,
              status: "PENDING",
              expiresAt,
              createdById: actor.userId,
              createdBy: actor.kind,
            },
          })
        );
      }
      return { rows, invoiceNumber: invoice.invoiceNumber, eventName: invoice.booking?.eventName ?? null, bookingId: invoice.bookingId };
    });

    await logActivity({
      userId: actor.userId,
      action: "created_payment_splits",
      entityType: "Invoice",
      entityId: input.invoiceId,
      changes: {
        by: actor.kind,
        count: created.rows.length,
        totalPaise: newTotalPaise,
        payers: clean.map((p) => ({ name: p.name, amountPaise: p.amountPaise })),
      },
    });

    revalidatePath("/portal/payments");
    revalidatePath(`/invoices/${input.invoiceId}`);
    if (created.bookingId) revalidatePath(`/bookings/${created.bookingId}`);

    return {
      success: true,
      data: {
        splits: created.rows.map(toSplitRow),
        invoiceNumber: created.invoiceNumber,
        eventName: created.eventName,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.startsWith("EXCEEDS:")) {
      const avail = Number(msg.slice("EXCEEDS:".length)) || 0;
      return {
        success: false,
        error:
          avail <= 0
            ? "The full amount due is already covered by pending split links. Cancel one first, or wait for them to be paid."
            : `Those shares add up to more than what's left to split. At most ${formatPaise(avail)} can still be shared out.`,
      };
    }
    if (msg === "NOT_FOUND") return { success: false, error: "Invoice not found." };
    if (msg === "NOT_PAYABLE") return { success: false, error: "This invoice isn't open for payment." };
    if (msg === "BOOKING_CANCELLED") return { success: false, error: "This booking has been cancelled." };
    console.error("[CREATE_PAYMENT_SPLITS_ERROR]", error);
    return { success: false, error: "Couldn't create the split links. Please try again." };
  }
}

// ============================================================
// Cancel a pending split (host or staff)
// ============================================================
export async function cancelPaymentSplit(splitId: string): Promise<Result<{ id: string }>> {
  try {
    const split = await prisma.paymentSplit.findUnique({
      where: { id: splitId },
      select: { id: true, parentLinkId: true, bookingId: true, status: true, payerName: true },
    });
    if (!split) return { success: false, error: "Split not found." };
    const authz = await authorizeInvoice(split.parentLinkId, "create");
    if (!authz) return { success: false, error: "You can't change this split." };
    if (split.status !== "PENDING") return { success: false, error: "Only a pending split can be cancelled." };

    const res = await prisma.paymentSplit.updateMany({
      where: { id: split.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (res.count !== 1) return { success: false, error: "This split was just paid or cancelled." };

    await logActivity({
      userId: authz.actor.userId,
      action: "cancelled_payment_split",
      entityType: "Invoice",
      entityId: split.parentLinkId,
      changes: { splitId: split.id, payerName: split.payerName, by: authz.actor.kind },
    });
    revalidatePath("/portal/payments");
    revalidatePath(`/invoices/${split.parentLinkId}`);
    if (split.bookingId) revalidatePath(`/bookings/${split.bookingId}`);
    return { success: true, data: { id: split.id } };
  } catch (error) {
    console.error("[CANCEL_PAYMENT_SPLIT_ERROR]", error);
    return { success: false, error: "Couldn't cancel the split." };
  }
}

// ============================================================
// PUBLIC: load a split for the /pay/split/<token> page. The token is the
// only credential; it returns nothing beyond what THIS payer needs.
// ============================================================
export async function getPublicSplitForPayment(token: string): Promise<Result<PublicSplitView>> {
  try {
    if (!TOKEN_RE.test(token ?? "")) return { success: false, error: "Invalid link" };
    const split = await prisma.paymentSplit.findUnique({ where: { token } });
    if (!split) return { success: false, error: "Invalid link" };
    const invoice = await prisma.invoice.findUnique({
      where: { id: split.invoiceId ?? split.parentLinkId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        balanceDue: true,
        contact: { select: { firstName: true, lastName: true } },
        booking: { select: { eventName: true, date: true, status: true } },
      },
    });
    if (!invoice) return { success: false, error: "Invalid link" };
    const outstandingPaise = Math.max(0, rupeesToPaise(Number(invoice.balanceDue)));
    const invoicePayable =
      isPayableStatus(invoice.status) &&
      outstandingPaise > 0 &&
      !(invoice.booking && invoice.booking.status === "CANCELLED");
    return {
      success: true,
      data: {
        id: split.id,
        payerName: split.payerName,
        payerPhone: split.payerPhone ?? "",
        payerEmail: split.payerEmail ?? "",
        amountPaise: split.amountPaise,
        status: splitEffectiveStatus(split),
        paidAt: split.paidAt ? split.paidAt.toISOString() : null,
        expiresAt: split.expiresAt ? split.expiresAt.toISOString() : null,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        eventName: invoice.booking?.eventName ?? null,
        eventDate: invoice.booking?.date ? new Date(invoice.booking.date).toISOString() : null,
        hostName: `${invoice.contact.firstName} ${invoice.contact.lastName ?? ""}`.trim(),
        invoicePayable,
        exceedsOutstanding: split.amountPaise > outstandingPaise,
        outstandingPaise,
        url: splitLinkUrl(split.token),
      },
    };
  } catch (error) {
    console.error("[GET_PUBLIC_SPLIT_ERROR]", error);
    return { success: false, error: "Failed to load this payment link" };
  }
}

// ============================================================
// PUBLIC: mint (or reuse) the Razorpay order for a split.
// Mirrors createPublicRazorpayOrder's guards EXACTLY, then adds the split
// rule. The pending Payment row it creates carries the "Split payment by …"
// note, so the receipt/GL/portal history all say who paid.
// ============================================================
export async function createSplitRazorpayOrder(
  token: string
): Promise<Result<{ orderId: string; amount: number; currency: string; keyId: string | undefined }>> {
  try {
    if (!razorpayConfigured()) return { success: false, error: "Online payment is not configured" };
    if (!TOKEN_RE.test(token ?? "")) return { success: false, error: "Invalid link" };

    const split = await prisma.paymentSplit.findUnique({ where: { token } });
    if (!split) return { success: false, error: "Invalid link" };
    const effective = splitEffectiveStatus(split);
    if (effective === "PAID") return { success: false, error: "This share has already been paid." };
    if (effective === "CANCELLED") return { success: false, error: "This payment link was cancelled by the host." };
    if (effective === "EXPIRED") return { success: false, error: "This payment link has expired. Please ask the host for a fresh one." };

    const invoiceId = split.invoiceId ?? split.parentLinkId;
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        balanceDue: true,
        booking: { select: { status: true } },
      },
    });
    if (!invoice) return { success: false, error: "Invoice not found" };
    // ---- Same guards as the public invoice link (never weakened) ----
    if (invoice.status === "PAID" || invoice.status === "CANCELLED" || !isPayableStatus(invoice.status)) {
      return { success: false, error: "This invoice is not payable" };
    }
    if (invoice.booking && invoice.booking.status === "CANCELLED") {
      return { success: false, error: "This booking has been cancelled and the date is no longer reserved. Please contact the host." };
    }
    const outstandingPaise = Math.max(0, rupeesToPaise(Number(invoice.balanceDue)));
    const amountPaise = split.amountPaise;
    if (!(amountPaise >= MIN_SPLIT_PAISE) || amountPaise > outstandingPaise) {
      // Over-collection guard: a share can never exceed what's still owed.
      return { success: false, error: "The amount due has changed since this link was shared. Please ask the host for a fresh link." };
    }
    // ---- Split rule, re-checked at order time: Σ live PENDING ≤ outstanding ----
    const siblings = await prisma.paymentSplit.findMany({
      where: { parentLinkId: invoice.id },
      select: { amountPaise: true, status: true, expiresAt: true },
    });
    if (sumReservedPaise(siblings) > outstandingPaise) {
      return { success: false, error: "The shares on this invoice no longer add up to what's owed. Please ask the host for a fresh link." };
    }

    // ---- Reuse the open order for this split (a dismissed checkout can be
    // reopened on the same order) instead of piling up pending rows ----
    if (split.razorpayOrderId) {
      const open = await prisma.payment.findFirst({
        where: { razorpayOrderId: split.razorpayOrderId, status: "PENDING", invoiceId: invoice.id },
        select: { amount: true },
      });
      if (open && rupeesToPaise(Number(open.amount)) === amountPaise) {
        return {
          success: true,
          data: { orderId: split.razorpayOrderId, amount: amountPaise, currency: "INR", keyId: razorpayKeyId() },
        };
      }
    }

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: razorpayKeyId(), key_secret: razorpayKeySecret() });
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: invoice.invoiceNumber,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        source: "split_payment",
        splitId: split.id,
        payerName: split.payerName.slice(0, 60),
      },
    });

    // The pending Payment is the SAME record type every other Razorpay
    // payment uses — applyRazorpayCapture finds it by razorpayOrderId.
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: paiseToRupees(amountPaise),
          method: "RAZORPAY",
          status: "PENDING",
          razorpayOrderId: order.id,
          notes: `Split payment by ${split.payerName}`,
        },
      }),
      prisma.paymentSplit.update({
        where: { id: split.id },
        data: { razorpayOrderId: order.id },
      }),
    ]);

    return {
      success: true,
      data: { orderId: order.id, amount: amountPaise, currency: "INR", keyId: razorpayKeyId() },
    };
  } catch (error: unknown) {
    const e = error as { statusCode?: number; error?: { code?: string; description?: string } };
    const desc = e?.error?.description;
    console.error("[CREATE_SPLIT_RAZORPAY_ORDER_ERROR]", {
      statusCode: e?.statusCode,
      code: e?.error?.code,
      description: desc,
      raw: desc ? undefined : error,
    });
    if (e?.statusCode === 401) {
      return { success: false, error: "Payment gateway authentication failed. Please contact us — the link will be reissued." };
    }
    return {
      success: false,
      error: desc ? `Couldn't start payment: ${desc}` : "Failed to start payment. Please try again or contact us.",
    };
  }
}
