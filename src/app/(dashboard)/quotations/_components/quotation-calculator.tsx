"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { getDateDemand, type DateDemandResult } from "@/actions/date-demand.actions";
import { DateDemandBanner } from "./date-demand-banner";

import {
  computeQuotation,
  computePackageLine,
  QUOTE_CATALOG,
  DEFAULT_ROOM_CHARGE,
  type QuotationInput,
  type PackageLine,
  type PackageDiscountType,
  type QuotePackageOption,
} from "@/lib/sales/quotation-calc";
import {
  createSalesQuotation,
  updateSalesQuotation,
  submitSalesQuotation,
  type QuotationMeta,
} from "@/actions/sales-quotation.actions";
import { getQuotePackageOptions } from "@/actions/quote-packages.actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const NONE = "__none__";

let _rowSeq = 0;
function rowId(): string {
  _rowSeq += 1;
  return `pl_${Date.now().toString(36)}_${_rowSeq}`;
}

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
  const [foodMode, setFoodMode] = useState<"WITH_FOOD" | "HALL_ONLY">(
    initial?.input.foodMode ?? "WITH_FOOD"
  );
  const [foodPackageId, setFoodPackageId] = useState(initial?.input.foodPackageId ?? "");
  const [foodOverride, setFoodOverride] = useState<string>(
    initial?.input.foodPerPlateOverride != null ? String(initial.input.foodPerPlateOverride) : ""
  );
  const [hallRate, setHallRate] = useState<string>(
    initial?.input.hallRate ? String(initial.input.hallRate) : ""
  );
  const [hallHours, setHallHours] = useState<string>(
    initial?.input.hallHours ? String(initial.input.hallHours) : "4"
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

  // ---- Vendor-package line items (repeatable, multiple-per-category) ----
  const [pkgOptions, setPkgOptions] = useState<QuotePackageOption[]>([]);
  const [pkgLoaded, setPkgLoaded] = useState(false);
  const [packageLines, setPackageLines] = useState<PackageLine[]>(
    (initial?.input.packageLines ?? []).map((p) => ({ ...p, id: p.id ?? rowId() }))
  );
  useEffect(() => {
    let active = true;
    getQuotePackageOptions()
      .then((opts) => { if (active) setPkgOptions(opts); })
      .catch(() => { if (active) setPkgOptions([]); })
      .finally(() => { if (active) setPkgLoaded(true); });
    return () => { active = false; };
  }, []);

  // Packages grouped by category for the grouped Select.
  const pkgByCategory = useMemo(() => {
    const map = new Map<string, QuotePackageOption[]>();
    for (const o of pkgOptions) {
      const arr = map.get(o.category) ?? [];
      arr.push(o);
      map.set(o.category, arr);
    }
    return Array.from(map.entries());
  }, [pkgOptions]);
  const optById = useMemo(() => new Map(pkgOptions.map((o) => [o.id, o])), [pkgOptions]);

  function addPackageLine() {
    setPackageLines((prev) => [
      ...prev,
      { id: rowId(), vendorPackageId: "", name: "", category: "", unitPrice: 0, qty: 1 },
    ]);
  }
  function removePackageLine(id: string) {
    setPackageLines((prev) => prev.filter((p) => p.id !== id));
  }
  function patchPackageLine(id: string, patch: Partial<PackageLine>) {
    setPackageLines((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function pickPackage(id: string, vendorPackageId: string) {
    const opt = optById.get(vendorPackageId);
    if (!opt) return;
    // Pax-aware default qty: per-plate (per-person) packages default to the
    // current guest count when it's set; everything else uses the min-pax floor.
    const pax = num(guestCount);
    const defaultQty =
      opt.priceUnit === "PER_PLATE" && pax >= 1
        ? pax
        : opt.minPax && opt.minPax > 0
        ? opt.minPax
        : 1;
    patchPackageLine(id, {
      vendorPackageId: opt.id,
      name: opt.name,
      category: opt.category,
      // Catalog reference price + editable revised cost defaulted to catalog.
      unitPrice: opt.customerPrice,
      revisedUnitPrice: opt.customerPrice,
      minPax: opt.minPax ?? undefined,
      qty: defaultQty,
      // Reset any prior discount — caps are per-package.
      discountType: undefined,
      discountValue: undefined,
    });
  }
  // Rupee cap on the discount for a line, per the package's maxDiscount* config.
  function maxDiscountRupees(opt: QuotePackageOption | undefined, gross: number): number {
    if (!opt || opt.maxDiscountValue == null || !opt.maxDiscountType) return 0;
    return opt.maxDiscountType === "PERCENT"
      ? gross * (Math.min(100, opt.maxDiscountValue) / 100)
      : opt.maxDiscountValue;
  }

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const input: QuotationInput = useMemo(
    () => ({
      guestCount: num(guestCount),
      foodMode,
      // Hall-only: per-hour charge replaces food. With-food: per-plate food.
      hallRate: foodMode === "HALL_ONLY" && hallRate ? num(hallRate) : undefined,
      hallHours: foodMode === "HALL_ONLY" ? num(hallHours) || 4 : undefined,
      foodPackageId: foodMode === "HALL_ONLY" ? undefined : foodPackageId || undefined,
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
      // Only completed package lines (a picked package) reach the engine/persist.
      // A line whose package is inactive/deleted (not in the loaded options) is
      // treated as unavailable and excluded from the total until re-selected.
      packageLines: packageLines
        .filter((p) => p.vendorPackageId && (!pkgLoaded || optById.has(p.vendorPackageId)))
        .map((p) => ({
          id: p.id,
          vendorPackageId: p.vendorPackageId,
          name: p.name,
          category: p.category,
          unitPrice: p.unitPrice,
          revisedUnitPrice: p.revisedUnitPrice,
          qty: Math.max(0, Math.floor(p.qty || 0)),
          minPax: p.minPax,
          discountType: p.discountType,
          discountValue: p.discountValue,
        })),
      discountPct: discountPct ? num(discountPct) : undefined,
    }),
    [
      guestCount, foodMode, hallRate, hallHours, foodPackageId, foodOverride, decorId, activityIds, cakeId, cakeKg,
      photographyId, photoCustom, drinksPerPerson, rooms, roomCharge, packageLines, discountPct, pkgLoaded, optById,
    ]
  );

  const result = useMemo(() => computeQuotation(input), [input]);

  // Demand-based pricing guidance for the chosen date (Muhurtham / weekend / scarcity).
  const [demand, setDemand] = useState<DateDemandResult | null>(null);
  useEffect(() => {
    if (!eventDate) { setDemand(null); return; }
    let active = true;
    getDateDemand(eventDate, venueId || null, timeSlot || null)
      .then((r) => { if (active) setDemand(r.success ? r.data : null); })
      .catch(() => { if (active) setDemand(null); });
    return () => { active = false; };
  }, [eventDate, venueId, timeSlot]);

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
            {/* Pricing model toggle */}
            <div className={`${field} sm:col-span-2`}>
              <Label>Pricing Model</Label>
              {/* The two labels total ~380px side by side — wider than a 375px
                  phone. Stacked full-width below `sm`, inline segmented control
                  from `sm` up (unchanged on desktop). */}
              <div className="flex w-full flex-col rounded-md border p-0.5 text-sm sm:inline-flex sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => setFoodMode("WITH_FOOD")}
                  className={`rounded px-3 py-1.5 font-medium transition ${foodMode === "WITH_FOOD" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  With Food (per plate)
                </button>
                <button
                  type="button"
                  onClick={() => setFoodMode("HALL_ONLY")}
                  className={`rounded px-3 py-1.5 font-medium transition ${foodMode === "HALL_ONLY" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Without Food (hall per hour)
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {foodMode === "WITH_FOOD"
                  ? "Food charged per plate × guests. No separate hall charge."
                  : "Hall charged per hour (min 4 hours). No per-plate food charge."}
              </p>
            </div>

            {foodMode === "WITH_FOOD" ? (
              <>
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
              </>
            ) : (
              <>
                {/* Hall (per hour) */}
                <div className={field}>
                  <Label>Hall Charge (per hour)</Label>
                  <Select value={hallRate || NONE} onValueChange={(v) => setHallRate(v === NONE ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select hall rate" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Select hall rate</SelectItem>
                      {QUOTE_CATALOG.hallRates.map((r) => (
                        <SelectItem key={r} value={String(r)}>Hall — ₹{r.toLocaleString("en-IN")}/hr</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={field}>
                  <Label>Hours (min 4)</Label>
                  <Input type="number" min={4} value={hallHours} onChange={(e) => setHallHours(e.target.value)} placeholder="4" />
                </div>
              </>
            )}

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

        {/* Vendor packages — repeatable line items, multiple per category */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Vendor Packages</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addPackageLine}>
              <Plus className="h-4 w-4" /> Add package
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {packageLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add vendor packages (catering, decor, photography…) as separate priced lines.
                You can add several — including more than one from the same category.
              </p>
            ) : (
              packageLines.map((line) => {
                const opt = optById.get(line.vendorPackageId);
                const qty = Math.max(0, Math.floor(line.qty || 0));
                const { gross, lineDiscount, amount } = computePackageLine(line);
                const minPax = opt?.minPax ?? line.minPax ?? null;
                const belowMin = minPax != null && qty < minPax;
                const capRupees = maxDiscountRupees(opt, gross);
                const discountAllowed = opt ? opt.maxDiscountValue != null && !!opt.maxDiscountType : false;
                const overCap = lineDiscount - capRupees > 1;
                // Package was picked but is no longer among the active options
                // (inactive/deleted). Flag the row and drop it from the total.
                const isUnavailable = pkgLoaded && !!line.vendorPackageId && !opt;
                return (
                  <div
                    key={line.id}
                    className={`rounded-xl border p-3.5 space-y-3 ${isUnavailable ? "border-destructive" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Label>Package</Label>
                        <Select
                          value={line.vendorPackageId || NONE}
                          onValueChange={(v) => v !== NONE && pickPackage(line.id!, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={pkgOptions.length ? "Choose a package" : "No active packages"} />
                          </SelectTrigger>
                          <SelectContent>
                            {pkgByCategory.map(([cat, opts]) => (
                              <SelectGroup key={cat}>
                                <SelectLabel>{cat}</SelectLabel>
                                {opts.map((o) => (
                                  <SelectItem key={o.id} value={o.id}>
                                    {o.name} — {inr(o.customerPrice)} · {o.vendorName}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6 text-destructive hover:text-destructive"
                        onClick={() => removePackageLine(line.id!)}
                        aria-label="Remove package line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {isUnavailable && (
                      <p className="text-xs text-destructive">
                        This package is no longer available — please re-select. It
                        won&apos;t be counted in the total until you do.
                      </p>
                    )}

                    {opt && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label>Revised cost (₹/unit)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={line.revisedUnitPrice != null ? String(line.revisedUnitPrice) : ""}
                              onChange={(e) => patchPackageLine(line.id!, { revisedUnitPrice: num(e.target.value) })}
                              placeholder={String(line.unitPrice)}
                            />
                            {(() => {
                              const revised = line.revisedUnitPrice ?? 0;
                              const adjusted = revised > 0 && Math.abs(revised - line.unitPrice) > 0.5;
                              return (
                                <p className="text-xs text-muted-foreground">
                                  {adjusted ? (
                                    <>
                                      Catalog <span className="line-through">{inr(line.unitPrice)}</span>
                                      <span className="text-warning ml-1 font-medium">
                                        · adjusted {revised > line.unitPrice ? "up" : "down"}
                                      </span>
                                    </>
                                  ) : (
                                    <>Catalog {inr(line.unitPrice)}</>
                                  )}
                                </p>
                              );
                            })()}
                          </div>
                          <div className="space-y-1.5">
                            <Label>Qty / units *</Label>
                            <Input
                              type="number"
                              min={minPax ?? 1}
                              value={String(line.qty ?? "")}
                              onChange={(e) => patchPackageLine(line.id!, { qty: num(e.target.value) })}
                              className={belowMin ? "border-destructive" : ""}
                            />
                            <p className={`text-xs ${belowMin ? "text-destructive" : "text-muted-foreground"}`}>
                              {minPax != null ? `Min ${minPax} pax/units` : "No minimum"}
                              {opt.priceUnit ? ` · ${opt.priceUnit.replace(/_/g, " ").toLowerCase()}` : ""}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Line total</Label>
                            <Input value={inr(amount)} readOnly disabled />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Discount type</Label>
                            <Select
                              value={line.discountType ?? NONE}
                              onValueChange={(v) =>
                                patchPackageLine(line.id!, {
                                  discountType: v === NONE ? undefined : (v as PackageDiscountType),
                                  discountValue: v === NONE ? undefined : line.discountValue,
                                })
                              }
                              disabled={!discountAllowed}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={discountAllowed ? "No discount" : "Not allowed"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>No discount</SelectItem>
                                <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                                <SelectItem value="AMOUNT">Amount (₹)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Discount value</Label>
                            <Input
                              type="number"
                              min={0}
                              value={line.discountValue != null ? String(line.discountValue) : ""}
                              onChange={(e) => patchPackageLine(line.id!, { discountValue: num(e.target.value) })}
                              disabled={!discountAllowed || !line.discountType}
                              placeholder="0"
                              className={overCap ? "border-destructive" : ""}
                            />
                            <p className={`text-xs ${overCap ? "text-destructive" : "text-muted-foreground"}`}>
                              {discountAllowed
                                ? `Cap: ${opt.maxDiscountType === "PERCENT" ? `${opt.maxDiscountValue}%` : inr(opt.maxDiscountValue ?? 0)}`
                                : "This package doesn't allow a discount"}
                              {lineDiscount > 0 ? ` · − ${inr(lineDiscount)}` : ""}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes &amp; details (shown to the customer)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              These notes appear on the quote the customer sees online. Don&apos;t
              include internal-only remarks here.
            </p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the customer (e.g. inclusions, terms, special arrangements)..." rows={3} />
          </CardContent>
        </Card>
      </div>

      {/* ---- Live preview ---- */}
      <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
        {/* How much to charge for this date (Muhurtham / weekend / scarcity). */}
        <DateDemandBanner
          demand={demand}
          subtotal={result.subtotal}
          taxableAmount={result.taxableAmount}
          discountPct={result.discountPct}
        />
        <Card>
          <CardHeader><CardTitle className="text-base">Live Quotation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {result.lines.length === 0 ? (
              <EmptyState
                className="py-8"
                icon={<Calculator />}
                title="Nothing quoted yet"
                description="Add packages and line items on the left — the running total appears here as you build."
              />
            ) : (
              <div className="space-y-1.5 text-sm">
                {result.lines.map((l) => (
                  <div key={l.sl} className="flex justify-between gap-2">
                    {/* min-w-0 / shrink-0: a long particular (vendor package
                        names run 40+ chars) must wrap, never squeeze the money. */}
                    <span className="min-w-0 text-muted-foreground">{l.particulars}</span>
                    <span className="numeric shrink-0 font-medium">{inr(l.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="numeric">{inr(result.subtotal)}</span></div>
              {result.discountAmount > 0 && (
                <div className="text-success flex justify-between"><span>Discount ({result.discountPct}%)</span><span className="numeric">− {inr(result.discountAmount)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Tax (5%)</span><span className="numeric">{inr(result.tax)}</span></div>
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t pt-3">
                <span className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">Grand Total</span>
                <span className="numeric text-lg font-bold tracking-[-0.02em]">{inr(result.grandTotal)}</span>
              </div>
            </div>
            {result.grandTotal > 0 && (
              <div className="border-t pt-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Schedule</p>
                {result.paymentSchedule.map((p, i) => (
                  <div key={i} className="flex justify-between gap-2 text-xs">
                    <span className="min-w-0 text-muted-foreground">{p.label} ({p.pct}%)</span>
                    <span className="numeric shrink-0">{inr(p.amount)}</span>
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
