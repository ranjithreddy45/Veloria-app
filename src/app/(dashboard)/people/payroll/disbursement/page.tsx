import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { getDisbursement, listDisbursementRuns } from "@/actions/hr-salary-hold.actions";
import { DisbursementView } from "./_components/disbursement-view";

export const metadata: Metadata = { title: "Disbursement" };

export default async function DisbursementPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; month?: string }>;
}) {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const runs = await listDisbursementRuns();
  const sp = await searchParams;

  // Default to the latest run when nothing is selected.
  const fallback = runs[0];
  const fy = sp.fy ?? fallback?.fy ?? "";
  const month = sp.month ? Number(sp.month) : (fallback?.month ?? 0);

  const data = fy && month ? await getDisbursement({ fy, month }) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/people/payroll"
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to payroll
      </Link>
      <DisbursementView data={data} runs={runs} selectedFy={fy} selectedMonth={month} />
    </div>
  );
}
