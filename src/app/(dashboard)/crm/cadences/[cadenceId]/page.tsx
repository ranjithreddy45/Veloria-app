import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon, RepeatIcon } from "lucide-react";
import { getCadence } from "@/actions/cadence.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StepBuilder } from "../_components/step-builder";
import { EnrollmentsTable } from "../_components/enrollments-table";

export const metadata: Metadata = { title: "Cadence Detail" };

const STATUS_HUE: Record<string, Hue> = {
  DRAFT: "slate",
  ACTIVE: "emerald",
  PAUSED: "amber",
  ARCHIVED: "neutral",
};

const ENTITY_TYPE_HUE: Record<string, Hue> = {
  LEAD: "blue",
  CONTACT: "violet",
};

export default async function CadenceDetailPage({
  params,
}: {
  params: Promise<{ cadenceId: string }>;
}) {
  const { cadenceId } = await params;
  const result = await getCadence(cadenceId);

  if (!result.success) {
    notFound();
  }

  const cadence = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={RepeatIcon}
        accent="violet"
        title={cadence.name}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link
              href="/crm/cadences"
              className="transition-colors hover:text-foreground"
            >
              Sales Cadences
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>Sequence</span>
          </span>
        }
        description={cadence.description ?? undefined}
      >
        <StatusPill
          label={cadence.status}
          hue={STATUS_HUE[cadence.status] ?? "slate"}
        />
        <StatusPill
          label={cadence.entityType}
          hue={ENTITY_TYPE_HUE[cadence.entityType] ?? "slate"}
        />
      </PageHeader>

      {/* At-a-glance summary */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border shadow-card sm:grid-cols-4">
        {[
          { label: "Steps", value: cadence.steps.length },
          { label: "Enrollments", value: cadence.enrollments.length },
          {
            label: "Active",
            value: cadence.enrollments.filter((e) => e.status === "ACTIVE")
              .length,
          },
          {
            label: "Completed",
            value: cadence.enrollments.filter((e) => e.status === "COMPLETED")
              .length,
          },
        ].map((s) => (
          <div key={s.label} className="bg-card p-5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p className="numeric mt-1.5 text-2xl font-semibold tracking-tight">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs: Steps & Enrollments */}
      <Tabs defaultValue="steps" className="w-full">
        <TabsList>
          <TabsTrigger value="steps">
            Steps <span className="numeric ml-1 text-muted-foreground">{cadence.steps.length}</span>
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            Enrollments <span className="numeric ml-1 text-muted-foreground">{cadence.enrollments.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="mt-4">
          <StepBuilder
            cadenceId={cadence.id}
            cadenceStatus={cadence.status}
            steps={cadence.steps}
          />
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          <EnrollmentsTable
            cadenceId={cadence.id}
            enrollments={cadence.enrollments}
            entityType={cadence.entityType}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
