import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileCheck } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import {
  listRequiredDocTypes,
  getMissingMandatoryCounts,
} from "@/actions/hr-required-docs.actions";
import { RequiredDocsAdmin } from "./_components/required-docs-admin";

export const metadata: Metadata = { title: "Required Documents" };

export default async function RequiredDocsPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:admin")) redirect("/people");

  const [types, overview] = await Promise.all([
    listRequiredDocTypes(),
    getMissingMandatoryCounts(),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/people/settings"
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> People settings
      </Link>
      <PageHeader
        icon={FileCheck}
        accent="blue"
        title="Required Documents"
        description="Mandatory documents an employee must have on file."
      />
      <RequiredDocsAdmin types={types} overview={overview} />
    </div>
  );
}
