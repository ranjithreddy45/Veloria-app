"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CheckIcon,
  XIcon,
  Loader2Icon,
} from "lucide-react";
import Link from "next/link";

import { acceptBid, rejectBid } from "@/actions/vendor.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  VENDOR_BID_STATUS_COLORS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";

// ============================================================
// BidList Types
// ============================================================

interface Bid {
  id: string;
  amount: number;
  message: string | null;
  status: string;
  submittedAt: string | Date;
  respondedAt: string | Date | null;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    date: string | Date;
  };
  vendor?: {
    id: string;
    name: string;
    category: string;
    rating: number;
  };
}

interface BidListProps {
  bids: Bid[];
  showVendor?: boolean;
  showBooking?: boolean;
}

// ============================================================
// BidActionButtons Component
// ============================================================

function BidActionButtons({ bidId }: { bidId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState<string | null>(null);

  const handleAccept = async () => {
    setIsPending("accept");
    try {
      const result = await acceptBid(bidId);
      if (result.success) {
        toast.success("Bid accepted successfully");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to accept bid");
    } finally {
      setIsPending(null);
    }
  };

  const handleReject = async () => {
    setIsPending("reject");
    try {
      const result = await rejectBid(bidId);
      if (result.success) {
        toast.success("Bid rejected");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to reject bid");
    } finally {
      setIsPending(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
        onClick={handleAccept}
        disabled={isPending !== null}
      >
        {isPending === "accept" ? (
          <Loader2Icon className="mr-1 size-3 animate-spin" />
        ) : (
          <CheckIcon className="mr-1 size-3" />
        )}
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        onClick={handleReject}
        disabled={isPending !== null}
      >
        {isPending === "reject" ? (
          <Loader2Icon className="mr-1 size-3 animate-spin" />
        ) : (
          <XIcon className="mr-1 size-3" />
        )}
        Reject
      </Button>
    </div>
  );
}

// ============================================================
// BidList Component
// ============================================================

export function BidList({
  bids,
  showVendor = false,
  showBooking = true,
}: BidListProps) {
  if (bids.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No bids found.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {bids.map((bid) => (
        <div
          key={bid.id}
          className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            {showBooking && (
              <Link
                href={`/bookings/${bid.booking.id}`}
                className="font-medium hover:underline"
              >
                {bid.booking.bookingNumber} - {bid.booking.eventName}
              </Link>
            )}
            {showVendor && bid.vendor && (
              <Link
                href={`/vendors/${bid.vendor.id}`}
                className="font-medium hover:underline"
              >
                {bid.vendor.name}
              </Link>
            )}
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground text-sm">
                {formatINR(bid.amount)}
              </span>
              {showBooking && (
                <span>
                  Event: {format(new Date(bid.booking.date), "dd MMM yyyy")}
                </span>
              )}
              <span>
                Submitted: {format(new Date(bid.submittedAt), "dd MMM yyyy")}
              </span>
              {bid.respondedAt && (
                <span>
                  Responded: {format(new Date(bid.respondedAt), "dd MMM yyyy")}
                </span>
              )}
            </div>
            {bid.message && (
              <p className="text-muted-foreground mt-1 text-sm">
                {bid.message}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge
              status={bid.status}
              colorMap={VENDOR_BID_STATUS_COLORS}
            />
            {bid.status === "PENDING" && <BidActionButtons bidId={bid.id} />}
          </div>
        </div>
      ))}
    </div>
  );
}
