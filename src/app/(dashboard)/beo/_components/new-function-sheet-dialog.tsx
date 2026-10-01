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
import { createBeo, type BookableEvent } from "@/actions/beo.actions";

// ============================================================
// NewFunctionSheetDialog: create a BEO from a confirmed booking.
// ------------------------------------------------------------
// The /beo page's main create action. The page renders it in the header's
// action cluster (QuickActions `leading`) only when the user holds beo:write,
// and createBeo re-checks beo:write on the server.
//
// The trigger, the filled primary pill, is built HERE, in the client
// component, not passed in by the server page. React 19.2's Flight serializer
// defers any element it meets after ~3.2KB of a task's payload into a lazy
// reference, and Radix's Slot (react-slot 1.2.3, behind DialogTrigger
// asChild) renders nothing for a lazy child. A server-built trigger placed
// after the `events` list therefore vanished on venues with many confirmed
// bookings (reproduced with 60 events). Only a client component may pass
// `trigger`.
// ============================================================

export function NewFunctionSheetDialog({
  events,
  trigger,
}: {
  /** Confirmed bookings the page loaded with getBookableEvents(). */
  events: BookableEvent[];
  /**
   * The element that opens the dialog (through DialogTrigger asChild).
   * Defaults to the header's primary pill. Pass one only from a client
   * component; see the note above.
   */
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [bookingId, setBookingId] = React.useState("");
  const [covers, setCovers] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) { setBookingId(""); setCovers(""); }
  }, [open]);

  const selected = events.find((e) => e.id === bookingId);

  function pick(id: string) {
    setBookingId(id);
    const e = events.find((x) => x.id === id);
    if (e?.guestCount != null) setCovers(String(e.guestCount));
  }

  async function create() {
    if (!bookingId) { toast.error("Pick an event first."); return; }
    setBusy(true);
    try {
      const res = await createBeo({ bookingId, covers: covers ? Number(covers) : undefined });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Function sheet created");
      setOpen(false);
      router.push(`/beo/${res.data.id}`);
    } catch {
      toast.error("Couldn't create — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <QuickActionButton variant="primary" label="New function sheet" hint="Brief a confirmed event" />
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New function sheet</DialogTitle>
          <DialogDescription>Create a BEO from a confirmed booking. Covers pre-fill from the guest count.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label>Event (confirmed booking)</Label>
            <Select value={bookingId || undefined} onValueChange={pick}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select an event…" /></SelectTrigger>
              <SelectContent>
                {events.length === 0 ? (
                  <div className="px-2 py-1.5 text-detail text-muted-foreground">No confirmed events.</div>
                ) : (
                  events.map((e) => (
                    <SelectItem key={e.id} value={e.id} disabled={e.hasBeo}>
                      {e.label}{e.hasBeo ? " (has BEO)" : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selected?.hasBeo && (
              <p className="text-detail text-amber-600">This event already has a function sheet.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Covers</Label>
            <Input inputMode="numeric" value={covers} onChange={(e) => setCovers(e.target.value)} placeholder="Number of covers" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={create} disabled={busy || !bookingId || selected?.hasBeo}>{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
