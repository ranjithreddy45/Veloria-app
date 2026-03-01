import type { Metadata } from "next";
import { getPipelineStages, getPipelineStats } from "@/actions/pipeline.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PipelineBoard } from "./_components/pipeline-board";

export const metadata: Metadata = { title: "Sales Pipeline" };

// Indian number formatting utility
function formatIndianCurrency(value: number): string {
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(2)} Cr`;
  }
  if (value >= 100000) {
    return `${(value / 100000).toFixed(2)} L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function PipelinePage() {
  const [stagesResult, statsResult] = await Promise.all([
    getPipelineStages(),
    getPipelineStats(),
  ]);

  const stages = stagesResult.success ? stagesResult.data : [];
  const stats = statsResult.success ? statsResult.data : null;

  const totalValue = stats?.totalValue ?? 0;
  const totalDeals = stats?.totalDeals ?? 0;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Sales Pipeline"
        description={`${totalDeals} deals worth ${formatIndianCurrency(totalValue)} in pipeline`}
      />

      <div className="mt-6 flex-1 overflow-hidden">
        <PipelineBoard initialStages={stages} />
      </div>
    </div>
  );
}
