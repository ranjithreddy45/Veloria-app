"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, IndianRupee } from "lucide-react";
// LeadStatus type matching Prisma schema
type LeadStatus =
  | "NEW"
  | "NOT_CONNECTED"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

import { updateLeadStatus } from "@/actions/lead.actions";
import { setLeadBooking } from "@/actions/lead-quality.actions";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "NOT_CONNECTED", label: "Not Connected" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

interface LeadStatusSelectProps {
  leadId: string;
  currentStatus: string;
}

export function LeadStatusSelect({ leadId, currentStatus }: LeadStatusSelectProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  // Won dialog — booking value + guest count are required to close a lead Won
  // (they feed the Booking-Confirmed offline conversion).
  const [wonOpen, setWonOpen] = React.useState(false);
  const [bookingValue, setBookingValue] = React.useState("");
  const [guestCount, setGuestCount] = React.useState("");

  async function commitStatus(newStatus: LeadStatus) {
    setIsPending(true);
    try {
      const result = await updateLeadStatus(leadId, newStatus);
      if (result.success) {
        toast.success(`Status updated to ${newStatus.replace(/_/g, " ").toLowerCase()}`);
        router.refresh();
        return true;
      }
      toast.error(result.error);
      return false;
    } catch {
      toast.error("Failed to update status");
      return false;
    } finally {
      setIsPending(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (newStatus === currentStatus) return;
    if (newStatus === "WON") {
      // Capture the booking before committing Won.
      setBookingValue("");
      setGuestCount("");
      setWonOpen(true);
      return;
    }
    await commitStatus(newStatus as LeadStatus);
  }

  async function confirmWon() {
    const value = Number(bookingValue);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a booking value greater than 0.");
      return;
    }
    setIsPending(true);
    try {
      const statusRes = await updateLeadStatus(leadId, "WON");
      if (!statusRes.success) {
        toast.error(statusRes.error);
        return; // keep dialog open so the rep can fix (e.g. assign owner / quality)
      }
      const bookRes = await setLeadBooking(
        leadId,
        value,
        guestCount ? Number(guestCount) : undefined
      );
      if (!bookRes.success) toast.error(bookRes.error);
      else toast.success("Lead won — booking recorded.");
      setWonOpen(false);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Select value={currentStatus} onValueChange={handleStatusChange} disabled={isPending}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Change status" />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATUSES.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={wonOpen} onOpenChange={(o) => !isPending && setWonOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this lead Won</DialogTitle>
            <DialogDescription>
              Record the booking so it can be sent to Google Ads as a confirmed booking. The
              value is the actual booking amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="won-value">Booking value (₹) *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="won-value"
                  inputMode="numeric"
                  className="pl-8"
                  placeholder="e.g. 320000"
                  value={bookingValue}
                  onChange={(e) => setBookingValue(e.target.value.replace(/[^\d]/g, ""))}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="won-guests">Guest count</Label>
              <Input
                id="won-guests"
                inputMode="numeric"
                placeholder="e.g. 300"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWonOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={confirmWon} disabled={isPending || !bookingValue}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Mark Won
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
