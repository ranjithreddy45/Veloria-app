"use client";

import * as React from "react";
import Link from "next/link";
import { PackageIcon, PlusIcon } from "lucide-react";

import { VENDOR_MODULE_CATEGORY_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
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
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-12 text-center">
        <PackageIcon className="mx-auto mb-3 size-8 text-muted-foreground/40" />
        {!hasAny ? (
          <>
            <p className="text-[15px] font-medium text-foreground">No packages yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Create your first vendor package to get started.
            </p>
            <Button asChild size="sm" className="mt-4 gap-1.5">
              <Link href="/vendors/packages/new">
                <PlusIcon className="size-3.5" strokeWidth={2.5} />
                Create package
              </Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-[15px] font-medium text-foreground">No packages match</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Try adjusting the search or{" "}
              {category !== "all" &&
                `removing the "${VENDOR_MODULE_CATEGORY_LABELS[category] ?? category}" filter`}
              .
            </p>
          </>
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
