import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { InventoryForm } from "../_components/inventory-form";

export const metadata: Metadata = { title: "New Inventory Item" };

// ============================================================
// Create Inventory Item Page
// ============================================================

export default function NewInventoryItemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Inventory Item"
        description="Add a new item to your inventory."
      />
      <div className="mx-auto max-w-3xl">
        <InventoryForm />
      </div>
    </div>
  );
}
