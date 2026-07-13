"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listActivePackagesForBeo,
  snapshotPackageToEvent,
  getBeoPackageSnapshots,
  removeBeoPackageSnapshot,
} from "@/actions/vendor-catalog.actions";

// ------------------------------------------------------------
// Types (mirrors the shapes returned by vendor-catalog.actions)
// ------------------------------------------------------------
type PackageOption = {
  id: string;
  name: string;
  category: string;
  price: number;
  priceUnit: string;
  vendor: { id: string; name: string };
};

type SnapshotItem = { name: string; type: string; options?: unknown; chosen?: string[] };
type SnapshotSection = { title: string; items: SnapshotItem[] };
type PackageSnapshot = {
  snapshotId: string;
  vendorPackageId: string;
  vendorName: string;
  name: string;
  category: string;
  vendorPrice: number;
  priceUnit: string;
  sections: SnapshotSection[];
  capturedAt: string;
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
function fmtPrice(n: number): string {
  return Number.isFinite(n) ? inr.format(n) : "—";
}

// ------------------------------------------------------------
// Vendor package snapshots — freeze agreed vendor scope + price onto the BEO
// ------------------------------------------------------------
export function BeoPackageSnapshots({ beoId, locked }: { beoId: string; locked: boolean }) {
  const [snapshots, setSnapshots] = React.useState<PackageSnapshot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const load = React.useCallback(() => {
    startTransition(async () => {
      const res = await getBeoPackageSnapshots(beoId);
      if (!res.success) { toast.error(res.error); return; }
      setSnapshots((res.data as PackageSnapshot[]) ?? []);
      setLoading(false);
    });
  }, [beoId]);

  React.useEffect(() => { load(); }, [load]);

  function remove(snapshotId: string) {
    if (!window.confirm("Remove this vendor package from the function sheet?")) return;
    startTransition(async () => {
      const res = await removeBeoPackageSnapshot(beoId, snapshotId);
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Vendor package removed");
      load();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <Package className="size-4 text-indigo-500" /> Vendor packages
          {snapshots.length > 0 && (
            <span className="rounded-md bg-indigo-100 px-1.5 text-[11px] font-medium text-indigo-700">{snapshots.length}</span>
          )}
        </CardTitle>
        {!locked && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} disabled={pending}>
            <Plus className="size-3.5" /> Add package
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2.5">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading…
          </p>
        ) : snapshots.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">No vendor packages frozen onto this BEO yet.</p>
        ) : (
          snapshots.map((s) => (
            <div key={s.snapshotId} className="rounded-lg border border-border/70 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">
                    {s.vendorName} — {s.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">{s.category}</Badge>
                    <span className="text-[12px] text-muted-foreground">
                      {fmtPrice(s.vendorPrice)} / {s.priceUnit}
                    </span>
                  </div>
                </div>
                {!locked && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-600"
                    onClick={() => remove(s.snapshotId)}
                    disabled={pending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              {s.sections.length > 0 && (
                <div className="mt-2.5 space-y-2 border-t border-border/60 pt-2.5">
                  {s.sections.map((sec, si) => (
                    <div key={si} className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{sec.title}</p>
                      <ul className="space-y-0.5">
                        {sec.items.map((it, ii) => (
                          <li key={ii} className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-foreground">
                            <span>{it.name}</span>
                            <span className="text-[11px] text-muted-foreground">· {it.type}</span>
                            {it.chosen && it.chosen.length > 0 && (
                              <span className="text-[11.5px] text-indigo-600">→ {it.chosen.join(", ")}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">Captured {fmtDateTime(s.capturedAt)}</p>
            </div>
          ))
        )}
      </CardContent>
      {!locked && <AddPackageDialog beoId={beoId} open={addOpen} onOpenChange={setAddOpen} onAdded={load} />}
    </Card>
  );
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------------
// Add package dialog
// ------------------------------------------------------------
function AddPackageDialog({
  beoId,
  open,
  onOpenChange,
  onAdded,
}: {
  beoId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded: () => void;
}) {
  const [packages, setPackages] = React.useState<PackageOption[]>([]);
  const [loadingPkgs, setLoadingPkgs] = React.useState(false);
  const [selected, setSelected] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelected("");
    setLoadingPkgs(true);
    listActivePackagesForBeo()
      .then((res) => {
        if (!res.success) { toast.error(res.error); return; }
        setPackages((res.data as PackageOption[]) ?? []);
      })
      .catch(() => toast.error("Couldn't load packages."))
      .finally(() => setLoadingPkgs(false));
  }, [open]);

  async function submit() {
    if (!selected) { toast.error("Select a package."); return; }
    setBusy(true);
    try {
      const res = await snapshotPackageToEvent({ packageId: selected, beoId });
      if (!res.success) { toast.error(res.error); return; }
      toast.success("Vendor package added");
      onOpenChange(false);
      onAdded();
    } catch {
      toast.error("Couldn't add package.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add vendor package</DialogTitle>
          <DialogDescription>Freeze a vendor package&apos;s agreed scope and price onto this function sheet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Select value={selected} onValueChange={setSelected} disabled={loadingPkgs}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loadingPkgs ? "Loading packages…" : "Select a package"} />
            </SelectTrigger>
            <SelectContent>
              {packages.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.vendor.name} — {p.name} ({fmtPrice(p.price)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loadingPkgs && packages.length === 0 && (
            <p className="text-[12px] text-muted-foreground">No active vendor packages available.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !selected}>{busy ? "Adding…" : "Add package"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
