"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Circle,
  FileSignature,
  Loader2,
  Lock,
  Paperclip,
  Pencil,
  Plus,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { requiresBdHeadApproval } from "@/lib/acq/domain";
import { acqCan } from "@/lib/acq/rbac";
import { cn } from "@/lib/utils";

import {
  transitionAcqDeal,
  updateAcqDeal,
  submitAcqEvaluation,
  addAcqAttachment,
  addAcqNote,
  markAcqContractSigned,
  approveAcqDeal,
  setAcqDealEconomicsFrozen,
  editAcqDealOverview,
} from "@/actions/acq-deal.actions";
import {
  ACQ_DEAL_STAGE_LABEL,
  ACQ_LOST_REASON,
  ACQ_OWNER_TYPE,
  ACQ_PROPERTY_TYPE,
  type AcqDealStage,
  type AcqLostReason,
} from "@/lib/acq/constants";

import { StatusPill } from "@/components/shared/status-pill";
import { ProjectionTab } from "./projection-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================================
// Types — serialized deal shape (numbers may arrive as strings)
// ============================================================
type Num = number | string | null;

export interface AcqEvaluationRow {
  id: string;
  totalScore: number;
  passed: boolean;
  capacityScore: number;
  parkingScore: number;
  kitchenScore: number;
  roomsScore: number;
  conditionScore: number;
  locationScore: number;
  avAmenitiesScore: number;
  notes: string | null;
  createdAt: string;
  evaluatedBy?: { name: string | null } | null;
}

export interface AcqAttachmentRow {
  id: string;
  kind: "PHOTO" | "DOCUMENT" | "AGREEMENT" | "GPA";
  url: string;
  label: string | null;
  createdAt: string;
  uploadedBy?: { name: string | null } | null;
}

export interface AcqNoteRow {
  id: string;
  noteType: "NEGOTIATION" | "INTERNAL" | "GENERAL" | "CHANGE_LOG" | string;
  body: string;
  createdAt: string;
  author?: { name: string | null } | null;
}

export interface AcqDealDetail {
  id: string;
  name: string;
  stage: AcqDealStage;
  ownerName: string;
  ownerType: string;
  propertyName: string;
  propertyType: string;
  city: string;
  locality: string;
  seatingTheatre: Num;
  seatingFloating: Num;
  ownerCurrentMonthlyRevenue: Num;
  avgEventsPerMonth: Num;
  peakRateCard: Num;
  model: "MANAGEMENT" | "FRANCHISE" | null;
  baseFeePct: Num;
  incentivePct: Num;
  royaltyPct: Num;
  termYears: Num;
  lockinYears: Num;
  isExclusive: boolean;
  expectedMonthlyEvents: Num;
  projectedFeeValue: Num;
  banquetSizeSft: Num;
  economicsFrozenAt: string | null;
  evalScore: Num;
  evalPassed: boolean | null;
  contractStatus: string;
  signatoryAuthorityVerified: boolean;
  gpaDocumentUrl: string | null;
  bdHeadApprovedById: string | null;
  bdHeadApprovedBy?: { name: string | null } | null;
  lostReason: string | null;
  evaluations: AcqEvaluationRow[];
  attachments: AcqAttachmentRow[];
  notes: AcqNoteRow[];
  property?: { id: string; status: string } | null;
}

// ============================================================
// Stage machine (mirrors server guard) — legal next stages
// ============================================================
const LEGAL_TARGETS: Record<AcqDealStage, AcqDealStage[]> = {
  QUALIFIED: ["EVALUATION", "LOST", "ON_HOLD"],
  EVALUATION: ["EVALUATION_COMPLETED", "ON_HOLD", "LOST"],
  EVALUATION_COMPLETED: ["PROPOSAL_SENT", "LOST"],
  PROPOSAL_SENT: ["NEGOTIATION", "LOST"],
  NEGOTIATION: ["CONTRACT_SENT", "LOST"],
  CONTRACT_SENT: ["SIGNED", "NEGOTIATION", "LOST"],
  SIGNED: ["WON"],
  WON: [],
  LOST: [],
  ON_HOLD: ["EVALUATION", "LOST"],
};

// The single forward stage for each current stage, and the live guard
// requirements to reach it — so a rep sees exactly what's needed before
// clicking (no guesswork, no dead ends).
interface NextStep {
  stage: AcqDealStage;
  reqs: { label: string; met: boolean }[];
}
function forwardStep(deal: AcqDealDetail): NextStep | null {
  const photos = deal.attachments.filter((a) => a.kind === "PHOTO").length;
  const hasGpa = deal.attachments.some((a) => a.kind === "GPA");
  const hasAgreement = deal.attachments.some((a) => a.kind === "AGREEMENT");
  const passedEval = deal.evaluations.some((e) => e.passed);

  switch (deal.stage) {
    case "QUALIFIED":
      return { stage: "EVALUATION", reqs: [] };
    case "ON_HOLD":
      return { stage: "EVALUATION", reqs: [] };
    case "EVALUATION":
      return {
        stage: "EVALUATION_COMPLETED",
        reqs: [
          { label: "Site evaluation passed (≥70, high criteria ≥3)", met: passedEval },
          { label: `8+ site photos uploaded (${photos}/8)`, met: photos >= 8 },
        ],
      };
    case "EVALUATION_COMPLETED": {
      const reqs: { label: string; met: boolean }[] = [
        { label: "Commercial model selected", met: !!deal.model },
      ];
      if (deal.model === "FRANCHISE") {
        reqs.push({ label: "Royalty % set", met: num(deal.royaltyPct) != null });
      } else {
        reqs.push({
          label: "Base fee % and incentive % set",
          met: num(deal.baseFeePct) != null && num(deal.incentivePct) != null,
        });
      }
      reqs.push({ label: "Term & lock-in (years) set", met: num(deal.termYears) != null && num(deal.lockinYears) != null });
      return { stage: "PROPOSAL_SENT", reqs };
    }
    case "PROPOSAL_SENT":
      return { stage: "NEGOTIATION", reqs: [] };
    case "NEGOTIATION": {
      const needsApproval = requiresBdHeadApproval({
        model: deal.model,
        baseFeePct: num(deal.baseFeePct),
        incentivePct: num(deal.incentivePct),
        royaltyPct: num(deal.royaltyPct),
        lockinYears: num(deal.lockinYears),
      });
      const reqs: { label: string; met: boolean }[] = [
        { label: "Signatory authority verified", met: deal.signatoryAuthorityVerified },
      ];
      if (deal.ownerType === "GPA_HOLDER") reqs.push({ label: "GPA document attached", met: hasGpa });
      if (needsApproval) reqs.push({ label: "BD Head approval (below floor / short lock-in)", met: !!deal.bdHeadApprovedById });
      return { stage: "CONTRACT_SENT", reqs };
    }
    case "CONTRACT_SENT":
      return {
        stage: "SIGNED",
        reqs: [
          { label: "Contract marked signed", met: deal.contractStatus === "SIGNED" },
          { label: "Executed agreement attached", met: hasAgreement },
        ],
      };
    case "SIGNED":
      return { stage: "WON", reqs: [] };
    default:
      return null;
  }
}

const STAGE_HUE: Record<AcqDealStage, Parameters<typeof StatusPill>[0]["hue"]> = {
  QUALIFIED: "cyan",
  EVALUATION: "blue",
  EVALUATION_COMPLETED: "indigo",
  PROPOSAL_SENT: "violet",
  NEGOTIATION: "amber",
  CONTRACT_SENT: "orange",
  SIGNED: "teal",
  WON: "emerald",
  LOST: "red",
  ON_HOLD: "slate",
};

const NOTE_TYPE_HUE: Record<string, Parameters<typeof StatusPill>[0]["hue"]> = {
  NEGOTIATION: "amber",
  INTERNAL: "slate",
  GENERAL: "blue",
};

const num = (v: Num): number | null =>
  v == null || v === "" ? null : Number(v);
const numStr = (v: Num): string => {
  const n = num(v);
  return n == null ? "" : String(n);
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Single source of truth for the deal change-log. Both the Overview "Change log"
// panel and the Negotiation thread derive from this so the two surfaces can never
// drift (O-10): CHANGE_LOG notes are the system-written edit history (economics,
// overview, approvals), kept separate from human negotiation/internal notes.
const isChangeLogNote = (n: AcqNoteRow) => n.noteType === "CHANGE_LOG";
const selectChangeLog = (notes: AcqNoteRow[]) => notes.filter(isChangeLogNote);
const selectHumanNotes = (notes: AcqNoteRow[]) => notes.filter((n) => !isChangeLogNote(n));

// ============================================================
// Component
// ============================================================
export function DealDetail({
  deal,
  userRole,
}: {
  deal: AcqDealDetail;
  userRole?: string;
}) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview" className="shrink-0 whitespace-nowrap">Overview</TabsTrigger>
            <TabsTrigger value="economics" className="shrink-0 whitespace-nowrap">Economics &amp; Model</TabsTrigger>
            <TabsTrigger value="evaluation" className="shrink-0 whitespace-nowrap">Evaluation</TabsTrigger>
            <TabsTrigger value="projection" className="shrink-0 whitespace-nowrap">Projection</TabsTrigger>
            <TabsTrigger value="negotiation" className="shrink-0 whitespace-nowrap">Negotiation</TabsTrigger>
            <TabsTrigger value="contract" className="shrink-0 whitespace-nowrap">Contract</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="economics" className="mt-4">
            <EconomicsTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="evaluation" className="mt-4">
            <EvaluationTab deal={deal} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="projection" className="mt-4">
            <ProjectionTab dealId={deal.id} userRole={userRole} />
          </TabsContent>
          <TabsContent value="negotiation" className="mt-4">
            <NegotiationTab deal={deal} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="contract" className="mt-4">
            <ContractTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
          </TabsContent>
        </Tabs>
      </div>

      <StagePanel deal={deal} onMutate={() => router.refresh()} />
    </div>
  );
}

// ------------------------------------------------------------
// Stage panel (right-hand) — guarded transitions
// ------------------------------------------------------------
function StagePanel({
  deal,
  onMutate,
}: {
  deal: AcqDealDetail;
  onMutate: () => void;
}) {
  const [pending, setPending] = useState<AcqDealStage | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState<AcqLostReason | "">("");
  const [lostBusy, setLostBusy] = useState(false);

  const targets = LEGAL_TARGETS[deal.stage] ?? [];

  async function go(toStage: AcqDealStage) {
    if (toStage === "LOST") {
      setLostOpen(true);
      return;
    }
    setPending(toStage);
    const res = await transitionAcqDeal(deal.id, toStage);
    setPending(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`Moved to ${ACQ_DEAL_STAGE_LABEL[res.data.stage]}`);
    onMutate();
  }

  async function confirmLost() {
    if (!lostReason) {
      toast.error("Select a lost reason.");
      return;
    }
    setLostBusy(true);
    const res = await transitionAcqDeal(deal.id, "LOST", { lostReason });
    setLostBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setLostOpen(false);
    setLostReason("");
    toast.success("Deal marked lost");
    onMutate();
  }

  return (
    <div className="lg:sticky lg:top-4 lg:self-start">
      <Card>
        <CardHeader className="pb-3">
          <CardDescription className="text-[11px] uppercase tracking-[0.08em]">
            Current stage
          </CardDescription>
          <div className="pt-1">
            <StatusPill
              label={ACQ_DEAL_STAGE_LABEL[deal.stage]}
              hue={STAGE_HUE[deal.stage]}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(() => {
            const step = forwardStep(deal);
            if (!step || step.reqs.length === 0) return null;
            const remaining = step.reqs.filter((r) => !r.met).length;
            return (
              <div className="mb-1 rounded-lg border border-border bg-muted/40 p-2.5">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  To reach {ACQ_DEAL_STAGE_LABEL[step.stage]}
                </p>
                <ul className="space-y-1">
                  {step.reqs.map((r) => (
                    <li key={r.label} className="flex items-start gap-1.5 text-[12px]">
                      {r.met ? (
                        <CheckCircle2 className="mt-px size-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="mt-px size-3.5 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className={r.met ? "text-foreground/70 line-through" : "text-foreground"}>
                        {r.label}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className={`mt-1.5 text-[11.5px] font-medium ${remaining === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {remaining === 0 ? "✓ Ready to advance" : `${remaining} requirement${remaining > 1 ? "s" : ""} left`}
                </p>
              </div>
            );
          })()}
          {targets.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">
              This stage is terminal — no further transitions.
            </p>
          ) : (
            targets.map((t) => (
              <Button
                key={t}
                variant={t === "LOST" ? "outline" : "default"}
                size="sm"
                className="w-full justify-between"
                disabled={pending !== null}
                onClick={() => go(t)}
              >
                <span>{ACQ_DEAL_STAGE_LABEL[t]}</span>
                {pending === t ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="size-3.5" />
                )}
              </Button>
            ))
          )}
          {deal.lostReason && (
            <p className="pt-1 text-[11.5px] text-muted-foreground">
              Lost reason: {deal.lostReason.replaceAll("_", " ")}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark deal as lost</DialogTitle>
            <DialogDescription>
              A lost reason is required and may trigger re-engagement rules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lost-reason">Lost reason</Label>
            <Select
              value={lostReason}
              onValueChange={(v) => setLostReason(v as AcqLostReason)}
            >
              <SelectTrigger id="lost-reason" className="w-full">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {ACQ_LOST_REASON.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLostOpen(false)}
              disabled={lostBusy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLost}
              disabled={lostBusy || !lostReason}
            >
              {lostBusy && <Loader2 className="size-3.5 animate-spin" />}
              Mark lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------------------------------------------------------
// Overview tab
// ------------------------------------------------------------
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[13px] text-foreground">{value || "—"}</dd>
    </div>
  );
}

function OverviewTab({
  deal,
  userRole,
  onMutate,
}: {
  deal: AcqDealDetail;
  userRole?: string;
  onMutate: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const canApprove = acqCan(userRole, "bdhead:approve");
  const canEdit = acqCan(userRole, "lead:write");
  // Shared selector (see isChangeLogNote) — identical history to the Negotiation tab.
  const changeLog = selectChangeLog(deal.notes);
  const seating = [num(deal.seatingTheatre), num(deal.seatingFloating)]
    .filter((n) => n != null)
    .map((n, i) => `${n} ${i === 0 ? "theatre" : "floating"}`)
    .join(" · ");

  async function approve() {
    setBusy(true);
    const res = await approveAcqDeal(deal.id);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Deal approved by BD Head");
    onMutate();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-[15px]">Overview</CardTitle>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Owner" value={deal.ownerName} />
          <Field label="Owner type" value={deal.ownerType?.replaceAll("_", " ")} />
          <Field label="Property" value={deal.propertyName} />
          <Field label="Type" value={deal.propertyType?.replaceAll("_", " ")} />
          <Field label="Location" value={`${deal.city} · ${deal.locality}`} />
          <Field label="Seating" value={seating} />
          <Field
            label="Stage"
            value={
              <StatusPill
                label={ACQ_DEAL_STAGE_LABEL[deal.stage]}
                hue={STAGE_HUE[deal.stage]}
                size="xs"
              />
            }
          />
          <Field
            label="Contract status"
            value={deal.contractStatus?.replaceAll("_", " ")}
          />
        </dl>

        <div className="rounded-md border border-border/60 bg-muted/30 p-3">
          {deal.bdHeadApprovedById ? (
            <div className="flex items-center gap-2 text-[13px] text-foreground">
              <BadgeCheck className="size-4 text-emerald-600" />
              BD Head approved
              {deal.bdHeadApprovedBy?.name
                ? ` by ${deal.bdHeadApprovedBy.name}`
                : ""}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-muted-foreground">
                {canApprove
                  ? "Not yet approved by BD Head."
                  : "Not yet approved by BD Head. Only a BD Head can approve."}
              </span>
              {canApprove && (
                <Button size="sm" onClick={approve} disabled={busy}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Approve (BD Head)
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Transparent change log */}
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            Change log
          </div>
          {changeLog.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">No edits yet.</p>
          ) : (
            <ul className="space-y-2">
              {changeLog.map((n) => (
                <li key={n.id} className="rounded-md border border-border/60 p-2.5 text-[12.5px]">
                  <pre className="whitespace-pre-wrap font-sans text-foreground">{n.body}</pre>
                  <div className="pt-1 text-[11px] text-muted-foreground">
                    {n.author?.name ?? "—"} · {fmtDate(n.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      <OverviewEditDialog
        deal={deal}
        open={editOpen}
        onOpenChange={setEditOpen}
        onMutate={onMutate}
      />
    </Card>
  );
}

function OverviewEditDialog({
  deal,
  open,
  onOpenChange,
  onMutate,
}: {
  deal: AcqDealDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMutate: () => void;
}) {
  const [ownerName, setOwnerName] = useState(deal.ownerName ?? "");
  const [ownerType, setOwnerType] = useState(deal.ownerType ?? "SOLE_OWNER");
  const [propertyName, setPropertyName] = useState(deal.propertyName ?? "");
  const [propertyType, setPropertyType] = useState(deal.propertyType ?? "BANQUET");
  const [city, setCity] = useState(deal.city ?? "");
  const [locality, setLocality] = useState(deal.locality ?? "");
  const [seatTheatre, setSeatTheatre] = useState(numStr(deal.seatingTheatre));
  const [seatFloating, setSeatFloating] = useState(numStr(deal.seatingFloating));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setOwnerName(deal.ownerName ?? "");
      setOwnerType(deal.ownerType ?? "SOLE_OWNER");
      setPropertyName(deal.propertyName ?? "");
      setPropertyType(deal.propertyType ?? "BANQUET");
      setCity(deal.city ?? "");
      setLocality(deal.locality ?? "");
      setSeatTheatre(numStr(deal.seatingTheatre));
      setSeatFloating(numStr(deal.seatingFloating));
    }
  }, [open, deal]);

  async function save() {
    setBusy(true);
    try {
      const res = await editAcqDealOverview(deal.id, {
        ownerName: ownerName.trim(),
        ownerType,
        propertyName: propertyName.trim(),
        propertyType,
        city: city.trim(),
        locality: locality.trim(),
        seatingTheatre: seatTheatre.trim() === "" ? null : Math.trunc(Number(seatTheatre)),
        seatingFloating: seatFloating.trim() === "" ? null : Math.trunc(Number(seatFloating)),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Overview updated");
      onOpenChange(false);
      onMutate();
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit overview</DialogTitle>
          <DialogDescription>Changes are logged below for the team.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Owner</Label><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Owner type</Label>
            <Select value={ownerType} onValueChange={setOwnerType}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACQ_OWNER_TYPE.map((o) => (<SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Property</Label><Input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Property type</Label>
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACQ_PROPERTY_TYPE.map((o) => (<SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Locality</Label><Input value={locality} onChange={(e) => setLocality(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Seating — theatre</Label><Input inputMode="numeric" value={seatTheatre} onChange={(e) => setSeatTheatre(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Seating — floating</Label><Input inputMode="numeric" value={seatFloating} onChange={(e) => setSeatFloating(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Economics & Model tab
// ------------------------------------------------------------
function EconomicsTab({
  deal,
  userRole,
  onMutate,
}: {
  deal: AcqDealDetail;
  userRole?: string;
  onMutate: () => void;
}) {
  const frozen = !!deal.economicsFrozenAt;
  const canFreeze = acqCan(userRole, "bdhead:approve");
  const [model, setModel] = useState<"MANAGEMENT" | "FRANCHISE">(
    deal.model ?? "MANAGEMENT"
  );
  const [baseFeePct, setBaseFeePct] = useState(numStr(deal.baseFeePct));
  const [incentivePct, setIncentivePct] = useState(numStr(deal.incentivePct));
  const [royaltyPct, setRoyaltyPct] = useState(numStr(deal.royaltyPct));
  const [termYears, setTermYears] = useState(numStr(deal.termYears));
  const [lockinYears, setLockinYears] = useState(numStr(deal.lockinYears));
  const [banquetSizeSft, setBanquetSizeSft] = useState(numStr(deal.banquetSizeSft));
  const [freezing, setFreezing] = useState(false);
  const [isExclusive, setIsExclusive] = useState(Boolean(deal.isExclusive));
  const [expectedMonthlyEvents, setExpectedMonthlyEvents] = useState(
    numStr(deal.expectedMonthlyEvents)
  );
  const [projectedFeeValue, setProjectedFeeValue] = useState(
    numStr(deal.projectedFeeValue)
  );
  const [ownerRevenue, setOwnerRevenue] = useState(
    numStr(deal.ownerCurrentMonthlyRevenue)
  );
  const [avgEvents, setAvgEvents] = useState(numStr(deal.avgEventsPerMonth));
  const [peakRateCard, setPeakRateCard] = useState(numStr(deal.peakRateCard));
  const [busy, setBusy] = useState(false);

  // Blank → null; anything non-finite (a lone "-", "1e", etc.) → null too,
  // so we never ship NaN to a Decimal column.
  const numOrNull = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  // termYears / lockinYears are Int? columns — Prisma rejects a decimal, so
  // truncate. Without this a "3.5" throws and (pre-fix) hung the Save button.
  const intOrNull = (s: string): number | null => {
    const n = numOrNull(s);
    return n == null ? null : Math.trunc(n);
  };

  async function save() {
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        model,
        royaltyPct: numOrNull(royaltyPct),
        lockinYears: intOrNull(lockinYears),
        isExclusive,
        expectedMonthlyEvents: numOrNull(expectedMonthlyEvents),
        projectedFeeValue: numOrNull(projectedFeeValue),
        ownerCurrentMonthlyRevenue: numOrNull(ownerRevenue),
        avgEventsPerMonth: numOrNull(avgEvents),
        peakRateCard: numOrNull(peakRateCard),
        banquetSizeSft: intOrNull(banquetSizeSft),
      };
      // Frozen → never send the locked commercials (the server would reject).
      if (!frozen) {
        patch.baseFeePct = numOrNull(baseFeePct);
        patch.incentivePct = numOrNull(incentivePct);
        patch.termYears = intOrNull(termYears);
      }
      const res = await updateAcqDeal(deal.id, patch);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Economics saved");
      onMutate();
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFreeze() {
    setFreezing(true);
    try {
      const res = await setAcqDealEconomicsFrozen(deal.id, !frozen);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(frozen ? "Economics unfrozen" : "Economics frozen");
      onMutate();
    } catch {
      toast.error("Couldn't update — please try again.");
    } finally {
      setFreezing(false);
    }
  }

  // Inline below-floor detection (mirrors the server-side requiresBdHeadApproval rule).
  const belowBase = model === "MANAGEMENT" && baseFeePct !== "" && Number(baseFeePct) < 5;
  const belowIncentive = model === "MANAGEMENT" && incentivePct !== "" && Number(incentivePct) < 15;
  const belowRoyalty = model === "FRANCHISE" && royaltyPct !== "" && Number(royaltyPct) < 20;
  const belowLockin = lockinYears !== "" && Number(lockinYears) < 3;
  const anyBelowFloor = belowBase || belowIncentive || belowRoyalty || belowLockin;
  const FLOOR_WARN = "Below floor — BD Head approval required before the contract can be sent.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Economics &amp; Model</CardTitle>
        <CardDescription>
          Floors: base ≥ 5%, incentive ≥ 15%, royalty ≥ 20%, lock-in ≥ 3 yrs.
          Below these requires BD Head approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Commercial model</Label>
            <Select
              value={model}
              onValueChange={(v) => setModel(v as "MANAGEMENT" | "FRANCHISE")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANAGEMENT">Management</SelectItem>
                <SelectItem value="FRANCHISE">Franchise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {model === "MANAGEMENT" ? (
            <>
              <NumField
                label="Base fee %"
                value={baseFeePct}
                onChange={setBaseFeePct}
                disabled={frozen}
                warn={belowBase ? FLOOR_WARN : undefined}
              />
              <NumField
                label="Incentive %"
                value={incentivePct}
                onChange={setIncentivePct}
                disabled={frozen}
                warn={belowIncentive ? FLOOR_WARN : undefined}
              />
            </>
          ) : (
            <NumField
              label="Royalty %"
              value={royaltyPct}
              onChange={setRoyaltyPct}
              warn={belowRoyalty ? FLOOR_WARN : undefined}
            />
          )}

          <NumField
            label="Term (years)"
            value={termYears}
            onChange={setTermYears}
            disabled={frozen}
          />
          <NumField
            label="Lock-in (years)"
            value={lockinYears}
            onChange={setLockinYears}
            warn={belowLockin ? FLOOR_WARN : undefined}
          />
          <NumField
            label="Expected monthly events"
            value={expectedMonthlyEvents}
            onChange={setExpectedMonthlyEvents}
          />
          <NumField
            label="Projected fee value"
            value={projectedFeeValue}
            onChange={setProjectedFeeValue}
          />
          <NumField
            label="Owner current monthly revenue"
            value={ownerRevenue}
            onChange={setOwnerRevenue}
          />
          <NumField
            label="Avg events / month"
            value={avgEvents}
            onChange={setAvgEvents}
          />
          <NumField
            label="Peak rate card"
            value={peakRateCard}
            onChange={setPeakRateCard}
          />
          <NumField
            label="Venue size (sqft)"
            value={banquetSizeSft}
            onChange={setBanquetSizeSft}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <div className="space-y-0.5">
            <Label className="text-[13px]">Exclusive</Label>
            <p className="text-[11.5px] text-muted-foreground">
              Venue committed exclusively to Veloria.
            </p>
          </div>
          <Switch checked={isExclusive} onCheckedChange={setIsExclusive} />
        </div>

        {/* Freeze banner — locks the agreed base fee / incentive / term. */}
        <div
          className={cn(
            "flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between",
            frozen ? "border-emerald-300 bg-emerald-50/60" : "border-border/60"
          )}
        >
          <div className="space-y-0.5">
            <Label className="flex items-center gap-1.5 text-[13px]">
              {frozen && <Lock className="size-3.5 text-emerald-600" />}
              {frozen ? "Economics frozen" : "Freeze economics"}
            </Label>
            <p className="text-[11.5px] text-muted-foreground">
              {frozen
                ? "Base fee, incentive and term are locked at the agreed terms."
                : "Lock base fee, incentive and term once agreed with the owner."}
            </p>
          </div>
          {canFreeze && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFreeze}
              disabled={freezing}
            >
              {freezing && <Loader2 className="size-3.5 animate-spin" />}
              {frozen ? "Unfreeze" : "Freeze economics"}
            </Button>
          )}
        </div>

        {anyBelowFloor && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50/70 p-3 text-[12.5px] text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              One or more terms are below floor. You can save these, but the deal will
              require <strong>BD&nbsp;Head approval</strong> before the contract can be sent.
            </span>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
  warn,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  warn?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={warn ? "text-amber-700" : undefined}>{label}</Label>
      <Input
        type="number"
        value={value}
        disabled={disabled}
        aria-invalid={!!warn}
        className={warn ? "border-amber-500 focus-visible:ring-amber-500" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {warn && <p className="text-[11.5px] text-amber-700">{warn}</p>}
    </div>
  );
}

// ------------------------------------------------------------
// Evaluation tab
// ------------------------------------------------------------
const EVAL_CRITERIA: {
  key:
    | "capacityScore"
    | "parkingScore"
    | "kitchenScore"
    | "roomsScore"
    | "conditionScore"
    | "locationScore"
    | "avAmenitiesScore";
  label: string;
}[] = [
  { key: "capacityScore", label: "Capacity" },
  { key: "parkingScore", label: "Parking" },
  { key: "kitchenScore", label: "Kitchen" },
  { key: "roomsScore", label: "Rooms" },
  { key: "conditionScore", label: "Condition" },
  { key: "locationScore", label: "Location" },
  { key: "avAmenitiesScore", label: "A/V" },
];

function EvaluationTab({
  deal,
  onMutate,
}: {
  deal: AcqDealDetail;
  onMutate: () => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>({
    capacityScore: 3,
    parkingScore: 3,
    kitchenScore: 3,
    roomsScore: 3,
    conditionScore: 3,
    locationScore: 3,
    avAmenitiesScore: 3,
  });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const photos = deal.attachments.filter((a) => a.kind === "PHOTO");

  async function submit() {
    setBusy(true);
    const res = await submitAcqEvaluation(deal.id, {
      capacityScore: scores.capacityScore,
      parkingScore: scores.parkingScore,
      kitchenScore: scores.kitchenScore,
      roomsScore: scores.roomsScore,
      conditionScore: scores.conditionScore,
      locationScore: scores.locationScore,
      avAmenitiesScore: scores.avAmenitiesScore,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Score ${res.data.totalScore} — ${res.data.passed ? "Passed" : "Did not pass"}`
    );
    onMutate();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Evaluation scorecard</CardTitle>
          <CardDescription>Score each criterion 1–5.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {EVAL_CRITERIA.map((c) => (
              <div key={c.key} className="space-y-1.5">
                <Label>{c.label}</Label>
                <Select
                  value={String(scores[c.key])}
                  onValueChange={(v) =>
                    setScores((s) => ({ ...s, [c.key]: Number(v) }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional evaluation notes"
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Submit evaluation
            </Button>
          </div>

          {deal.evaluations.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              {deal.evaluations.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-[12.5px]"
                >
                  <span className="text-muted-foreground">
                    {fmtDate(ev.createdAt)}
                    {ev.evaluatedBy?.name ? ` · ${ev.evaluatedBy.name}` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">Score {ev.totalScore}</span>
                    <StatusPill
                      label={ev.passed ? "Passed" : "Failed"}
                      hue={ev.passed ? "emerald" : "red"}
                      size="xs"
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PhotoGrid deal={deal} photos={photos} onMutate={onMutate} />
      <AttachmentAdder deal={deal} onMutate={onMutate} />
    </div>
  );
}

function PhotoGrid({
  deal,
  photos,
  onMutate,
}: {
  deal: AcqDealDetail;
  photos: AcqAttachmentRow[];
  onMutate: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!url.trim()) {
      toast.error("Enter a photo URL.");
      return;
    }
    setBusy(true);
    const res = await addAcqAttachment(deal.id, { kind: "PHOTO", url: url.trim() });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setUrl("");
    toast.success("Photo added");
    onMutate();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <Camera className="size-4" /> Photos
          <span className="text-[12px] font-normal text-muted-foreground">
            {photos.length}/8 required
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {photos.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            No photos uploaded yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.label ?? "Property photo"}
                  className="size-full object-cover transition-transform group-hover:scale-105"
                />
              </a>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Add photo URL"
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <Button onClick={add} disabled={busy} size="sm">
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AttachmentAdder({
  deal,
  onMutate,
}: {
  deal: AcqDealDetail;
  onMutate: () => void;
}) {
  const [kind, setKind] = useState<"GPA" | "AGREEMENT" | "DOCUMENT">("DOCUMENT");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const docs = deal.attachments.filter((a) => a.kind !== "PHOTO");

  async function add() {
    if (!url.trim()) {
      toast.error("Enter a URL.");
      return;
    }
    setBusy(true);
    const res = await addAcqAttachment(deal.id, {
      kind,
      url: url.trim(),
      label: label.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setUrl("");
    setLabel("");
    toast.success("Attachment added");
    onMutate();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <Paperclip className="size-4" /> Documents
        </CardTitle>
        <CardDescription>Attach GPA, agreement or other documents.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {docs.length > 0 && (
          <ul className="space-y-1.5">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-[12.5px]"
              >
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-foreground hover:underline"
                >
                  {d.label ?? d.url}
                </a>
                <StatusPill label={d.kind} hue="slate" size="xs" />
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto]">
          <Select
            value={kind}
            onValueChange={(v) =>
              setKind(v as "GPA" | "AGREEMENT" | "DOCUMENT")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GPA">GPA</SelectItem>
              <SelectItem value="AGREEMENT">Agreement</SelectItem>
              <SelectItem value="DOCUMENT">Document</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Document URL"
          />
          <Button onClick={add} disabled={busy} size="sm">
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Add
          </Button>
        </div>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
        />
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Negotiation tab
// ------------------------------------------------------------
function NegotiationTab({
  deal,
  onMutate,
}: {
  deal: AcqDealDetail;
  onMutate: () => void;
}) {
  const [noteType, setNoteType] = useState<
    "NEGOTIATION" | "INTERNAL" | "GENERAL"
  >("NEGOTIATION");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!body.trim()) {
      toast.error("Note body required.");
      return;
    }
    setBusy(true);
    const res = await addAcqNote(deal.id, { noteType, body: body.trim() });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setBody("");
    toast.success("Note added");
    onMutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Negotiation notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
            <Select
              value={noteType}
              onValueChange={(v) =>
                setNoteType(v as "NEGOTIATION" | "INTERNAL" | "GENERAL")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                <SelectItem value="INTERNAL">Internal</SelectItem>
                <SelectItem value="GENERAL">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note…"
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={add} disabled={busy} size="sm">
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Add note
            </Button>
          </div>
        </div>

        {/* Human notes only; the edit history lives in Overview's Change log
            (shared selector — see selectChangeLog) so the two never contradict. */}
        {(() => {
        const humanNotes = selectHumanNotes(deal.notes);
        return (
        <div className="space-y-2 border-t border-border/60 pt-3">
          {humanNotes.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">No notes yet.</p>
          ) : (
            humanNotes.map((n) => (
              <div
                key={n.id}
                className="rounded-md border border-border/60 p-3"
              >
                <div className="flex items-center justify-between gap-2 pb-1">
                  <StatusPill
                    label={n.noteType}
                    hue={NOTE_TYPE_HUE[n.noteType] ?? "slate"}
                    size="xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {n.author?.name ?? "—"} · {fmtDate(n.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[12.5px] text-foreground">
                  {n.body}
                </p>
              </div>
            ))
          )}
        </div>
        );
        })()}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Required agreement documents (Aadhaar, PAN, property tax, ownership…)
// ------------------------------------------------------------
const REQUIRED_DOCS = [
  "Aadhaar (Owner)",
  "PAN (Owner / Business)",
  "Property Tax Receipt",
  "Ownership Document",
] as const;

function ContractDocuments({
  deal,
  onMutate,
}: {
  deal: AcqDealDetail;
  onMutate: () => void;
}) {
  const docs = deal.attachments.filter((a) => a.kind === "DOCUMENT");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function add(label: string) {
    const url = (urls[label] ?? "").trim();
    if (!url) {
      toast.error("Paste a document link first.");
      return;
    }
    setBusy(label);
    try {
      const res = await addAcqAttachment(deal.id, { kind: "DOCUMENT", url, label });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${label} uploaded`);
      setUrls((p) => ({ ...p, [label]: "" }));
      onMutate();
    } catch {
      toast.error("Couldn't upload — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 p-3">
      <Label className="text-[13px]">Agreement documents</Label>
      <p className="text-[11.5px] text-muted-foreground">
        Upload the owner&apos;s KYC and property papers needed for the agreement.
      </p>
      <div className="space-y-2 pt-1">
        {REQUIRED_DOCS.map((label) => {
          const existing = docs.find((d) => d.label === label);
          return (
            <div key={label} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="flex w-full items-center gap-1.5 text-[12.5px] sm:w-52">
                {existing ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="size-3.5 shrink-0 text-muted-foreground/40" />
                )}
                {label}
              </span>
              {existing ? (
                <a
                  href={existing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12.5px] text-primary hover:underline"
                >
                  View uploaded
                </a>
              ) : (
                <div className="flex flex-1 gap-2">
                  <Input
                    value={urls[label] ?? ""}
                    onChange={(e) => setUrls((p) => ({ ...p, [label]: e.target.value }))}
                    placeholder="https://… (document link)"
                    className="h-8 text-[12.5px]"
                  />
                  <Button size="sm" variant="outline" onClick={() => add(label)} disabled={busy === label}>
                    {busy === label ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Any other documents */}
      {docs.filter((d) => !REQUIRED_DOCS.includes(d.label as never)).length > 0 && (
        <div className="space-y-1 border-t border-border/50 pt-2">
          {docs
            .filter((d) => !REQUIRED_DOCS.includes(d.label as never))
            .map((d) => (
              <a
                key={d.id}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[12.5px] text-primary hover:underline"
              >
                {d.label ?? "Document"}
              </a>
            ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Contract tab
// ------------------------------------------------------------
function ContractTab({
  deal,
  userRole,
  onMutate,
}: {
  deal: AcqDealDetail;
  userRole?: string;
  onMutate: () => void;
}) {
  const [verified, setVerified] = useState(
    Boolean(deal.signatoryAuthorityVerified)
  );
  const [gpaUrl, setGpaUrl] = useState(deal.gpaDocumentUrl ?? "");
  const [savingVerify, setSavingVerify] = useState(false);
  const [savingGpa, setSavingGpa] = useState(false);
  const [signing, setSigning] = useState(false);
  const canSign = acqCan(userRole, "legal:review");

  async function toggleVerified(next: boolean) {
    setVerified(next);
    setSavingVerify(true);
    const res = await updateAcqDeal(deal.id, {
      signatoryAuthorityVerified: next,
    });
    setSavingVerify(false);
    if (!res.success) {
      setVerified(!next);
      toast.error(res.error);
      return;
    }
    toast.success("Signatory authority updated");
    onMutate();
  }

  async function saveGpa() {
    setSavingGpa(true);
    const res = await updateAcqDeal(deal.id, {
      gpaDocumentUrl: gpaUrl.trim() || null,
    });
    setSavingGpa(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("GPA document URL saved");
    onMutate();
  }

  async function markSigned() {
    setSigning(true);
    try {
      const res = await markAcqContractSigned(deal.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Contract marked signed");
      onMutate();
    } catch {
      toast.error("Couldn't mark signed — please try again.");
    } finally {
      setSigning(false);
    }
  }

  const contractHue =
    deal.contractStatus === "SIGNED"
      ? "emerald"
      : deal.contractStatus === "SENT"
        ? "amber"
        : "slate";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Contract</CardTitle>
        <CardDescription className="flex items-center gap-2">
          Status:
          <StatusPill
            label={(deal.contractStatus ?? "NOT_SENT").replaceAll("_", " ")}
            hue={contractHue}
            size="xs"
          />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2 text-[13px]">
              <ShieldCheck className="size-4" /> Signatory authority verified
            </Label>
            <p className="text-[11.5px] text-muted-foreground">
              Required before a contract can be sent.
            </p>
          </div>
          <Switch
            checked={verified}
            disabled={savingVerify}
            onCheckedChange={toggleVerified}
          />
        </div>

        <div className="space-y-1.5">
          <Label>GPA document URL</Label>
          <div className="flex gap-2">
            <Input
              value={gpaUrl}
              onChange={(e) => setGpaUrl(e.target.value)}
              placeholder="https://…"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={saveGpa}
              disabled={savingGpa}
            >
              {savingGpa && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>

        <ContractDocuments deal={deal} onMutate={onMutate} />

        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            {deal.contractStatus === "SIGNED" ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <FileSignature className="size-4" />
            )}
            {canSign
              ? "Mark the executed contract as signed."
              : "Only Legal / BD Head can mark a contract signed."}
          </div>
          {canSign && (
            <Button
              size="sm"
              onClick={markSigned}
              disabled={signing || deal.contractStatus === "SIGNED"}
            >
              {signing && <Loader2 className="size-3.5 animate-spin" />}
              Mark Contract Signed
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
