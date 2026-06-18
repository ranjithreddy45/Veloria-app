"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ImageIcon, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import {
  createQuotePackage,
  updateQuotePackage,
  deleteQuotePackage,
  toggleQuotePackageActive,
  addQuoteMenuItem,
  updateQuoteMenuItem,
  deleteQuoteMenuItem,
  type QuotePackageDTO,
  type QuotePackageInput,
  type QuoteMenuItemInput,
} from "@/actions/quote-catalog.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CATEGORIES = ["HALL", "FOOD", "DECOR", "CAKE", "DRINKS", "ACTIVITY", "ROOM", "PHOTOGRAPHY"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  HALL: "Hall", FOOD: "Food", DECOR: "Decor", CAKE: "Cake", DRINKS: "Drinks",
  ACTIVITY: "Activities", ROOM: "Hotel Rooms", PHOTOGRAPHY: "Photography",
};
const PRICING = ["PER_PLATE", "PER_PERSON", "PER_NIGHT", "PER_KG", "FLAT"] as const;
const PRICING_LABEL: Record<string, string> = {
  PER_PLATE: "Per plate (× guests)", PER_PERSON: "Per person (× guests)",
  PER_NIGHT: "Per room / night", PER_KG: "Per kg", FLAT: "Flat (one-time)",
};
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

type Vendor = { id: string; name: string };

export function QuoteCatalogManager({
  initialPackages, vendors, canWrite,
}: {
  initialPackages: QuotePackageDTO[];
  vendors: Vendor[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<(typeof CATEGORIES)[number]>("HALL");
  const refresh = () => router.refresh();

  const byCat = initialPackages.filter((p) => p.category === activeCat);

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const count = initialPackages.filter((p) => p.category === c).length;
          return (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                activeCat === c ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              }`}
            >
              {CATEGORY_LABEL[c]} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{CATEGORY_LABEL[activeCat]} packages</h2>
        {canWrite && (
          <PackageDialog
            category={activeCat}
            vendors={vendors}
            onSaved={refresh}
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 size-4" /> Add {CATEGORY_LABEL[activeCat]} package
              </Button>
            }
          />
        )}
      </div>

      {byCat.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
          No {CATEGORY_LABEL[activeCat]} packages yet.
        </p>
      ) : (
        <div className="space-y-3">
          {byCat.map((p) => (
            <PackageRow key={p.id} pkg={p} vendors={vendors} canWrite={canWrite} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Package row + its menu items
// ------------------------------------------------------------
function PackageRow({
  pkg, vendors, canWrite, onChanged,
}: {
  pkg: QuotePackageDTO; vendors: Vendor[]; canWrite: boolean; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const vendorName = vendors.find((v) => v.id === pkg.vendorId)?.name;

  async function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (r.success) { toast.success(ok); onChanged(); }
      else toast.error(r.error || "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Card className={pkg.isActive ? "" : "opacity-60"}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Thumb */}
          <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md">
            {pkg.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pkg.imageUrl} alt={pkg.name} className="size-full object-cover" />
            ) : (
              <ImageIcon className="text-muted-foreground size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{pkg.name}</p>
              {!pkg.isActive && <span className="text-muted-foreground text-xs">(hidden)</span>}
            </div>
            <p className="text-muted-foreground text-sm">
              {inr(pkg.price)} · {PRICING_LABEL[pkg.pricingType]}
              {vendorName ? ` · Vendor: ${vendorName}` : ""}
            </p>
            {pkg.description && <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{pkg.description}</p>}
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs"
            >
              {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              {pkg.menuItems.length} menu option{pkg.menuItems.length === 1 ? "" : "s"}
            </button>
          </div>
          {canWrite && (
            <div className="flex shrink-0 items-center gap-1">
              <Switch
                checked={pkg.isActive}
                disabled={busy}
                onCheckedChange={() => run(() => toggleQuotePackageActive(pkg.id), "Updated")}
              />
              <PackageDialog
                category={pkg.category}
                vendors={vendors}
                existing={pkg}
                onSaved={onChanged}
                trigger={<Button variant="ghost" size="icon-xs"><Pencil className="size-4" /></Button>}
              />
              <Button
                variant="ghost" size="icon-xs" disabled={busy}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => { if (confirm(`Delete "${pkg.name}"?`)) run(() => deleteQuotePackage(pkg.id), "Deleted"); }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>

        {open && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {pkg.menuItems.length === 0 && (
              <p className="text-muted-foreground text-xs">No menu options. Add choices reps can lock (e.g. welcome drinks).</p>
            )}
            {pkg.menuItems.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                <div className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded">
                  {m.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.imageUrl} alt={m.name} className="size-full object-cover" />
                  ) : <ImageIcon className="text-muted-foreground size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.groupName ? <span className="text-muted-foreground">{m.groupName} · </span> : null}{m.name}
                  </p>
                  {m.extraCost > 0 && <p className="text-muted-foreground text-xs">+{inr(m.extraCost)}</p>}
                </div>
                {canWrite && (
                  <div className="flex shrink-0 gap-1">
                    <MenuItemDialog
                      packageId={pkg.id} existing={m} onSaved={onChanged}
                      trigger={<Button variant="ghost" size="icon-xs"><Pencil className="size-3.5" /></Button>}
                    />
                    <Button
                      variant="ghost" size="icon-xs" disabled={busy}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => { if (confirm(`Delete "${m.name}"?`)) run(() => deleteQuoteMenuItem(m.id), "Deleted"); }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {canWrite && (
              <MenuItemDialog
                packageId={pkg.id} onSaved={onChanged}
                trigger={<Button variant="outline" size="sm"><Plus className="mr-1.5 size-3.5" /> Add menu option</Button>}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Package add/edit dialog
// ------------------------------------------------------------
function PackageDialog({
  category, vendors, existing, trigger, onSaved,
}: {
  category: (typeof CATEGORIES)[number];
  vendors: Vendor[];
  existing?: QuotePackageDTO;
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<QuotePackageInput>(
    existing
      ? {
          category: existing.category, name: existing.name, description: existing.description,
          imageUrl: existing.imageUrl, pricingType: existing.pricingType, price: existing.price,
          unitLabel: existing.unitLabel, vendorId: existing.vendorId, isActive: existing.isActive,
        }
      : {
          category, name: "", description: "", imageUrl: "",
          pricingType: category === "FOOD" ? "PER_PLATE" : category === "ROOM" ? "PER_NIGHT" : category === "CAKE" ? "PER_KG" : category === "DRINKS" ? "PER_PERSON" : "FLAT",
          price: 0, unitLabel: "", vendorId: null, isActive: true,
        }
  );

  async function save() {
    if (!f.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      const r = existing ? await updateQuotePackage(existing.id, f) : await createQuotePackage(f);
      if (r.success) { toast.success(existing ? "Package updated" : "Package added"); setOpen(false); onSaved(); }
      else toast.error(r.error);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{existing ? "Edit" : "Add"} {CATEGORY_LABEL[category]} package</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Veg Gold Package" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Pricing</Label>
              <Select value={f.pricingType} onValueChange={(v) => setF({ ...f, pricingType: v as QuotePackageInput["pricingType"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICING.map((p) => <SelectItem key={p} value={p}>{PRICING_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Image URL</Label>
            <Input value={f.imageUrl ?? ""} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} placeholder="https://…  (or paste a Gallery image link)" />
          </div>
          <div className="space-y-1.5">
            <Label>Vendor (optional — for sharing locked selections)</Label>
            <Select value={f.vendorId ?? "none"} onValueChange={(v) => setF({ ...f, vendorId: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="No vendor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No vendor</SelectItem>
                {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Menu-item add/edit dialog
// ------------------------------------------------------------
function MenuItemDialog({
  packageId, existing, trigger, onSaved,
}: {
  packageId: string;
  existing?: { id: string; groupName: string | null; name: string; description: string | null; imageUrl: string | null; extraCost: number };
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<QuoteMenuItemInput>(
    existing
      ? { groupName: existing.groupName, name: existing.name, description: existing.description, imageUrl: existing.imageUrl, extraCost: existing.extraCost }
      : { groupName: "", name: "", description: "", imageUrl: "", extraCost: 0 }
  );

  async function save() {
    if (!f.name?.trim()) return toast.error("Item name is required");
    setBusy(true);
    try {
      const r = existing ? await updateQuoteMenuItem(existing.id, f) : await addQuoteMenuItem(packageId, f);
      if (r.success) { toast.success(existing ? "Updated" : "Added"); setOpen(false); onSaved(); }
      else toast.error(r.error);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{existing ? "Edit" : "Add"} menu option</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Group</Label>
              <Input value={f.groupName ?? ""} onChange={(e) => setF({ ...f, groupName: e.target.value })} placeholder="e.g. Welcome Drinks" />
            </div>
            <div className="space-y-1.5">
              <Label>Extra cost (₹)</Label>
              <Input type="number" min={0} value={f.extraCost ?? 0} onChange={(e) => setF({ ...f, extraCost: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Item name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Virgin Mojito" />
          </div>
          <div className="space-y-1.5">
            <Label>Image URL</Label>
            <Input value={f.imageUrl ?? ""} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} placeholder="https://…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
