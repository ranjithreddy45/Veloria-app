import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExecutionPlan } from "@/actions/execution-plan.actions";
import { getSOPTemplates } from "@/actions/sop-template.actions";
import { PlayCircleIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ExecutionPlanView } from "./_components/execution-plan-view";
import { CreatePlanDialog } from "./_components/create-plan-dialog";

export const metadata: Metadata = { title: "Execution Plan" };

interface ExecutionPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function ExecutionPlanPage({ params }: ExecutionPageProps) {
  const { bookingId } = await params;

  const [planResult, templatesResult] = await Promise.all([
    getExecutionPlan(bookingId),
    getSOPTemplates(),
  ]);

  const plan = planResult.success ? planResult.data : null;
  const templates = templatesResult.success ? (templatesResult.data ?? []) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PlayCircleIcon}
        accent="gold"
        eyebrow="Event delivery"
        title="Execution Plan"
        description="Every phase, task and proof needed to deliver this event — assigned and tracked."
      />

      {plan ? (
        <ExecutionPlanView plan={plan} bookingId={bookingId} />
      ) : (
        <CreatePlanDialog bookingId={bookingId} templates={templates} />
      )}
    </div>
  );
}
