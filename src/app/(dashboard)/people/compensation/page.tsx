import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Users, BadgeIndianRupee, Wallet, AlertCircle } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { listCompensation } from "@/actions/hr-compensation.actions";
import { CompensationTable } from "./_components/compensation-table";

export const metadata: Metadata = { title: "Compensation" };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default async function CompensationPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const rows = await listCompensation();

  const total = rows.length;
  const withStructure = rows.filter((r) => r.annualCtc != null).length;
  const without = total - withStructure;
  const totalMonthly = rows.reduce((sum, r) => sum + (r.monthlyCtc ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compensation"
        description="Company-wide view of current CTC by employee. Open a profile to revise a salary structure — revisions keep full history."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active employees" value={total} accent="indigo" icon={<Users />} />
        <StatTile label="Salary set" value={withStructure} accent="emerald" icon={<BadgeIndianRupee />} sub="Have a current structure" />
        <StatTile label="Pending setup" value={without} accent="amber" icon={<AlertCircle />} sub="No CTC yet" />
        <StatTile label="Monthly CTC" value={inr(totalMonthly)} accent="violet" icon={<Wallet />} sub="Sum of current structures" />
      </div>

      <CompensationTable rows={rows} />
    </div>
  );
}
