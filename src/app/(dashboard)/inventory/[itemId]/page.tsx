import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilIcon } from "lucide-react";

import { getItem } from "@/actions/inventory.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
            {!item.isActive && (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {item.sku ? `SKU: ${item.sku}` : item.category}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/inventory/${item.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Detail Component */}
      <InventoryDetail item={item} />
    </div>
  );
}
