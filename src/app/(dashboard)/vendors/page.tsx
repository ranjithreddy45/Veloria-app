import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getVendors } from "@/actions/vendor.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { VendorsTable } from "./_components/vendors-table";
import { VendorStatStrip } from "./_components/vendor-stat-strip";

export const metadata: Metadata = { title: "Vendors" };

// ============================================================
// Vendors List Page
// ============================================================

export default async function VendorsPage() {
  // Ceiling lets the client table page + facet through rows without the
  // default-50 cutoff, while keeping the payload lighter than 1000.
  const result = await getVendors({ limit: 500 });

  const vendors = result.success ? result.data.data : [];

  const active = vendors.filter((v) => v.status === "ACTIVE").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendors"
        help={<PageHelp id="vendors" />}
        eyebrow={
          <div className="flex items-center gap-3">
            <span>Operations · Marketplace</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{vendors.length}</span> vendors
            </span>
            <span className="h-3 w-px bg-border" />
            <span>
              <span className="font-semibold tabular-nums text-foreground/80">{active}</span> active
            </span>
          </div>
        }
        description="Manage your vendor marketplace, ratings, and assignments."
      >
        <Button asChild>
          <Link href="/vendors/new">
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            New vendor
          </Link>
        </Button>
      </PageHeader>

      <VendorStatStrip vendors={vendors} />

      <VendorsTable data={vendors} />
    </div>
  );
}
