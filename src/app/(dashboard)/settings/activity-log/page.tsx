import type { Metadata } from "next";
import { getActivityLogs, getTeamUsers } from "@/actions/activity.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityLogList } from "./_components/activity-log-list";

export const metadata: Metadata = { title: "Activity Log" };

// ============================================================
// Activity Log Page
// ============================================================

export default async function ActivityLogPage() {
  const [logsResult, usersResult] = await Promise.all([
    getActivityLogs({ limit: 30 }),
    getTeamUsers(),
  ]);

  const logs = logsResult.success ? logsResult.data.logs : [];
  const pagination = logsResult.success ? logsResult.data.pagination : null;
  const users = usersResult.success ? usersResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Track all actions and changes across the system."
      />
      <ActivityLogList
        initialLogs={logs}
        initialPagination={pagination}
        users={users}
      />
    </div>
  );
}
