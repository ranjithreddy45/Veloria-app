/**
 * Idempotent importer for the Vendor Rate Card (reads scripts/vendor-import.json,
 * produced by normalize-vendor-rate-card.py). Safe to re-run: vendors are matched
 * case-insensitively by name (respecting the lower(name) unique index), packages by
 * vendor + name. Run:
 *   DATABASE_URL=<target> npx tsx scripts/import-vendor-rate-card.ts [--dry]
 */
import { PrismaClient, Prisma, VendorCategory, VendorPackagePriceUnit } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

type Pkg = { name: string; category: string; priceUnit: string; vendorPrice: number | null; customerPrice: number | null; description: string | null };
type Vendor = { name: string; email: string | null; phone: string | null; address: string | null; city: string | null; gstin: string | null; categoryKeys: string[]; primaryEnum: string; packages: Pkg[] };
type Data = { categories: { key: string; label: string }[]; vendors: Vendor[] };

const dec = (n: number | null) => (n == null ? null : new Prisma.Decimal(n.toFixed(2)));

async function main() {
  const data: Data = JSON.parse(readFileSync(join(process.cwd(), "scripts/vendor-import.json"), "utf8"));
  console.log(`Target DB host: ${(process.env.DATABASE_URL || "").replace(/:[^:@/]+@/, ":***@").replace(/\?.*$/, "")}`);
  console.log(`${DRY ? "[DRY RUN] " : ""}${data.vendors.length} vendors, ${data.vendors.reduce((s, v) => s + v.packages.length, 0)} packages, ${data.categories.length} new categories\n`);

  // 1) New catalog categories (idempotent by unique key).
  for (const [i, c] of data.categories.entries()) {
    if (!DRY) {
      await prisma.vendorCategoryDef.upsert({
        where: { key: c.key },
        update: { label: c.label, isActive: true },
        create: { key: c.key, label: c.label, isActive: true, sortOrder: 100 + i },
      });
    }
    console.log(`  category ${c.key} (${c.label}) ✓`);
  }

  let vCreated = 0, vUpdated = 0, pCreated = 0, pUpdated = 0;

  for (const v of data.vendors) {
    // Match case-insensitively by name (mirrors the lower(name) unique index).
    const existing = await prisma.vendor.findFirst({
      where: { name: { equals: v.name, mode: "insensitive" } },
      select: { id: true },
    });
    const vendorData = {
      name: v.name,
      category: v.primaryEnum as VendorCategory,
      status: "ACTIVE" as const,
      email: v.email || null,
      phone: v.phone || null,
      address: v.address || null,
      city: v.city || null,
      gstin: v.gstin || null,
      categories: v.categoryKeys,
      vendorType: "EXTERNAL",
      empanelmentStatus: "empanelled",
    };
    let vendorId: string;
    if (existing) {
      vendorId = existing.id;
      if (!DRY) await prisma.vendor.update({ where: { id: existing.id }, data: vendorData });
      vUpdated++;
    } else {
      if (DRY) { vendorId = `dry_${v.name}`; }
      else vendorId = (await prisma.vendor.create({ data: vendorData, select: { id: true } })).id;
      vCreated++;
    }
    console.log(`  vendor ${existing ? "updated" : "created"}: ${v.name} (${v.packages.length} pkgs)`);

    for (const p of v.packages) {
      const price = dec(p.customerPrice ?? p.vendorPrice ?? 0)!;
      const pkgData = {
        name: p.name,
        category: p.category,
        status: "ACTIVE" as const,
        price,
        priceUnit: p.priceUnit as VendorPackagePriceUnit,
        currency: "INR",
        description: p.description || null,
        vendorPrice: dec(p.vendorPrice),
        customerPrice: dec(p.customerPrice),
      };
      if (DRY) { pCreated++; continue; }
      const ex = await prisma.vendorPackage.findFirst({
        where: { vendorId, name: { equals: p.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (ex) { await prisma.vendorPackage.update({ where: { id: ex.id }, data: pkgData }); pUpdated++; }
      else { await prisma.vendorPackage.create({ data: { ...pkgData, vendorId } }); pCreated++; }
    }
  }

  console.log(`\n${DRY ? "[DRY] would " : ""}vendors: +${vCreated} new / ${vUpdated} updated · packages: +${pCreated} new / ${pUpdated} updated`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
