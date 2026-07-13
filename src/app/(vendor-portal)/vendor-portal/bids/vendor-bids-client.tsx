"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gavel, Plus, Filter, Clock, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { VENDOR_BID_STATUS_COLORS } from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";
import {
  getVendorBids,
  submitVendorBid,
  withdrawBid,
} from "@/actions/vendor-portal.actions";
import type { VendorBidStatus } from "@prisma/client";

// ============================================================
// Types
// ============================================================

interface Bid {
  id: string;
  amount: number;
  message: string | null;
  status: string;
  submittedAt: string;
  respondedAt: string | null;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    eventType: string;
    date: string;
    status: string;
    venue: { id: string; name: string };
  };
}

interface BidsData {
  data: Bid[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AvailableBooking {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: string;
  venue: { name: string };
}

interface VendorBidsClientProps {
  initialData: BidsData;
  availableBookings: AvailableBooking[];
}

// ============================================================
// Vendor Bids Client Component
// ============================================================

export function VendorBidsClient({ initialData, availableBookings }: VendorBidsClientProps) {
  const router = useRouter();
  const [data, setData] = React.useState(initialData);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(false);

  // Withdraw flow (confirm dialog + pending state).
  const [withdrawTarget, setWithdrawTarget] = React.useState<Bid | null>(null);
  const [withdrawing, startWithdraw] = React.useTransition();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form state
  const [selectedBookingId, setSelectedBookingId] = React.useState<string>("");
  const [bidAmount, setBidAmount] = React.useState<string>("");
  const [bidMessage, setBidMessage] = React.useState<string>("");

  const fetchBids = React.useCallback(
    async (status?: string, page = 1) => {
      setLoading(true);
      try {
        const result = await getVendorBids({
          status: status && status !== "all" ? (status as VendorBidStatus) : undefined,
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
    fetchBids(value, 1);
  };

  const confirmWithdraw = () => {
    if (!withdrawTarget) return;
    const target = withdrawTarget;
    startWithdraw(async () => {
      const result = await withdrawBid(target.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Bid withdrawn");
      setWithdrawTarget(null);
      await fetchBids(statusFilter, data.page);
      router.refresh();
    });
  };

  const handleSubmitBid = async () => {
    setError(null);

    if (!selectedBookingId) {
      setError("Please select a booking.");
      return;
    }
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid bid amount.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitVendorBid({
        bookingId: selectedBookingId,
        amount,
        message: bidMessage || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Reset form and close dialog
      setSelectedBookingId("");
      setBidAmount("");
      setBidMessage("");
      setDialogOpen(false);

      // Refresh bids list
      fetchBids(statusFilter, 1);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Gavel className="size-6 text-violet-600 dark:text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              My Bids
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {data.total} bid{data.total !== 1 ? "s" : ""} submitted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-zinc-400" />
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* New Bid Button */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-violet-600 hover:bg-violet-700">
                <Plus className="size-4" />
                New Bid
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Submit a New Bid</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Booking Select */}
                <div className="space-y-2">
                  <Label htmlFor="booking">Booking</Label>
                  {availableBookings.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No available bookings to bid on.
                    </p>
                  ) : (
                    <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                      <SelectTrigger id="booking">
                        <SelectValue placeholder="Select a booking" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBookings.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bookingNumber} - {b.eventName} ({formatDate(b.date)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Bid Amount (INR)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="e.g. 50000"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">Message (optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Add a note about your bid..."
                    rows={3}
                    value={bidMessage}
                    onChange={(e) => setBidMessage(e.target.value)}
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                )}

                {/* Submit */}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitBid}
                    disabled={submitting || availableBookings.length === 0}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {submitting ? "Submitting..." : "Submit Bid"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bids Table */}
      <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Bid History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Gavel className="size-12 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                No bids found
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {statusFilter !== "all"
                  ? "Try changing the filter to see more bids."
                  : "Submit your first bid to get started."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Event Date</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead className="text-right">Bid Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Responded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((bid) => (
                      <TableRow key={bid.id} className={loading ? "opacity-50" : ""}>
                        <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">
                          {bid.booking.bookingNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">
                              {bid.booking.eventName}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {bid.booking.eventType}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300">
                          {formatDate(bid.booking.date)}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                          {bid.booking.venue.name}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatINR(bid.amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={bid.status}
                            colorMap={VENDOR_BID_STATUS_COLORS}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                          {formatDate(bid.submittedAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                          {bid.respondedAt ? formatDate(bid.respondedAt) : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          {bid.status === "PENDING" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                              onClick={() => setWithdrawTarget(bid)}
                            >
                              <X className="size-3.5" />
                              Withdraw
                            </Button>
                          ) : (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">--</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {data.data.map((bid) => (
                  <div
                    key={bid.id}
                    className={`rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 ${
                      loading ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {bid.booking.eventName}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {bid.booking.bookingNumber} &middot; {bid.booking.eventType}
                        </p>
                      </div>
                      <StatusBadge
                        status={bid.status}
                        colorMap={VENDOR_BID_STATUS_COLORS}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(bid.booking.date)}
                      </div>
                      <span className="text-zinc-300 dark:text-zinc-600">|</span>
                      <span>{bid.booking.venue.name}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {formatINR(bid.amount)}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        Submitted {formatDate(bid.submittedAt)}
                      </span>
                    </div>
                    {bid.message && (
                      <p className="mt-2 text-xs text-zinc-500 italic dark:text-zinc-400">
                        &quot;{bid.message}&quot;
                      </p>
                    )}
                    {bid.status === "PENDING" && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                          onClick={() => setWithdrawTarget(bid)}
                        >
                          <X className="size-3.5" />
                          Withdraw
                        </Button>
                      </div>
                    )}
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
                      onClick={() => fetchBids(statusFilter, data.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page >= data.totalPages || loading}
                      onClick={() => fetchBids(statusFilter, data.page + 1)}
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

      {/* Withdraw confirmation dialog */}
      <Dialog
        open={withdrawTarget !== null}
        onOpenChange={(open) => {
          if (!open) setWithdrawTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw bid</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Withdraw your {withdrawTarget ? formatINR(withdrawTarget.amount) : ""} bid on{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              {withdrawTarget?.booking.eventName}
            </span>
            ? This removes it permanently and can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setWithdrawTarget(null)}
              disabled={withdrawing}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmWithdraw}
              disabled={withdrawing}
            >
              {withdrawing ? "Withdrawing..." : "Withdraw Bid"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
