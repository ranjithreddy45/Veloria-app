"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Send } from "lucide-react";

import {
  computeQuotation,
  QUOTE_CATALOG,
  DEFAULT_ROOM_CHARGE,
  type QuotationInput,
} from "@/lib/sales/quotation-calc";
import {
  createSalesQuotation,
  updateSalesQuotation,
  submitSalesQuotation,
  type QuotationMeta,
} from "@/actions/sales-quotation.actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const NONE = "__none__";

interface LeadOpt {
  id: string;
  title: string;
  contactId?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
}
interface VenueOpt {
  id: string;
  name: string;
}

export interface QuotationInitial {
  id: string;
  input: QuotationInput;
  meta: QuotationMeta;
}

interface Props {
  leads: LeadOpt[];
  venues: VenueOpt[];
  initial?: QuotationInitial;
}

export function QuotationCalculator({ leads, venues, initial }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // ---- Customer / context ----
  const [leadId, setLeadId] = useState(initial?.meta.leadId ?? "");
  const [venueId, setVenueId] = useState(initial?.meta.venueId ?? "");
  const [clientName, setClientName] = useState(initial?.meta.clientName ?? "");
  const [clientPhone, setClientPhone] = useState(initial?.meta.clientPhone ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.meta.clientEmail ?? "");
  const [occasion, setOccasion] = useState(initial?.meta.occasion ?? "");
  const [eventDate, setEventDate] = useState(
    initial?.meta.eventDate ? String(initial.meta.eventDate).slice(0, 10) : ""
  );
  const [timeSlot, setTimeSlot] = useState(initial?.meta.timeSlot ?? "");
  const [notes, setNotes] = useState(initial?.meta.notes ?? "");

  // ---- Line item inputs ----
  const [guestCount, setGuestCount] = useState<string>(
    initial?.input.guestCount ? String(initial.input.guestCount) : ""
  );
  const [foodPackageId, setFoodPackageId] = useState(initial?.input.foodPackageId ?? "");
  const [foodOverride, setFoodOverride] = useState<string>(
    initial?.input.foodPerPlateOverride != null ? String(initial.input.foodPerPlateOverride) : ""
  );
  const [decorId, setDecorId] = useState(initial?.input.decorId ?? "");
  const [activityIds, setActivityIds] = useState<string[]>(initial?.input.activityIds ?? []);
  const [cakeId, setCakeId] = useState(initial?.input.cakeId ?? "");
  const [cakeKg, setCakeKg] = useState<string>(
    initial?.input.cakeKg ? String(initial.input.cakeKg) : ""
  );
  const [photographyId, setPhotographyId] = useState(initial?.input.photographyId ?? "");
  const [photoCustom, setPhotoCustom] = useState<string>(
    initial?.input.photographyCustomAmount != null ? String(initial.input.photographyCustomAmount) : ""
  );
  const [drinksPerPerson, setDrinksPerPerson] = useState<string>(
    initial?.input.drinksPerPerson ? String(initial.input.drinksPerPerson) : ""
  );
  const [rooms, setRooms] = useState<string>(
    initial?.input.rooms ? String(initial.input.rooms) : ""
  );
  const [roomCharge, setRoomCharge] = useState<string>(
    initial?.input.roomCharge ? String(initial.input.roomCharge) : String(DEFAULT_ROOM_CHARGE)
  );
  const [discountPct, setDiscountPct] = useState<string>(
    initial?.input.discountPct ? String(initial.input.discountPct) : ""
  );

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const input: QuotationInput = useMemo(
    () => ({
      guestCount: num(guestCount),
      foodPackageId: foodPackageId || undefined,
      foodPerPlateOverride: foodOverride ? num(foodOverride) : null,
      decorId: decorId || undefined,
      activityIds,
      cakeId: cakeId || undefined,
      cakeKg: cakeKg ? num(cakeKg) : undefined,
      photographyId: photographyId || undefined,
      photographyCustomAmount: photoCustom ? num(photoCustom) : undefined,
      drinksPerPerson: drinksPerPerson ? num(drinksPerPerson) : undefined,
      rooms: rooms ? num(rooms) : undefined,
      roomCharge: roomCharge ? num(roomCharge) : undefined,
      discountPct: discountPct ? num(discountPct) : undefined,
    }),
    [
      guestCount, foodPackageId, foodOverride, decorId, activityIds, cakeId, cakeKg,
      photographyId, photoCustom, drinksPerPerson, rooms, roomCharge, discountPct,
    ]
  );

  const result = useMemo(() => computeQuotation(input), [input]);

  const meta: QuotationMeta = {
    clientName, clientPhone, clientEmail, occasion,
    eventDate: eventDate || null, timeSlot, notes,
    leadId: leadId || null, venueId: venueId || null,
    contactId: leads.find((l) => l.id === leadId)?.contactId ?? null,
  };

  function onPickLead(id: string) {
    const v = id === NONE ? "" : id;
    setLeadId(v);
    const lead = leads.find((l) => l.id === v);
    if (lead) {
      if (lead.clientName && !clientName) setClientName(lead.clientName);
      if (lead.clientPhone && !clientPhone) setClientPhone(lead.clientPhone);
      if (lead.clientEmail && !clientEmail) setClientEmail(lead.clientEmail);
    }
  }

  function toggleActivity(id: string) {
    setActivityIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save(submit: boolean) {
    setSaving(true);
    try {
      let id = initial?.id;
      if (id) {
        const res = await updateSalesQuotation(id, input, meta);
        if (!res.success) return toast.error(res.error);
      } else {
        const res = await createSalesQuotation(input, meta);
        if (!res.success) return toast.error(res.error);
        id = res.data.id;
      }
      if (submit && id) {
        const sub = await submitSalesQuotation(id);
        if (!sub.success) {
          toast.error(sub.error);
          router.push(`/quotations/${id}`);
          return;
        }
        toast.success("Quotation submitted for approval.");
      } else {
        toast.success("Quotation saved.");
      }
      router.push(`/quotations/${id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const field = "space-y-1.5";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* ---- Form ---- */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer & Event</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className={field}>
              <Label>Link to Lead (optional)</Label>
              <Select value={leadId || NONE} onValueChange={onPickLead}>
                <SelectTrigger><SelectValue placeholder="No lead" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No lead</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label>Hall / Venue</Label>
              <Select value={venueId || NONE} onValueChange={(v) => setVenueId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label>Client Name</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Mr/Mrs. ..." />
            </div>
            <div className={field}>
              <Label>Phone</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Phone number" />
            </div>
            <div className={field}>
              <Label>Email</Label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Email (for sending)" />
            </div>
            <div className={field}>
              <Label>Occasion</Label>
              <Input value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Baby shower, Birthday..." />
            </div>
            <div className={field}>
              <Label>Event Date</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className={field}>
              <Label>Time Slot</Label>
              <Select value={timeSlot || NONE} onValueChange={(v) => setTimeSlot(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select slot" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {QUOTE_CATALOG.timeSlots.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label>Guest Count *</Label>
              <Input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} placeholder="e.g. 120" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Line Items</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {/* Food */}
            <div className={field}>
              <Label>Food Plan (per plate × guests)</Label>
              <Select value={foodPackageId || NONE} onValueChange={(v) => setFoodPackageId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No food" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No food</SelectItem>
                  {QUOTE_CATALOG.food.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label} — ₹{f.perPlate}/plate</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label>Per-plate override (optional)</Label>
              <Input type="number" min={0} value={foodOverride} onChange={(e) => setFoodOverride(e.target.value)} placeholder="Negotiated rate" />
            </div>

            {/* Decor */}
            <div className={field}>
              <Label>Decor Plan (fixed)</Label>
              <Select value={decorId || NONE} onValueChange={(v) => setDecorId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No decor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No decor</SelectItem>
                  {QUOTE_CATALOG.decor.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.label} — {inr(d.amount)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Photography */}
            <div className={field}>
              <Label>Photography / Videography</Label>
              <Select value={photographyId || NONE} onValueChange={(v) => setPhotographyId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {QUOTE_CATALOG.photography.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}{p.amount != null ? ` — ${inr(p.amount)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {photographyId === "other" && (
                <Input type="number" min={0} value={photoCustom} onChange={(e) => setPhotoCustom(e.target.value)} placeholder="Custom amount" className="mt-1.5" />
              )}
            </div>

            {/* Cake */}
            <div className={field}>
              <Label>Cake Plan (rate/kg × kg)</Label>
              <Select value={cakeId || NONE} onValueChange={(v) => setCakeId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No cake" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No cake</SelectItem>
                  {QUOTE_CATALOG.cake.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label} — ₹{c.ratePerKg}/kg</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label>Cake Quantity (kg)</Label>
              <Input type="number" min={0} step="0.5" value={cakeKg} onChange={(e) => setCakeKg(e.target.value)} placeholder="e.g. 3" />
            </div>

            {/* Drinks */}
            <div className={field}>
              <Label>Drinks (per person × guests)</Label>
              <Input type="number" min={0} value={drinksPerPerson} onChange={(e) => setDrinksPerPerson(e.target.value)} placeholder="Per-person rate" />
            </div>

            {/* Accommodation */}
            <div className={field}>
              <Label>Hotel Rooms</Label>
              <div className="flex gap-2">
                <Input type="number" min={0} value={rooms} onChange={(e) => setRooms(e.target.value)} placeholder="Rooms" />
                <Input type="number" min={0} value={roomCharge} onChange={(e) => setRoomCharge(e.target.value)} placeholder="₹/room" />
              </div>
            </div>

            {/* Activities */}
            <div className="sm:col-span-2 space-y-2">
              <Label>Activities (fixed)</Label>
              <div className="flex flex-wrap gap-4">
                {QUOTE_CATALOG.activity.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={activityIds.includes(a.id)} onCheckedChange={() => toggleActivity(a.id)} />
                    {a.label} — {inr(a.amount)}
                  </label>
                ))}
              </div>
            </div>

            <div className={field}>
              <Label>Discount %</Label>
              <Input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Remarks</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special notes for this quotation..." rows={3} />
          </CardContent>
        </Card>
      </div>

      {/* ---- Live preview ---- */}
      <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Live Quotation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {result.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add line items to see the quote.</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {result.lines.map((l) => (
                  <div key={l.sl} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{l.particulars}</span>
                    <span className="tabular-nums font-medium">{inr(l.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{inr(result.subtotal)}</span></div>
              {result.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Discount ({result.discountPct}%)</span><span className="tabular-nums">− {inr(result.discountAmount)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Tax (5%)</span><span className="tabular-nums">{inr(result.tax)}</span></div>
              <div className="flex justify-between text-base font-bold pt-1"><span>Grand Total</span><span className="tabular-nums">{inr(result.grandTotal)}</span></div>
            </div>
            {result.grandTotal > 0 && (
              <div className="border-t pt-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Schedule</p>
                {result.paymentSchedule.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{p.label} ({p.pct}%)</span>
                    <span className="tabular-nums">{inr(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button onClick={() => save(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Save & Submit for Approval
          </Button>
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            <Save className="h-4 w-4" /> Save Draft
          </Button>
        </div>
      </div>
    </div>
  );
}
