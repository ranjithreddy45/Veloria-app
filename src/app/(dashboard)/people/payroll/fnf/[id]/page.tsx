import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { getFnf } from "@/actions/hr-fnf.actions";
import { FnfDetail } from "./_components/fnf-detail";

export const metadata: Metadata = { title: "Settlement" };

const STATUS_HUE: Record<string, "slate" | "amber" | "emerald"> = {
  DRAFT: "slate", APPROVED: "amber", PAID: "emerald",
};

export default async function FnfDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const { id } = await params;
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const fnf = await getFnf(id);
  if (!fnf) notFound();

  return (
    <div className="space-y-6">
      <Link href="/people/payroll/fnf" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Full & Final Settlements
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Full & Final"
          title={fnf.name}
          description={`${fnf.empCode} · Last working day ${formatDate(fnf.lastWorkingDay)}`}
        />
        <StatusPill label={fnf.status[0] + fnf.status.slice(1).toLowerCase()} hue={STATUS_HUE[fnf.status] ?? "slate"} size="sm" />
      </div>

      <FnfDetail fnf={fnf as never} />
    </div>
  );
}
