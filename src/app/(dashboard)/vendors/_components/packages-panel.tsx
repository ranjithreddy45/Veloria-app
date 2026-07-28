"use client";

import * as React from "react";
import Link from "next/link";
import { PackageIcon, PlusIcon } from "lucide-react";

import { VENDOR_MODULE_CATEGORY_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PackageCard } from "./package-card";
import type { PackageCardData } from "./vendor-module";

// ============================================================
// PackagesPanel
// ============================================================

interface PackagesPanelProps {
  initial: PackageCardData[];
  total: number;
  search: string;
  category: string;
  vendors?: { id: string; name: string; categories: string[] }[];
}

export function PackagesPanel({
  initial,
  search,
  category,
}: PackagesPanelProps) {
  const filtered = React.useMemo(() => {
    let list = initial;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.vendor.name.toLowerCase().includes(q)
      );
    }

    if (category && category !== "all") {
      list = list.filter((p) => p.category === category);
    }

    return list;
  }, [initial, search, category]);

  if (filtered.length === 0) {
    const hasAny = initial.length > 0;

    return (
      <div className="rounded-2xl border border-dashed bg-card/50">
        {!hasAny ? (
          <EmptyState
            icon={<PackageIcon />}
            title="Your catalogue is a blank page"
            description="Packages are what your team quotes from — build the first one and it becomes sellable everywhere."
            action={
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/vendors/packages/new">
                  <PlusIcon className="size-3.5" strokeWidth={2.5} />
                  Create package
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<PackageIcon />}
            title="Nothing in the catalogue matches that"
            description={
              category !== "all"
                ? `Try a different search, or drop the "${VENDOR_MODULE_CATEGORY_LABELS[category] ?? category}" category filter.`
                : "Try a shorter search term — we match on package and vendor names."
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((pkg) => (
        <PackageCard
          key={pkg.id}
          data={pkg}
          href={`/vendors/packages/${pkg.id}`}
        />
      ))}
    </div>
  );
}
