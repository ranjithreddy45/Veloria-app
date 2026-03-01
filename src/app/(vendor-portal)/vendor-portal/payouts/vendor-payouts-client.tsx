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
import { Button } from "@/components/ui/button";
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
      title: "Total Paid",
      value: formatINR(stats.totalPaid),
      count: stats.paidCount,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Pending",
      value: formatINR(stats.totalPending),
      count: stats.pendingCount,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Approved",
      value: formatINR(stats.totalApproved),
      count: stats.approvedCount,
      icon: CircleDot,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="size-6 text-violet-600 dark:text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              My Payouts
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {data.total} payout{data.total !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-zinc-400" />
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
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="border-zinc-200/80 shadow-sm dark:border-zinc-800"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {card.title}
                    </p>
                    <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      {card.value}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {card.count} payout{card.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div
                    className={`flex size-10 items-center justify-center rounded-lg ${card.bgColor} dark:opacity-90`}
                  >
                    <Icon className={`size-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payouts Table */}
      <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Payout History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wallet className="size-12 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                No payouts found
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {statusFilter !== "all"
                  ? "Try changing the filter to see more payouts."
                  : "Your payouts will appear here once created."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Paid At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((payout) => (
                      <TableRow key={payout.id} className={loading ? "opacity-50" : ""}>
                        <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">
                          {payout.referenceNumber || "--"}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                          {PAYOUT_TYPE_LABELS[payout.type] || payout.type}
                        </TableCell>
                        <TableCell>
                          {payout.booking ? (
                            <div>
                              <p className="text-sm text-zinc-900 dark:text-zinc-100">
                                {payout.booking.bookingNumber}
                              </p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {payout.booking.eventName}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-zinc-600 dark:text-zinc-300">
                          {payout.description || "--"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatINR(payout.amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={payout.status}
                            colorMap={PAYOUT_STATUS_COLORS}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                          {formatDate(payout.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                          {payout.paidAt ? formatDate(payout.paidAt) : "--"}
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
                    className={`rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 ${
                      loading ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {payout.referenceNumber || "No Reference"}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {PAYOUT_TYPE_LABELS[payout.type] || payout.type}
                        </p>
                      </div>
                      <StatusBadge
                        status={payout.status}
                        colorMap={PAYOUT_STATUS_COLORS}
                      />
                    </div>
                    {payout.booking && (
                      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {payout.booking.bookingNumber} - {payout.booking.eventName}
                      </div>
                    )}
                    {payout.description && (
                      <p className="mt-1 text-xs text-zinc-400 truncate dark:text-zinc-500">
                        {payout.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {formatINR(payout.amount)}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
                        <IndianRupee className="size-3" />
                        {payout.paidAt
                          ? `Paid ${formatDate(payout.paidAt)}`
                          : `Created ${formatDate(payout.createdAt)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Page {data.page} of {data.totalPages} ({data.total} total)
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
