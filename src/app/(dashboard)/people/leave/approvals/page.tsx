import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getLeaveApprovalQueue } from "@/actions/hr-leave.actions";
import { ApprovalQueue } from "./_components/approval-queue";

export const metadata: Metadata = { title: "Leave Approvals" };

export default async function LeaveApprovalsPage() {
  if (!FEATURES.hr || !FEATURES.hrLeave) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  // Managers (routed approvers) and HR approvers both use this page; the queue
  // itself scopes what each sees. Block only users with no HR read at all.
  if (!hasPermission(role, "hr:read")) redirect("/people");

  const { rows } = await getLeaveApprovalQueue();

  return (
    <div className="space-y-6">
      <Link href="/people/leave" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to leave
      </Link>
      <PageHeader
        title="Leave approvals"
        description="Requests routed to you via the org chart. Approve or reject — balances update automatically and the decision is logged."
      />
      <ApprovalQueue rows={rows as never} />
    </div>
  );
}
