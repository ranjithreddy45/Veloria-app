import type { Metadata } from "next";
import { PackageIcon } from "lucide-react";

import { listCatalogVendors, listPackageTemplates } from "@/actions/vendor-catalog.actions";
import { listVendorCategories } from "@/actions/vendor-category.actions";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PackageBuilder } from "../_components/package-builder";

export const metadata: Metadata = { title: "New package — Vendors & Packages" };

export default async function NewPackagePage({
  searchParams,
}: {
  searchParams: Promise<{ vendorId?: string }>;
}) {
  const { vendorId } = await searchParams;
  const [vendorsResult, categoriesResult, venuesResult, templates] = await Promise.all([
    listCatalogVendors({ pageSize: 200 }),
    listVendorCategories(),
    getVenues({ activeOnly: true }),
    listPackageTemplates(),
  ]);

  type VendorRow = { id: string; name: string; categories: string[] };
  const vendors: VendorRow[] = vendorsResult.success
    ? (vendorsResult.data.data as VendorRow[])
    : [];
  const categories = categoriesResult.success
    ? categoriesResult.data.map((c) => ({ key: c.key, label: c.label }))
    : [];
  const venues = venuesResult.success
    ? venuesResult.data.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }))
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

      <PackageBuilder
        vendors={vendors}
        categories={categories}
        venues={venues}
        templates={templates}
        defaultVendorId={vendorId}
      />
    </div>
  );
}
