import type { Metadata } from "next";
import { PackageIcon } from "lucide-react";

import { listCatalogVendors } from "@/actions/vendor-catalog.actions";
import { listVendorCategories } from "@/actions/vendor-category.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PackageBuilder } from "../_components/package-builder";

export const metadata: Metadata = { title: "New package — Vendors & Packages" };

export default async function NewPackagePage({
  searchParams,
}: {
  searchParams: Promise<{ vendorId?: string }>;
}) {
  const { vendorId } = await searchParams;
  const [vendorsResult, categoriesResult] = await Promise.all([
    listCatalogVendors({ pageSize: 200 }),
    listVendorCategories(),
  ]);

  type VendorRow = { id: string; name: string; categories: string[] };
  const vendors: VendorRow[] = vendorsResult.success
    ? (vendorsResult.data.data as VendorRow[])
    : [];
  const categories = categoriesResult.success
    ? categoriesResult.data.map((c) => ({ key: c.key, label: c.label }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PackageIcon}
        accent="teal"
        title="New package"
        eyebrow="Vendors · Packages"
        description="Define what the client actually gets — sections, items, choices, and the price it sells at."
      />

      <PackageBuilder vendors={vendors} categories={categories} defaultVendorId={vendorId} />
    </div>
  );
}
