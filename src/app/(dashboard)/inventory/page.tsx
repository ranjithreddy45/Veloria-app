import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, AlertTriangleIcon } from "lucide-react";

import { getItems, getLowStockAlerts } from "@/actions/inventory.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InventoryTable } from "./_components/inventory-table";

export const metadata: Metadata = { title: "Inventory" };

// ============================================================
// Inventory List Page
// ============================================================

export default async function InventoryPage() {
  const [itemsResult, lowStockResult] = await Promise.all([
    getItems(),
    getLowStockAlerts(),
  ]);

  const items = itemsResult.success ? itemsResult.data.data : [];
  const lowStockItems = lowStockResult.success ? lowStockResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage inventory items and stock levels."
      >
        <Button asChild>
          <Link href="/inventory/new">
            <PlusIcon className="mr-2 size-4" />
            New Item
          </Link>
        </Button>
      </PageHeader>

      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-200">
              <AlertTriangleIcon className="size-5" />
              Low Stock Alert ({lowStockItems.length}{" "}
              {lowStockItems.length === 1 ? "item" : "items"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(
                (item: {
                  id: string;
                  name: string;
                  availableQty: number;
                  reorderLevel: number;
                }) => (
                  <Link
                    key={item.id}
                    href={`/inventory/${item.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
                  >
                    {item.name}
                    <span className="text-amber-600 dark:text-amber-400">
                      ({item.availableQty}/{item.reorderLevel})
                    </span>
                  </Link>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <InventoryTable data={items} />
    </div>
  );
}
