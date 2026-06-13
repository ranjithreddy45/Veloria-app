import type { Metadata } from "next";
import { getEventControlDashboard } from "@/actions/execution-task.actions";
import { getActiveEscalations } from "@/actions/escalation.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ControlDashboard } from "./_components/control-dashboard";

export const metadata: Metadata = { title: "Live Event Control" };

interface ControlPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function EventControlPage({ params }: ControlPageProps) {
  const { bookingId } = await params;

  const [dashResult, escalationsResult] = await Promise.all([
    getEventControlDashboard(bookingId),
    getActiveEscalations(bookingId),
  ]);

  const dashboard = dashResult.success ? dashResult.data : null;
  const escalations = escalationsResult.success
    ? (escalationsResult.data ?? [])
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Event Control"
        description="Monitor event execution in real-time."
      />

      {dashboard ? (
        <ControlDashboard
          dashboard={dashboard}
          escalations={escalations}
          bookingId={bookingId}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">
            No execution plan found for this booking. Create one first from the Execution Plan page.
          </p>
        </div>
      )}
    </div>
  );
}
