import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getItem } from "@/actions/inventory.actions";
import { PageHeader } from "@/components/layout/page-header";
import { InventoryForm } from "../../_components/inventory-form";

export const metadata: Metadata = { title: "Edit Inventory Item" };

// ============================================================
// Edit Inventory Item Page
// ============================================================

interface EditInventoryItemPageProps {
  params: Promise<{ itemId: string }>;
}

export default async function EditInventoryItemPage({
  params,
}: EditInventoryItemPageProps) {
  const { itemId } = await params;
  const result = await getItem(itemId);

  if (!result.success || !result.data) {
    notFound();
  }

  const item = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Inventory Item"
        description={`Editing ${item.name}`}
      />
      <div className="mx-auto max-w-3xl">
        <InventoryForm item={item} />
      </div>
    </div>
  );
}
