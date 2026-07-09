"use server";

// ============================================================
// Quote ← Vendor packages (read + server-side cap validation).
// ------------------------------------------------------------
// The Sales quotation builder lets a rep add vendor-package line items. This
// module is the ONLY quotation-side reader of the vendor catalog (the vendor
// module owns vendor-catalog.actions.ts). It returns customer-safe, plain-
// serialized DTOs and re-checks each package line's min-pax + max-discount cap
// against the live DB so a tampered client payload can never exceed a cap.
// "use server": every export is an async function (types live in quotation-calc).
// ============================================================

import { prisma } from "@/lib/prisma";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import {
  computePackageLine,
  type PackageLine,
  type QuotePackageOption,
} from "@/lib/sales/quotation-calc";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * ACTIVE vendor packages the rep may add to a quote, grouped/sorted by category
 * (then name). Decimals → plain numbers; customerPrice falls back to `price`.
 * Requires quotes:read (the builder is a sales surface).
 */
export async function getQuotePackageOptions(): Promise<QuotePackageOption[]> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "quotes:read")) return [];

  const rows = await prisma.vendorPackage.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      customerPrice: true,
      minPax: true,
      maxDiscountType: true,
      maxDiscountValue: true,
      priceUnit: true,
      vendor: { select: { name: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    vendorName: r.vendor?.name ?? "—",
    // customerPrice is the price shown to the customer; fall back to `price`.
    customerPrice: num(r.customerPrice ?? r.price),
    minPax: r.minPax ?? null,
    maxDiscountType: r.maxDiscountType ?? null,
    maxDiscountValue: r.maxDiscountValue != null ? num(r.maxDiscountValue) : null,
    priceUnit: String(r.priceUnit),
  }));
}

/**
 * DB-authoritative re-validation of a quote's package lines. Called from the
 * create/update persist path so the min-pax + max-discount caps are enforced
 * server-side (the UI enforces them too, but a crafted request must not win).
 * Returns human-readable error strings (empty = OK). Unknown/archived package
 * ids are rejected. The discount cap compares the ACTUAL rupee discount applied
 * (via the shared engine) against the package's cap, whatever the cap's unit.
 */
export async function validatePackageLinesAgainstCatalog(
  lines: PackageLine[] | undefined | null
): Promise<string[]> {
  const list = (lines ?? []).filter((p) => p && p.vendorPackageId);
  if (list.length === 0) return [];

  const ids = Array.from(new Set(list.map((p) => p.vendorPackageId)));
  const pkgs = await prisma.vendorPackage.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      status: true,
      price: true,
      customerPrice: true,
      minPax: true,
      maxDiscountType: true,
      maxDiscountValue: true,
    },
  });
  const byId = new Map(pkgs.map((p) => [p.id, p]));

  const errs: string[] = [];
  for (const p of list) {
    const label = p.name?.trim() || "package";
    const pkg = byId.get(p.vendorPackageId);
    if (!pkg || pkg.status !== "ACTIVE") {
      errs.push(`Package "${label}" is no longer available.`);
      continue;
    }
    const qty = Math.floor(p.qty ?? 0);
    if (qty < 1) {
      errs.push(`Package "${pkg.name}" needs a quantity of at least 1.`);
      continue;
    }
    // Min-pax cap (DB-authoritative).
    if (pkg.minPax != null && qty < pkg.minPax) {
      errs.push(`Package "${pkg.name}" requires a minimum of ${pkg.minPax} pax/units.`);
    }
    // Max-discount cap. Compute the rupee discount the engine would apply, then
    // compare against the package's cap expressed in its own unit.
    const unitPrice = num(pkg.customerPrice ?? pkg.price);
    const { gross, lineDiscount } = computePackageLine({ ...p, unitPrice, qty });
    if (pkg.maxDiscountValue != null && pkg.maxDiscountType) {
      const capVal = num(pkg.maxDiscountValue);
      const maxRupees =
        pkg.maxDiscountType === "PERCENT" ? gross * (Math.min(100, capVal) / 100) : capVal;
      // 1-rupee tolerance for rounding.
      if (lineDiscount - maxRupees > 1) {
        const capLabel = pkg.maxDiscountType === "PERCENT" ? `${capVal}%` : `₹${capVal}`;
        errs.push(`Package "${pkg.name}" discount exceeds the allowed cap of ${capLabel}.`);
      }
    } else if (lineDiscount > 0) {
      // No cap configured → no discount permitted on this package.
      errs.push(`Package "${pkg.name}" does not allow a discount.`);
    }
  }
  return errs;
}
