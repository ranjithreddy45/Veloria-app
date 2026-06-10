import type { Metadata } from "next";
import {
  getMyPendingApprovals,
  getApprovalHistory,
} from "@/actions/approval.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { ApprovalQueue } from "./_components/approval-queue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "My Approvals" };

export default async function ApprovalsPage() {
  const [pendingResult, approvedResult, rejectedResult, allResult] =
    await Promise.all([
      getMyPendingApprovals(),
      getApprovalHistory({ status: "APPROVED", limit: 50 }),
      getApprovalHistory({ status: "REJECTED", limit: 50 }),
      getApprovalHistory({ limit: 50 }),
    ]);

  const pending = pendingResult.success ? pendingResult.data : [];
  const approved = approvedResult.success ? approvedResult.data.requests : [];
  const rejected = rejectedResult.success ? rejectedResult.data.requests : [];
  const all = allResult.success ? allResult.data.requests : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Approvals"
        help={<PageHelp id="approvals" />}
        description="Review and manage approval requests assigned to you."
      />

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending
            {pending.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <ApprovalQueue requests={pending} showActions />
        </TabsContent>

        <TabsContent value="approved">
          <ApprovalQueue requests={approved} showActions={false} />
        </TabsContent>

        <TabsContent value="rejected">
          <ApprovalQueue requests={rejected} showActions={false} />
        </TabsContent>

        <TabsContent value="all">
          <ApprovalQueue requests={all} showActions={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
