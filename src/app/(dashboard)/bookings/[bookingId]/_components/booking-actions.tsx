"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontalIcon,
  XCircleIcon,
  ClockIcon,
  UnlockIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelBooking,
  placeHold,
  releaseHold,
} from "@/actions/booking.actions";

// ============================================================
// BookingActions Component
// ============================================================

interface BookingActionsProps {
  bookingId: string;
  currentStatus: string;
}

export function BookingActions({ bookingId, currentStatus }: BookingActionsProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [holdDialogOpen, setHoldDialogOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [holdHours, setHoldHours] = React.useState(48);

  async function handleCancel() {
    setIsPending(true);
    try {
      const result = await cancelBooking(bookingId, cancelReason || undefined);
      if (result.success) {
        toast.success("Booking cancelled successfully");
        setCancelDialogOpen(false);
        setCancelReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to cancel booking");
    } finally {
      setIsPending(false);
    }
  }

  async function handlePlaceHold() {
    setIsPending(true);
    try {
      const result = await placeHold(bookingId, holdHours);
      if (result.success) {
        toast.success(`Hold placed for ${holdHours} hours`);
        setHoldDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to place hold");
    } finally {
      setIsPending(false);
    }
  }

  async function handleReleaseHold() {
    setIsPending(true);
    try {
      const result = await releaseHold(bookingId);
      if (result.success) {
        toast.success("Hold released, booking cancelled");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to release hold");
    } finally {
      setIsPending(false);
    }
  }

  const isCancelled = currentStatus === "CANCELLED";
  const isCompleted = currentStatus === "COMPLETED";
  const isHold = currentStatus === "HOLD";

  if (isCancelled || isCompleted) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={isPending}>
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {isHold && (
            <DropdownMenuItem onClick={handleReleaseHold}>
              <UnlockIcon className="mr-2 size-4" />
              Release Hold
            </DropdownMenuItem>
          )}
          {!isHold && (
            <DropdownMenuItem onClick={() => setHoldDialogOpen(true)}>
              <ClockIcon className="mr-2 size-4" />
              Place Hold
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => setCancelDialogOpen(true)}
          >
            <XCircleIcon className="mr-2 size-4" />
            Cancel Booking
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Enter cancellation reason..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={isPending}
            >
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending}
            >
              {isPending ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Dialog */}
      <Dialog open={holdDialogOpen} onOpenChange={setHoldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Hold</DialogTitle>
            <DialogDescription>
              Place a temporary hold on this booking. The hold will expire after
              the specified time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="hold-hours">Hold Duration (hours)</Label>
            <Input
              id="hold-hours"
              type="number"
              min="1"
              max="168"
              value={holdHours}
              onChange={(e) => setHoldHours(parseInt(e.target.value) || 48)}
            />
            <p className="text-xs text-zinc-500">
              Hold will expire in {holdHours} hours (
              {Math.round((holdHours / 24) * 10) / 10} days)
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHoldDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handlePlaceHold} disabled={isPending}>
              {isPending ? "Placing Hold..." : "Place Hold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
