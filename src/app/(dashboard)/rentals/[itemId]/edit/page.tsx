import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRentalItem } from "@/actions/rental.actions";
import { PageHeader } from "@/components/layout/page-header";
import { RentalItemForm } from "../../_components/rental-item-form";

export const metadata: Metadata = { title: "Edit Rental Item" };

// ============================================================
// Edit Rental Item Page
// ============================================================

interface EditRentalItemPageProps {
  params: Promise<{ itemId: string }>;
}

export default async function EditRentalItemPage({
  params,
}: EditRentalItemPageProps) {
  const { itemId } = await params;
  const result = await getRentalItem(itemId);

  if (!result.success || !result.data) {
    notFound();
  }

  const item = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Rental Item"
        description={`Editing ${item.name}`}
      />
      <div className="mx-auto max-w-3xl">
        <RentalItemForm item={item} />
      </div>
    </div>
  );
}
