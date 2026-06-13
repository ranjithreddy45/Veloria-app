"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { upsertProjectVendor } from "@/actions/project-procurement.actions";

interface Vendor { id: string; name: string; trade: string | null; phone: string | null; email: string | null; gstin: string | null }

export function VendorsAdmin({ vendors, canManage }: { vendors: Vendor[]; canManage: boolean }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="flex items-center gap-2 text-[13px] font-semibold"><Hammer className="size-4" /> Construction vendors</span>
        {canManage && <VendorDialog />}
      </div>
      {vendors.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No vendors yet. Add your civil, electrical, HVAC and furniture suppliers.</div>
      ) : (
        <div className="divide-y">
          {vendors.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <span className="font-medium">{v.name}</span>
                {v.trade && <span className="ml-2 text-[12px] text-muted-foreground">{v.trade}</span>}
                <div className="text-[12px] text-muted-foreground">{[v.phone, v.email, v.gstin].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              {canManage && <VendorDialog existing={v} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VendorDialog({ existing }: { existing?: Vendor }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(existing?.name ?? "");
  const [trade, setTrade] = React.useState(existing?.trade ?? "");
  const [phone, setPhone] = React.useState(existing?.phone ?? "");
  const [email, setEmail] = React.useState(existing?.email ?? "");
  const [gstin, setGstin] = React.useState(existing?.gstin ?? "");

  async function save() {
    setError(null); if (!name.trim()) { setError("Name required."); return; }
    setBusy(true); const res = await upsertProjectVendor({ id: existing?.id, name, trade, phone, email, gstin }); setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{existing ? <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><Pencil className="size-4" /></Button> : <Button size="sm" className="gap-1.5"><Plus className="size-4" /> Add vendor</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{existing ? "Edit vendor" : "New vendor"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Trade</Label><Input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Civil / Electrical / HVAC…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-[12.5px]">Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-[12.5px]">Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">GSTIN</Label><Input value={gstin} onChange={(e) => setGstin(e.target.value)} /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={save} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
