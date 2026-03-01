import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilIcon, FileTextIcon } from "lucide-react";

import { getInsurancePolicyById } from "@/actions/insurance.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const statusColorClass =
    INSURANCE_STATUS_COLORS[policy.status] ?? "bg-muted text-foreground/80";
  const documents = (policy.documents as { name: string; url: string }[] | null) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {policy.policyNumber}
            </h1>
            <Badge variant="outline" className={`text-xs ${statusColorClass}`}>
              {policy.status}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {INSURANCE_TYPE_LABELS[policy.type] ?? policy.type}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {policy.provider}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Policy Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Policy Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Provider
                </p>
                <p className="text-sm font-medium">{policy.provider}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Policy Number
                </p>
                <p className="text-sm font-medium">{policy.policyNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Type
                </p>
                <p className="text-sm font-medium">
                  {INSURANCE_TYPE_LABELS[policy.type] ?? policy.type}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Status
                </p>
                <Badge
                  variant="outline"
                  className={`text-xs ${statusColorClass}`}
                >
                  {policy.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Coverage Amount
                </p>
                <p className="text-lg font-bold text-green-700">
                  {formatINR(policy.coverageAmount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Premium
                </p>
                <p className="text-lg font-bold">
                  {formatINR(policy.premium)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policy Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Start Date
                </p>
                <p className="text-sm font-medium">
                  {formatDate(policy.startDate)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  End Date
                </p>
                <p className="text-sm font-medium">
                  {formatDate(policy.endDate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked Entities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Booking
                </p>
                {policy.booking ? (
                  <Link
                    href={`/bookings/${policy.booking.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {policy.booking.bookingNumber} - {policy.booking.eventName}
                  </Link>
                ) : (
                  <p className="text-muted-foreground text-sm">--</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Venue
                </p>
                {policy.venue ? (
                  <p className="text-sm font-medium">{policy.venue.name}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">--</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="size-4" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <ul className="space-y-2">
              {documents.map((doc, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <FileTextIcon className="text-muted-foreground size-4" />
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {doc.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No documents attached to this policy.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
