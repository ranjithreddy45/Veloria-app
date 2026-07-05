"use client";

// ============================================================
// Self-serve configurator — "use client".
// ------------------------------------------------------------
// Binds QuotationInput fields to state and prices LIVE with the SAME pure
// computeQuotation() engine the server re-prices with (math can never diverge).
// discountPct is intentionally NOT bound — customers cannot self-discount.
// On "Proceed to pay advance" it calls priceAndCreateAdvanceLink() and redirects
// to the existing /pay/<invoiceId> Razorpay checkout.
// ============================================================

import { useMemo, useState, useCallback } from "react";
import { Loader2, ArrowRight, ArrowLeft, AlertCircle, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  computeQuotation,
  validateQuotationInput,
  type QuotationInput,
  type FoodMode,
} from "@/lib/sales/quotation-calc";
import type { PublicConfiguratorCatalog } from "@/lib/public/configurator-catalog";
import type { StorefrontVenue } from "@/actions/storefront.actions";
import {
  createPublicQuoteDraft,
  updatePublicQuoteDraft,
  priceAndCreateAdvanceLink,
  type PublicQuoteDraftView,
} from "@/actions/public-configurator.actions";
import { PriceSummary } from "./price-summary";
import { SocialProofAside } from "./social-proof-aside";

interface Props {
  catalog: PublicConfiguratorCatalog;
  venues: StorefrontVenue[];
  initialVenueId?: string;
  resume?: PublicQuoteDraftView | null;
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function Configurator({ catalog, venues, initialVenueId, resume }: Props) {
  const r = resume?.inputs;

  const [step, setStep] = useState(1);
  const [venueId, setVenueId] = useState(resume?.venueId ?? initialVenueId ?? "");
  const [eventDate, setEventDate] = useState(
    resume?.eventDate ? resume.eventDate.slice(0, 10) : ""
  );
  const [timeSlot, setTimeSlot] = useState(resume?.timeSlot ?? catalog.timeSlots[0] ?? "");
  const [occasion, setOccasion] = useState(resume?.occasion ?? "");

  const [foodMode, setFoodMode] = useState<FoodMode>(r?.foodMode ?? "WITH_FOOD");
  const [guestCount, setGuestCount] = useState<number>(r?.guestCount ?? 100);
  const [hallRate, setHallRate] = useState<number>(r?.hallRate ?? 0);
  const [hallHours, setHallHours] = useState<number>(r?.hallHours ?? catalog.minHallHours);
  const [foodPackageId, setFoodPackageId] = useState(r?.foodPackageId ?? "");
  const [decorId, setDecorId] = useState(r?.decorId ?? "");
  const [activityIds, setActivityIds] = useState<string[]>(r?.activityIds ?? []);
  const [cakeId, setCakeId] = useState(r?.cakeId ?? "");
  const [cakeKg, setCakeKg] = useState<number>(r?.cakeKg ?? 0);
  const [photographyId, setPhotographyId] = useState(r?.photographyId ?? "");
  const [photographyCustomAmount, setPhotographyCustomAmount] = useState<number>(
    r?.photographyCustomAmount ?? 0
  );
  const [drinksPerPerson, setDrinksPerPerson] = useState<number>(r?.drinksPerPerson ?? 0);
  const [rooms, setRooms] = useState<number>(r?.rooms ?? 0);

  const [name, setName] = useState(resume?.customerName ?? "");
  const [phone, setPhone] = useState(resume?.customerPhone ?? "");
  const [email, setEmail] = useState(resume?.customerEmail ?? "");

  const [token, setToken] = useState<string | null>(resume?.token ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build the QuotationInput from state (discountPct intentionally omitted).
  const input: QuotationInput = useMemo(
    () => ({
      guestCount,
      foodMode,
      hallRate: foodMode === "HALL_ONLY" ? hallRate || undefined : undefined,
      hallHours: foodMode === "HALL_ONLY" ? hallHours : undefined,
      foodPackageId: foodMode === "WITH_FOOD" ? foodPackageId || undefined : undefined,
      decorId: decorId || undefined,
      activityIds,
      cakeId: cakeId || undefined,
      cakeKg: cakeId ? cakeKg : undefined,
      photographyId: photographyId || undefined,
      photographyCustomAmount: photographyCustomAmount || undefined,
      drinksPerPerson: drinksPerPerson || undefined,
      rooms: rooms || undefined,
    }),
    [
      guestCount,
      foodMode,
      hallRate,
      hallHours,
      foodPackageId,
      decorId,
      activityIds,
      cakeId,
      cakeKg,
      photographyId,
      photographyCustomAmount,
      drinksPerPerson,
      rooms,
    ]
  );

  // LIVE price — same engine the server re-prices with.
  const result = useMemo(() => computeQuotation(input), [input]);
  const validationErrors = useMemo(() => validateQuotationInput(input), [input]);

  const customPhoto =
    catalog.photography.find((p) => p.id === photographyId)?.amount === null;

  const toggleActivity = useCallback((id: string) => {
    setActivityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const meta = useMemo(
    () => ({
      occasion: occasion || undefined,
      eventDate: eventDate || null,
      timeSlot: timeSlot || undefined,
      venueId: venueId || null,
    }),
    [occasion, eventDate, timeSlot, venueId]
  );

  // Persist the draft (create on first save, update thereafter) so the price
  // and resume link survive a refresh. Best-effort — never blocks the UI.
  const persist = useCallback(async () => {
    try {
      if (token) {
        await updatePublicQuoteDraft(token, input, meta);
      } else {
        const res = await createPublicQuoteDraft(input, meta);
        if (res.success) setToken(res.data.token);
      }
    } catch {
      // Non-fatal: the customer can still proceed; conversion re-saves.
    }
  }, [token, input, meta]);

  const goToStep2 = useCallback(async () => {
    setError(null);
    await persist();
    setStep(2);
  }, [persist]);

  const goToStep3 = useCallback(async () => {
    setError(null);
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }
    await persist();
    setStep(3);
  }, [persist, validationErrors]);

  const proceed = useCallback(async () => {
    setError(null);
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    setSubmitting(true);
    try {
      // Ensure a draft exists, with the latest inputs + contact context.
      let activeToken = token;
      if (activeToken) {
        await updatePublicQuoteDraft(activeToken, input, meta);
      } else {
        const created = await createPublicQuoteDraft(input, meta);
        if (!created.success) {
          setError(created.error);
          setSubmitting(false);
          return;
        }
        activeToken = created.data.token;
        setToken(activeToken);
      }

      const res = await priceAndCreateAdvanceLink(activeToken, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      });
      if (!res.success) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      window.location.href = res.data.payUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }, [token, input, meta, name, phone, email, validationErrors]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Left: steps */}
      <div className="space-y-6">
        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {["Event", "Package", "Details"].map((label, i) => {
            const n = i + 1;
            return (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={`flex size-6 items-center justify-center rounded-full ${
                    step >= n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {n}
                </span>
                <span className={step >= n ? "text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
                {n < 3 && <span className="mx-1 h-px w-6 bg-border" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1 — Event */}
        {step === 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tell us about your event</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="venue">Venue</Label>
                <select
                  id="venue"
                  className={selectClass}
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                >
                  <option value="">Any / not sure yet</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (up to {v.capacity} guests)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="date">Event date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slot">Time slot</Label>
                  <select
                    id="slot"
                    className={selectClass}
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                  >
                    {catalog.timeSlots.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="occasion">Occasion</Label>
                  <Input
                    id="occasion"
                    placeholder="Birthday, Engagement…"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guests">Guest count</Label>
                  <Input
                    id="guests"
                    type="number"
                    min={1}
                    value={guestCount || ""}
                    onChange={(e) => setGuestCount(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={goToStep2}>
                  Next <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2 — Package */}
        {step === 2 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Build your package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Food vs hall-only */}
              <div className="space-y-1.5">
                <Label>Catering</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={foodMode === "WITH_FOOD" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFoodMode("WITH_FOOD")}
                  >
                    With food
                  </Button>
                  <Button
                    type="button"
                    variant={foodMode === "HALL_ONLY" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFoodMode("HALL_ONLY")}
                  >
                    Hall only
                  </Button>
                </div>
              </div>

              {foodMode === "WITH_FOOD" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="food">Food package (per plate × {guestCount})</Label>
                  <select
                    id="food"
                    className={selectClass}
                    value={foodPackageId}
                    onChange={(e) => setFoodPackageId(e.target.value)}
                  >
                    <option value="">No food package</option>
                    {catalog.food.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label} — ₹{f.perPlate}/plate
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="hallRate">Hall rate (per hour)</Label>
                    <select
                      id="hallRate"
                      className={selectClass}
                      value={hallRate || ""}
                      onChange={(e) => setHallRate(Number(e.target.value))}
                    >
                      <option value="">Select a rate</option>
                      {catalog.hallRates.map((rate) => (
                        <option key={rate} value={rate}>
                          ₹{rate.toLocaleString("en-IN")}/hr
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hallHours">Hours (min {catalog.minHallHours})</Label>
                    <Input
                      id="hallHours"
                      type="number"
                      min={catalog.minHallHours}
                      value={hallHours || ""}
                      onChange={(e) => setHallHours(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="decor">Decor</Label>
                <select
                  id="decor"
                  className={selectClass}
                  value={decorId}
                  onChange={(e) => setDecorId(e.target.value)}
                >
                  <option value="">No decor</option>
                  {catalog.decor.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} — ₹{d.amount.toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Add-on activities</Label>
                {/* Social proof, not pre-ticking — pre-selected paid add-ons are a
                    flagged dark pattern (India CCPA 2023); a norm hint is the
                    ethical nudge that works nearly as well. */}
                {catalog.activity.length > 0 && (
                  <p className="text-[12px] text-muted-foreground">
                    ✨ Most celebrations here add at least one of these
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {catalog.activity.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={activityIds.includes(a.id)}
                        onCheckedChange={() => toggleActivity(a.id)}
                      />
                      <span>
                        {a.label}{" "}
                        <span className="text-muted-foreground">
                          (₹{a.amount.toLocaleString("en-IN")})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cake">Cake</Label>
                  <select
                    id="cake"
                    className={selectClass}
                    value={cakeId}
                    onChange={(e) => setCakeId(e.target.value)}
                  >
                    <option value="">No cake</option>
                    {catalog.cake.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} — ₹{c.ratePerKg}/kg
                      </option>
                    ))}
                  </select>
                </div>
                {cakeId && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cakeKg">Cake weight (kg)</Label>
                    <Input
                      id="cakeKg"
                      type="number"
                      min={0}
                      step="0.5"
                      value={cakeKg || ""}
                      onChange={(e) => setCakeKg(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="photo">Photography</Label>
                  <select
                    id="photo"
                    className={selectClass}
                    value={photographyId}
                    onChange={(e) => setPhotographyId(e.target.value)}
                  >
                    <option value="">None</option>
                    {catalog.photography.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                        {p.amount != null ? ` — ₹${p.amount.toLocaleString("en-IN")}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {customPhoto && (
                  <div className="space-y-1.5">
                    <Label htmlFor="photoAmt">Photography amount</Label>
                    <Input
                      id="photoAmt"
                      type="number"
                      min={0}
                      value={photographyCustomAmount || ""}
                      onChange={(e) =>
                        setPhotographyCustomAmount(Math.max(0, Number(e.target.value)))
                      }
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="drinks">Drinks (per person)</Label>
                  <Input
                    id="drinks"
                    type="number"
                    min={0}
                    value={drinksPerPerson || ""}
                    onChange={(e) => setDrinksPerPerson(Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rooms">Hotel rooms</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setRooms((n) => Math.max(0, n - 1))}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Input
                      id="rooms"
                      type="number"
                      min={0}
                      className="text-center"
                      value={rooms || 0}
                      onChange={(e) => setRooms(Math.max(0, Number(e.target.value)))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setRooms((n) => n + 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-1.5 size-4" /> Back
                </Button>
                <Button onClick={goToStep3}>
                  Next <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3 — Contact + proceed */}
        {step === 3 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cemail">Email (optional)</Label>
                  <Input
                    id="cemail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-1.5 size-4" /> Back
                </Button>
                <Button onClick={proceed} disabled={submitting} className="h-11">
                  {submitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 size-4" />
                  )}
                  {submitting
                    ? "Preparing your payment…"
                    : `Proceed to pay advance${
                        result.paymentSchedule[0]
                          ? ` (${new Intl.NumberFormat("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            }).format(result.paymentSchedule[0].amount)})`
                          : ""
                      }`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <p className="flex items-start gap-1.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
      </div>

      {/* Right: live price */}
      <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
        <PriceSummary result={result} />
        <SocialProofAside occasion={occasion} venueId={venueId} />
      </div>
    </div>
  );
}
