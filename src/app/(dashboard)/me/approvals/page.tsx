import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { auth } from "@/../auth";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { listMyApprovals } from "@/actions/hr-reimbursement.actions";
import { ApprovalsList } from "./_components/approvals-list";

export const metadata: Metadata = { title: "My Approvals" };

// ============================================================
// Claims waiting on THIS user — first- or second-level reimbursement
// approvals. Lives under /me so a business head who isn't HR can act on
// what's routed to them without any HR permission.
// ============================================================

export default async function MyApprovalsPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!session?.user?.id) notFound();

  const rows = await listMyApprovals();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CheckCircle2}
        accent="emerald"
        eyebrow="My space"
        title="My approvals"
        description="Expense claims routed to you. Check the bills, then approve, send back for more information, or reject — every step is recorded on the claim with your name and time."
      />
      <ApprovalsList rows={rows} />
    </div>
  );
}
