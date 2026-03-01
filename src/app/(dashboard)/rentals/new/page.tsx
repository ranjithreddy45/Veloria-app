import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { RentalItemForm } from "../_components/rental-item-form";

export const metadata: Metadata = { title: "New Rental Item" };

// ============================================================
// Create Rental Item Page
// ============================================================

export default function NewRentalItemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Rental Item"
        description="Add a new item to the equipment rental catalog."
      />
      <div className="mx-auto max-w-3xl">
        <RentalItemForm />
      </div>
    </div>
  );
}
