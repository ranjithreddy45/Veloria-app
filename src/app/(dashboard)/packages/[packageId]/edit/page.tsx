import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPackage } from "@/actions/package.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PackageForm } from "../../_components/package-form";

export const metadata: Metadata = { title: "Edit Package" };

// ============================================================
// Edit Package Page
// ============================================================

interface EditPackagePageProps {
  params: Promise<{ packageId: string }>;
}

export default async function EditPackagePage({
  params,
}: EditPackagePageProps) {
  const { packageId } = await params;
  const result = await getPackage(packageId);

  if (!result.success || !result.data) {
    notFound();
  }

  const eventPackage = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Package"
        description={`Editing ${eventPackage.name}`}
      />
      <div className="mx-auto max-w-3xl">
        <PackageForm
          eventPackage={{
            id: eventPackage.id,
            name: eventPackage.name,
            description: eventPackage.description,
            eventType: eventPackage.eventType,
            basePrice: Number(eventPackage.basePrice),
            tier: eventPackage.tier as "BASIC" | "STANDARD" | "PREMIUM" | "CUSTOM",
            isActive: eventPackage.isActive,
            imageUrl: eventPackage.imageUrl,
            items: eventPackage.items.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              category: item.category,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
              isIncluded: item.isIncluded,
              order: item.order,
            })),
          }}
        />
      </div>
    </div>
  );
}
