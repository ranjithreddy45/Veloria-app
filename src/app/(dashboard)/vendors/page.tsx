import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getVendors } from "@/actions/vendor.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { VendorsTable } from "./_components/vendors-table";

export const metadata: Metadata = { title: "Vendors" };

// ============================================================
// Vendors List Page
// ============================================================

export default async function VendorsPage() {
  const result = await getVendors();

  const vendors = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Manage your vendor marketplace and assignments."
      >
        <Button asChild>
          <Link href="/vendors/new">
            <PlusIcon className="mr-2 size-4" />
            New Vendor
          </Link>
        </Button>
      </PageHeader>
      <VendorsTable data={vendors} />
    </div>
  );
}
