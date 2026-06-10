import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, PackageIcon } from "lucide-react";

import { getPackages } from "@/actions/package.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { PackageCard } from "./_components/package-card";

export const metadata: Metadata = { title: "Event Packages" };

// ============================================================
// Packages List Page
// ============================================================

export default async function PackagesPage() {
  const result = await getPackages();

  const packages = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 dark:border-zinc-800">
          <PackageIcon className="size-10 text-zinc-400 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            No packages yet
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
            Create your first event package to get started.
          </p>
          <Button asChild>
            <Link href="/packages/new">
              <PlusIcon className="mr-2 size-4" />
              Create Package
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
