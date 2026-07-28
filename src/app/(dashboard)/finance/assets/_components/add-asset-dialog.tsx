"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { createAsset } from "@/actions/finance-assets.actions";

export function AddAssetDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [salvageValue, setSalvageValue] = React.useState("");
  const [purchaseDate, setPurchaseDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [usefulLifeMonths, setUsefulLifeMonths] = React.useState("60");
  const [venueId, setVenueId] = React.useState("");

  function reset() {
    setName(""); setCategory(""); setCost(""); setSalvageValue("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setUsefulLifeMonths("60"); setVenueId(""); setError(null);
  }

  async function save() {
    setError(null);
    setBusy(true);
    const res = await createAsset({
      name,
      category: category.trim() || undefined,
      cost: parseFloat(cost) || 0,
      salvageValue: salvageValue ? parseFloat(salvageValue) : 0,
      purchaseDate,
      usefulLifeMonths: parseInt(usefulLifeMonths, 10) || 0,
      venueId: venueId.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    toast.success("Asset added.");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="size-4" /> Add asset</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add fixed asset</DialogTitle>
          <DialogDescription>Straight-line depreciation = (cost − salvage) ÷ useful life (months).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Banquet hall AV system" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Equipment" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Purchase date</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Cost (₹)</Label>
              <Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className="text-right numeric" inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Salvage value (₹)</Label>
              <Input value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} placeholder="0" className="text-right numeric" inputMode="decimal" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Useful life (months)</Label>
              <Input value={usefulLifeMonths} onChange={(e) => setUsefulLifeMonths(e.target.value)} placeholder="60" className="text-right numeric" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Venue ID (optional)</Label>
              <Input value={venueId} onChange={(e) => setVenueId(e.target.value)} placeholder="—" />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="size-4 animate-spin" />} Add asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
