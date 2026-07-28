import type { Metadata } from "next";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { StoreIcon } from "lucide-react";
import { serialize } from "@/lib/utils";
import { listCatalogVendors, listPackages } from "@/actions/vendor-catalog.actions";
import { listVendorCategories } from "@/actions/vendor-category.actions";
import { PageHeader } from "@/components/layout/page-header";
import { VendorModule } from "./_components/vendor-module";

export const metadata: Metadata = { title: "Vendors & Packages" };

// ============================================================
// Vendors & Packages — Grand Module Root
// Server component: fetch both lists, hand off to the client shell.
// ============================================================

export default async function VendorsPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  const canManageCategories = hasPermission(role, "vendor-categories:manage");

  const [vendorsResult, packagesResult, categoriesResult, venueRows] = await Promise.all([
    listCatalogVendors({ pageSize: 100 }),
    listPackages({ pageSize: 100 }),
    listVendorCategories(),
    prisma.venue.findMany({
      where: { isActive: true },
      select: { id: true, name: true, capacity: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const categories = categoriesResult.success
    ? categoriesResult.data.map((c) => ({ key: c.key, label: c.label }))
    : [];
  const venues = serialize(venueRows);

  type VendorRow = {
    id: string;
    name: string;
    categories: string[];
    category: string;
    city: string | null;
    email: string | null;
    phone: string | null;
    empanelmentStatus: string | null;
    qualityScore: number | null;
    isArchived: boolean;
    packageCount: number;
    vendorType: string | null;
    venueIds: string[];
    allVenues: boolean;
  };

  type PackageRow = {
    id: string;
    name: string;
    category: string;
    status: string;
    price: number;
    priceUnit: string;
    currency: string;
    description: string | null;
    vendor: { id: string; name: string };
    coverUrl: string | null;
    sectionCount: number;
    itemCount: number;
  };

  const vendors: VendorRow[] = vendorsResult.success
    ? (vendorsResult.data.data as VendorRow[])
    : [];
  const vendorTotal: number = vendorsResult.success
    ? vendorsResult.data.total
    : 0;

  const packages: PackageRow[] = packagesResult.success
    ? (packagesResult.data.data as PackageRow[])
    : [];
  const packageTotal: number = packagesResult.success
    ? packagesResult.data.total
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        aura
        icon={StoreIcon}
        accent="teal"
        title="Vendors & Packages"
        eyebrow={`Operations · Marketplace · ${vendorTotal} vendors · ${packageTotal} packages`}
        description="Your empanelled bench and everything they sell — kept current so quotes never wait on a phone call."
      />

      <VendorModule
        vendors={vendors}
        vendorTotal={vendorTotal}
        packages={packages}
        packageTotal={packageTotal}
        categories={categories}
        venues={venues}
        canManageCategories={canManageCategories}
      />
    </div>
  );
}
