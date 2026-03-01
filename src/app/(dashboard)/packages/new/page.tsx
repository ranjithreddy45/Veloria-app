import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { PackageForm } from "../_components/package-form";

export const metadata: Metadata = { title: "New Package" };

// ============================================================
// Create Package Page
// ============================================================

export default function NewPackagePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Package"
        description="Create a new event package with items and pricing."
      />
      <div className="mx-auto max-w-3xl">
        <PackageForm />
      </div>
    </div>
  );
}
