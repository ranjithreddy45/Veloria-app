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
import { EmptyState } from "@/components/ui/empty-state";
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-teal-500/12 text-teal-700 sm:flex dark:text-teal-300">
            <Gavel className="size-[22px]" />
          </span>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">
              Opportunities
            </p>
            <h1 className="text-[28px] leading-tight text-foreground sm:text-[32px]">
              Your bids
            </h1>
            <p className="text-[14px] text-muted-foreground">
              <span className="numeric">{data.total}</span> bid
              {data.total !== 1 ? "s" : ""} submitted to our events team.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
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
              <Button className="gap-2">
                <Plus className="size-4" />
                New bid
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Submit a bid</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Booking Select */}
                <div className="space-y-2">
                  <Label htmlFor="booking">Booking</Label>
                  {availableBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing is open for bidding right now — we&apos;ll be in touch.
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
                  >
                    {submitting ? "Submitting…" : "Submit bid"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bids Table */}
      <Card className="rounded-2xl border bg-card shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-semibold">Bid history</CardTitle>
        </CardHeader>
        <CardContent>
          {data.data.length === 0 ? (
            <EmptyState
              icon={<Gavel />}
              title={
                statusFilter !== "all"
                  ? "Nothing under this filter"
                  : "Your first bid starts the conversation"
              }
              description={
                statusFilter !== "all"
                  ? "Switch back to all statuses to see everything you've quoted."
                  : "Pick an open event, name your price, and our team reviews it the same week."
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="[&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-[0.1em] [&>th]:text-muted-foreground">
                      <TableHead>Booking</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Event date</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead className="text-right">Bid amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Responded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((bid) => (
                      <TableRow
                        key={bid.id}
                        className={`transition-colors hover:bg-muted/40 ${loading ? "opacity-50" : ""}`}
                      >
                        <TableCell className="numeric py-3.5 font-medium text-foreground">
                          {bid.booking.bookingNumber}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div>
                            <p className="text-sm text-foreground">
                              {bid.booking.eventName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {bid.booking.eventType}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="numeric whitespace-nowrap py-3.5 text-sm text-muted-foreground">
                          {formatDate(bid.booking.date)}
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-muted-foreground">
                          {bid.booking.venue.name}
                        </TableCell>
                        <TableCell className="numeric py-3.5 text-right font-semibold text-foreground">
                          {formatINR(bid.amount)}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <StatusBadge
                            status={bid.status}
                            colorMap={VENDOR_BID_STATUS_COLORS}
                          />
                        </TableCell>
                        <TableCell className="numeric whitespace-nowrap py-3.5 text-sm text-muted-foreground">
                          {formatDate(bid.submittedAt)}
                        </TableCell>
                        <TableCell className="numeric whitespace-nowrap py-3.5 text-sm text-muted-foreground">
                          {bid.respondedAt ? formatDate(bid.respondedAt) : "—"}
                        </TableCell>
                        <TableCell className="py-3.5 text-right">
                          {bid.status === "PENDING" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                              onClick={() => setWithdrawTarget(bid)}
                            >
                              <X className="size-3.5" />
                              Withdraw
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
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
                    className={`rounded-xl border bg-muted/30 p-4 ${
                      loading ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {bid.booking.eventName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="numeric">{bid.booking.bookingNumber}</span>
                          {" · "}
                          {bid.booking.eventType}
                        </p>
                      </div>
                      <StatusBadge
                        status={bid.status}
                        colorMap={VENDOR_BID_STATUS_COLORS}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <span className="numeric">{formatDate(bid.booking.date)}</span>
                      </div>
                      <span className="opacity-40">·</span>
                      <span>{bid.booking.venue.name}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <span className="numeric text-[17px] font-semibold text-foreground">
                        {formatINR(bid.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Submitted {formatDate(bid.submittedAt)}
                      </span>
                    </div>
                    {bid.message && (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        &quot;{bid.message}&quot;
                      </p>
                    )}
                    {bid.status === "PENDING" && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
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
          <p className="text-sm text-muted-foreground">
            Withdraw your{" "}
            <span className="numeric font-medium text-foreground">
              {withdrawTarget ? formatINR(withdrawTarget.amount) : ""}
            </span>{" "}
            bid on{" "}
            <span className="font-medium text-foreground">
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
