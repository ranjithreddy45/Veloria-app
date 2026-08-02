import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Landmark } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listEntitiesWithConfig } from "@/actions/hr-statutory-config.actions";
import { StatutoryConfigForm } from "./_components/statutory-config-form";

export const metadata: Metadata = { title: "Statutory configuration" };

export default async function StatutoryConfigPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:payroll")) redirect("/people");

  const canEdit = hasPermission(role, "hr:admin");
  const entities = await listEntitiesWithConfig();

  return (
    <div className="space-y-6">
      <Link
        href="/people/payroll"
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Payroll
      </Link>
      <PageHeader
        icon={Landmark}
        accent="emerald"
        title="Statutory configuration"
        description="Per-entity PF, ESI, Professional Tax, LWF and gratuity rules used by the payroll engine."
      />
      <StatutoryConfigForm entities={entities} canEdit={canEdit} />
    </div>
  );
}
