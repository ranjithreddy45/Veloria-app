import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPackage, listCatalogVendors } from "@/actions/vendor-catalog.actions";
import { listVendorCategories } from "@/actions/vendor-category.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PackageBuilder } from "../../_components/package-builder";

export const metadata: Metadata = { title: "Edit package — Vendors & Packages" };

interface EditPackagePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPackagePage({ params }: EditPackagePageProps) {
  const { id } = await params;

  const [pkgResult, vendorsResult, categoriesResult] = await Promise.all([
    getPackage(id),
    listCatalogVendors({ pageSize: 200 }),
    listVendorCategories(),
  ]);

  if (!pkgResult.success) notFound();

  type VendorRow = { id: string; name: string; categories: string[] };
  const vendors: VendorRow[] = vendorsResult.success
    ? (vendorsResult.data.data as VendorRow[])
    : [];
  const categories = categoriesResult.success
    ? categoriesResult.data.map((c) => ({ key: c.key, label: c.label }))
    : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pkg = pkgResult.data as any;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${pkg.name}`}
        eyebrow="Vendors · Packages"
        description="Update package details, sections, items, and images."
      />

      <PackageBuilder vendors={vendors} categories={categories} initial={pkg} />
    </div>
  );
}
