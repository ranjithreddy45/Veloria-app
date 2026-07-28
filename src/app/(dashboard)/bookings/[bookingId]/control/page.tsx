import type { Metadata } from "next";
import { getEventControlDashboard } from "@/actions/execution-task.actions";
import { getActiveEscalations } from "@/actions/escalation.actions";
import { getOperationReadinessForBooking } from "@/actions/ops-readiness.actions";
import { LayoutDashboardIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ControlDashboard } from "./_components/control-dashboard";

export const metadata: Metadata = { title: "Live Event Control" };

interface ControlPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function EventControlPage({ params }: ControlPageProps) {
  const { bookingId } = await params;

  const [dashResult, escalationsResult, readinessResult] = await Promise.all([
    getEventControlDashboard(bookingId),
    getActiveEscalations(bookingId),
    getOperationReadinessForBooking(bookingId),
  ]);

  const dashboard = dashResult.success ? dashResult.data : null;
  const escalations = escalationsResult.success
    ? (escalationsResult.data ?? [])
    : [];
  const readiness = readinessResult.success ? readinessResult.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboardIcon}
        accent="rose"
        eyebrow="Event day · Live"
        title="Live Event Control"
        description="Real-time cockpit for the event in progress — progress, escalations and readiness at a glance."
      />

      {dashboard ? (
        <ControlDashboard
          dashboard={dashboard}
          escalations={escalations}
          readiness={readiness}
          bookingId={bookingId}
        />
      ) : (
        <div className="rounded-2xl border border-dashed bg-card shadow-card">
          <EmptyState
            icon={<LayoutDashboardIcon className="size-6" />}
            title="Nothing to monitor yet"
            description="Live control runs off the execution plan. Create the plan first and this cockpit will light up on event day."
          />
        </div>
      )}
    </div>
  );
}
