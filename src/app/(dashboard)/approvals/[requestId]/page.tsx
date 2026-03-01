import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeftIcon, UserIcon, CalendarIcon } from "lucide-react";

import { getApprovalRequest } from "@/actions/approval.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ApprovalStatusBadge } from "@/components/shared/approval-status-badge";
import { ApprovalDetailCard } from "../_components/approval-detail-card";
import { ApprovalDecisionForm } from "../_components/approval-decision-form";

export const metadata: Metadata = { title: "Approval Request" };

// ============================================================
// Entity Type Colors
// ============================================================

const ENTITY_TYPE_COLORS: Record<string, string> = {
  QUOTE: "bg-purple-100 text-purple-700 border-purple-200",
  DEAL: "bg-blue-100 text-blue-700 border-blue-200",
  BOOKING: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

// ============================================================
// Page
// ============================================================

interface ApprovalRequestPageProps {
  params: Promise<{ requestId: string }>;
}

export default async function ApprovalRequestPage({
  params,
}: ApprovalRequestPageProps) {
  const { requestId } = await params;
  const result = await getApprovalRequest(requestId);

  if (!result.success || !result.data) {
    notFound();
  }

  const request = result.data;

  const entityLabel =
    (request.metadata?.name as string) ||
    (request.metadata?.eventName as string) ||
    (request.metadata?.title as string) ||
    (request.metadata?.reference as string) ||
    request.entityId;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/approvals">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back to Approvals
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{entityLabel}</h1>
            <Badge
              variant="outline"
              className={
                ENTITY_TYPE_COLORS[request.entityType] ??
                "bg-muted text-foreground/80 border-border"
              }
            >
              {request.entityType}
            </Badge>
            <ApprovalStatusBadge status={request.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Rule: {request.rule.name}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <ApprovalDetailCard request={request} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Decision Form (only if pending) */}
          {request.status === "PENDING_APPROVAL" && (
            <ApprovalDecisionForm requestId={request.id} />
          )}

          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <ApprovalStatusBadge status={request.status} />
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Entity Type
                </p>
                <Badge
                  variant="outline"
                  className={
                    ENTITY_TYPE_COLORS[request.entityType] ??
                    "bg-muted text-foreground/80 border-border"
                  }
                >
                  {request.entityType}
                </Badge>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Submitted By
                </p>
                <div className="flex items-center gap-2">
                  <UserIcon className="size-3.5 text-zinc-400" />
                  <span className="text-sm text-zinc-700">
                    {request.submittedBy?.name ?? request.submittedBy?.email ?? "Unknown"}
                  </span>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Submitted At
                </p>
                <div className="flex items-center gap-1.5 text-sm text-zinc-700">
                  <CalendarIcon className="size-3.5" />
                  {format(
                    new Date(request.submittedAt),
                    "dd MMM yyyy, HH:mm"
                  )}
                </div>
              </div>

              {request.resolvedAt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Resolved At
                    </p>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-700">
                      <CalendarIcon className="size-3.5" />
                      {format(
                        new Date(request.resolvedAt),
                        "dd MMM yyyy, HH:mm"
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Current Step
                </p>
                <span className="text-sm text-zinc-700">
                  Step {request.currentStep + 1} of{" "}
                  {request.rule.approverChain.length}
                </span>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Total Decisions
                </p>
                <span className="text-sm text-zinc-700">
                  {request.decisions.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
