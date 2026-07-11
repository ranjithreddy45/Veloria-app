import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listStatutoryPeriods, getPtRegister } from "@/actions/hr-report-statutory.actions";
import { NotFiledBanner } from "../_components/statutory-shared";
import { PtRegisterView } from "./pt-register-view";

export const metadata: Metadata = { title: "PT Register" };

export default async function PtRegisterPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const periods = await listStatutoryPeriods();
  const first = periods[0];
  const initial = first ? await getPtRegister({ fy: first.fy, month: first.month }) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People · Reports"
        title="Professional Tax register"
        description="For reconciliation, not the PT challan. Per-employee PT grouped by the entity's PT state."
        accent="emerald"
      />
      <NotFiledBanner />
      <PtRegisterView periods={periods} initial={initial} />
    </div>
  );
}
