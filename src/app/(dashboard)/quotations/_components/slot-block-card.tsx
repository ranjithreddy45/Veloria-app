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
  /** True once the 20% booking advance has been paid on the quotation's invoice. */
  advancePaid?: boolean;
  /** Super Admins may block the slot before the 20% advance is received. */
  isSuperAdmin?: boolean;
}

export function SlotBlockCard({ quotationId, venues, defaultVenueId, defaultDateISO, defaultPlannerSlot, blocked, invoiceId, advancePaid, isSuperAdmin }: Props) {
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
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
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
              Generate booking invoice (20% to confirm)
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Collect the 20% advance on the invoice — once paid, the slot auto-confirms and the customer is notified.
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

  // Super Admins may block before the advance is collected; everyone else is
  // gated on the 20% advance (the server enforces this too).
  const canBlock = advancePaid || isSuperAdmin;
  const overriding = !advancePaid && !!isSuperAdmin;

  async function block() {
    if (!venueId || !date) return toast.error("Pick a venue and date first.");
    if (overriding && !window.confirm(
      "The 20% advance has NOT been received. Block this slot anyway? (Super Admin override — the booking stays on HOLD until the advance clears.)"
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
            the 20% advance is paid (blocking then auto-confirms the booking). */}
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-sm font-medium">Step 1 — Collect the 20% advance</p>
          {!invoiceId ? (
            <Button size="sm" className="w-full" onClick={genInvoice} disabled={invoicing}>
              {invoicing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate proforma invoice (20% advance)
            </Button>
          ) : advancePaid ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Advance received — block the slot below.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-amber-600">
                Advance pending. Record the 20% advance to unlock slot booking.
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

        <Button className="w-full" onClick={block} disabled={blocking || !canBlock || (selectedAvail ? !selectedAvail.available : false)}>
          {blocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {advancePaid ? "Block this slot" : overriding ? "Block slot (Super Admin override)" : "Block slot (after advance)"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {advancePaid
            ? "Advance received — blocking the slot confirms the booking and hands it to operations."
            : overriding
            ? "Super Admin override: you can block before the 20% advance is received. The booking stays on HOLD until the advance clears. Others must collect the advance first."
            : "Slot booking unlocks once the 20% advance is paid in Step 1. Only a Super Admin can block before then."}
        </p>
      </CardContent>
    </Card>
  );
}
