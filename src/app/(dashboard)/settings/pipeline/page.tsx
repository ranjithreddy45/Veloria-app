import type { Metadata } from "next";
import { getPipelineStages } from "@/actions/pipeline.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PipelineStageSettings } from "./_components/pipeline-stage-settings";

export const metadata: Metadata = { title: "Pipeline Settings" };

export default async function PipelineSettingsPage() {
  const result = await getPipelineStages();
  const stages = result.success ? result.data : [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Pipeline Stages"
        description="Manage the stages in your sales pipeline. Reorder, rename, or adjust colors."
      />

      <PipelineStageSettings
        initialStages={stages.map((s) => ({
          id: s.id,
          name: s.name,
          order: s.order,
          color: s.color,
          isDefault: s.isDefault,
          isWonStage: s.isWonStage,
          isLostStage: s.isLostStage,
          dealCount: s.deals.length,
        }))}
      />
    </div>
  );
}
