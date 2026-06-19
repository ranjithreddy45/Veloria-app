"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Finance · Revenue Automation — READ-only, GL-neutral.
// Two derived views: (1) confirmed bookings missing an invoice, routed to the
// existing new-invoice flow; (2) per-vendor payout statements. Neither posts to
// the ledger — they reuse existing booking/invoice/payout data.
// All exports finance:read-gated; non-async-safe (return [] on denial).
// ============================================================

async function role(): Promise<string | undefined> {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role;
}

function canRead(r: string | undefined): boolean {
  return !!r && hasPermission(r, "finance:read");
}

export type UninvoicedBooking = {
  id: string;
  bookingNumber: string;
  eventName: string;
  contact: string;
  date: string;
  amount: number;
};

// Confirmed bookings that have no linked invoice yet. Action target is the
// existing prefilled new-invoice route — we never create invoices here.
export async function getUninvoicedBookings(): Promise<UninvoicedBooking[]> {
  if (!canRead(await role())) return [];

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      invoices: { none: {} },
    },
    select: {
      id: true,
      bookingNumber: true,
      eventName: true,
      date: true,
      totalAmount: true,
      contact: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: "asc" },
  });

  return bookings.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    eventName: b.eventName,
    contact: `${b.contact.firstName} ${b.contact.lastName}`.trim(),
    date: b.date.toISOString(),
    amount: Number(b.totalAmount),
  }));
}

export type VendorPayout = {
  id: string;
  amount: number;
  status: string;
  description: string | null;
  createdAt: string;
};

export type PayoutStatement = {
  vendorId: string;
  vendor: string;
  total: number;
  paid: number;
  pending: number;
  count: number;
  payouts: VendorPayout[];
};

// Per-vendor payout statement: total / paid / pending, plus a drill of the
// vendor's individual payouts. Read-only; PAID = settled, everything else
// (PENDING/APPROVED) is treated as still owing.
export async function getPayoutStatements(): Promise<PayoutStatement[]> {
  if (!canRead(await role())) return [];

  const payouts = await prisma.payout.findMany({
    where: { vendorId: { not: null } },
    select: {
      id: true,
      amount: true,
      status: true,
      description: true,
      createdAt: true,
      vendorId: true,
      vendor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byVendor = new Map<string, PayoutStatement>();

  for (const p of payouts) {
    if (!p.vendorId) continue;
    const amount = Number(p.amount);
    let row = byVendor.get(p.vendorId);
    if (!row) {
      row = {
        vendorId: p.vendorId,
        vendor: p.vendor?.name ?? "Unknown vendor",
        total: 0,
        paid: 0,
        pending: 0,
        count: 0,
        payouts: [],
      };
      byVendor.set(p.vendorId, row);
    }
    if (p.status !== "CANCELLED") {
      row.total += amount;
      if (p.status === "PAID") row.paid += amount;
      else row.pending += amount;
      row.count += 1;
    }
    row.payouts.push({
      id: p.id,
      amount,
      status: p.status,
      description: p.description,
      createdAt: p.createdAt.toISOString(),
    });
  }

  return Array.from(byVendor.values()).sort((a, b) => b.total - a.total);
}
