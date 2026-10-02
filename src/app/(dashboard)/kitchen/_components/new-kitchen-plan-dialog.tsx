"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuickActionButton } from "@/components/ui/quick-actions";
import {
  type BookableEventDTO,
  getBookableEvents,
  createKitchenPlan,
} from "@/actions/kitchen.actions";

// ============================================================
// NewKitchenPlanDialog: start a production plan for a confirmed event.
// ------------------------------------------------------------
// The /kitchen page's main create action. The page renders it in the header's
// action cluster (QuickActions `leading`) only when the user holds
// kitchen:write. Confirmed events load the first time the dialog opens;
// createKitchenPlan re-checks kitchen:write on the server.
//
// The trigger, the filled primary pill, is built HERE, in the client
// component, not passed in by the server page. React 19.2's Flight serializer
// defers any element it meets after ~3.2KB of a task's payload into a lazy
// reference, and Radix's Slot (react-slot 1.2.3, behind DialogTrigger
// asChild) renders nothing for a lazy child, so a server-built trigger can
// silently disappear. Only a client component may pass `trigger`.
// ============================================================

export function NewKitchenPlanDialog({
  trigger,
}: {
  /**
   * The element that opens the dialog (through DialogTrigger asChild).
   * Defaults to the header's primary pill. Pass one only from a client
   * component; see the note above.
   */
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [events, setEvents] = React.useState<BookableEventDTO[]>([]);
  const [loadingEv, setLoadingEv] = React.useState(false);
  const [bookingId, setBookingId] = React.useState("");
  const [covers, setCovers] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || events.length > 0) return;
    setLoadingEv(true);
    getBookableEvents()
      .then((res) => {
        if (res.success) setEvents(res.data);
        else toast.error(res.error);
      })
      .finally(() => setLoadingEv(false));
  }, [open, events.length]);

  // Prefill covers from the picked event's guest count.
  function handlePickEvent(id: string) {
    setBookingId(id);
    const ev = events.find((e) => e.id === id);
    if (ev && !covers) setCovers(String(ev.guestCount));
  }

  async function handleCreate() {
    if (!bookingId) {
      toast.error("Select an event");
      return;
    }
    if (covers) {
      const coversNum = Number(covers);
      if (!Number.isFinite(coversNum) || coversNum <= 0) {
        toast.error("Covers must be a positive number");
        return;
      }
    }
    setSubmitting(true);
    const res = await createKitchenPlan({
      bookingId,
      covers: covers ? Number(covers) : undefined,
    });
    setSubmitting(false);
    if (res.success) {
      toast.success("Kitchen plan created");
      setOpen(false);
      router.push(`/kitchen/${res.data.id}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <QuickActionButton variant="primary" label="New plan" hint="Plan event production" />}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New kitchen plan</DialogTitle>
          <DialogDescription>
            Pick a confirmed event. Covers prefill from its guest count.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label>Event</Label>
            <Select value={bookingId} onValueChange={handlePickEvent} disabled={loadingEv}>
              <SelectTrigger>
                <SelectValue placeholder={loadingEv ? "Loading…" : "Select event"} />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingEv && events.length === 0 && (
              <p className="text-detail text-muted-foreground">
                No confirmed events available.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kitchen-covers">Covers</Label>
            <Input
              id="kitchen-covers"
              type="number"
              min={0}
              value={covers}
              onChange={(e) => setCovers(e.target.value)}
              placeholder="Number of plates"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating…" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
