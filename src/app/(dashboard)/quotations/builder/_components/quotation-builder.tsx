"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Send,
  Plus,
  Trash2,
  UtensilsCrossed,
  Building2,
  Sparkles,
  Cake,
  Wine,
  PartyPopper,
  BedDouble,
  Camera,
  Package as PackageIcon,
} from "lucide-react";

import {
  computeStoredQuote,
  nightsBetween,
  type CatalogPackage,
  type CatalogStoredInput,
} from "@/lib/sales/quotation-calc";
import {
  createSalesQuotation,
  updateSalesQuotation,
  submitSalesQuotation,
  type QuotationMeta,
} from "@/actions/sales-quotation.actions";
import type { QuotePackageDTO } from "@/actions/quote-catalog.actions";

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
import { cn } from "@/lib/utils";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const NONE = "__none__";
const TIME_SLOTS = ["11am to 3pm", "5pm to 10pm", "Full Day"];

// Category display order + icon/label.
const CATEGORY_ORDER = [
  "HALL",
  "FOOD",
  "DECOR",
  "CAKE",
  "DRINKS",
  "ACTIVITY",
  "ROOM",
  "PHOTOGRAPHY",
] as const;
const CATEGORY_META: Record<string, { label: string; Icon: typeof PackageIcon }> = {
  HALL: { label: "Hall / Venue", Icon: Building2 },
  FOOD: { label: "Food", Icon: UtensilsCrossed },
  DECOR: { label: "Decor", Icon: Sparkles },
  CAKE: { label: "Cake", Icon: Cake },
  DRINKS: { label: "Drinks", Icon: Wine },
  ACTIVITY: { label: "Activities", Icon: PartyPopper },
  ROOM: { label: "Accommodation", Icon: BedDouble },
  PHOTOGRAPHY: { label: "Photography / Videography", Icon: Camera },
};

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

export interface BuilderInitial {
  id: string;
  stored: CatalogStoredInput;
  meta: QuotationMeta;
}

interface Props {
  leads: LeadOpt[];
  venues: VenueOpt[];
  packages: QuotePackageDTO[];
  initial?: BuilderInitial;
}

// Per-package selection state held in the builder.
interface SelState {
  lockedMenuItemIds: string[];
  kg?: string; // string for the input; coerced with Number() before math
}

export function QuotationBuilder({ leads, venues, packages, initial }: Props) {
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

  // ---- Quote inputs ----
  const initCat = initial?.stored.catalog;
  const [guestCount, setGuestCount] = useState<string>(
    initCat?.guestCount ? String(initCat.guestCount) : ""
  );
  const [discountPct, setDiscountPct] = useState<string>(
    initCat?.discountPct ? String(initCat.discountPct) : ""
  );
  const [rooms, setRooms] = useState<string>(initCat?.rooms ? String(initCat.rooms) : "");
  const [checkInDate, setCheckInDate] = useState(
    initial?.stored.checkInDate ? String(initial.stored.checkInDate).slice(0, 10) : ""
  );
  const [checkOutDate, setCheckOutDate] = useState(
    initial?.stored.checkOutDate ? String(initial.stored.checkOutDate).slice(0, 10) : ""
  );

  // Selected packages: id -> selection state.
  const [selections, setSelections] = useState<Record<string, SelState>>(() => {
    const out: Record<string, SelState> = {};
    for (const s of initCat?.selections ?? []) {
      out[s.packageId] = {
        lockedMenuItemIds: s.lockedMenuItemIds ?? [],
        kg: s.kg != null ? String(s.kg) : undefined,
      };
    }
    return out;
  });

  // Custom items.
  const [customItems, setCustomItems] = useState<{ label: string; amount: string }[]>(
    (initCat?.customItems ?? []).map((c) => ({ label: c.label, amount: String(c.amount) }))
  );

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const packagesById = useMemo(() => {
    const m = new Map<string, QuotePackageDTO>();
    for (const p of packages) m.set(p.id, p);
    return m;
  }, [packages]);

  const byCategory = useMemo(() => {
    const m = new Map<string, QuotePackageDTO[]>();
    for (const p of packages) {
      const arr = m.get(p.category) ?? [];
      arr.push(p);
      m.set(p.category, arr);
    }
    return m;
  }, [packages]);

  const nights = useMemo(() => nightsBetween(checkInDate, checkOutDate), [checkInDate, checkOutDate]);

  // ---- Build the stored input from current state (single source for preview + save). ----
  const stored: CatalogStoredInput = useMemo(() => {
    const selectedPkgs: CatalogPackage[] = [];
    const sel = Object.entries(selections).map(([packageId, st]) => {
      const dto = packagesById.get(packageId);
      if (dto) {
        selectedPkgs.push({
          id: dto.id,
          category: dto.category,
          name: dto.name,
          pricingType: dto.pricingType,
          price: Number(dto.price),
          unitLabel: dto.unitLabel,
          menuItems: dto.menuItems.map((m) => ({
            id: m.id,
            name: m.name,
            extraCost: Number(m.extraCost),
          })),
        });
      }
      return {
        packageId,
        lockedMenuItemIds: st.lockedMenuItemIds,
        kg: st.kg != null && st.kg !== "" ? num(st.kg) : undefined,
      };
    });
    return {
      mode: "catalog",
      catalog: {
        guestCount: num(guestCount),
        rooms: rooms ? num(rooms) : undefined,
        nights: nights || undefined,
        discountPct: discountPct ? num(discountPct) : undefined,
        selections: sel,
        customItems: customItems
          .filter((c) => c.label.trim() && c.amount !== "")
          .map((c) => ({ label: c.label.trim(), amount: num(c.amount) })),
      },
      packages: selectedPkgs,
      checkInDate: checkInDate || null,
      checkOutDate: checkOutDate || null,
    };
  }, [
    selections,
    packagesById,
    guestCount,
    rooms,
    nights,
    discountPct,
    customItems,
    checkInDate,
    checkOutDate,
  ]);

  const result = useMemo(() => computeStoredQuote(stored), [stored]);

  const meta: QuotationMeta = {
    clientName,
    clientPhone,
    clientEmail,
    occasion,
    eventDate: eventDate || null,
    timeSlot,
    notes,
    leadId: leadId || null,
    venueId: venueId || null,
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

  function togglePackage(id: string) {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { lockedMenuItemIds: [] };
      return next;
    });
  }

  function toggleMenuItem(packageId: string, itemId: string) {
    setSelections((prev) => {
      const cur = prev[packageId];
      if (!cur) return prev;
      const has = cur.lockedMenuItemIds.includes(itemId);
      return {
        ...prev,
        [packageId]: {
          ...cur,
          lockedMenuItemIds: has
            ? cur.lockedMenuItemIds.filter((x) => x !== itemId)
            : [...cur.lockedMenuItemIds, itemId],
        },
      };
    });
  }

  function setKg(packageId: string, kg: string) {
    setSelections((prev) => {
      const cur = prev[packageId];
      if (!cur) return prev;
      return { ...prev, [packageId]: { ...cur, kg } };
    });
  }

  function addCustomItem() {
    setCustomItems((p) => [...p, { label: "", amount: "" }]);
  }
  function updateCustomItem(i: number, field: "label" | "amount", value: string) {
    setCustomItems((p) => p.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }
  function removeCustomItem(i: number) {
    setCustomItems((p) => p.filter((_, idx) => idx !== i));
  }

  async function save(submit: boolean) {
    setSaving(true);
    try {
      let id = initial?.id;
      if (id) {
        const res = await updateSalesQuotation(id, stored, meta);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
      } else {
        const res = await createSalesQuotation(stored, meta);
        if (!res.success) {
          toast.error(res.error);
          return;
        }
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

  // Group menu items by groupName for a selected package.
  function groupedMenu(dto: QuotePackageDTO) {
    const groups = new Map<string, QuotePackageDTO["menuItems"]>();
    for (const m of dto.menuItems) {
      if (!m.isActive) continue;
      const key = m.groupName ?? "Options";
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    }
    return groups;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* ---- Form ---- */}
      <div className="space-y-6">
        {/* Customer & Event */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer &amp; Event</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className={field}>
              <Label>Link to Lead (optional)</Label>
              <Select value={leadId || NONE} onValueChange={onPickLead}>
                <SelectTrigger>
                  <SelectValue placeholder="No lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No lead</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label>Hall / Venue</Label>
              <Select value={venueId || NONE} onValueChange={(v) => setVenueId(v === NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <Label>Client Name</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Mr/Mrs. ..."
              />
            </div>
            <div className={field}>
              <Label>Phone</Label>
              <Input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className={field}>
              <Label>Email</Label>
              <Input
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="Email (for sending)"
              />
            </div>
            <div className={field}>
              <Label>Occasion</Label>
              <Input
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="Baby shower, Birthday..."
              />
            </div>
            <div className={field}>
              <Label>Event Date</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div className={field}>
              <Label>Time Slot</Label>
              <Select value={timeSlot || NONE} onValueChange={(v) => setTimeSlot(v === NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {TIME_SLOTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Headline numbers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Guests &amp; Discount</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className={field}>
              <Label>Guest Count *</Label>
              <Input
                type="number"
                min={1}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
            <div className={field}>
              <Label>Discount %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                placeholder="0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Catalog by category */}
        {CATEGORY_ORDER.map((cat) => {
          const list = byCategory.get(cat) ?? [];
          if (list.length === 0) return null;
          const { label, Icon } = CATEGORY_META[cat];
          const isRoom = cat === "ROOM";
          return (
            <Card key={cat}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isRoom && (
                  <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3">
                    <div className={field}>
                      <Label>Rooms</Label>
                      <Input
                        type="number"
                        min={0}
                        value={rooms}
                        onChange={(e) => setRooms(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className={field}>
                      <Label>Check-in</Label>
                      <Input
                        type="date"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                      />
                    </div>
                    <div className={field}>
                      <Label>Check-out</Label>
                      <Input
                        type="date"
                        value={checkOutDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground sm:col-span-3">
                      {nights > 0
                        ? `${nights} night(s) — per-night packages are billed rooms × nights.`
                        : "Pick check-in & check-out to compute nights for per-night rooms."}
                    </p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((p) => {
                    const selected = !!selections[p.id];
                    const st = selections[p.id];
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "rounded-lg border transition-colors",
                          selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/30"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => togglePackage(p.id)}
                          className="flex w-full items-start gap-3 p-3 text-left"
                        >
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                            {p.imageUrl ? (
                              // Catalog image URLs can come from any host (admin-entered),
                              // so use a plain <img> rather than next/image's host allowlist.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center">
                                <Icon className="h-5 w-5 text-muted-foreground" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-snug">{p.name}</p>
                              <Checkbox checked={selected} className="mt-0.5 pointer-events-none" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {inr(Number(p.price))}
                              {p.unitLabel ? ` ${p.unitLabel}` : ""}
                            </p>
                            {p.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </button>

                        {selected && (
                          <div className="space-y-3 border-t px-3 py-2.5">
                            {p.pricingType === "PER_KG" && (
                              <div className={field}>
                                <Label className="text-xs">Quantity (kg)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.5"
                                  value={st?.kg ?? ""}
                                  onChange={(e) => setKg(p.id, e.target.value)}
                                  placeholder="e.g. 3"
                                />
                              </div>
                            )}
                            {p.menuItems.some((m) => m.isActive) && (
                              <div className="space-y-2">
                                {[...groupedMenu(p).entries()].map(([group, items]) => (
                                  <div key={group} className="space-y-1.5">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      {group}
                                    </p>
                                    <div className="grid gap-1.5">
                                      {items.map((m) => (
                                        <label
                                          key={m.id}
                                          className="flex items-center gap-2 text-sm"
                                        >
                                          <Checkbox
                                            checked={st?.lockedMenuItemIds.includes(m.id) ?? false}
                                            onCheckedChange={() => toggleMenuItem(p.id, m.id)}
                                          />
                                          <span className="flex-1">{m.name}</span>
                                          {Number(m.extraCost) > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                              +{inr(Number(m.extraCost))}
                                            </span>
                                          )}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Custom items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custom Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Anything the client asks for that isn&apos;t in the catalog.
            </p>
            {customItems.length === 0 && (
              <p className="text-sm text-muted-foreground">No custom items.</p>
            )}
            {customItems.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={c.label}
                  onChange={(e) => updateCustomItem(i, "label", e.target.value)}
                  placeholder="Description"
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={0}
                  value={c.amount}
                  onChange={(e) => updateCustomItem(i, "amount", e.target.value)}
                  placeholder="Amount"
                  className="w-32"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCustomItem(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addCustomItem}>
              <Plus className="h-4 w-4" /> Add custom item
            </Button>
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special notes for this quotation..."
              rows={3}
            />
          </CardContent>
        </Card>
      </div>

      {/* ---- Live preview ---- */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live Quotation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select packages or add custom items to see the quote.
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                {result.lines.map((l) => (
                  <div key={l.sl} className="space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{l.particulars}</span>
                      <span className="tabular-nums font-medium">{inr(l.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{l.plan}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{inr(result.subtotal)}</span>
              </div>
              {result.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount ({result.discountPct}%)</span>
                  <span className="tabular-nums">− {inr(result.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (5%)</span>
                <span className="tabular-nums">{inr(result.tax)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-bold">
                <span>Grand Total</span>
                <span className="tabular-nums">{inr(result.grandTotal)}</span>
              </div>
            </div>
            {result.grandTotal > 0 && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Payment Schedule
                </p>
                {result.paymentSchedule.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {p.label} ({p.pct}%)
                    </span>
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
            Save &amp; submit for approval
          </Button>
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            <Save className="h-4 w-4" /> Save draft
          </Button>
        </div>
      </div>
    </div>
  );
}
