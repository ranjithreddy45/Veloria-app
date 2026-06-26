"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  CheckCircle2Icon,
  XCircleIcon,
  EyeIcon,
  Loader2Icon,
  InboxIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  approveRequest,
  rejectRequest,
  type ApprovalRequestData,
} from "@/actions/approval.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalStatusBadge } from "@/components/shared/approval-status-badge";
import { cn } from "@/lib/utils";

// ============================================================
// Entity Type Colors
// ============================================================

const ENTITY_TYPE_COLORS: Record<string, string> = {
  QUOTE: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900",
  DEAL: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900",
  BOOKING: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
};

// ============================================================
// Props
// ============================================================

interface ApprovalQueueProps {
  requests: ApprovalRequestData[];
  showActions?: boolean;
  onRefresh?: () => void;
}

// ============================================================
// Component
// ============================================================

export function ApprovalQueue({
  requests: initialRequests,
  showActions = true,
  onRefresh,
}: ApprovalQueueProps) {
  const [requests, setRequests] = React.useState(initialRequests);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [rejectComment, setRejectComment] = React.useState("");

  React.useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  async function handleApprove(requestId: string) {
    setLoadingId(requestId);
    const result = await approveRequest(requestId);
    if (result.success) {
      toast.success("Request approved");
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
    setLoadingId(null);
  }

  async function handleReject(requestId: string) {
    if (!rejectComment.trim()) {
      toast.error("A comment is required when rejecting");
      return;
    }
    setLoadingId(requestId);
    const result = await rejectRequest(requestId, rejectComment.trim());
    if (result.success) {
      toast.success("Request rejected");
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setRejectComment("");
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
    setLoadingId(null);
  }

  function getEntityLabel(request: ApprovalRequestData): string {
    const meta = request.metadata;
    if (!meta) return request.entityId;
    return (
      (meta.name as string) ||
      (meta.eventName as string) ||
      (meta.title as string) ||
      (meta.reference as string) ||
      request.entityId
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card">
        <EmptyState
          icon={<InboxIcon className="size-5" />}
          title="No approval requests"
          description="Nothing in this view right now — requests routed to you will appear here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-stagger-1">
      {requests.map((request) => {
        const chain = request.rule.approverChain;
        const chainLength = chain.length;
        // `currentStep` stores the active step's `order` value, which may be
        // non-contiguous (e.g. [0, 5, 10]). Resolve the human-facing position
        // by matching `order`, not by treating `currentStep` as an array index.
        const stepIdx = chain.findIndex((s) => s.order === request.currentStep);
        const stepPosition = stepIdx >= 0 ? stepIdx + 1 : null;
        const isLoading = loadingId === request.id;

        return (
          <Card key={request.id} className="border-border/80 shadow-card hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs border font-medium",
                        ENTITY_TYPE_COLORS[request.entityType] ??
                          "bg-muted text-foreground/80 border-border"
                      )}
                    >
                      {request.entityType}
                    </Badge>
                    <Link
                      href={`/approvals/${request.id}`}
                      className="font-medium text-sm hover:underline truncate"
                    >
                      {getEntityLabel(request)}
                    </Link>
                    <ApprovalStatusBadge status={request.status} />
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Rule: <span className="font-medium">{request.rule.name}</span>
                    </span>
                    <span>
                      By:{" "}
                      <span className="font-medium">
                        {request.submittedBy?.name ?? request.submittedBy?.email ?? "Unknown"}
                      </span>
                    </span>
                    <span>
                      {format(new Date(request.submittedAt), "dd MMM yyyy, HH:mm")}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-medium tabular-nums">
                      Step {stepPosition ?? "—"} of {chainLength}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {showActions && request.status === "PENDING_APPROVAL" && (
                    <>
                      {/* Quick Approve */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        disabled={isLoading}
                        title="Approve"
                        className="text-success hover:text-success hover:bg-success/10"
                      >
                        {isLoading ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2Icon className="size-4" />
                        )}
                      </Button>

                      {/* Quick Reject */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isLoading}
                            title="Reject"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <XCircleIcon className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reject Approval</AlertDialogTitle>
                            <AlertDialogDescription>
                              Please provide a reason for rejecting this request. This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Textarea
                            placeholder="Reason for rejection..."
                            value={rejectComment}
                            onChange={(e) => setRejectComment(e.target.value)}
                            rows={3}
                          />
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setRejectComment("")}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleReject(request.id)}
                              className="bg-destructive text-white hover:bg-destructive/90"
                              disabled={!rejectComment.trim()}
                            >
                              Reject
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}

                  {/* View Detail */}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/approvals/${request.id}`}>
                      <EyeIcon className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
