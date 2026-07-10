import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, PackageIcon } from "lucide-react";

import { getPackages } from "@/actions/package.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PackagesCatalog } from "./_components/packages-catalog";

export const metadata: Metadata = { title: "Event Packages" };

// ============================================================
// Packages List Page
// ============================================================

export default async function PackagesPage() {
  const result = await getPackages();

  const packages = result.success ? result.data.data : [];

  const total = packages.length;
  const active = packages.filter((p) => p.isActive).length;
  const eyebrow = `CATALOG · ${total} ${total === 1 ? "PACKAGE" : "PACKAGES"} · ${active} ACTIVE`;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PackageIcon}
        accent="teal"
        eyebrow={eyebrow}
        title="Event Packages"
        help={<PageHelp id="packages" />}
        description="Manage your event packages and pricing tiers."
      >
        <Button asChild>
          <Link href="/packages/new">
            <PlusIcon className="mr-2 size-4" />
            New Package
          </Link>
        </Button>
      </PageHeader>

      {packages.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card shadow-card">
          <EmptyState
            icon={<PackageIcon className="size-5" />}
            title="No packages yet"
            description="Create your first event package to get started."
            action={
              <Button asChild>
                <Link href="/packages/new">
                  <PlusIcon className="mr-2 size-4" />
                  Create Package
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <PackagesCatalog packages={packages} />
      )}
    </div>
  );
}
