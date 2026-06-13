import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  UserIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  ArrowLeftIcon,
  StarIcon,
  ExternalLinkIcon,
  BuildingIcon,
  FileTextIcon,
} from "lucide-react";

import { getReferralById } from "@/actions/referral.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
      key: "PENDING",
      reached:
        referral.status === "PENDING" ||
        referral.status === "CONTACTED" ||
        referral.status === "CONVERTED",
    },
    {
      label: "Contacted",
      key: "CONTACTED",
      reached:
        referral.status === "CONTACTED" || referral.status === "CONVERTED",
    },
    {
      label: "Converted",
      key: "CONVERTED",
      reached: referral.status === "CONVERTED",
    },
  ];

  const isExpired = referral.status === "EXPIRED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-xs" asChild>
              <Link href="/referrals">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {referral.referredName}
            </h1>
            <StatusBadge
              status={referral.status}
              colorMap={REFERRAL_STATUS_COLORS}
            />
          </div>
          <p className="text-muted-foreground mt-1 ml-10 text-sm">
            Referred by {referral.referrerContact.firstName}{" "}
            {referral.referrerContact.lastName}
          </p>
        </div>
        <ReferralActions
          referralId={referral.id}
          status={referral.status}
          convertedLeadId={referral.convertedLeadId}
        />
      </div>

      {/* Detail Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Referred Person Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referred Person</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <UserIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Name</p>
                <p className="text-sm font-medium">{referral.referredName}</p>
              </div>
            </div>
            {referral.referredEmail && (
              <div className="flex items-center gap-3">
                <MailIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="text-sm">{referral.referredEmail}</p>
                </div>
              </div>
            )}
            {referral.referredPhone && (
              <div className="flex items-center gap-3">
                <PhoneIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p className="text-sm">{referral.referredPhone}</p>
                </div>
              </div>
            )}
            {referral.rewardPoints && (
              <div className="flex items-center gap-3">
                <StarIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Reward Points</p>
                  <p className="text-sm font-medium text-amber-700">
                    {referral.rewardPoints} points
                  </p>
                </div>
              </div>
            )}
            {referral.convertedLeadId && (
              <>
                <Separator />
                <div className="flex items-center gap-3">
                  <ExternalLinkIcon className="text-muted-foreground size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Converted Lead
                    </p>
                    <Button variant="link" size="sm" className="h-auto p-0" asChild>
                      <Link href={`/leads/${referral.convertedLeadId}`}>
                        View Lead
                      </Link>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Referrer Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Referrer Contact</span>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/contacts/${referral.referrerContact.id}`}>
                  View Contact
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <UserIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Name</p>
                <p className="text-sm font-medium">
                  {referral.referrerContact.firstName}{" "}
                  {referral.referrerContact.lastName}
                </p>
              </div>
            </div>
            {referral.referrerContact.email && (
              <div className="flex items-center gap-3">
                <MailIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="text-sm">{referral.referrerContact.email}</p>
                </div>
              </div>
            )}
            {referral.referrerContact.phone && (
              <div className="flex items-center gap-3">
                <PhoneIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p className="text-sm">{referral.referrerContact.phone}</p>
                </div>
              </div>
            )}
            {referral.referrerContact.company && (
              <div className="flex items-center gap-3">
                <BuildingIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Company</p>
                  <p className="text-sm">{referral.referrerContact.company}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {isExpired ? (
              <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <Badge
                  variant="outline"
                  className="border-zinc-300 bg-zinc-100 text-zinc-600"
                >
                  Expired
                </Badge>
                <p className="text-sm text-zinc-500">
                  This referral has been marked as expired.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {statusTimeline.map((step, index) => (
                  <div key={step.key} className="flex items-center gap-4">
                    <div
                      className={`flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                        step.reached
                          ? step.key === referral.status
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border bg-card text-zinc-400"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          step.reached ? "text-zinc-900" : "text-zinc-400"
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes & Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Created At</p>
                <p className="text-sm">
                  {format(
                    new Date(referral.createdAt),
                    "dd MMM yyyy, hh:mm a"
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Last Updated</p>
                <p className="text-sm">
                  {format(
                    new Date(referral.updatedAt),
                    "dd MMM yyyy, hh:mm a"
                  )}
                </p>
              </div>
            </div>
            {referral.notes && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <FileTextIcon className="text-muted-foreground size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap text-zinc-600">
                      {referral.notes}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
