import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRightIcon, ShieldCheckIcon } from "lucide-react";

import { getApprovalRequest } from "@/actions/approval.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { ApprovalStatusBadge } from "@/components/shared/approval-status-badge";
import { ApprovalDetailCard } from "../_components/approval-detail-card";
import { ApprovalDecisionForm } from "../_components/approval-decision-form";

export const metadata: Metadata = { title: "Approval Request" };

// ============================================================
// Entity Type Hues
// ============================================================

const ENTITY_TYPE_HUE: Record<string, Hue> = {
  QUOTE: "violet",
  DEAL: "blue",
  BOOKING: "emerald",
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
      <PageHeader
        icon={ShieldCheckIcon}
        accent="amber"
        title={entityLabel}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/approvals" className="transition-colors hover:text-foreground">
              Approvals
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>{request.entityType}</span>
          </span>
        }
        description={`Governed by the “${request.rule.name}” approval rule.`}
      >
        <StatusPill
          label={request.entityType}
          hue={ENTITY_TYPE_HUE[request.entityType] ?? "slate"}
        />
        <ApprovalStatusBadge status={request.status} />
      </PageHeader>

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

          {/* Details */}
          <section className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="text-copy font-semibold tracking-[-0.01em]">
              Request details
            </h2>
            <p className="mt-0.5 text-body text-muted-foreground">
              Where this request sits in the approval chain.
            </p>

            <dl className="mt-5 space-y-4">
              <div>
                <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                  Status
                </dt>
                <dd className="mt-1.5">
                  <ApprovalStatusBadge status={request.status} />
                </dd>
              </div>

              <div>
                <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                  Submitted by
                </dt>
                <dd className="mt-1 text-sm">
                  {request.submittedBy?.name ??
                    request.submittedBy?.email ??
                    "Unknown"}
                </dd>
              </div>

              <div>
                <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                  Submitted at
                </dt>
                <dd className="numeric mt-1 text-sm">
                  {format(new Date(request.submittedAt), "dd MMM yyyy, HH:mm")}
                </dd>
              </div>

              {request.resolvedAt && (
                <div>
                  <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                    Resolved at
                  </dt>
                  <dd className="numeric mt-1 text-sm">
                    {format(new Date(request.resolvedAt), "dd MMM yyyy, HH:mm")}
                  </dd>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                    Current step
                  </dt>
                  <dd className="numeric mt-1 text-sm">
                    {request.currentStep + 1} of {request.rule.approverChain.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                    Decisions
                  </dt>
                  <dd className="numeric mt-1 text-sm">
                    {request.decisions.length}
                  </dd>
                </div>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
