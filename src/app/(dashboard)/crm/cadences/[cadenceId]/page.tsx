import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { getCadence } from "@/actions/cadence.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StepBuilder } from "../_components/step-builder";
import { EnrollmentsTable } from "../_components/enrollments-table";

export const metadata: Metadata = { title: "Cadence Detail" };

const STATUS_BADGE_MAP: Record<string, string> = {
  DRAFT: "bg-muted text-foreground/80 border-border",
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  PAUSED: "bg-amber-100 text-amber-700 border-amber-200",
  ARCHIVED: "bg-slate-100 text-slate-700 border-slate-200",
};

const ENTITY_TYPE_BADGE_MAP: Record<string, string> = {
  LEAD: "bg-blue-100 text-blue-700 border-blue-200",
  CONTACT: "bg-purple-100 text-purple-700 border-purple-200",
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
      {/* Back Button + Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/crm/cadences">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {cadence.name}
            </h1>
            <Badge
              variant="outline"
              className={STATUS_BADGE_MAP[cadence.status] ?? ""}
            >
              {cadence.status}
            </Badge>
            <Badge
              variant="outline"
              className={ENTITY_TYPE_BADGE_MAP[cadence.entityType] ?? ""}
            >
              {cadence.entityType}
            </Badge>
          </div>
          {cadence.description && (
            <p className="text-muted-foreground mt-1 text-sm">
              {cadence.description}
            </p>
          )}
        </div>
      </div>

      {/* Tabs: Steps & Enrollments */}
      <Tabs defaultValue="steps" className="w-full">
        <TabsList>
          <TabsTrigger value="steps">
            Steps ({cadence.steps.length})
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            Enrollments ({cadence.enrollments.length})
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
