import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronRightIcon,
  PencilIcon,
  FileTextIcon,
  ShieldIcon,
} from "lucide-react";

import { getInsurancePolicyById } from "@/actions/insurance.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR, formatDate } from "@/lib/utils";
import {
  INSURANCE_TYPE_LABELS,
  INSURANCE_STATUS_COLORS,
} from "@/lib/constants";
import { InsurancePolicyActions } from "../_components/insurance-policy-actions";

export const metadata: Metadata = { title: "Insurance Policy Details" };

// ============================================================
// Insurance Policy Detail Page
// ============================================================

interface InsurancePolicyDetailPageProps {
  params: Promise<{ policyId: string }>;
}

export default async function InsurancePolicyDetailPage({
  params,
}: InsurancePolicyDetailPageProps) {
  const { policyId } = await params;
  const result = await getInsurancePolicyById(policyId);

  if (!result.success || !result.data) {
    notFound();
  }

  const policy = result.data;
  const typeLabel = INSURANCE_TYPE_LABELS[policy.type] ?? policy.type;
  const documents =
    (policy.documents as { name: string; url: string }[] | null) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldIcon}
        accent="blue"
        title={policy.policyNumber}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link
              href="/insurance"
              className="transition-colors hover:text-foreground"
            >
              Insurance
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>{typeLabel}</span>
          </span>
        }
        description={policy.provider}
      >
        <StatusBadge status={policy.status} colorMap={INSURANCE_STATUS_COLORS} />
        <Button variant="outline" asChild>
          <Link href={`/insurance/${policy.id}/edit`}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
        <InsurancePolicyActions
          policyId={policy.id}
          status={policy.status}
          policyNumber={policy.policyNumber}
        />
      </PageHeader>

      {/* ============================================================
          Cover at a glance — the four numbers that matter
          ============================================================ */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border shadow-card lg:grid-cols-4">
        <div className="bg-card p-5">
          <p className="text-meta uppercase tracking-wide text-muted-foreground">
            Coverage amount
          </p>
          <p className="numeric mt-1.5 text-2xl font-semibold tracking-tight">
            {formatINR(policy.coverageAmount)}
          </p>
        </div>
        <div className="bg-card p-5">
          <p className="text-meta uppercase tracking-wide text-muted-foreground">
            Premium
          </p>
          <p className="numeric mt-1.5 text-2xl font-semibold tracking-tight">
            {formatINR(policy.premium)}
          </p>
        </div>
        <div className="bg-card p-5">
          <p className="text-meta uppercase tracking-wide text-muted-foreground">
            Cover starts
          </p>
          <p className="numeric mt-1.5 text-base font-medium">
            {formatDate(policy.startDate)}
          </p>
        </div>
        <div className="bg-card p-5">
          <p className="text-meta uppercase tracking-wide text-muted-foreground">
            Cover ends
          </p>
          <p className="numeric mt-1.5 text-base font-medium">
            {formatDate(policy.endDate)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ============================================================
            Policy details
            ============================================================ */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-copy font-semibold tracking-[-0.01em]">
            Policy details
          </h2>
          <p className="mt-0.5 text-body text-muted-foreground">
            Who underwrites this cover and what it protects.
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                Provider
              </dt>
              <dd className="mt-1 text-sm">{policy.provider}</dd>
            </div>
            <div>
              <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                Policy number
              </dt>
              <dd className="numeric mt-1 text-sm">{policy.policyNumber}</dd>
            </div>
            <div>
              <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                Type
              </dt>
              <dd className="mt-1 text-sm">{typeLabel}</dd>
            </div>
            <div>
              <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                Status
              </dt>
              <dd className="mt-1.5">
                <StatusBadge
                  status={policy.status}
                  colorMap={INSURANCE_STATUS_COLORS}
                />
              </dd>
            </div>
          </dl>
        </section>

        {/* ============================================================
            Linked entities
            ============================================================ */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-copy font-semibold tracking-[-0.01em]">
            Linked to
          </h2>
          <p className="mt-0.5 text-body text-muted-foreground">
            The booking and venue this policy covers.
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                Booking
              </dt>
              <dd className="mt-1 text-sm">
                {policy.booking ? (
                  <Link
                    href={`/bookings/${policy.booking.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {policy.booking.bookingNumber} · {policy.booking.eventName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Not linked</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-meta uppercase tracking-wide text-muted-foreground">
                Venue
              </dt>
              <dd className="mt-1 text-sm">
                {policy.venue?.name ?? (
                  <span className="text-muted-foreground">Not linked</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* ============================================================
          Documents
          ============================================================ */}
      <section className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-copy font-semibold tracking-[-0.01em]">
              Documents
            </h2>
            <p className="mt-0.5 text-body text-muted-foreground">
              Certificates and paperwork attached to this policy.
            </p>
          </div>
          {documents.length > 0 && (
            <Badge variant="outline" className="numeric shrink-0">
              {documents.length}
            </Badge>
          )}
        </div>

        {documents.length > 0 ? (
          <ul className="mt-5 divide-y rounded-xl border">
            {documents.map((doc, index) => (
              <li key={index}>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{doc.name}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<FileTextIcon />}
            title="No documents attached"
            description="Upload the policy certificate so the ops team can find it on event day."
          />
        )}
      </section>
    </div>
  );
}
