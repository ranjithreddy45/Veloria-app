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
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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
 * DB-authoritative re-validation + sanitisation of a quote's package lines.
 * Called from the create/update persist path AND at approval-freeze time so the
 * unit price, min-pax and max-discount caps are enforced server-side — the UI
 * enforces them too, but a crafted request must never win.
 *
 * Returns `{ errors, lines }`:
 *  - `errors` = human-readable strings (empty = OK); the caller MUST reject if
 *    non-empty.
 *  - `lines`  = the SAME lines with the unit price, min-pax, name and category
 *    OVERWRITTEN from the live catalog, so the stored/frozen figures never trust
 *    a client-supplied unitPrice (which previously let a rep fabricate the price
 *    basis and defeat the discount cap). Unknown/archived packages are dropped
 *    from `lines` and reported in `errors`.
 *
 * Gated on quotes:read — it is a "use server" export, hence a callable endpoint.
 */
export async function validatePackageLinesAgainstCatalog(
  lines: PackageLine[] | undefined | null
): Promise<{ errors: string[]; lines: PackageLine[] }> {
  const list = (lines ?? []).filter((p) => p && p.vendorPackageId);
  if (list.length === 0) return { errors: [], lines: [] }; // nothing to price → no gate needed

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !hasPermission(role, "quotes:read")) {
    return { errors: ["You don't have permission to price packages."], lines: [] };
  }

  const ids = Array.from(new Set(list.map((p) => p.vendorPackageId)));
  const pkgs = await prisma.vendorPackage.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      category: true,
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
  const corrected: PackageLine[] = [];
  for (const p of list) {
    const label = p.name?.trim() || "package";
    const pkg = byId.get(p.vendorPackageId);
    if (!pkg || pkg.status !== "ACTIVE") {
      errs.push(`Package "${label}" is no longer available.`);
      continue; // drop it from the sanitised lines
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
    // Catalog customerPrice is the un-forgeable REFERENCE. A sales-entered revised
    // (negotiated) price is allowed, but the client can never dodge the cap by
    // silently lowering the base — the reduction below catalog (revised mark-down +
    // any line discount) is what's capped, computed against the catalog gross.
    const catalogUnit = num(pkg.customerPrice ?? pkg.price);
    const revised =
      p.revisedUnitPrice != null && Number.isFinite(p.revisedUnitPrice) && p.revisedUnitPrice > 0
        ? r2(p.revisedUnitPrice)
        : null;
    // What the customer actually pays for this line (revised base − any line discount).
    // The capped quantity is the NET reduction below catalog: if the net price is still
    // at/above catalog (e.g. a mark-up with a small discount), the reduction is 0 and the
    // cap can't wrongly reject it — a mark-up is free revenue, never counted as a discount.
    const catalogGross = r2(catalogUnit * qty);
    const { amount: netAmount } = computePackageLine({ ...p, unitPrice: catalogUnit, revisedUnitPrice: revised ?? undefined, qty });
    const totalReduction = r2(Math.max(0, catalogGross - netAmount));
    if (pkg.maxDiscountValue != null && pkg.maxDiscountType) {
      const capVal = num(pkg.maxDiscountValue);
      const maxRupees =
        pkg.maxDiscountType === "PERCENT" ? catalogGross * (Math.min(100, capVal) / 100) : capVal;
      // 1-rupee tolerance for rounding.
      if (totalReduction - maxRupees > 1) {
        const capLabel = pkg.maxDiscountType === "PERCENT" ? `${capVal}%` : `₹${capVal}`;
        errs.push(`Package "${pkg.name}" revised price/discount exceeds the allowed cap of ${capLabel} below catalog.`);
      }
    } else if (totalReduction > 0) {
      // No cap configured → cannot be priced below its catalog rate.
      errs.push(`Package "${pkg.name}" cannot be priced below its catalog rate.`);
    }
    // Persist: catalog unitPrice (reference) + revised price (authoritative when set),
    // DB min-pax / name / category, client's qty + discount (validated above).
    corrected.push({
      ...p,
      unitPrice: catalogUnit,
      revisedUnitPrice: revised ?? undefined,
      qty,
      minPax: pkg.minPax ?? undefined,
      name: pkg.name,
      category: pkg.category,
    });
  }
  return { errors: errs, lines: corrected };
}
