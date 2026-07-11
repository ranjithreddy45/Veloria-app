import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listStatutoryPeriods, getPfRegister } from "@/actions/hr-report-statutory.actions";
import { NotFiledBanner } from "../_components/statutory-shared";
import { PfRegisterView } from "./pf-register-view";

export const metadata: Metadata = { title: "PF Register" };

export default async function PfRegisterPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const periods = await listStatutoryPeriods();
  const first = periods[0];
  const initial = first ? await getPfRegister({ fy: first.fy, month: first.month }) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People · Reports"
        title="PF contribution register"
        description="For reconciliation, not the ECR file. Per-employee PF legs with UAN/PF no masked."
        accent="emerald"
      />
      <NotFiledBanner />
      <PfRegisterView periods={periods} initial={initial} />
    </div>
  );
}
