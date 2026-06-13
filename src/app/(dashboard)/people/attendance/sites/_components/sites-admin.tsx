"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, MapPin, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { upsertAttendanceSite } from "@/actions/hr-attendance.actions";

export interface Site {
  id: string; name: string; lat: number | null; lng: number | null;
  radiusMeters: number; allowedIps: string | null; allowWfh: boolean; isActive: boolean;
}

export function SitesAdmin({ sites }: { sites: Site[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Check-in locations</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Define office/site geo-fences and allowed networks. No sites = unrestricted check-in.
          </p>
        </div>
        <SiteDialog />
      </div>
      {sites.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No sites yet. Add your Bengaluru HQ and hotel/venue locations.
        </div>
      ) : (
        <div className="divide-y">
          {sites.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  {!s.isActive && <StatusPill label="Inactive" hue="slate" size="xs" />}
                  {s.allowWfh && <StatusPill label="WFH ok" hue="sky" size="xs" />}
                </div>
                <span className="text-[12px] text-muted-foreground">
                  {s.lat != null ? `${s.lat.toFixed(4)}, ${s.lng?.toFixed(4)} · ${s.radiusMeters}m` : "No geo-fence"}
                  {s.allowedIps ? ` · IPs: ${s.allowedIps}` : ""}
                </span>
              </div>
              <SiteDialog existing={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SiteDialog({ existing }: { existing?: Site }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(existing?.name ?? "");
  const [lat, setLat] = React.useState(existing?.lat?.toString() ?? "");
  const [lng, setLng] = React.useState(existing?.lng?.toString() ?? "");
  const [radius, setRadius] = React.useState(existing?.radiusMeters?.toString() ?? "200");
  const [ips, setIps] = React.useState(existing?.allowedIps ?? "");
  const [allowWfh, setAllowWfh] = React.useState(existing?.allowWfh ?? true);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });
  }

  async function save() {
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    const res = await upsertAttendanceSite({
      id: existing?.id, name,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radiusMeters: radius ? Number(radius) : undefined,
      allowedIps: ips || undefined, allowWfh, isActive: existing?.isActive ?? true,
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing
          ? <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><Pencil className="size-4" /></Button>
          : <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add site</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{existing ? "Edit site" : "New site"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bengaluru HQ" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-[12.5px]">Latitude</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="12.9716" /></div>
            <div className="space-y-1.5"><Label className="text-[12.5px]">Longitude</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="77.5946" /></div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={useMyLocation}>
            <Crosshair className="size-3.5" /> Use my current location
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-[12.5px]">Radius (m)</Label>
              <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} /></div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={allowWfh} onChange={(e) => setAllowWfh(e.target.checked)} className="size-4" />
                Allow work-from-home
              </label>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Allowed office IPs (comma-separated, optional)</Label>
            <Input value={ips} onChange={(e) => setIps(e.target.value)} placeholder="203.0.113.5, 203.0.113.6" /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
