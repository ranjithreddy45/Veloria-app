"use client";

import { format } from "date-fns";
import {
  CheckCircle2Icon,
  XCircleIcon,
  ArrowRightCircleIcon,
  UserIcon,
  ClockIcon,
} from "lucide-react";

import type { ApprovalRequestData } from "@/actions/approval.actions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ============================================================
// Props
// ============================================================

interface ApprovalDetailCardProps {
  request: ApprovalRequestData;
}

// ============================================================
// Component
// ============================================================

export function ApprovalDetailCard({ request }: ApprovalDetailCardProps) {
  const chain = request.rule.approverChain;
  const metadata = request.metadata;

  return (
    <div className="space-y-6">
      {/* Entity Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entity Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          {metadata ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(metadata)
                .filter(
                  ([key]) =>
                    !key.startsWith("_") &&
                    key !== "id" &&
                    key !== "createdAt" &&
                    key !== "updatedAt"
                )
                .slice(0, 12)
                .map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                    <p className="text-zinc-700 truncate">
                      {value === null || value === undefined
                        ? "--"
                        : typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No metadata snapshot available.</p>
          )}
        </CardContent>
      </Card>

      {/* Chain Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Chain Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {chain.map((step, index) => {
              const isCompleted = index < request.currentStep;
              const isCurrent = index === request.currentStep;
              const isRejected = request.status === "REJECTED" && isCurrent;
              const isApproved = request.status === "APPROVED";

              let stepColor = "bg-zinc-200 text-zinc-600";
              if (isCompleted || (isApproved && index <= request.currentStep)) {
                stepColor = "bg-green-500 text-white";
              } else if (isRejected) {
                stepColor = "bg-red-500 text-white";
              } else if (isCurrent && request.status === "PENDING_APPROVAL") {
                stepColor = "bg-amber-500 text-white";
              }

              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-xs font-bold",
                        stepColor
                      )}
                    >
                      {index + 1}
                    </div>
                    <div className="text-center max-w-20">
                      <p className="text-[10px] text-zinc-500 leading-tight">
                        {step.approverType === "USER" ? "User" : "Role"}
                      </p>
                      <p className="text-[10px] font-medium text-zinc-700 truncate">
                        {step.approverId}
                      </p>
                      {step.isOptional && (
                        <Badge
                          variant="outline"
                          className="text-[8px] px-1 py-0 mt-0.5 border-zinc-200"
                        >
                          Optional
                        </Badge>
                      )}
                    </div>
                  </div>
                  {index < chain.length - 1 && (
                    <div className="h-px w-6 bg-zinc-300" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Decisions Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Decisions Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {request.decisions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-zinc-400">
              <ClockIcon className="mr-2 size-4" />
              <p className="text-sm">No decisions yet. Awaiting review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {request.decisions.map((decision, index) => {
                const actionIcon =
                  decision.action === "APPROVE" ? (
                    <CheckCircle2Icon className="size-4 text-green-600" />
                  ) : decision.action === "REJECT" ? (
                    <XCircleIcon className="size-4 text-red-600" />
                  ) : (
                    <ArrowRightCircleIcon className="size-4 text-blue-600" />
                  );

                const actionColor =
                  decision.action === "APPROVE"
                    ? "border-green-200 bg-green-50"
                    : decision.action === "REJECT"
                      ? "border-red-200 bg-red-50"
                      : "border-blue-200 bg-blue-50";

                return (
                  <div key={decision.id}>
                    {index > 0 && <Separator className="mb-4" />}
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full border",
                          actionColor
                        )}
                      >
                        {actionIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            Step {decision.stepOrder + 1}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs border font-medium",
                              decision.action === "APPROVE"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : decision.action === "REJECT"
                                  ? "bg-red-100 text-red-700 border-red-200"
                                  : "bg-blue-100 text-blue-700 border-blue-200"
                            )}
                          >
                            {decision.action}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                          <UserIcon className="size-3" />
                          <span>
                            {decision.decidedBy?.name ?? decision.decidedBy?.email ?? "Unknown"}
                          </span>
                          <span>
                            {format(new Date(decision.decidedAt), "dd MMM yyyy, HH:mm")}
                          </span>
                        </div>
                        {decision.comment && (
                          <p className="mt-1.5 text-sm text-zinc-600 bg-zinc-50 rounded-md px-3 py-2">
                            {decision.comment}
                          </p>
                        )}
                        {decision.action === "DELEGATE" && decision.delegatedTo && (
                          <p className="mt-1 text-xs text-blue-600">
                            Delegated to:{" "}
                            {decision.delegatedTo.name ?? decision.delegatedTo.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
