import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getLeaveBalancesAdmin } from "@/actions/hr-leave.actions";
import { LeaveBalancesAdmin } from "../_components/leave-balances-admin";

export const metadata: Metadata = { title: "Leave balances" };

export default async function LeaveBalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read")) redirect("/people/leave");
  const canProvision = hasPermission(role, "hr:admin");

  const { year } = await searchParams;
  const parsed = Number(year);
  const selectedYear = Number.isInteger(parsed) && parsed > 2000 && parsed < 3000
    ? parsed
    : new Date().getUTCFullYear();

  const data = await getLeaveBalancesAdmin({ year: selectedYear });

  return (
    <div className="space-y-5">
      <Link
        href="/people/leave"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to leave
      </Link>
      <PageHeader
        title="Leave balances"
        description="Every active employee's entitlement, usage and remaining balance per leave type. Provision balances to seed the year for all employees at once."
      />
      <LeaveBalancesAdmin
        year={data.year}
        types={data.types}
        rows={data.rows}
        canProvision={canProvision}
      />
    </div>
  );
}
