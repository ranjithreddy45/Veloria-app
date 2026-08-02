"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Package, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { formatINR, cn } from "@/lib/utils";
import {
  createWorkPackage, updateWorkPackage, createPurchaseOrder, updatePurchaseOrderStatus,
} from "@/actions/project-procurement.actions";

interface WP { id: string; title: string; budgetAmount: number; status: string; categoryKey: string | null }
interface PO { id: string; number: number; description: string; amount: number; status: string; vendor: string | null; workPackage: string | null }
interface Vendor { id: string; name: string }
interface Variance { estimate: number; plannedBudget: number; committed: number; paid: number; vsEstimate: number; vsEstimatePct: number | null }

const WP_HUE: Record<string, "slate" | "amber" | "emerald" | "blue"> = { PLANNED: "slate", IN_PROGRESS: "amber", DONE: "emerald", ON_HOLD: "blue" };
const PO_HUE: Record<string, "slate" | "amber" | "blue" | "emerald" | "red"> = { DRAFT: "slate", ISSUED: "amber", RECEIVED: "blue", PAID: "emerald", CANCELLED: "red" };

export function ProcurementBoard({ projectId, workPackages, purchaseOrders, vendors, variance, canManage }: {
  projectId: string; workPackages: WP[]; purchaseOrders: PO[]; vendors: Vendor[]; variance: Variance; canManage: boolean;
}) {
  const overBudget = variance.vsEstimate < 0;
  return (
    <div className="space-y-5">
      {/* Budget variance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="CapEx estimate" value={formatINR(variance.estimate)} />
        <Stat label="Planned (work pkgs)" value={formatINR(variance.plannedBudget)} />
        <Stat label="Committed (POs)" value={formatINR(variance.committed)} />
        <div className={cn("rounded-xl border p-4", overBudget ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
          <div className="flex items-center gap-2 text-detail font-medium text-muted-foreground">
            {overBudget ? <TrendingUp className="size-4 text-red-600" /> : <TrendingDown className="size-4 text-emerald-600" />} vs estimate
          </div>
          <div className={cn("mt-2 text-xl font-semibold tabular-nums break-words sm:text-2xl", overBudget ? "text-red-700" : "text-emerald-700")}>
            {overBudget ? "−" : "+"}{formatINR(Math.abs(variance.vsEstimate))}
          </div>
          {variance.vsEstimatePct != null && <div className="mt-0.5 text-meta text-muted-foreground">{Math.abs(variance.vsEstimatePct)}% {overBudget ? "over committed" : "headroom"}</div>}
        </div>
      </div>

      {/* Work packages */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="flex items-center gap-2 text-body font-semibold"><Package className="size-4" /> Work packages</span>
          {canManage && <CreateWPDialog projectId={projectId} />}
        </div>
        {workPackages.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No work packages yet. Break the build into scoped budgets.</div>
        ) : (
          <div className="divide-y">
            {workPackages.map((w) => <WPRow key={w.id} wp={w} canManage={canManage} />)}
          </div>
        )}
      </div>

      {/* Purchase orders */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="flex items-center gap-2 text-body font-semibold"><Receipt className="size-4" /> Purchase orders</span>
          {canManage && <CreatePODialog projectId={projectId} vendors={vendors} workPackages={workPackages} />}
        </div>
        {purchaseOrders.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No purchase orders yet.</div>
        ) : (
          <div className="divide-y">
            {purchaseOrders.map((p) => <PORow key={p.id} po={p} canManage={canManage} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  // text-xl on a phone: these tiles sit 2-up at 375px (~133px of inner width),
  // and a rupee figure like ₹1,25,00,000 at text-2xl overflows the card. Budget
  // numbers must stay whole, so the type steps down instead of being cut.
  return <div className="rounded-xl border bg-card p-4"><div className="text-detail font-medium text-muted-foreground">{label}</div><div className="mt-2 text-xl font-semibold tabular-nums break-words sm:text-2xl">{value}</div></div>;
}

function WPRow({ wp, canManage }: { wp: WP; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function patch(input: { status?: string; budgetAmount?: number }) { setBusy(true); await updateWorkPackage(wp.id, input); setBusy(false); router.refresh(); }
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1"><span className="font-medium">{wp.title}</span></div>
      <span className="text-body tabular-nums text-muted-foreground">{formatINR(wp.budgetAmount)}</span>
      {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      {canManage ? (
        <Select value={wp.status} onValueChange={(v) => patch({ status: v })}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{["PLANNED", "IN_PROGRESS", "DONE", "ON_HOLD"].map((s) => <SelectItem key={s} value={s}>{s[0] + s.slice(1).toLowerCase().replace("_", " ")}</SelectItem>)}</SelectContent>
        </Select>
      ) : <StatusPill label={wp.status[0] + wp.status.slice(1).toLowerCase().replace("_", " ")} hue={WP_HUE[wp.status]} size="xs" />}
    </div>
  );
}

function PORow({ po, canManage }: { po: PO; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function setStatus(v: string) { setBusy(true); await updatePurchaseOrderStatus(po.id, v); setBusy(false); router.refresh(); }
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-meta font-medium text-muted-foreground tabular-nums">PO#{po.number}</span>
      <div className="min-w-0 flex-1">
        <span className="font-medium">{po.description}</span>
        <div className="text-detail text-muted-foreground">{po.vendor ?? "No vendor"}{po.workPackage ? ` · ${po.workPackage}` : ""}</div>
      </div>
      <span className="text-body tabular-nums">{formatINR(po.amount)}</span>
      {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      {canManage ? (
        <Select value={po.status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{["DRAFT", "ISSUED", "RECEIVED", "PAID", "CANCELLED"].map((s) => <SelectItem key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
        </Select>
      ) : <StatusPill label={po.status[0] + po.status.slice(1).toLowerCase()} hue={PO_HUE[po.status]} size="xs" />}
    </div>
  );
}

function CreateWPDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  async function save() {
    setError(null); if (!title.trim()) { setError("Title required."); return; }
    setBusy(true); const res = await createWorkPackage({ projectId, title, budgetAmount: Number(budget) || 0 }); setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setTitle(""); setBudget(""); router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> Work package</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New work package</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-detail">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Civil & interiors — Hall A" /></div>
          <div className="space-y-1.5"><Label className="text-detail">Budget (₹)</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={save} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePODialog({ projectId, vendors, workPackages }: { projectId: string; vendors: Vendor[]; workPackages: WP[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [vendorId, setVendorId] = React.useState("");
  const [wpId, setWpId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  async function save() {
    setError(null);
    if (!description.trim() || !(Number(amount) > 0)) { setError("Description and a positive amount are required."); return; }
    setBusy(true); const res = await createPurchaseOrder({ projectId, description, amount: Number(amount), vendorId: vendorId || undefined, workPackageId: wpId || undefined }); setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setOpen(false); setDescription(""); setAmount(""); setVendorId(""); setWpId(""); router.refresh();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="size-4" /> Purchase order</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-detail">Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-detail">Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={vendorId} onValueChange={setVendorId}><SelectTrigger><SelectValue placeholder="Vendor" /></SelectTrigger><SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
            <Select value={wpId} onValueChange={setWpId}><SelectTrigger><SelectValue placeholder="Work package" /></SelectTrigger><SelectContent>{workPackages.map((w) => <SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={save} disabled={busy} className="gap-1.5">{busy && <Loader2 className="size-4 animate-spin" />} Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
