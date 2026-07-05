import { getCallLogs, getCallAnalytics } from "@/actions/call.actions";
import { CallsTable } from "./_components/calls-table";
import { CallStatsCards } from "./_components/call-stats-cards";
import { CallAnalyticsCharts } from "./_components/call-analytics-charts-lazy";
import { CallDispositionDialog } from "./_components/call-disposition-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";

export const metadata = {
  title: "Call Log",
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const direction = params.direction as string | undefined;
  const disposition = params.disposition as string | undefined;
  const agentId = params.agentId as string | undefined;

  const [logsResult, analyticsResult] = await Promise.all([
    getCallLogs({
      page,
      limit: 20,
      direction: direction as "INBOUND" | "OUTBOUND" | undefined,
      disposition: disposition as
        | "COMPLETED"
        | "NO_ANSWER"
        | "BUSY"
        | "VOICEMAIL"
        | "WRONG_NUMBER"
        | "CALLBACK_REQUESTED"
        | undefined,
      agentId,
    }),
    getCallAnalytics({}),
  ]);

  const logs = logsResult.success ? logsResult.data.data : [];
  const total = logsResult.success ? logsResult.data.total : 0;
  const analytics = analyticsResult.success ? analyticsResult.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Engagement · CRM</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{total}</span> call{total === 1 ? "" : "s"} logged
            </span>
          </div>
        }
        title="Call Log"
        help={<PageHelp id="call-log" />}
        description="Track and manage all call activities."
      >
        <CallDispositionDialog />
      </PageHeader>

      {analytics && <CallStatsCards analytics={analytics} />}

      {analytics && <CallAnalyticsCharts analytics={analytics} />}

      <CallsTable data={logs} total={total} page={page} limit={20} />
    </div>
  );
}
