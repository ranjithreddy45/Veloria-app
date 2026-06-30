"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HardHatIcon,
  PlusIcon,
  Loader2Icon,
  SendIcon,
  CheckCircle2Icon,
  PenLineIcon,
  XCircleIcon,
  IndianRupeeIcon,
  BellRingIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatINR } from "@/lib/utils";
import {
  createWorkOrder,
  sendWorkOrder,
  acknowledgeWorkOrder,
  signWorkOrder,
  declineWorkOrder,
  releaseAdvance,
  bulkSendWorkOrders,
  type WorkOrderDTO,
} from "@/actions/work-order.actions";

// ============================================================
// OMS CR-005 — Vendor Work Orders card (Stage 3)
// Lists work orders for a booking, drives the DRAFT→SENT→ACKNOWLEDGED→SIGNED
// lifecycle, supports decline + advance release, and bulk-send.
// ============================================================

interface VendorOption {
  id: string;
  name: string;
}

interface Props {
  bookingId: string;
  workOrders: WorkOrderDTO[];
  vendors: VendorOption[];
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SENT: "bg-blue-100 text-blue-700 border-blue-200",
  ACKNOWLEDGED: "bg-amber-100 text-amber-700 border-amber-200",
  SIGNED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DECLINED: "bg-rose-100 text-rose-700 border-rose-200",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 border-slate-200"
      )}
    >
      {status}
    </span>
  );
}

export function VendorWorkOrdersCard({ bookingId, workOrders, vendors }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [scope, setScope] = useState("");
  const [terms, setTerms] = useState("");
  const [advance, setAdvance] = useState("");
  const [adding, setAdding] = useState(false);

  // Sign dialog
  const [signTarget, setSignTarget] = useState<WorkOrderDTO | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");

  // Decline dialog
  const [declineTarget, setDeclineTarget] = useState<WorkOrderDTO | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const draftCount = workOrders.filter((w) => w.status === "DRAFT").length;

  function resetAdd() {
    setVendorId("");
    setServiceType("");
    setScope("");
    setTerms("");
    setAdvance("");
  }

  async function handleAdd() {
    if (!vendorId) {
      toast.error("Pick a vendor");
      return;
    }
    if (!serviceType.trim()) {
      toast.error("Enter a service type");
      return;
    }
    setAdding(true);
    try {
      const advanceAmount = advance.trim() ? Number(advance) : undefined;
      if (advanceAmount !== undefined && (!Number.isFinite(advanceAmount) || advanceAmount < 0)) {
        toast.error("Advance must be a non-negative number");
        return;
      }
      const res = await createWorkOrder(bookingId, {
        vendorId,
        serviceType: serviceType.trim(),
        scope: scope.trim() || undefined,
        terms: terms.trim() || undefined,
        advanceAmount,
      });
      if (res.success) {
        toast.success("Work order created");
        setAddOpen(false);
        resetAdd();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to create work order");
    } finally {
      setAdding(false);
    }
  }

  async function runAction(id: string, fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) {
    setBusyId(id);
    try {
      const res = await fn();
      if (res.success) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.error ?? "Action failed");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSign() {
    if (!signTarget) return;
    if (!signerName.trim()) {
      toast.error("Enter the signer's name");
      return;
    }
    const target = signTarget;
    setBusyId(target.id);
    try {
      const res = await signWorkOrder(target.id, {
        signerName: signerName.trim(),
        signatureUrl: signatureUrl.trim() || undefined,
      });
      if (res.success) {
        toast.success("Work order marked signed");
        setSignTarget(null);
        setSignerName("");
        setSignatureUrl("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to sign work order");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline() {
    if (!declineTarget) return;
    if (!declineReason.trim()) {
      toast.error("Enter a reason");
      return;
    }
    const target = declineTarget;
    setBusyId(target.id);
    try {
      const res = await declineWorkOrder(target.id, declineReason.trim());
      if (res.success) {
        toast.success("Work order declined");
        setDeclineTarget(null);
        setDeclineReason("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to decline work order");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulkSend() {
    setBulkBusy(true);
    try {
      const res = await bulkSendWorkOrders(bookingId);
      if (res.success) {
        toast.success(`Sent ${res.data.sent} work order${res.data.sent === 1 ? "" : "s"}${res.data.failed ? `, ${res.data.failed} failed` : ""}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to notify vendors");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardHatIcon className="size-4 text-violet-600" /> Vendor work orders
          {workOrders.length > 0 && (
            <span className="text-muted-foreground text-xs font-normal">({workOrders.length})</span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleBulkSend} disabled={bulkBusy}>
              {bulkBusy ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <BellRingIcon className="mr-1.5 size-4" />}
              Notify all vendors ({draftCount})
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon className="mr-1.5 size-4" /> Add work order
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {workOrders.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No work orders yet. Add one to formalise a vendor&apos;s scope and advance.
          </p>
        ) : (
          <div className="space-y-3">
            {workOrders.map((wo) => {
              const busy = busyId === wo.id;
              return (
                <div
                  key={wo.id}
                  className="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{wo.vendorName ?? "Vendor"}</span>
                        <StatusPill status={wo.status} />
                        {wo.woNumber && (
                          <span className="text-muted-foreground font-mono text-[11px]">{wo.woNumber}</span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-sm">{wo.serviceType}</p>
                      {wo.scope && <p className="mt-1 text-xs text-zinc-600 whitespace-pre-wrap">{wo.scope}</p>}
                      {wo.status === "DECLINED" && wo.declineReason && (
                        <p className="mt-1 text-xs text-rose-600">Declined: {wo.declineReason}</p>
                      )}
                      {wo.status === "SIGNED" && wo.signerName && (
                        <p className="mt-1 text-xs text-emerald-700">Signed by {wo.signerName}</p>
                      )}
                      {wo.advanceReleasedAt && (
                        <p className="mt-1 text-xs text-emerald-700">Advance release sent to Finance</p>
                      )}
                    </div>
                    {wo.advanceAmount != null && (
                      <div className="text-right">
                        <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Advance</p>
                        <p className="flex items-center justify-end gap-0.5 text-sm font-semibold tabular-nums">
                          <IndianRupeeIcon className="size-3.5" />
                          {formatINR(wo.advanceAmount).replace(/^₹/, "")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Per-row actions by status */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {wo.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => runAction(wo.id, () => sendWorkOrder(wo.id), "Work order sent")}
                      >
                        {busy ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <SendIcon className="mr-1.5 size-4" />}
                        Send
                      </Button>
                    )}
                    {wo.status === "SENT" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => runAction(wo.id, () => acknowledgeWorkOrder(wo.id), "Acknowledged")}
                      >
                        {busy ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <CheckCircle2Icon className="mr-1.5 size-4" />}
                        Acknowledge
                      </Button>
                    )}
                    {wo.status === "ACKNOWLEDGED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setSignTarget(wo);
                          setSignerName("");
                          setSignatureUrl("");
                        }}
                      >
                        <PenLineIcon className="mr-1.5 size-4" /> Mark signed
                      </Button>
                    )}
                    {(wo.status === "SENT" || wo.status === "ACKNOWLEDGED") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600 hover:text-rose-700"
                        disabled={busy}
                        onClick={() => {
                          setDeclineTarget(wo);
                          setDeclineReason("");
                        }}
                      >
                        <XCircleIcon className="mr-1.5 size-4" /> Decline
                      </Button>
                    )}
                    {wo.status === "SIGNED" && !wo.advanceReleasedAt && wo.advanceAmount != null && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => runAction(wo.id, () => releaseAdvance(wo.id), "Advance release sent to Finance")}
                      >
                        {busy ? <Loader2Icon className="mr-1.5 size-4 animate-spin" /> : <IndianRupeeIcon className="mr-1.5 size-4" />}
                        Release advance
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add work order dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!adding) { setAddOpen(o); if (!o) resetAdd(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add work order</DialogTitle>
            <DialogDescription>Formalise a vendor&apos;s scope, terms and advance for this event.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-1.5 text-sm">No active vendors</div>
                  ) : (
                    vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-service">Service type</Label>
              <Input id="wo-service" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="e.g. Catering, Décor, Photography" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-scope">Scope</Label>
              <Textarea id="wo-scope" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="What the vendor will deliver" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-terms">Terms</Label>
              <Textarea id="wo-terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms, timelines, conditions" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-advance">Advance amount (₹)</Label>
              <Input id="wo-advance" type="number" min={0} value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetAdd(); }} disabled={adding}>Cancel</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign dialog */}
      <Dialog open={signTarget !== null} onOpenChange={(o) => { if (!o) setSignTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark work order signed</DialogTitle>
            <DialogDescription>
              {signTarget?.vendorName ? `${signTarget.vendorName} — ${signTarget.serviceType}` : "Record the vendor's sign-off."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wo-signer">Signer name</Label>
              <Input id="wo-signer" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Name of the person who signed" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-signature">Signature link (optional)</Label>
              <Input id="wo-signature" value={signatureUrl} onChange={(e) => setSignatureUrl(e.target.value)} placeholder="https://… or uploaded image/PDF" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignTarget(null)}>Cancel</Button>
            <Button onClick={handleSign} disabled={busyId === signTarget?.id}>
              {busyId === signTarget?.id && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
              Mark signed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline dialog */}
      <Dialog open={declineTarget !== null} onOpenChange={(o) => { if (!o) setDeclineTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline work order</DialogTitle>
            <DialogDescription>
              {declineTarget?.vendorName ? `${declineTarget.vendorName} — ${declineTarget.serviceType}` : "Record why this work order was declined."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="wo-decline">Reason</Label>
            <Textarea id="wo-decline" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Why was this declined?" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline} disabled={busyId === declineTarget?.id}>
              {busyId === declineTarget?.id && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
