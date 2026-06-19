import type { Metadata } from "next";

import { listCatalogVendors, listPackages } from "@/actions/vendor-catalog.actions";
import { PageHeader } from "@/components/layout/page-header";
import { VendorModule } from "./_components/vendor-module";

export const metadata: Metadata = { title: "Vendors & Packages" };

// ============================================================
// Vendors & Packages — Grand Module Root
// Server component: fetch both lists, hand off to the client shell.
// ============================================================

export default async function VendorsPage() {
  const [vendorsResult, packagesResult] = await Promise.all([
    listCatalogVendors({ pageSize: 100 }),
    listPackages({ pageSize: 100 }),
  ]);

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
        title="Vendors & Packages"
        eyebrow="Operations · Marketplace"
        description="Manage your empanelled vendor catalog, quality scores, and service packages."
      />

      <VendorModule
        vendors={vendors}
        vendorTotal={vendorTotal}
        packages={packages}
        packageTotal={packageTotal}
      />
    </div>
  );
}
