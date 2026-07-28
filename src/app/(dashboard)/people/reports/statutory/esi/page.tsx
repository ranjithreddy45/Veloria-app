import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listStatutoryPeriods, getEsiRegister } from "@/actions/hr-report-statutory.actions";
import { NotFiledBanner } from "../_components/statutory-shared";
import { EsiRegisterView } from "./esi-register-view";

export const metadata: Metadata = { title: "ESI Register" };

export default async function EsiRegisterPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const periods = await listStatutoryPeriods();
  const first = periods[0];
  const initial = first ? await getEsiRegister({ fy: first.fy, month: first.month }) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People · Reports"
        title="ESI contribution register"
        description="For reconciliation, not the ESI return. Per-employee ESI legs with ESI no masked."
        accent="emerald"
      />
      <NotFiledBanner />
      <EsiRegisterView periods={periods} initial={initial} />
    </div>
  );
}
