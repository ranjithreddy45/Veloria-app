"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, Loader2, Lock, Search } from "lucide-react";

import { getDaySlotAvailability, blockSlotFromQuotation, type SlotAvailability } from "@/actions/quotation-booking.actions";
import { createBookingInvoiceFromQuotation } from "@/actions/booking-invoice.actions";
import { BOOKABLE_SLOTS, plannerSlotToEnum, SLOT_LABEL, type TimeSlotEnum } from "@/lib/sales/slot";
import { FileText, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BOOKING_ADVANCE_PCT, REDUCED_ADVANCE_PCT } from "@/lib/sales/quotation-calc";
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
  invoiceId?: string | null;
  /** True once the booking advance has been paid on the quotation's invoice. */
  advancePaid?: boolean;
  /** True once the REDUCED advance (Finance-only bar) has been paid. */
  reducedAdvancePaid?: boolean;
  /** Holders of bookings:block-reduced-advance (Finance, Super Admin) may block
   *  on the reduced advance. Sales deliberately cannot. */
  mayUseReducedAdvance?: boolean;
}

export function SlotBlockCard({ quotationId, venues, defaultVenueId, defaultDateISO, defaultPlannerSlot, blocked, invoiceId, advancePaid, reducedAdvancePaid, mayUseReducedAdvance }: Props) {
  const router = useRouter();
  const [venueId, setVenueId] = useState(defaultVenueId ?? "");
  const [date, setDate] = useState(defaultDateISO ? defaultDateISO.slice(0, 10) : "");
  const [slot, setSlot] = useState<TimeSlotEnum>(plannerSlotToEnum(defaultPlannerSlot));
  const [checking, setChecking] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [avail, setAvail] = useState<SlotAvailability[] | null>(null);

  async function genInvoice() {
    setInvoicing(true);
    try {
      const res = await createBookingInvoiceFromQuotation(quotationId);
      if (!res.success) return toast.error(res.error);
      toast.success("Booking invoice created.");
      router.push(`/invoices/${res.data.invoiceId}`);
    } finally {
      setInvoicing(false);
    }
  }

  if (blocked) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardHeader>
          <CardTitle className="text-success flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" /> Slot Blocked
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>The slot is held for this customer (pending the booking advance).</p>
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={`/bookings/${blocked.bookingId}`}><CalendarCheck className="h-4 w-4" /> View booking</a>
          </Button>
          {invoiceId ? (
            <Button asChild size="sm" className="w-full">
              <a href={`/invoices/${invoiceId}`}><Receipt className="h-4 w-4" /> View booking invoice</a>
            </Button>
          ) : (
            <Button size="sm" className="w-full" onClick={genInvoice} disabled={invoicing}>
              {invoicing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate booking invoice ({BOOKING_ADVANCE_PCT}% to confirm)
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Collect the {BOOKING_ADVANCE_PCT}% advance on the invoice — once paid, the slot auto-confirms and the customer is notified.
          </p>
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

  // Two tiers, mirrored from the server: Sales needs the full advance, Finance
  // may commit the slot from the reduced one — but nobody blocks on nothing.
  const onReduced = !advancePaid && !!mayUseReducedAdvance && !!reducedAdvancePaid;
  const canBlock = advancePaid || onReduced;
  const overriding = onReduced;

  async function block() {
    if (!venueId || !date) return toast.error("Pick a venue and date first.");
    if (overriding && !window.confirm(
      `Only the reduced ${REDUCED_ADVANCE_PCT}% advance is in, not the full ${BOOKING_ADVANCE_PCT}%. Block this slot anyway? It stays on HOLD until the full advance clears.`
    )) return;
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
        {/* Step 1 — proforma invoice + advance. The slot is ONLY blocked after
            the booking advance is paid (blocking then auto-confirms the booking),
            unless Finance overrides. The percentage is PAYMENT_TERMS-derived. */}
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3.5">
          <p className="text-sm font-medium">Step 1 — Collect the {BOOKING_ADVANCE_PCT}% advance</p>
          {!invoiceId ? (
            <Button size="sm" className="w-full" onClick={genInvoice} disabled={invoicing}>
              {invoicing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate proforma invoice ({BOOKING_ADVANCE_PCT}% advance)
            </Button>
          ) : advancePaid ? (
            <p className="text-success flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4" /> Advance received — block the slot below.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-warning text-xs">
                Advance pending. Record the {BOOKING_ADVANCE_PCT}% advance to unlock slot booking.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={`/invoices/${invoiceId}`}>
                  <Receipt className="h-4 w-4" /> Open invoice to record advance
                </a>
              </Button>
            </div>
          )}
        </div>

        <p className="text-sm font-medium">Step 2 — Block the slot</p>
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
          <div className="space-y-1 rounded-xl border p-3 text-sm">
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
                  <span className="text-success flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Free</span>
                ) : (
                  <span className="text-destructive text-xs">{a.reason || "Taken"}</span>
                )}
              </button>
            ))}
            {selectedAvail && !selectedAvail.available && (
              <p className="text-warning px-2 pt-1 text-xs">
                The selected slot is taken — pick one of the free slots above.
              </p>
            )}
          </div>
        )}

        <Button className="w-full" onClick={block} disabled={blocking || !canBlock || (selectedAvail ? !selectedAvail.available : false)}>
          {blocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {advancePaid ? "Block this slot" : overriding ? `Block slot on ${REDUCED_ADVANCE_PCT}% advance` : "Block slot (after advance)"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {advancePaid
            ? "Advance received — blocking the slot confirms the booking and hands it to operations."
            : overriding
            ? `The reduced ${REDUCED_ADVANCE_PCT}% advance is in. You can block the slot now; it stays on HOLD until the full ${BOOKING_ADVANCE_PCT}% clears — Sales cannot do this.`
            : mayUseReducedAdvance
            ? `You can block this slot once at least ${REDUCED_ADVANCE_PCT}% is received. Nothing has reached that bar yet.`
            : `Slot booking unlocks once the ${BOOKING_ADVANCE_PCT}% advance is paid in Step 1. Finance can block it from ${REDUCED_ADVANCE_PCT}% if the full advance cannot be collected yet.`}
        </p>
      </CardContent>
    </Card>
  );
}
