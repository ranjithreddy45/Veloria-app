import type { Metadata } from "next";

import { listCatalogVendors } from "@/actions/vendor-catalog.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PackageBuilder } from "../_components/package-builder";

export const metadata: Metadata = { title: "New package — Vendors & Packages" };

export default async function NewPackagePage() {
  const vendorsResult = await listCatalogVendors({ pageSize: 200 });

  type VendorRow = { id: string; name: string; categories: string[] };
  const vendors: VendorRow[] = vendorsResult.success
    ? (vendorsResult.data.data as VendorRow[])
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New package"
        eyebrow="Vendors · Packages"
        description="Define a vendor service package: sections, items, choices, and pricing."
      />

      <PackageBuilder vendors={vendors} />
    </div>
  );
}
