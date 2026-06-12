"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, Loader2, Lock, Search } from "lucide-react";

import { getDaySlotAvailability, blockSlotFromQuotation, type SlotAvailability } from "@/actions/quotation-booking.actions";
import { BOOKABLE_SLOTS, plannerSlotToEnum, SLOT_LABEL, type TimeSlotEnum } from "@/lib/sales/slot";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VenueOpt { id: string; name: string }

interface Props {
  quotationId: string;
  venues: VenueOpt[];
  defaultVenueId?: string | null;
  defaultDateISO?: string | null;
  defaultPlannerSlot?: string | null;
  blocked: { bookingId: string; at: string | null } | null;
}

export function SlotBlockCard({ quotationId, venues, defaultVenueId, defaultDateISO, defaultPlannerSlot, blocked }: Props) {
  const router = useRouter();
  const [venueId, setVenueId] = useState(defaultVenueId ?? "");
  const [date, setDate] = useState(defaultDateISO ? defaultDateISO.slice(0, 10) : "");
  const [slot, setSlot] = useState<TimeSlotEnum>(plannerSlotToEnum(defaultPlannerSlot));
  const [checking, setChecking] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [avail, setAvail] = useState<SlotAvailability[] | null>(null);

  if (blocked) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
            <Lock className="h-4 w-4" /> Slot Blocked
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>The slot is held for this customer.</p>
          <Button asChild variant="outline" size="sm">
            <a href={`/bookings/${blocked.bookingId}`}>View booking</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  async function check() {
    if (!venueId || !date) return toast.error("Pick a venue and date first.");
    setChecking(true);
    try {
      const res = await getDaySlotAvailability(venueId, date);
      if (!res.success) return toast.error(res.error);
      setAvail(res.data);
    } finally {
      setChecking(false);
    }
  }

  async function block() {
    if (!venueId || !date) return toast.error("Pick a venue and date first.");
    setBlocking(true);
    try {
      const res = await blockSlotFromQuotation(quotationId, { venueId, dateISO: date, timeSlot: slot });
      if (!res.success) return toast.error(res.error);
      toast.success("Slot blocked.");
      router.refresh();
    } finally {
      setBlocking(false);
    }
  }

  const selectedAvail = avail?.find((a) => a.slot === slot);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-4 w-4" /> Block the Slot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Venue</Label>
          <Select value={venueId} onValueChange={(v) => { setVenueId(v); setAvail(null); }}>
            <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
            <SelectContent>
              {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Event Date</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setAvail(null); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Slot</Label>
            <Select value={slot} onValueChange={(v) => setSlot(v as TimeSlotEnum)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BOOKABLE_SLOTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button variant="outline" size="sm" className="w-full" onClick={check} disabled={checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Check availability
        </Button>

        {avail && (
          <div className="space-y-1 rounded-md border p-2 text-sm">
            {avail.map((a) => (
              <button
                key={a.slot}
                type="button"
                disabled={!a.available}
                onClick={() => setSlot(a.slot)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${
                  a.slot === slot ? "bg-muted" : ""
                } ${a.available ? "hover:bg-muted" : "opacity-60"}`}
              >
                <span>{SLOT_LABEL[a.slot]}</span>
                {a.available ? (
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Free</span>
                ) : (
                  <span className="text-rose-600 text-xs">{a.reason || "Taken"}</span>
                )}
              </button>
            ))}
            {selectedAvail && !selectedAvail.available && (
              <p className="px-2 pt-1 text-xs text-amber-600">
                The selected slot is taken — pick one of the free slots above.
              </p>
            )}
          </div>
        )}

        <Button className="w-full" onClick={block} disabled={blocking || (selectedAvail ? !selectedAvail.available : false)}>
          {blocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Block this slot
        </Button>
        <p className="text-xs text-muted-foreground">
          Creates a held booking for the customer. Next: collect the 10% booking advance to confirm.
        </p>
      </CardContent>
    </Card>
  );
}
