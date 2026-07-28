import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listFnf, listFnfEmployees } from "@/actions/hr-fnf.actions";
import { FnfHome } from "./_components/fnf-home";

export const metadata: Metadata = { title: "Full & Final Settlements" };

export default async function FnfPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const { employeeId } = await searchParams;
  const [settlements, employees] = await Promise.all([listFnf(), listFnfEmployees()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll"
        title="Full & Final Settlements"
        description="Compute a leaver's gratuity, leave encashment and pending salary, less notice recovery — save a draft, get it approved, and mark it paid."
      />
      <FnfHome settlements={settlements as never} employees={employees as never} initialEmployeeId={employeeId} />
    </div>
  );
}
