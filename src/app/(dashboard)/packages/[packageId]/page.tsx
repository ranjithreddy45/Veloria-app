import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPackage } from "@/actions/package.actions";
import { PackageDetail } from "../_components/package-detail";

export const metadata: Metadata = { title: "Package Details" };

// ============================================================
// Package Detail Page
// ============================================================

interface PackageDetailPageProps {
  params: Promise<{ packageId: string }>;
}

export default async function PackageDetailPage({
  params,
}: PackageDetailPageProps) {
  const { packageId } = await params;
  const result = await getPackage(packageId);

  if (!result.success || !result.data) {
    notFound();
  }

  // Data is already serialized (Decimal → number) in the server action
  return <PackageDetail eventPackage={result.data} />;
}
