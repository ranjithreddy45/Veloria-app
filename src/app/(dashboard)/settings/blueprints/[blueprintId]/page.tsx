import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { getBlueprint } from "@/actions/blueprint.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransitionsList } from "../_components/transitions-list";
import { TransitionMap } from "../_components/transition-map";

export const metadata: Metadata = { title: "Blueprint Details" };

// ============================================================
// Entity Type Badge Colors
// ============================================================

const ENTITY_TYPE_COLORS: Record<string, string> = {
  LEAD: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DEAL: "bg-orange-100 text-orange-800 border-orange-200",
  BOOKING: "bg-emerald-100 text-emerald-800 border-emerald-200",
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings/blueprints">
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back to Blueprints</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {blueprint.name}
              </h1>
              <Badge
                variant="outline"
                className={
                  ENTITY_TYPE_COLORS[blueprint.entityType] ??
                  "bg-muted text-foreground"
                }
              >
                {blueprint.entityType}
              </Badge>
              {blueprint.isActive ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border">
                  Inactive
                </Badge>
              )}
              {blueprint.isPublished && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Published
                </Badge>
              )}
            </div>
            {blueprint.description && (
              <p className="text-muted-foreground mt-1 text-sm">
                {blueprint.description}
              </p>
            )}
          </div>
        </div>
      </div>

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
