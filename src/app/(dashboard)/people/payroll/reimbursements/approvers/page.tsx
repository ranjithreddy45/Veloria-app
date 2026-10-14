import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, UserCheck } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getReimbursementApproverConfig } from "@/actions/hr-reimbursement.actions";
import { ApproverConfigForm } from "./_components/approver-config-form";

export const metadata: Metadata = { title: "Reimbursement approvers" };

export default async function ReimbursementApproversPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:admin")) redirect("/people/payroll/reimbursements");

  const cfg = await getReimbursementApproverConfig();
  if (!cfg.success) redirect("/people/payroll/reimbursements");

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/people/payroll/reimbursements" className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Reimbursement claims
      </Link>
      <PageHeader
        icon={UserCheck}
        accent="emerald"
        eyebrow="Payroll · Workflow"
        title="Reimbursement approvers"
        description="Who approves expense claims, in order. A claim follows its claimant's named-person route if there is one, otherwise their manager's team route, otherwise the default route — one stage at a time, never skipping one, and only then to payment. Nobody approves their own claim. Approvers are notified when a claim reaches them, and the employee is told at every step."
      />
      <ApproverConfigForm config={cfg.data} />
    </div>
  );
}
