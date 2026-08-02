import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getLeaveTypesAdmin } from "@/actions/hr-leave.actions";
import { LeaveTypesAdmin, type LeaveTypeRow } from "../_components/leave-types-admin";

export const metadata: Metadata = { title: "Leave types" };

export default async function LeaveTypesPage() {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:admin")) redirect("/people/leave");

  const rows = await getLeaveTypesAdmin();
  const types: LeaveTypeRow[] = rows.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    paid: t.paid,
    accrualPerYear: t.accrualPerYear,
    carryForwardMax: t.carryForwardMax,
    allowHalfDay: t.allowHalfDay,
    allowNegative: t.allowNegative,
    requiresApproval: t.requiresApproval,
    color: t.color,
    isActive: t.isActive,
    order: t.order,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/people/leave"
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to leave
      </Link>
      <PageHeader
        title="Leave types"
        description="Configure the leave catalogue — entitlement, carry-forward, half-day rules, approval and colour. These drive every employee's balances and applications."
      />
      <LeaveTypesAdmin types={types} />
    </div>
  );
}
