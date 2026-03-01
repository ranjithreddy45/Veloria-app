import type { Metadata } from "next";
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
        title="New Vendor"
        description="Add a new vendor to the marketplace."
      />
      <div className="mx-auto max-w-3xl">
        <VendorForm />
      </div>
    </div>
  );
}
