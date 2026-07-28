import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { Importer } from "./_components/importer";

export const metadata: Metadata = { title: "Import People" };

export default async function ImportPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:write")) redirect("/people");

  return (
    <div className="space-y-6">
      <Link href="/people" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All people
      </Link>
      <PageHeader
        title="Bulk import"
        description="Add many employees at once from a CSV. We validate every row first — dry-run preview with per-row errors and warnings — so nothing imports until you’re happy."
      />
      <Importer />
    </div>
  );
}
