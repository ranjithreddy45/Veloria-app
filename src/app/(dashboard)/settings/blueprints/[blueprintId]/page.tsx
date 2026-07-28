import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, GitBranchIcon } from "lucide-react";

import { getBlueprint } from "@/actions/blueprint.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { TransitionsList } from "../_components/transitions-list";
import { TransitionMap } from "../_components/transition-map";

export const metadata: Metadata = { title: "Blueprint Details" };

// ============================================================
// Entity Type Hues
// ============================================================

const ENTITY_TYPE_HUE: Record<string, Hue> = {
  LEAD: "indigo",
  DEAL: "orange",
  BOOKING: "emerald",
};

// ============================================================
// Blueprint Detail Page
// ============================================================

interface BlueprintDetailPageProps {
  params: Promise<{ blueprintId: string }>;
}

export default async function BlueprintDetailPage({
  params,
}: BlueprintDetailPageProps) {
  const { blueprintId } = await params;
  const result = await getBlueprint(blueprintId);

  if (!result.success || !result.data) {
    notFound();
  }

  const blueprint = result.data;

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 h-8 text-muted-foreground hover:text-foreground"
        >
          <Link href="/settings/blueprints">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back to Blueprints
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Settings · Blueprints"
        icon={GitBranchIcon}
        accent="violet"
        title={blueprint.name}
        description={
          blueprint.description ??
          "The state machine this record type follows — which transitions are legal, who may make them, and what must be filled in first."
        }
      >
        <StatusPill
          label={blueprint.entityType}
          hue={ENTITY_TYPE_HUE[blueprint.entityType] ?? "neutral"}
        />
        <StatusPill
          label={blueprint.isActive ? "Active" : "Inactive"}
          hue={blueprint.isActive ? "emerald" : "slate"}
        />
        {blueprint.isPublished && <StatusPill label="Published" hue="blue" />}
      </PageHeader>

      {/* Transition Map */}
      <TransitionMap
        entityType={blueprint.entityType}
        transitions={blueprint.transitions as Array<{
          id: string;
          fromStatus: string;
          toStatus: string;
          name: string | null;
          requiredFields: unknown;
          requiredActions: unknown;
          allowedRoles: string[];
          isActive: boolean;
          order: number;
        }>}
      />

      {/* Transitions List */}
      <TransitionsList
        blueprintId={blueprint.id}
        entityType={blueprint.entityType}
        transitions={blueprint.transitions as Array<{
          id: string;
          fromStatus: string;
          toStatus: string;
          name: string | null;
          requiredFields: unknown;
          requiredActions: unknown;
          allowedRoles: string[];
          isActive: boolean;
          order: number;
          createdAt: string;
          updatedAt: string;
        }>}
      />
    </div>
  );
}
