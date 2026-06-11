"use client";

import type React from "react";
import { useState } from "react";
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
  Paperclip,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { requiresBdHeadApproval } from "@/lib/acq/domain";

import {
  transitionAcqDeal,
  updateAcqDeal,
  submitAcqEvaluation,
  addAcqAttachment,
  addAcqNote,
  markAcqContractSigned,
  approveAcqDeal,
} from "@/actions/acq-deal.actions";
import {
  ACQ_DEAL_STAGE_LABEL,
  ACQ_LOST_REASON,
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
  noteType: "NEGOTIATION" | "INTERNAL" | "GENERAL";
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
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="economics">Economics &amp; Model</TabsTrigger>
            <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
            <TabsTrigger value="negotiation">Negotiation</TabsTrigger>
            <TabsTrigger value="contract">Contract</TabsTrigger>
            <TabsTrigger value="projection">Projection</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab deal={deal} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="economics" className="mt-4">
            <EconomicsTab deal={deal} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="evaluation" className="mt-4">
            <EvaluationTab deal={deal} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="negotiation" className="mt-4">
            <NegotiationTab deal={deal} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="contract" className="mt-4">
            <ContractTab deal={deal} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="projection" className="mt-4">
            <ProjectionTab dealId={deal.id} userRole={userRole} />
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
  onMutate,
}: {
  deal: AcqDealDetail;
  onMutate: () => void;
}) {
  const [busy, setBusy] = useState(false);
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
      <CardHeader>
        <CardTitle className="text-[15px]">Overview</CardTitle>
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
                Not yet approved by BD Head.
              </span>
              <Button size="sm" onClick={approve} disabled={busy}>
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                Approve (BD Head)
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Economics & Model tab
// ------------------------------------------------------------
function EconomicsTab({
  deal,
  onMutate,
}: {
  deal: AcqDealDetail;
  onMutate: () => void;
}) {
  const [model, setModel] = useState<"MANAGEMENT" | "FRANCHISE">(
    deal.model ?? "MANAGEMENT"
  );
  const [baseFeePct, setBaseFeePct] = useState(numStr(deal.baseFeePct));
  const [incentivePct, setIncentivePct] = useState(numStr(deal.incentivePct));
  const [royaltyPct, setRoyaltyPct] = useState(numStr(deal.royaltyPct));
  const [termYears, setTermYears] = useState(numStr(deal.termYears));
  const [lockinYears, setLockinYears] = useState(numStr(deal.lockinYears));
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

  const numOrNull = (s: string): number | null =>
    s.trim() === "" ? null : Number(s);

  async function save() {
    setBusy(true);
    const res = await updateAcqDeal(deal.id, {
      model,
      baseFeePct: numOrNull(baseFeePct),
      incentivePct: numOrNull(incentivePct),
      royaltyPct: numOrNull(royaltyPct),
      termYears: numOrNull(termYears),
      lockinYears: numOrNull(lockinYears),
      isExclusive,
      expectedMonthlyEvents: numOrNull(expectedMonthlyEvents),
      projectedFeeValue: numOrNull(projectedFeeValue),
      ownerCurrentMonthlyRevenue: numOrNull(ownerRevenue),
      avgEventsPerMonth: numOrNull(avgEvents),
      peakRateCard: numOrNull(peakRateCard),
    });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Economics saved");
    onMutate();
  }

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
              />
              <NumField
                label="Incentive %"
                value={incentivePct}
                onChange={setIncentivePct}
              />
            </>
          ) : (
            <NumField
              label="Royalty %"
              value={royaltyPct}
              onChange={setRoyaltyPct}
            />
          )}

          <NumField
            label="Term (years)"
            value={termYears}
            onChange={setTermYears}
          />
          <NumField
            label="Lock-in (years)"
            value={lockinYears}
            onChange={setLockinYears}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
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

        <div className="space-y-2 border-t border-border/60 pt-3">
          {deal.notes.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">No notes yet.</p>
          ) : (
            deal.notes.map((n) => (
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
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Contract tab
// ------------------------------------------------------------
function ContractTab({
  deal,
  onMutate,
}: {
  deal: AcqDealDetail;
  onMutate: () => void;
}) {
  const [verified, setVerified] = useState(
    Boolean(deal.signatoryAuthorityVerified)
  );
  const [gpaUrl, setGpaUrl] = useState(deal.gpaDocumentUrl ?? "");
  const [savingVerify, setSavingVerify] = useState(false);
  const [savingGpa, setSavingGpa] = useState(false);
  const [signing, setSigning] = useState(false);

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
    const res = await markAcqContractSigned(deal.id);
    setSigning(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Contract marked signed");
    onMutate();
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

        <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            {deal.contractStatus === "SIGNED" ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <FileSignature className="size-4" />
            )}
            Mark the executed contract as signed.
          </div>
          <Button
            size="sm"
            onClick={markSigned}
            disabled={signing || deal.contractStatus === "SIGNED"}
          >
            {signing && <Loader2 className="size-3.5 animate-spin" />}
            Mark Contract Signed
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
