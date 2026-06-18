"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { CatalogStoredInput, StoredQuoteInput } from "@/lib/sales/quotation-calc";

type Result<T> = { success: true; data: T } | { success: false; error: string; code?: number };

function isAdmin(role?: string) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// Escape user/catalog-derived text before interpolating into the email HTML.
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Share the LOCKED catalog selections with each package's assigned vendor.
 *
 * Catalog quotations freeze their chosen packages in `inputsJson.packages` but
 * that snapshot intentionally omits vendorId, so we re-read prisma.quotePackage
 * for the selected package ids to resolve the current vendor. Packages with no
 * vendor (or whose vendor has no email) are skipped and reported back.
 *
 * Best-effort per vendor: one failed send never aborts the rest.
 */
export async function shareQuotationWithVendors(
  quotationId: string
): Promise<Result<{ sent: number; skipped: string[] }>> {
  const session = await auth();
  const user = session?.user as { id: string; role?: string } | undefined;
  if (!user?.id) return { success: false, error: "Not authenticated.", code: 401 };

  const role = user.role;
  const allowed =
    isAdmin(role) ||
    (!!role && hasPermission(role, "quotes:read") && hasPermission(role, "quotes:send"));
  if (!allowed) return { success: false, error: "You do not have permission to share with vendors.", code: 403 };

  const row = await prisma.salesQuotation.findUnique({
    where: { id: quotationId },
    select: {
      id: true,
      quoteNumber: true,
      clientName: true,
      eventDate: true,
      timeSlot: true,
      guestCount: true,
      inputsJson: true,
    },
  });
  if (!row) return { success: false, error: "Quotation not found.", code: 404 };

  const stored = row.inputsJson as unknown as StoredQuoteInput;
  if ((stored as CatalogStoredInput)?.mode !== "catalog") {
    return { success: false, error: "Only catalog quotations can be shared with vendors.", code: 400 };
  }
  const catalogStored = stored as CatalogStoredInput;
  const selections = catalogStored.catalog?.selections ?? [];
  const frozen = catalogStored.packages ?? [];
  if (selections.length === 0) {
    return { success: false, error: "This quotation has no catalog selections to share.", code: 400 };
  }

  // Resolve current vendor per selected package from the DB (snapshot omits it).
  const packageIds = selections.map((s) => s.packageId);
  const dbPackages = await prisma.quotePackage.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, name: true, vendorId: true },
  });
  const vendorByPackage = new Map(dbPackages.map((p) => [p.id, p.vendorId]));
  const frozenById = new Map(frozen.map((p) => [p.id, p]));

  // Group selections by vendorId (skip packages with no vendor).
  type VendorGroup = { packageName: string; lockedItems: string[] }[];
  const byVendor = new Map<string, VendorGroup>();
  for (const sel of selections) {
    const vendorId = vendorByPackage.get(sel.packageId);
    if (!vendorId) continue;
    const pkg = frozenById.get(sel.packageId);
    const packageName =
      pkg?.name ?? dbPackages.find((p) => p.id === sel.packageId)?.name ?? "Package";
    const lockedItems = (pkg?.menuItems ?? [])
      .filter((m) => sel.lockedMenuItemIds?.includes(m.id))
      .map((m) => m.name);
    const group = byVendor.get(vendorId) ?? [];
    group.push({ packageName, lockedItems });
    byVendor.set(vendorId, group);
  }

  if (byVendor.size === 0) {
    return { success: false, error: "No selected packages have a vendor assigned.", code: 400 };
  }

  const vendors = await prisma.vendor.findMany({
    where: { id: { in: Array.from(byVendor.keys()) } },
    select: { id: true, name: true, email: true },
  });
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  const eventDateStr = row.eventDate ? formatDate(row.eventDate) : "TBC";
  const timeSlotStr = row.timeSlot || "TBC";
  const guests = row.guestCount || 0;

  let sent = 0;
  const skipped: string[] = [];

  for (const [vendorId, group] of byVendor.entries()) {
    const vendor = vendorById.get(vendorId);
    if (!vendor) {
      skipped.push(`${vendorId} (vendor not found)`);
      continue;
    }
    if (!vendor.email) {
      skipped.push(`${vendor.name} (no email)`);
      continue;
    }

    const packagesHtml = group
      .map((g) => {
        const items = g.lockedItems.length
          ? `<ul>${g.lockedItems.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
          : `<p style="margin:4px 0;color:#666">No specific items locked.</p>`;
        return `<p style="margin:12px 0 4px"><strong>${esc(g.packageName)}</strong></p>${items}`;
      })
      .join("");

    const html =
      `<p>Dear ${esc(vendor.name)},</p>` +
      `<p>Please find the locked selections for the following event (quotation <strong>${esc(
        row.quoteNumber
      )}</strong>${row.clientName ? ` — ${esc(row.clientName)}` : ""}):</p>` +
      `<p><strong>Event date:</strong> ${esc(eventDateStr)}<br/>` +
      `<strong>Time slot:</strong> ${esc(timeSlotStr)}<br/>` +
      `<strong>Guest count:</strong> ${esc(guests)}</p>` +
      packagesHtml +
      `<p>Kindly confirm availability and readiness for the above.</p>` +
      `<p>Warm regards,<br/>Veloria Grand</p>`;

    try {
      const res = await sendEmail({
        to: vendor.email,
        subject: `Veloria Grand — items for ${row.quoteNumber}`,
        html,
      });
      if (res.success) sent++;
      else skipped.push(`${vendor.name} (${res.error ?? "send failed"})`);
    } catch (e) {
      console.error("[VENDOR_SHARE_EMAIL_ERROR]", e);
      skipped.push(`${vendor.name} (send error)`);
    }
  }

  logActivity({
    userId: user.id,
    action: "QUOTATION_VENDOR_SHARED",
    entityType: "SalesQuotation",
    entityId: row.id,
    changes: { sent, skipped },
  });

  return { success: true, data: { sent, skipped } };
}
