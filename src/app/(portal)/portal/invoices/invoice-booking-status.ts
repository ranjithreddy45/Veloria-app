import { prisma } from "@/lib/prisma";

// ============================================================
// The booking status behind each invoice the portal shows, so its invoice
// pages apply the public pay links' cancelled-booking rule (portalPayState in
// _components/invoice-balance.ts). The ids come from getPortalInvoices and
// getPortalInvoice, which already limit them to the signed-in customer's
// verified contacts; only the booking's status is read.
// Server only. On a read error the map is empty: the Pay button then shows, and
// POST /api/payments/create-order still refuses a cancelled booking.
// ============================================================

/** Invoice id → its booking's status, for the invoices that have a booking. */
export async function bookingStatusByInvoice(invoiceIds: readonly string[]): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  const ids = [...new Set(invoiceIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return statuses;
  try {
    const rows = await prisma.invoice.findMany({
      where: { id: { in: ids } },
      select: { id: true, booking: { select: { status: true } } },
    });
    for (const row of rows) {
      if (row.booking) statuses.set(row.id, row.booking.status);
    }
  } catch (e) {
    console.error("[PORTAL_INVOICE_BOOKING_STATUS_ERROR]", e);
  }
  return statuses;
}
