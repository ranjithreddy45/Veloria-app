import type { Metadata } from "next";
import { StoreIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { VendorForm } from "../_components/vendor-form";

export const metadata: Metadata = { title: "New Vendor" };

// ============================================================
// Create Vendor Page
// ============================================================

export default function NewVendorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={StoreIcon}
        accent="teal"
        eyebrow="Vendors · Partners"
        title="New vendor"
        description="Add a partner to the bench. Their packages, rates, and ratings all hang off this record."
      />
      <div className="mx-auto max-w-3xl">
        <VendorForm />
      </div>
    </div>
  );
}
