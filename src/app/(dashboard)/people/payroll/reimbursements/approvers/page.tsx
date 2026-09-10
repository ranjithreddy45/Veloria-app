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
        description="Who approves expense claims. Every claim goes to the first-level approver, then to the second-level approver for the employee's department, and only then to Finance for payment. Each approver is notified in-app and by email when a claim reaches them."
      />
      <ApproverConfigForm config={cfg.data} />
    </div>
  );
}
