import { getCallLogs, getCallAnalytics } from "@/actions/call.actions";
import { CallsTable } from "./_components/calls-table";
import { CallStatsCards } from "./_components/call-stats-cards";
import { CallAnalyticsCharts } from "./_components/call-analytics-charts-lazy";
import { CallDispositionDialog } from "./_components/call-disposition-dialog";
import { Phone } from "lucide-react";

export const metadata = {
  title: "Call Log | Veloria Grand",
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            Call Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track and manage all call activities
          </p>
        </div>
        <CallDispositionDialog />
      </div>

      {analytics && <CallStatsCards analytics={analytics} />}

      {analytics && <CallAnalyticsCharts analytics={analytics} />}

      <CallsTable data={logs} total={total} page={page} limit={20} />
    </div>
  );
}
