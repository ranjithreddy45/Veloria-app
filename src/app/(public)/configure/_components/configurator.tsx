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
import { Loader2, ArrowRight, ArrowLeft, AlertCircle, Plus, Minus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeQuotation,
  validateQuotationInput,
  type QuotationInput,
  type FoodMode,
} from "@/lib/sales/quotation-calc";
import type { PublicConfiguratorCatalog } from "@/lib/public/configurator-catalog";
import {
  buildCuratedPackages,
  inferPackageKey,
  type CuratedPackage,
  type CuratedPackageKey,
} from "@/lib/public/curated-packages";
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

// text-base below sm: iOS Safari force-zooms the whole page when a focused
// <select> or <input> has a font-size under 16px, which yanks the layout
// sideways mid-form. The coarse-pointer rule in globals.css covers <input> but
// not the font-size of a plain <select>.
const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm";

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
  // Hall-only pricing is not part of the self-serve package flow (kept in the
  // input shape for engine compatibility, but customers never set these).
  const [hallRate] = useState<number>(r?.hallRate ?? 0);
  const [hallHours] = useState<number>(r?.hallHours ?? catalog.minHallHours);
  const [foodPackageId, setFoodPackageId] = useState(r?.foodPackageId ?? "");
  const [decorId, setDecorId] = useState(r?.decorId ?? "");
  const [activityIds, setActivityIds] = useState<string[]>(r?.activityIds ?? []);
  const [cakeId, setCakeId] = useState(r?.cakeId ?? "");
  const [cakeKg, setCakeKg] = useState<number>(r?.cakeKg ?? 0);
  const [photographyId, setPhotographyId] = useState(r?.photographyId ?? "");
  const [photographyCustomAmount, setPhotographyCustomAmount] = useState<number>(
    r?.photographyCustomAmount ?? 0
  );
  const [drinksPerPerson] = useState<number>(r?.drinksPerPerson ?? 0);
  const [rooms, setRooms] = useState<number>(r?.rooms ?? 0);

  // Curated packages (Silver/Gold/Platinum) derived from the catalog. The
  // customer chooses one instead of assembling the internal rate card by hand.
  const packages = useMemo(() => buildCuratedPackages(catalog), [catalog]);
  const [selectedPackage, setSelectedPackage] = useState<CuratedPackageKey | null>(
    () => inferPackageKey(packages, r?.foodPackageId)
  );

  // Applying a package presets the underlying quotation fields; the same pricing
  // engine then produces the live total. Always WITH_FOOD (self-serve packages
  // are food-inclusive; hall-only stays a talk-to-the-team path).
  const applyPackage = useCallback((pkg: CuratedPackage) => {
    setSelectedPackage(pkg.key);
    setFoodMode("WITH_FOOD");
    setFoodPackageId(pkg.preset.foodPackageId ?? "");
    setDecorId(pkg.preset.decorId ?? "");
    setActivityIds(pkg.preset.activityIds);
    setPhotographyId(pkg.preset.photographyId ?? "");
    setPhotographyCustomAmount(0);
    setCakeId(pkg.preset.cakeId ?? "");
    setCakeKg(pkg.preset.cakeKg ?? 0);
  }, []);

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
    if (!selectedPackage) {
      setError("Please choose a package to continue.");
      return;
    }
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }
    await persist();
    setStep(3);
  }, [persist, validationErrors, selectedPackage]);

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

  const inr = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  const advance = result.paymentSchedule[0];
  // The mobile price bar only earns its space once there is a price to show.
  const showMobilePriceBar = result.grandTotal > 0;

  return (
    <div
      className={`grid gap-6 lg:grid-cols-[1fr_360px] ${
        // Room for the fixed mobile price bar so it never covers the Next /
        // Proceed buttons at the bottom of a step card.
        showMobilePriceBar ? "pb-24 lg:pb-0" : ""
      }`}
    >
      {/* Left: steps */}
      <div className="space-y-6">
        {/* Stepper — wraps rather than overflowing: three labels plus their
            connectors measure ~316px, which clears 375px but not a 320px
            iPhone SE, and an overflowing stepper scrolls the whole page. */}
        <div className="flex flex-wrap items-center gap-y-2 gap-x-2 text-xs font-medium">
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

        {/* STEP 2 — Choose a package */}
        {step === 2 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Choose your package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Guests — also set in step 1; handy to tweak while comparing. */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <Label htmlFor="guests2" className="text-sm">Guests</Label>
                <Input
                  id="guests2"
                  type="number"
                  min={1}
                  className="h-9 w-24 text-center"
                  value={guestCount || ""}
                  onChange={(e) => setGuestCount(Math.max(0, Number(e.target.value)))}
                />
              </div>

              {/* Curated packages — each presets the price; no internal rate card. */}
              <div className="space-y-3">
                {packages.map((pkg) => {
                  const active = selectedPackage === pkg.key;
                  const food = catalog.food.find((f) => f.id === pkg.preset.foodPackageId);
                  return (
                    <button
                      key={pkg.key}
                      type="button"
                      onClick={() => applyPackage(pkg)}
                      aria-pressed={active}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-primary bg-primary/[0.03] ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {pkg.name}
                            </span>
                            {pkg.badge && (
                              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-warning">
                                {pkg.badge}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                            {pkg.tagline}
                          </p>
                        </div>
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {active && <Check className="size-3.5" />}
                        </span>
                      </div>
                      <ul className="mt-3 grid gap-1.5">
                        {pkg.highlights.map((h, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-2 text-[12.5px] text-foreground"
                          >
                            <Check className="size-3.5 shrink-0 text-success" /> {h}
                          </li>
                        ))}
                      </ul>
                      {food && (
                        <p className="mt-3 text-[12px] text-muted-foreground">
                          Catering ₹{food.perPlate}/plate × {guestCount || 0} guests
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Optional add-on: hotel rooms (a legit customer-facing extra). */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="rooms" className="text-sm">Hotel rooms (optional)</Label>
                  <p className="text-[12px] text-muted-foreground">For guests staying over.</p>
                </div>
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
                    className="h-9 w-16 text-center"
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

              {/* Bespoke path — hall-only / custom menu stays a human conversation. */}
              <p className="rounded-xl bg-muted/40 px-3.5 py-2.5 text-[12px] text-muted-foreground">
                Want something bespoke — hall-only, a custom menu, or a different theme? Pick a
                package to hold your date, and our team will tailor every detail with you after.
              </p>

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

      {/* Right: live price. On desktop it sits alongside and sticks; on a phone
          it stacks BELOW the step card, so the live price — the whole point of
          the configurator — is off-screen while the customer is choosing.
          The fixed bar below keeps it visible on mobile. */}
      <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
        <PriceSummary result={result} />
        <SocialProofAside occasion={occasion} venueId={venueId} />
      </div>

      {showMobilePriceBar && (
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/85 fixed inset-x-0 bottom-0 z-40 border-t px-4 pb-[calc(0.75rem+var(--sab))] pt-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-[10.5px] font-semibold uppercase tracking-[0.14em]">
                Your estimate
              </p>
              <p className="tabular-nums text-foreground text-[19px] font-semibold leading-tight">
                {inr(result.grandTotal)}
              </p>
            </div>
            {advance && advance.amount > 0 && (
              <div className="shrink-0 text-right">
                <p className="text-muted-foreground text-[10.5px] font-semibold uppercase tracking-[0.14em]">
                  Pay now
                </p>
                <p className="tabular-nums text-primary text-[19px] font-semibold leading-tight">
                  {inr(advance.amount)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
