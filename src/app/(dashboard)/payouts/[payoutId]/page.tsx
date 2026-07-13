import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  IndianRupeeIcon,
  CalendarIcon,
  FileTextIcon,
  UserIcon,
  TagIcon,
  ArrowLeftIcon,
} from "lucide-react";

import { getPayoutById } from "@/actions/payout.actions";
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
import { PAYOUT_STATUS_COLORS, PAYOUT_TYPE_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { PayoutActions } from "./_components/payout-actions";

export const metadata: Metadata = { title: "Payout Details" };

// ============================================================
// Payout Detail Page
// ============================================================

interface PayoutDetailPageProps {
  params: Promise<{ payoutId: string }>;
}

export default async function PayoutDetailPage({
  params,
}: PayoutDetailPageProps) {
  const { payoutId } = await params;
  const result = await getPayoutById(payoutId);

  if (!result.success || !result.data) {
    notFound();
  }

  const payout = result.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-xs" asChild>
              <Link href="/payouts">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {payout.referenceNumber || "Payout Details"}
            </h1>
            <StatusBadge
              status={payout.status}
              colorMap={PAYOUT_STATUS_COLORS}
            />
          </div>
          <p className="text-muted-foreground mt-1 ml-10 text-sm">
            {PAYOUT_TYPE_LABELS[payout.type] || payout.type}
          </p>
        </div>
        <PayoutActions payoutId={payout.id} status={payout.status} />
      </div>

      {/* Detail Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Payout Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <IndianRupeeIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Amount</p>
                <p className="text-lg font-bold text-green-700">
                  {formatINR(payout.amount)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TagIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Type</p>
                <Badge variant="outline" className="mt-0.5">
                  {PAYOUT_TYPE_LABELS[payout.type] || payout.type}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Reference Number</p>
                <p className="text-sm font-mono font-medium">
                  {payout.referenceNumber || "--"}
                </p>
              </div>
            </div>
            {payout.description && (
              <>
                <Separator />
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Description
                  </p>
                  <p className="text-sm">{payout.description}</p>
                </div>
              </>
            )}
            {payout.notes && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap text-zinc-600">
                  {payout.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status & Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status & Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <StatusBadge
                  status={payout.status}
                  colorMap={PAYOUT_STATUS_COLORS}
                  className="mt-0.5"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Created At</p>
                <p className="text-sm">
                  {format(new Date(payout.createdAt), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">Last Updated</p>
                <p className="text-sm">
                  {format(new Date(payout.updatedAt), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
            </div>
            {payout.paidAt && (
              <div className="flex items-center gap-3">
                <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Paid At</p>
                  <p className="text-sm font-medium text-emerald-700">
                    {format(new Date(payout.paidAt), "dd MMM yyyy, hh:mm a")}
                  </p>
                </div>
              </div>
            )}
            {payout.approvedById && (
              <div className="flex items-center gap-3">
                <UserIcon className="text-muted-foreground size-4 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Approved By</p>
                  <p className="text-sm">{payout.approvedById}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendor Card */}
        {payout.vendor && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Vendor</span>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/vendors/${payout.vendor.id}`}>
                    View Vendor
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-muted-foreground text-xs">Name</p>
                <p className="text-sm font-medium">{payout.vendor.name}</p>
              </div>
              {payout.vendor.email && (
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="text-sm">{payout.vendor.email}</p>
                </div>
              )}
              {payout.vendor.phone && (
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p className="text-sm">{payout.vendor.phone}</p>
                </div>
              )}
              {payout.vendor.category && (
                <div>
                  <p className="text-muted-foreground text-xs">Category</p>
                  <p className="text-sm">{payout.vendor.category}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Booking Card */}
        {payout.booking && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Booking</span>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/bookings/${payout.booking.id}`}>
                    View Booking
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-muted-foreground text-xs">Booking Number</p>
                <p className="text-sm font-mono font-medium">
                  {payout.booking.bookingNumber}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Event Name</p>
                <p className="text-sm font-medium">{payout.booking.eventName}</p>
              </div>
              {payout.booking.date && (
                <div>
                  <p className="text-muted-foreground text-xs">Event Date</p>
                  <p className="text-sm">
                    {format(new Date(payout.booking.date), "dd MMM yyyy")}
                  </p>
                </div>
              )}
              {payout.booking.totalAmount != null && (
                <div>
                  <p className="text-muted-foreground text-xs">Booking Total</p>
                  <p className="text-sm font-medium">
                    {formatINR(payout.booking.totalAmount)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Linked Bill Card */}
        {payout.bill && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Linked Bill</span>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/payouts/bills">View Bills</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-muted-foreground text-xs">Bill Number</p>
                <p className="text-sm font-mono font-medium">
                  {payout.bill.billNumber}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Bill Amount</p>
                <p className="text-sm font-medium">
                  {formatINR(payout.bill.amount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <Badge variant="outline" className="mt-0.5">
                  {payout.bill.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
