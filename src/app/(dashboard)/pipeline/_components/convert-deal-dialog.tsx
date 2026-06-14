"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck,
  PartyPopper,
  Loader2Icon,
  Users,
  IndianRupee,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { convertDealToBooking } from "@/actions/pipeline.actions";
import { getVenues } from "@/actions/booking.actions";
import { formatINR } from "@/lib/utils";
import type { DealItem } from "./pipeline-board";

// ============================================================
// Types
// ============================================================

interface Venue {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
}

interface ConvertDealDialogProps {
  deal: DealItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================
// Time slot display
// ============================================================

const TIME_SLOTS = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
  { value: "FULL_DAY", label: "Full Day" },
] as const;

// ============================================================
// Component
// ============================================================

export function ConvertDealDialog({
  deal,
  open,
  onOpenChange,
}: ConvertDealDialogProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [venues, setVenues] = React.useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = React.useState(false);

  // Form state
  const [venueId, setVenueId] = React.useState("");
  const [eventName, setEventName] = React.useState("");
  const [date, setDate] = React.useState("");
  const [timeSlot, setTimeSlot] = React.useState("EVENING");
  const [guestCount, setGuestCount] = React.useState(0);
  const [totalAmount, setTotalAmount] = React.useState(0);
  const [specialRequests, setSpecialRequests] = React.useState("");

  // Load venues and pre-fill form when dialog opens
  React.useEffect(() => {
    if (open && deal) {
      setLoadingVenues(true);
      getVenues().then((result) => {
        if (result.success) {
          const activeVenues = (result.data as Venue[]).filter(
            (v) => v.isActive
          );
          setVenues(activeVenues);
          if (activeVenues.length > 0) {
            setVenueId(activeVenues[0].id);
          }
        }
        setLoadingVenues(false);
      });

      // Pre-fill from deal data
      setEventName(deal.lead?.title || deal.title || "");
      // Use the lead's real guest count; don't fabricate 100. The guestCount<=0
      // guard then forces an explicit entry when the lead has none.
      setGuestCount(deal.lead?.guestCount ?? 0);
      setTotalAmount(deal.value || 0);

      // Set date from lead's eventDate if available
      if (deal.lead?.eventDate) {
        const d = new Date(deal.lead.eventDate);
        setDate(d.toISOString().split("T")[0]);
      } else {
        // Default to 2 weeks from now
        const d = new Date();
        d.setDate(d.getDate() + 14);
        setDate(d.toISOString().split("T")[0]);
      }

      setTimeSlot("EVENING");
      setSpecialRequests("");
    }
  }, [open, deal]);

  async function handleConvert() {
    if (!deal) return;

    if (!venueId) {
      toast.error("Please select a venue");
      return;
    }
    if (!eventName.trim()) {
      toast.error("Event name is required");
      return;
    }
    if (!date) {
      toast.error("Event date is required");
      return;
    }
    if (guestCount <= 0) {
      toast.error("Guest count must be greater than 0");
      return;
    }
    if (totalAmount <= 0) {
      toast.error("Total amount must be greater than 0");
      return;
    }

    setIsPending(true);
    try {
      const result = await convertDealToBooking({
        dealId: deal.id,
        venueId,
        eventName: eventName.trim(),
        date,
        timeSlot,
        guestCount,
        totalAmount,
        specialRequests: specialRequests.trim() || undefined,
      });

      if (result.success) {
        toast.success("Booking created!", {
          description: `Booking ${result.data.bookingNumber} has been created from this deal.`,
          action: {
            label: "View Booking",
            onClick: () => router.push(`/bookings/${result.data.bookingId}`),
          },
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to convert deal to booking");
    } finally {
      setIsPending(false);
    }
  }

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="size-5 text-green-600" />
            Deal Won — Create Booking
          </DialogTitle>
          <DialogDescription>
            Convert this won deal into a confirmed booking. Details have been
            pre-filled from the deal.
          </DialogDescription>
        </DialogHeader>

        {/* Deal summary */}
        <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{deal.title}</span>
            <Badge
              variant="outline"
              className="bg-green-100 text-green-700 border-green-200"
            >
              Won
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {deal.contact && (
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {deal.contact.firstName} {deal.contact.lastName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <IndianRupee className="size-3" />
              {formatINR(deal.value)}
            </span>
          </div>
        </div>

        {/* Booking form */}
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="convert-venue">Venue *</Label>
            {loadingVenues ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2Icon className="size-4 animate-spin" />
                Loading venues...
              </div>
            ) : (
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger id="convert-venue">
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} (cap. {v.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="convert-event-name">Event Name *</Label>
            <Input
              id="convert-event-name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Sharma Wedding Reception"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="convert-date">Event Date *</Label>
              <Input
                id="convert-date"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-timeslot">Time Slot *</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger id="convert-timeslot">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((ts) => (
                    <SelectItem key={ts.value} value={ts.value}>
                      {ts.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="convert-guests">Guest Count *</Label>
              <Input
                id="convert-guests"
                type="number"
                min={1}
                value={guestCount || ""}
                onChange={(e) => setGuestCount(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-amount">Total Amount (₹) *</Label>
              <Input
                id="convert-amount"
                type="number"
                min={0}
                value={totalAmount || ""}
                onChange={(e) =>
                  setTotalAmount(parseFloat(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="convert-requests">Special Requests</Label>
            <Textarea
              id="convert-requests"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Any special requirements..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Skip for Now
          </Button>
          <Button onClick={handleConvert} disabled={isPending}>
            {isPending ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <CalendarCheck className="mr-2 size-4" />
            )}
            Create Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
