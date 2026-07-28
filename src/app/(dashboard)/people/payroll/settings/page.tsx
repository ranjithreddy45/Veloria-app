import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listPayComponents } from "@/actions/hr-payroll-config.actions";
import { PayComponentsAdmin } from "./_components/pay-components-admin";

export const metadata: Metadata = { title: "Payroll Settings" };

export default async function PayrollSettingsPage() {
  if (!FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const components = await listPayComponents();

  return (
    <div className="space-y-6">
      <Link href="/people" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All people
      </Link>
      <PageHeader
        title="Payroll settings"
        description="Define the pay components that make up every salary structure. Statutory heads (PF, ESI, PT, TDS) are computed automatically by the payroll engine — you don't add them here."
      />
      <PayComponentsAdmin components={components} />
    </div>
  );
}
