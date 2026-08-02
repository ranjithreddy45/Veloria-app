"use client";

import * as React from "react";
import {
  Wallet,
  Filter,
  Clock,
  IndianRupee,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PAYOUT_STATUS_COLORS, PAYOUT_TYPE_LABELS } from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";
import { getVendorPayouts } from "@/actions/vendor-portal.actions";
import type { PayoutStatus } from "@prisma/client";

// ============================================================
// Types
// ============================================================

interface Payout {
  id: string;
  amount: number;
  status: string;
  type: string;
  description: string | null;
  referenceNumber: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
  } | null;
}

interface PayoutsStats {
  totalPaid: number;
  paidCount: number;
  totalPending: number;
  pendingCount: number;
  totalApproved: number;
  approvedCount: number;
}

interface PayoutsData {
  data: Payout[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: PayoutsStats;
}

interface VendorPayoutsClientProps {
  initialData: PayoutsData;
}

// ============================================================
// Vendor Payouts Client Component
// ============================================================

export function VendorPayoutsClient({ initialData }: VendorPayoutsClientProps) {
  const [data, setData] = React.useState(initialData);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(false);

  const fetchPayouts = React.useCallback(
    async (status?: string, page = 1) => {
      setLoading(true);
      try {
        const result = await getVendorPayouts({
          status: status && status !== "all" ? (status as PayoutStatus) : undefined,
          page,
          limit: 20,
        });
        if (result.success) {
          setData(result.data);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    fetchPayouts(value, 1);
  };

  const stats = data.stats;

  const statCards = [
    {
      title: "Total paid",
      value: formatINR(stats.totalPaid),
      count: stats.paidCount,
      icon: CheckCircle2,
      chip: "bg-success/12 text-success",
    },
    {
      title: "Pending",
      value: formatINR(stats.totalPending),
      count: stats.pendingCount,
      icon: Clock,
      chip: "bg-warning/15 text-warning",
    },
    {
      title: "Approved",
      value: formatINR(stats.totalApproved),
      count: stats.approvedCount,
      icon: CircleDot,
      chip: "bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payments"
        icon={Wallet}
        accent="emerald"
        title="Your payouts"
        description="Every advance and settlement we've raised against your work."
      >
        <Badge variant="outline" className="numeric">
          {data.total} {data.total === 1 ? "payout" : "payouts"}
        </Badge>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="rounded-2xl border bg-card py-0 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="text-meta font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="numeric text-title font-semibold leading-none tracking-[-0.02em] text-foreground">
                      {card.value}
                    </p>
                    <p className="text-detail text-muted-foreground">
                      <span className="numeric">{card.count}</span> payout
                      {card.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.chip}`}
                  >
                    <Icon className="size-[18px]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payouts Table */}
      <Card className="rounded-2xl border bg-card shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-copy font-semibold">
            Payout history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.data.length === 0 ? (
            <EmptyState
              icon={<Wallet />}
              title={
                statusFilter !== "all"
                  ? "Nothing under this filter"
                  : "No payments have gone out yet"
              }
              description={
                statusFilter !== "all"
                  ? "Switch back to all statuses to see your full payment history."
                  : "Every advance and settlement we raise against your work will be listed here, with its reference."
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="[&>th]:text-meta [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted-foreground">
                      <TableHead>Reference</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Paid on</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((payout) => (
                      <TableRow
                        key={payout.id}
                        className={`transition-colors hover:bg-muted/40 ${loading ? "opacity-50" : ""}`}
                      >
                        <TableCell className="numeric py-3.5 font-medium text-foreground">
                          {payout.referenceNumber || "—"}
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-muted-foreground">
                          {PAYOUT_TYPE_LABELS[payout.type] || payout.type}
                        </TableCell>
                        <TableCell className="py-3.5">
                          {payout.booking ? (
                            <div>
                              <p className="numeric text-sm text-foreground">
                                {payout.booking.bookingNumber}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {payout.booking.eventName}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate py-3.5 text-sm text-muted-foreground">
                          {payout.description || "—"}
                        </TableCell>
                        <TableCell className="numeric py-3.5 text-right font-semibold text-foreground">
                          {formatINR(payout.amount)}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <StatusBadge
                            status={payout.status}
                            colorMap={PAYOUT_STATUS_COLORS}
                          />
                        </TableCell>
                        <TableCell className="numeric whitespace-nowrap py-3.5 text-sm text-muted-foreground">
                          {formatDate(payout.createdAt)}
                        </TableCell>
                        <TableCell className="numeric whitespace-nowrap py-3.5 text-sm text-muted-foreground">
                          {payout.paidAt ? formatDate(payout.paidAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {data.data.map((payout) => (
                  <div
                    key={payout.id}
                    className={`rounded-xl border bg-muted/30 p-4 ${
                      loading ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="numeric font-medium text-foreground">
                          {payout.referenceNumber || "No reference"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {PAYOUT_TYPE_LABELS[payout.type] || payout.type}
                        </p>
                      </div>
                      <StatusBadge
                        status={payout.status}
                        colorMap={PAYOUT_STATUS_COLORS}
                      />
                    </div>
                    {payout.booking && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span className="numeric">{payout.booking.bookingNumber}</span>
                        {" · "}
                        {payout.booking.eventName}
                      </div>
                    )}
                    {payout.description && (
                      <p className="mt-1 truncate text-xs text-muted-foreground/80">
                        {payout.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <span className="numeric text-lede font-semibold text-foreground">
                        {formatINR(payout.amount)}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <IndianRupee className="size-3" />
                        {payout.paidAt
                          ? `Paid ${formatDate(payout.paidAt)}`
                          : `Raised ${formatDate(payout.createdAt)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page <span className="numeric">{data.page}</span> of{" "}
                    <span className="numeric">{data.totalPages}</span> ·{" "}
                    <span className="numeric">{data.total}</span> total
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page <= 1 || loading}
                      onClick={() => fetchPayouts(statusFilter, data.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page >= data.totalPages || loading}
                      onClick={() => fetchPayouts(statusFilter, data.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
