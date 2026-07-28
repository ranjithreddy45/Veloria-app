import type { Metadata } from "next";
import type React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ChevronRightIcon,
  CheckIcon,
  ExternalLinkIcon,
  Share2Icon,
} from "lucide-react";

import { getReferralById } from "@/actions/referral.actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { REFERRAL_STATUS_COLORS } from "@/lib/constants";
import { ReferralActions } from "./_components/referral-actions";

export const metadata: Metadata = {
  title: "Referral Details",
};

// ============================================================
// Referral Detail Page
// ============================================================

interface ReferralDetailPageProps {
  params: Promise<{ referralId: string }>;
}

// Small label/value pair — the app-wide detail primitive.
function Field({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className={`mt-1 text-sm${mono ? " numeric" : ""}`}>{children}</div>
    </div>
  );
}

export default async function ReferralDetailPage({
  params,
}: ReferralDetailPageProps) {
  const { referralId } = await params;
  const result = await getReferralById(referralId);

  if (!result.success || !result.data) {
    notFound();
  }

  const referral = result.data;

  // Build status timeline steps
  const statusTimeline = [
    {
      label: "Pending",
      hint: "Referral received, awaiting first contact",
      key: "PENDING",
      reached:
        referral.status === "PENDING" ||
        referral.status === "CONTACTED" ||
        referral.status === "CONVERTED",
    },
    {
      label: "Contacted",
      hint: "Sales has reached out to the referred person",
      key: "CONTACTED",
      reached:
        referral.status === "CONTACTED" || referral.status === "CONVERTED",
    },
    {
      label: "Converted",
      hint: "Turned into a qualified lead",
      key: "CONVERTED",
      reached: referral.status === "CONVERTED",
    },
  ];

  const isExpired = referral.status === "EXPIRED";
  const referrerName = `${referral.referrerContact.firstName} ${referral.referrerContact.lastName}`;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Share2Icon}
        accent="pink"
        title={referral.referredName}
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link
              href="/referrals"
              className="transition-colors hover:text-foreground"
            >
              Referrals
            </Link>
            <ChevronRightIcon className="size-3 opacity-50" />
            <span>Referred person</span>
          </span>
        }
        description={`Referred by ${referrerName}`}
      >
        <StatusBadge
          status={referral.status}
          colorMap={REFERRAL_STATUS_COLORS}
        />
        <ReferralActions
          referralId={referral.id}
          status={referral.status}
          convertedLeadId={referral.convertedLeadId}
        />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ============================================================
            Referred person
            ============================================================ */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            Referred person
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Who to reach out to, and what the referral is worth.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            <Field label="Name">
              <span className="font-medium">{referral.referredName}</span>
            </Field>
            <Field label="Reward points" mono>
              {referral.rewardPoints ? (
                `${referral.rewardPoints} pts`
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Email">
              {referral.referredEmail ? (
                <span className="break-all">{referral.referredEmail}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Phone" mono>
              {referral.referredPhone ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </div>

          {referral.convertedLeadId && (
            <div className="mt-5 border-t pt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/leads/${referral.convertedLeadId}`}>
                  <ExternalLinkIcon className="mr-2 size-4" />
                  View converted lead
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* ============================================================
            Referrer
            ============================================================ */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                Referrer
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                The advocate who sent this business your way.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href={`/contacts/${referral.referrerContact.id}`}>
                View contact
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            <Field label="Name">
              <span className="font-medium">{referrerName}</span>
            </Field>
            <Field label="Company">
              {referral.referrerContact.company ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Email">
              {referral.referrerContact.email ? (
                <span className="break-all">
                  {referral.referrerContact.email}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Phone" mono>
              {referral.referrerContact.phone ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </div>
        </section>

        {/* ============================================================
            Progress
            ============================================================ */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            Progress
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            How far this referral has moved through the funnel.
          </p>

          {isExpired ? (
            <div className="mt-5 rounded-xl border bg-muted/40 p-4">
              <p className="text-sm font-medium">Expired</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                This referral lapsed before it could be converted.
              </p>
            </div>
          ) : (
            <ol className="mt-5 space-y-1">
              {statusTimeline.map((step, index) => {
                const isCurrent = step.key === referral.status;
                return (
                  <li key={step.key} className="relative flex gap-3.5 pb-5 last:pb-0">
                    {/* connector */}
                    {index < statusTimeline.length - 1 && (
                      <span
                        aria-hidden
                        className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px ${
                          statusTimeline[index + 1].reached
                            ? "bg-primary/40"
                            : "bg-border"
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                        step.reached
                          ? isCurrent
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                            : "bg-primary/12 text-primary"
                          : "border bg-card text-muted-foreground"
                      }`}
                    >
                      {step.reached && !isCurrent ? (
                        <CheckIcon className="size-3.5" strokeWidth={3} />
                      ) : (
                        <span className="numeric">{index + 1}</span>
                      )}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={`text-sm font-medium ${
                          step.reached ? "" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        {step.hint}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ============================================================
            Record
            ============================================================ */}
        <section className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            Record
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Timestamps and any notes captured on this referral.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            <Field label="Created" mono>
              {format(new Date(referral.createdAt), "dd MMM yyyy, hh:mm a")}
            </Field>
            <Field label="Last updated" mono>
              {format(new Date(referral.updatedAt), "dd MMM yyyy, hh:mm a")}
            </Field>
          </div>

          <div className="mt-5 border-t pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Notes
            </p>
            {referral.notes ? (
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                {referral.notes}
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">
                No notes recorded.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
