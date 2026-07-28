import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreIcon } from "lucide-react";
import { getVendor } from "@/actions/vendor.actions";
import { PageHeader } from "@/components/layout/page-header";
import { VendorForm } from "../../_components/vendor-form";

export const metadata: Metadata = { title: "Edit Vendor" };

// ============================================================
// Edit Vendor Page
// ============================================================

interface EditVendorPageProps {
  params: Promise<{ vendorId: string }>;
}

export default async function EditVendorPage({
  params,
}: EditVendorPageProps) {
  const { vendorId } = await params;
  const result = await getVendor(vendorId);

  if (!result.success || !result.data) {
    notFound();
  }

  const vendor = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={StoreIcon}
        accent="teal"
        eyebrow="Vendors · Partners"
        title="Edit vendor"
        description={`Updating ${vendor.name}`}
      />
      <div className="mx-auto max-w-3xl">
        <VendorForm vendor={vendor} />
      </div>
    </div>
  );
}
