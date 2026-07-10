import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HandCoins, Users, BadgeIndianRupee } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { listAdvances, listAdvanceEmployees } from "@/actions/hr-advance.actions";
import { NewAdvanceButton } from "./_components/new-advance-button";
import { AdvancesTable } from "./_components/advances-table";

export const metadata: Metadata = { title: "Salary advances" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default async function AdvancesPage() {
  if (!FEATURES.hrPayroll) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:payroll")) redirect("/people");

  const [advances, employees] = await Promise.all([
    listAdvances(),
    listAdvanceEmployees(),
  ]);

  const activeAdvances = advances.filter((a) => a.status === "ACTIVE");
  const totalOutstanding = activeAdvances.reduce((s, a) => s + a.outstanding, 0);
  const recoveredToDate = advances.reduce((s, a) => s + a.recovered, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Salary advances"
        description="Advances paid to employees and recovered from their salary in monthly instalments. Instalments are deducted automatically when payroll is processed."
        icon={HandCoins}
        accent="emerald"
      >
        <NewAdvanceButton employees={employees} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Total outstanding"
          value={inr(totalOutstanding)}
          accent="emerald"
          icon={<HandCoins />}
          sub="Across active advances"
        />
        <StatTile
          label="Active advances"
          value={activeAdvances.length}
          accent="indigo"
          icon={<Users />}
          sub="Currently being recovered"
        />
        <StatTile
          label="Recovered to date"
          value={inr(recoveredToDate)}
          accent="teal"
          icon={<BadgeIndianRupee />}
          sub="All advances, all runs"
        />
      </div>

      <AdvancesTable rows={advances} />

      <p className="text-[12px] text-muted-foreground">
        Instalments are deducted automatically when payroll is processed. This screen records and
        tracks advances; it does not itself post any recovery.
      </p>
    </div>
  );
}
