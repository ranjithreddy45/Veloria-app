import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listPayrollRunPeriods, getStatutoryRegister } from "@/actions/hr-statutory-reports.actions";
import { RegistersView } from "./_components/registers-view";

export const metadata: Metadata = { title: "Statutory Registers" };

export default async function RegistersPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const periods = await listPayrollRunPeriods();
  // Default to the most recent period, if any.
  const first = periods[0];
  const initial = first
    ? await getStatutoryRegister({ fy: first.fy, month: first.month })
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payroll"
        title="Statutory Registers"
        description="The monthly PF / ESI / PT / TDS challan register — per-employee amounts and totals HR files returns from."
      />
      <RegistersView periods={periods as never} initial={initial as never} />
    </div>
  );
}
