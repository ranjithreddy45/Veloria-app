import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon, PackageIcon, PencilIcon } from "lucide-react";

import { getItem } from "@/actions/inventory.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { InventoryDetail } from "../_components/inventory-detail";

export const metadata: Metadata = { title: "Inventory Item Details" };

// ============================================================
// Inventory Item Detail Page
// ============================================================

interface InventoryDetailPageProps {
  params: Promise<{ itemId: string }>;
}

export default async function InventoryDetailPage({
  params,
}: InventoryDetailPageProps) {
  const { itemId } = await params;
  const result = await getItem(itemId);

  if (!result.success || !result.data) {
    notFound();
  }

  const item = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PackageIcon}
        accent="amber"
        title={item.name}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/inventory" className="transition-colors hover:text-foreground">
              Inventory
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>{item.category}</span>
          </span>
        }
        description={item.sku ? `SKU ${item.sku}` : undefined}
      >
        <StatusPill
          label={item.isActive ? "Active" : "Inactive"}
          hue={item.isActive ? "emerald" : "slate"}
        />
        <Button variant="outline" asChild>
          <Link href={`/inventory/${item.id}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      {/* Detail Component */}
      <InventoryDetail item={item} />
    </div>
  );
}
