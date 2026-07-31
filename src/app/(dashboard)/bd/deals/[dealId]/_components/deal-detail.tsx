"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Camera,
  CheckCircle2,
  Circle,
  FileSignature,
  Loader2,
  Lock,
  Paperclip,
  Pencil,
  Rocket,
  ShieldCheck,
  Trash2,
  Users,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { requiresBdHeadApproval, LEGAL_TRANSITIONS } from "@/lib/acq/domain";
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
  updateAcqDealImages,
} from "@/actions/acq-deal.actions";
import { LeadImagesField } from "@/app/(dashboard)/leads/_components/lead-images-field";
import { editAcqLead } from "@/actions/acq-lead.actions";
import {
  convertDealToProject,
  scheduleIntroductionMeeting,
  getIntroductionMeetings,
  updateIntroductionMeeting,
} from "@/actions/acq-meeting.actions";
import { FileUpload } from "@/components/ui/file-upload";
import {
  ACQ_DEAL_STAGE,
  ACQ_DEAL_STAGE_LABEL,
  ACQ_DEAL_MODEL,
  ACQ_DEAL_MODEL_LABEL,
  ACQ_LOST_REASON,
  ACQ_OWNER_TYPE,
  ACQ_PROPERTY_TYPE,
  ACQ_PROPERTY_STAGE,
  ACQ_LEAD_SOURCE,
  ACQ_RM_PRICE_BASIS,
  ACQ_RM_PRICE_BASIS_LABEL,
  type AcqDealStage,
  type AcqDealModel,
  type AcqRmPriceBasis,
  type AcqLostReason,
} from "@/lib/acq/constants";

import { StatusPill } from "@/components/shared/status-pill";
import { ProjectionTab } from "./projection-tab";
import { AcqSchedulePanel } from "@/app/(dashboard)/bd/_components/acq-schedule-panel";
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
import { TAB_LIST_SCROLL } from "@/lib/mobile-tabs";

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

export interface AcqLeadPreview {
  id: string;
  ownerName: string;
  mobilePrimary: string | null;
  mobileAlternate: string | null;
  email: string | null;
  propertyName: string;
  propertyType: string;
  city: string;
  locality: string;
  seatingTheatre: Num;
  seatingFloating: Num;
  seatingRange: string | null;
  propertyStage: string | null;
  parkingAvailable: boolean | null;
  leadSource: string | null;
  ownerType: string | null;
  referrerName: string | null;
  referrerPhone: string | null;
  referrerEmail: string | null;
  brokerageDemand: string | null;
  notes: string | null;
  qualSeating100: boolean | null;
  qualOwnerInterested: boolean | null;
  qualAgreeRenovate: boolean | null;
  qualPhotosReady: boolean | null;
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
  model: AcqDealModel | null;
  baseFeePct: Num;
  incentivePct: Num;
  royaltyPct: Num;
  termYears: Num;
  lockinYears: Num;
  // REVENUE_MARGIN economics — absolute prices, not percentages.
  rmBasePrice?: Num;
  rmBestPrice?: Num;
  rmPriceBasis?: string | null;
  rmHallCapacity?: number | null;
  rmMinimumPax?: number | null;
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
  expectedSigningDate?: string | null;
  taFees?: Num;
  expectedCollectionDate?: string | null;
  images: string[];
  evaluations: AcqEvaluationRow[];
  attachments: AcqAttachmentRow[];
  notes: AcqNoteRow[];
  property?: { id: string; status: string } | null;
  lead?: AcqLeadPreview | null;
}

// ============================================================
// Stage machine — the SAME map the server guard uses (imported, not copied, so
// the buttons offered here can never drift from what transitionAcqDeal allows).
// ============================================================
const LEGAL_TARGETS: Record<AcqDealStage, AcqDealStage[]> = LEGAL_TRANSITIONS;

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
      } else if (deal.model === "REVENUE_MARGIN") {
        // Absolute-price model: ask for ITS fields, never a fee/royalty %.
        reqs.push({
          label: "Base price, best price and price basis set",
          met:
            num(deal.rmBasePrice) != null &&
            num(deal.rmBestPrice) != null &&
            !!deal.rmPriceBasis,
        });
        if (deal.rmPriceBasis === "PER_PAX") {
          reqs.push({
            label: "Hall capacity and minimum pax set (per-pax price)",
            met: deal.rmHallCapacity != null && deal.rmMinimumPax != null,
          });
        }
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

const num = (v: Num | undefined): number | null =>
  v == null || v === "" ? null : Number(v);
const numStr = (v: Num | undefined): string => {
  const n = num(v);
  return n == null ? "" : String(n);
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// ISO string → value for an <input type="date"> ("YYYY-MM-DD"), local time.
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}
// ISO string → value for an <input type="datetime-local"> ("YYYY-MM-DDTHH:mm").
function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

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
          {/* w-full is this screen's own choice (the tab row spans the deal
            * column on desktop); TAB_LIST_SCROLL adds the phone behaviour. */}
          <TabsList className={`${TAB_LIST_SCROLL} w-full`}>
            <TabsTrigger value="overview" className="shrink-0 whitespace-nowrap">Overview</TabsTrigger>
            <TabsTrigger value="contact" className="shrink-0 whitespace-nowrap">Contact</TabsTrigger>
            <TabsTrigger value="economics" className="shrink-0 whitespace-nowrap">Economics &amp; Model</TabsTrigger>
            <TabsTrigger value="evaluation" className="shrink-0 whitespace-nowrap">Evaluation</TabsTrigger>
            <TabsTrigger value="projection" className="shrink-0 whitespace-nowrap">Projection</TabsTrigger>
            <TabsTrigger value="schedule" className="shrink-0 whitespace-nowrap">Schedule</TabsTrigger>
            <TabsTrigger value="negotiation" className="shrink-0 whitespace-nowrap">Negotiation</TabsTrigger>
            <TabsTrigger value="contract" className="shrink-0 whitespace-nowrap">Contract</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="contact" className="mt-4">
            <ContactTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="economics" className="mt-4">
            <EconomicsTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="evaluation" className="mt-4">
            <EvaluationTab deal={deal} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="projection" className="mt-4">
            {/* One projection lifecycle for every model. A Revenue-Margin deal
                seeds the RM engine from its agreed economics; the builder freezes
                those numbers onto the projection when it saves. */}
            <ProjectionTab
              dealId={deal.id}
              userRole={userRole}
              dealModel={deal.model}
              rmDefaults={{
                basePrice: num(deal.rmBasePrice),
                bestPrice: num(deal.rmBestPrice),
                priceBasis: deal.rmPriceBasis === "PER_PAX" ? "PER_PAX" : "PER_EVENT",
                hallCapacity: deal.rmHallCapacity ?? null,
                minimumPax: deal.rmMinimumPax ?? null,
                eventsPerMonth: num(deal.expectedMonthlyEvents),
                expectedPax:
                  Math.max(
                    num(deal.seatingTheatre) ?? 0,
                    num(deal.seatingFloating) ?? 0
                  ) || null,
              }}
            />
          </TabsContent>
          <TabsContent value="schedule" className="mt-4">
            {/* Calls / site-visits / meetings against this deal (shared panel). */}
            <AcqSchedulePanel
              scope="deal"
              id={deal.id}
              userRole={userRole}
              onMutate={() => router.refresh()}
            />
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
// Contact tab — owner contact details (name / phones / email).
// These live on the deal's originating lead (the deal snapshot carries only
// ownerName + ownerType), so we capture/edit them there via editAcqLead —
// reusing the existing lead-write action rather than adding new owner columns.
// ------------------------------------------------------------
function ContactTab({
  deal,
  userRole,
  onMutate,
}: {
  deal: AcqDealDetail;
  userRole?: string;
  onMutate: () => void;
}) {
  const canEdit = acqCan(userRole, "lead:write") && !!deal.lead;
  const lead = deal.lead;
  const [ownerName, setOwnerName] = useState(lead?.ownerName ?? deal.ownerName ?? "");
  const [mobilePrimary, setMobilePrimary] = useState(lead?.mobilePrimary ?? "");
  const [mobileAlternate, setMobileAlternate] = useState(lead?.mobileAlternate ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!lead) return;
    if (!ownerName.trim()) {
      toast.error("Owner name is required.");
      return;
    }
    setBusy(true);
    const res = await editAcqLead(lead.id, {
      ownerName: ownerName.trim(),
      mobilePrimary: mobilePrimary.trim(),
      mobileAlternate: mobileAlternate.trim() || undefined,
      email: email.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Contact details saved");
    onMutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px] tracking-[-0.01em]">
          <Users className="size-4" /> Owner contact
        </CardTitle>
        <CardDescription>
          The venue owner&apos;s point of contact for this acquisition.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!lead ? (
          <p className="text-[12.5px] text-muted-foreground">
            Contact details are captured on the deal&apos;s originating lead, which
            isn&apos;t available for this deal.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Owner name</Label>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Owner / signatory name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canEdit}
                  placeholder="owner@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Primary mobile</Label>
                <Input
                  value={mobilePrimary}
                  onChange={(e) => setMobilePrimary(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Primary phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Alternate mobile</Label>
                <Input
                  value={mobileAlternate}
                  onChange={(e) => setMobileAlternate(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Alternate phone (optional)"
                />
              </div>
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button onClick={save} disabled={busy}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Save contact
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
  // Explicit stage editor (task 6). It calls the SAME guarded transition action
  // as the quick buttons — there is no bypass path.
  const [target, setTarget] = useState<AcqDealStage | "">("");
  const [note, setNote] = useState("");
  // Refusals are kept on screen (a toast disappears before the rep has read the
  // requirement it names).
  const [refusal, setRefusal] = useState<string | null>(null);

  const targets = LEGAL_TARGETS[deal.stage] ?? [];

  async function go(toStage: AcqDealStage, reason?: string) {
    if (toStage === "LOST") {
      setLostOpen(true);
      return;
    }
    setRefusal(null);
    setPending(toStage);
    const res = await transitionAcqDeal(deal.id, toStage, reason?.trim() ? { reason: reason.trim() } : {});
    setPending(null);
    if (!res.success) {
      setRefusal(res.error);
      toast.error(res.error);
      return;
    }
    setTarget("");
    setNote("");
    toast.success(`Moved to ${ACQ_DEAL_STAGE_LABEL[res.data.stage]}`);
    onMutate();
  }

  async function confirmLost() {
    if (!lostReason) {
      toast.error("Select a lost reason.");
      return;
    }
    setLostBusy(true);
    const res = await transitionAcqDeal(deal.id, "LOST", {
      lostReason,
      ...(note.trim() ? { reason: note.trim() } : {}),
    });
    setLostBusy(false);
    if (!res.success) {
      setRefusal(res.error);
      toast.error(res.error);
      return;
    }
    setLostOpen(false);
    setLostReason("");
    setNote("");
    setTarget("");
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

          {/* Explicit stage editor — pick any stage; illegal ones are disabled
              with the reason, and the guarded action still has the final say. */}
          {targets.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <Label className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                Change stage
              </Label>
              <Select value={target} onValueChange={(v) => setTarget(v as AcqDealStage)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {ACQ_DEAL_STAGE.filter((s) => s !== deal.stage).map((s) => {
                    const legal = targets.includes(s);
                    return (
                      <SelectItem key={s} value={s} disabled={!legal}>
                        {ACQ_DEAL_STAGE_LABEL[s]}
                        {!legal && ` — not allowed from ${ACQ_DEAL_STAGE_LABEL[deal.stage]}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason / note for the stage change (optional)"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!target || pending !== null || lostBusy}
                onClick={() => target && go(target, note)}
              >
                {pending === target ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="size-3.5" />
                )}
                Update stage
              </Button>
            </div>
          )}

          {refusal && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-[12px] text-destructive">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                <strong>Stage change refused.</strong> {refusal}
              </span>
            </div>
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
      {/* Emails and long owner names have no break opportunity, and this dl runs
        * two columns (~165px) on a phone — without break-words they push the
        * card past the viewport edge. */}
      <dd className="text-[13px] break-words text-foreground">{value || "—"}</dd>
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
  const [leadEditOpen, setLeadEditOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const canApprove = acqCan(userRole, "bdhead:approve");
  const canEdit = acqCan(userRole, "lead:write");
  // Shared selector (see isChangeLogNote) — identical history to the Negotiation tab.
  const changeLog = selectChangeLog(deal.notes);
  const seating = [num(deal.seatingTheatre), num(deal.seatingFloating)]
    .filter((n) => n != null)
    .map((n, i) => `${n} ${i === 0 ? "theatre" : "floating"}`)
    .join(" · ");
  const lead = deal.lead ?? null;
  const taFees = num(deal.taFees);

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
        <CardTitle className="text-[13px] tracking-[-0.01em]">Overview</CardTitle>
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

        {/* Deal preview — full lead-stage details captured at lead stage */}
        <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Deal preview · lead details
            </div>
            {canEdit && lead && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setLeadEditOpen(true)}>
                <Pencil className="size-3.5" /> Edit lead details
              </Button>
            )}
          </div>
          {lead ? (
            <>
              <dl className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                <Field label="Owner name" value={lead.ownerName} />
                <Field label="Primary phone" value={lead.mobilePrimary} />
                <Field label="Alternate phone" value={lead.mobileAlternate} />
                <Field label="Email" value={lead.email} />
                <Field label="Owner type" value={lead.ownerType?.replaceAll("_", " ")} />
                <Field label="Lead source" value={lead.leadSource?.replaceAll("_", " ")} />
                <Field label="Property name" value={lead.propertyName} />
                <Field label="Property type" value={lead.propertyType?.replaceAll("_", " ")} />
                <Field label="Property stage" value={lead.propertyStage?.replaceAll("_", " ")} />
                <Field label="City" value={lead.city} />
                <Field label="Locality" value={lead.locality} />
                <Field
                  label="Seating"
                  value={[num(lead.seatingTheatre), num(lead.seatingFloating)]
                    .filter((n) => n != null)
                    .map((n, i) => `${n} ${i === 0 ? "theatre" : "floating"}`)
                    .join(" · ")}
                />
                <Field label="Seating range" value={lead.seatingRange?.replaceAll("R_", "").replaceAll("_", "–").replace("–PLUS", "+")} />
                <Field
                  label="Parking"
                  value={lead.parkingAvailable == null ? "—" : lead.parkingAvailable ? "Available" : "Not available"}
                />
              </dl>

              {(lead.referrerName || lead.referrerPhone || lead.referrerEmail || lead.brokerageDemand) && (
                <dl className="grid grid-cols-2 gap-3.5 border-t border-border/50 pt-3 sm:grid-cols-3">
                  <Field label="Referrer name" value={lead.referrerName} />
                  <Field label="Referrer phone" value={lead.referrerPhone} />
                  <Field label="Referrer email" value={lead.referrerEmail} />
                  <Field label="Brokerage demand" value={lead.brokerageDemand} />
                </dl>
              )}

              {lead.notes && (
                <div className="border-t border-border/50 pt-3">
                  <Field label="Notes" value={<span className="whitespace-pre-wrap">{lead.notes}</span>} />
                </div>
              )}

              <div className="border-t border-border/50 pt-3">
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Qualification checklist
                </div>
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {[
                    { label: "Seating ≥ 100", met: lead.qualSeating100 },
                    { label: "Owner interested", met: lead.qualOwnerInterested },
                    { label: "Agrees to renovate", met: lead.qualAgreeRenovate },
                    { label: "Photos ready", met: lead.qualPhotosReady },
                  ].map((q) => (
                    <li key={q.label} className="flex items-center gap-1.5 text-[12.5px]">
                      {q.met ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="size-3.5 shrink-0 text-muted-foreground/40" />
                      )}
                      <span className={q.met ? "text-foreground" : "text-muted-foreground"}>{q.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">No linked lead record.</p>
          )}
        </div>

        {/* Commercial dates & TA fees (deal-level) */}
        <div className="space-y-3 rounded-md border border-border/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Signing &amp; collection
            </div>
            {canEdit && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDatesOpen(true)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
            <Field label="Expected signing date" value={deal.expectedSigningDate ? fmtDate(deal.expectedSigningDate) : "—"} />
            <Field label="TA fees" value={taFees != null ? INR.format(taFees) : "—"} />
            <Field label="Expected collection date" value={deal.expectedCollectionDate ? fmtDate(deal.expectedCollectionDate) : "—"} />
          </dl>
        </div>

        {/* Property photos captured on the deal (shown on the linked property) */}
        <DealImagesSection deal={deal} userRole={userRole} onMutate={onMutate} />

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
      <DealDatesEditDialog
        deal={deal}
        open={datesOpen}
        onOpenChange={setDatesOpen}
        onMutate={onMutate}
      />
      {lead && (
        <LeadDetailsEditDialog
          lead={lead}
          open={leadEditOpen}
          onOpenChange={setLeadEditOpen}
          onMutate={onMutate}
        />
      )}
    </Card>
  );
}

// Property photos captured on the deal (AcqDeal.images). Reuses the controlled
// LeadImagesField for the picker; persists via updateAcqDealImages. These images
// are displayed on the linked property's detail page.
function DealImagesSection({
  deal,
  userRole,
  onMutate,
}: {
  deal: AcqDealDetail;
  userRole?: string;
  onMutate: () => void;
}) {
  const canEdit = acqCan(userRole, "lead:write");
  const [images, setImages] = useState<string[]>(deal.images ?? []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setImages(deal.images ?? []);
  }, [deal.images]);

  const dirty =
    images.length !== (deal.images?.length ?? 0) ||
    images.some((v, i) => v !== deal.images?.[i]);

  async function save() {
    setBusy(true);
    try {
      const res = await updateAcqDealImages(deal.id, images);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Property photos saved");
      onMutate();
    } catch {
      toast.error("Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border/60 p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          <Camera className="size-3.5" /> Property photos
        </div>
        {canEdit && dirty && (
          <Button size="sm" onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Save photos
          </Button>
        )}
      </div>
      {canEdit ? (
        <div className="grid gap-4">
          <LeadImagesField value={images} onChange={setImages} />
        </div>
      ) : images.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((src, idx) => (
            <div key={idx} className="aspect-square overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Property photo ${idx + 1}`} className="size-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Edit deal-level commercial dates + TA fees (saved via updateAcqDeal).
function DealDatesEditDialog({
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
  const [signing, setSigning] = useState(toDateInput(deal.expectedSigningDate));
  const [taFees, setTaFees] = useState(numStr(deal.taFees));
  const [collection, setCollection] = useState(toDateInput(deal.expectedCollectionDate));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSigning(toDateInput(deal.expectedSigningDate));
      setTaFees(numStr(deal.taFees));
      setCollection(toDateInput(deal.expectedCollectionDate));
    }
  }, [open, deal]);

  async function save() {
    setBusy(true);
    try {
      const feeNum = taFees.trim() === "" ? null : Number(taFees);
      if (feeNum != null && !Number.isFinite(feeNum)) {
        toast.error("TA fees must be a valid number.");
        return;
      }
      const res = await updateAcqDeal(deal.id, {
        expectedSigningDate: signing ? new Date(signing).toISOString() : null,
        taFees: feeNum,
        expectedCollectionDate: collection ? new Date(collection).toISOString() : null,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signing &amp; collection</DialogTitle>
          <DialogDescription>Expected dates and the transaction-advisory fee.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Expected signing date</Label>
            <Input type="date" value={signing} onChange={(e) => setSigning(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>TA fees (₹)</Label>
            <Input type="number" inputMode="decimal" value={taFees} onChange={(e) => setTaFees(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Expected collection date</Label>
            <Input type="date" value={collection} onChange={(e) => setCollection(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit ALL lead-stage details captured at the lead stage (saved via editAcqLead).
function LeadDetailsEditDialog({
  lead,
  open,
  onOpenChange,
  onMutate,
}: {
  lead: AcqLeadPreview;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMutate: () => void;
}) {
  const [f, setF] = useState(() => leadFormState(lead));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setF(leadFormState(lead));
  }, [open, lead]);

  const set = <K extends keyof ReturnType<typeof leadFormState>>(
    k: K,
    v: ReturnType<typeof leadFormState>[K]
  ) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const res = await editAcqLead(lead.id, {
        ownerName: f.ownerName.trim(),
        mobilePrimary: f.mobilePrimary.trim(),
        mobileAlternate: f.mobileAlternate.trim(),
        email: f.email.trim(),
        propertyName: f.propertyName.trim(),
        propertyType: f.propertyType as never,
        city: f.city.trim(),
        locality: f.locality.trim(),
        seatingTheatre: f.seatingTheatre.trim() === "" ? null : Math.trunc(Number(f.seatingTheatre)),
        seatingFloating: f.seatingFloating.trim() === "" ? null : Math.trunc(Number(f.seatingFloating)),
        propertyStage: (f.propertyStage || null) as never,
        leadSource: f.leadSource as never,
        ownerType: f.ownerType as never,
        parkingAvailable: f.parking === "" ? null : f.parking === "yes",
        referrerName: f.referrerName.trim(),
        referrerPhone: f.referrerPhone.trim(),
        referrerEmail: f.referrerEmail.trim(),
        brokerageDemand: f.brokerageDemand.trim(),
        notes: f.notes.trim(),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Lead details updated");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit lead details</DialogTitle>
          <DialogDescription>All details captured at the lead stage.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Owner name</Label><Input value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Owner type</Label>
            <Select value={f.ownerType} onValueChange={(v) => set("ownerType", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ACQ_OWNER_TYPE.map((o) => (<SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Primary phone</Label><Input value={f.mobilePrimary} onChange={(e) => set("mobilePrimary", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Alternate phone</Label><Input value={f.mobileAlternate} onChange={(e) => set("mobileAlternate", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Email</Label><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Property name</Label><Input value={f.propertyName} onChange={(e) => set("propertyName", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Property type</Label>
            <Select value={f.propertyType} onValueChange={(v) => set("propertyType", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ACQ_PROPERTY_TYPE.map((o) => (<SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Property stage</Label>
            <Select value={f.propertyStage || "__none"} onValueChange={(v) => set("propertyStage", v === "__none" ? "" : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {ACQ_PROPERTY_STAGE.map((o) => (<SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Parking</Label>
            <Select value={f.parking || "__none"} onValueChange={(v) => set("parking", v === "__none" ? "" : (v as "yes" | "no"))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                <SelectItem value="yes">Available</SelectItem>
                <SelectItem value="no">Not available</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>City</Label><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Locality</Label><Input value={f.locality} onChange={(e) => set("locality", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Seating — theatre</Label><Input inputMode="numeric" value={f.seatingTheatre} onChange={(e) => set("seatingTheatre", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Seating — floating</Label><Input inputMode="numeric" value={f.seatingFloating} onChange={(e) => set("seatingFloating", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Lead source</Label>
            <Select value={f.leadSource} onValueChange={(v) => set("leadSource", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ACQ_LEAD_SOURCE.map((o) => (<SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Brokerage demand</Label><Input value={f.brokerageDemand} onChange={(e) => set("brokerageDemand", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Referrer name</Label><Input value={f.referrerName} onChange={(e) => set("referrerName", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Referrer phone</Label><Input value={f.referrerPhone} onChange={(e) => set("referrerPhone", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Referrer email</Label><Input value={f.referrerEmail} onChange={(e) => set("referrerEmail", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function leadFormState(lead: AcqLeadPreview) {
  return {
    ownerName: lead.ownerName ?? "",
    ownerType: lead.ownerType ?? "SOLE_OWNER",
    mobilePrimary: lead.mobilePrimary ?? "",
    mobileAlternate: lead.mobileAlternate ?? "",
    email: lead.email ?? "",
    propertyName: lead.propertyName ?? "",
    propertyType: lead.propertyType ?? "BANQUET",
    propertyStage: lead.propertyStage ?? "",
    city: lead.city ?? "",
    locality: lead.locality ?? "",
    seatingTheatre: numStr(lead.seatingTheatre),
    seatingFloating: numStr(lead.seatingFloating),
    leadSource: lead.leadSource ?? "OTHER",
    parking: lead.parkingAvailable == null ? "" : lead.parkingAvailable ? "yes" : "no",
    referrerName: lead.referrerName ?? "",
    referrerPhone: lead.referrerPhone ?? "",
    referrerEmail: lead.referrerEmail ?? "",
    brokerageDemand: lead.brokerageDemand ?? "",
    notes: lead.notes ?? "",
  };
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
  const [model, setModel] = useState<AcqDealModel>(deal.model ?? "MANAGEMENT");
  // REVENUE_MARGIN economics — absolute prices, so none of the % floors apply.
  const [rmBasePrice, setRmBasePrice] = useState(numStr(deal.rmBasePrice));
  const [rmBestPrice, setRmBestPrice] = useState(numStr(deal.rmBestPrice));
  const [rmPriceBasis, setRmPriceBasis] = useState<AcqRmPriceBasis>(
    deal.rmPriceBasis === "PER_PAX" ? "PER_PAX" : "PER_EVENT"
  );
  const [rmHallCapacity, setRmHallCapacity] = useState(numStr(deal.rmHallCapacity ?? null));
  const [rmMinimumPax, setRmMinimumPax] = useState(numStr(deal.rmMinimumPax ?? null));
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

  // Client mirror of the server's REVENUE_MARGIN rules (acq-deal.actions.ts) so
  // the rep sees the problem before the round-trip. The server still re-checks.
  const rmErrors: string[] = [];
  if (model === "REVENUE_MARGIN") {
    const b = numOrNull(rmBasePrice);
    const t = numOrNull(rmBestPrice);
    const cap = numOrNull(rmHallCapacity);
    const min = numOrNull(rmMinimumPax);
    if (b != null && b < 0) rmErrors.push("Base price must be ≥ 0.");
    if (t != null && t < 0) rmErrors.push("Best price must be ≥ 0.");
    if (b != null && t != null && t < b) {
      rmErrors.push("Best price can't be lower than the base price (that would be a negative margin).");
    }
    if (cap != null && (!Number.isInteger(cap) || cap < 1)) {
      rmErrors.push("Hall capacity must be a whole number ≥ 1.");
    }
    if (min != null && (!Number.isInteger(min) || min < 1)) {
      rmErrors.push("Minimum pax must be a whole number ≥ 1.");
    }
    if (cap != null && min != null && min > cap) {
      rmErrors.push("Minimum pax can't exceed the hall capacity.");
    }
  }

  async function save() {
    if (rmErrors.length > 0) {
      toast.error(rmErrors[0]);
      return;
    }
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
      // The Revenue-Margin prices are locked by the same freeze.
      if (!frozen) {
        patch.baseFeePct = numOrNull(baseFeePct);
        patch.incentivePct = numOrNull(incentivePct);
        patch.termYears = intOrNull(termYears);
        // Only the Revenue-Margin model owns these columns — don't write (and
        // change-log) them on a Management/Franchise deal. Values already saved
        // are left untouched, so switching models back keeps the agreed prices.
        if (model === "REVENUE_MARGIN") {
          patch.rmBasePrice = numOrNull(rmBasePrice);
          patch.rmBestPrice = numOrNull(rmBestPrice);
          patch.rmPriceBasis = rmPriceBasis;
          patch.rmHallCapacity = numOrNull(rmHallCapacity);
          // Minimum pax only means anything on a per-pax price — clear it on a
          // per-event price so a stale floor can't quietly inflate a projection.
          patch.rmMinimumPax =
            rmPriceBasis === "PER_PAX" ? numOrNull(rmMinimumPax) : null;
        }
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
        <CardTitle className="text-[13px] tracking-[-0.01em]">Economics &amp; Model</CardTitle>
        <CardDescription>
          {model === "REVENUE_MARGIN"
            ? "Revenue Margin quotes absolute prices — the % floors don't apply. Lock-in ≥ 3 yrs still needs BD Head approval when shorter."
            : "Floors: base ≥ 5%, incentive ≥ 15%, royalty ≥ 20%, lock-in ≥ 3 yrs. Below these requires BD Head approval."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Commercial model</Label>
            <Select value={model} onValueChange={(v) => setModel(v as AcqDealModel)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACQ_DEAL_MODEL.map((m) => (
                  <SelectItem key={m} value={m}>
                    {ACQ_DEAL_MODEL_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {model === "MANAGEMENT" && (
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
          )}
          {model === "FRANCHISE" && (
            <NumField
              label="Royalty %"
              value={royaltyPct}
              onChange={setRoyaltyPct}
              disabled={frozen}
              warn={belowRoyalty ? FLOOR_WARN : undefined}
            />
          )}
          {/* REVENUE_MARGIN inputs — only this model has them. */}
          {model === "REVENUE_MARGIN" && (
            <>
              <div className="space-y-1.5">
                <Label>Price basis</Label>
                <Select
                  value={rmPriceBasis}
                  onValueChange={(v) => setRmPriceBasis(v as AcqRmPriceBasis)}
                  disabled={frozen}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACQ_RM_PRICE_BASIS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {ACQ_RM_PRICE_BASIS_LABEL[b]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11.5px] text-muted-foreground">
                  {rmPriceBasis === "PER_PAX"
                    ? "Priced per head — pax multiplies the gross, capped by hall capacity."
                    : "Priced per event — pax is not a multiplier."}
                </p>
              </div>
              <NumField
                label="Base price (₹, owner guaranteed)"
                value={rmBasePrice}
                onChange={setRmBasePrice}
                disabled={frozen}
              />
              <NumField
                label="Best price (₹, expected sell)"
                value={rmBestPrice}
                onChange={setRmBestPrice}
                disabled={frozen}
              />
              <NumField
                label="Hall capacity (pax)"
                value={rmHallCapacity}
                onChange={setRmHallCapacity}
                disabled={frozen}
              />
              {rmPriceBasis === "PER_PAX" && (
                <NumField
                  label="Minimum pax (billable floor)"
                  value={rmMinimumPax}
                  onChange={setRmMinimumPax}
                  disabled={frozen}
                />
              )}
            </>
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

        <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
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

        {rmErrors.length > 0 && (
          <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-[12px] text-destructive">
            {rmErrors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}

        {model === "REVENUE_MARGIN" && rmErrors.length === 0 && (
          <p className="text-[11.5px] text-muted-foreground">
            Save, then see the <strong>Projection</strong> tab for the annualised
            gross revenue and the base-to-best margin.
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={busy || rmErrors.length > 0}>
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
          <CardTitle className="text-[13px] tracking-[-0.01em]">Evaluation scorecard</CardTitle>
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
  const remaining = Math.max(0, 8 - photos.length);

  async function upload(dataUrl: string, file: File) {
    const res = await addAcqAttachment(deal.id, { kind: "PHOTO", url: dataUrl, label: file.name });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Photo added");
    onMutate();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[13px] tracking-[-0.01em]">
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
        <div className="flex flex-wrap items-center gap-2">
          <FileUpload
            onUploaded={upload}
            accept="image/png,image/jpeg,image/webp"
            label="Upload photo"
          />
          <span className="text-[12px] text-muted-foreground">
            {remaining > 0 ? `${remaining} more required` : "✓ Minimum met"}
          </span>
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
  const [label, setLabel] = useState("");

  const docs = deal.attachments.filter((a) => a.kind !== "PHOTO");

  async function upload(dataUrl: string, file: File) {
    const res = await addAcqAttachment(deal.id, {
      kind,
      url: dataUrl,
      label: label.trim() || file.name,
    });
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setLabel("");
    toast.success("Attachment added");
    onMutate();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[13px] tracking-[-0.01em]">
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
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional — defaults to file name)"
          />
          <FileUpload onUploaded={upload} label="Upload" />
        </div>
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
        <CardTitle className="text-[13px] tracking-[-0.01em]">Negotiation notes</CardTitle>
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

  async function add(label: string, dataUrl: string) {
    try {
      const res = await addAcqAttachment(deal.id, { kind: "DOCUMENT", url: dataUrl, label });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${label} uploaded`);
      onMutate();
    } catch {
      toast.error("Couldn't upload — please try again.");
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
                <FileUpload
                  onUploaded={(dataUrl) => add(label, dataUrl)}
                  label="Upload"
                />
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

  async function uploadGpa(dataUrl: string) {
    setSavingGpa(true);
    try {
      const res = await updateAcqDeal(deal.id, { gpaDocumentUrl: dataUrl });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("GPA document uploaded");
      onMutate();
    } finally {
      setSavingGpa(false);
    }
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
        <CardTitle className="text-[13px] tracking-[-0.01em]">Contract</CardTitle>
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
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
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
          <Label>GPA document</Label>
          <div className="flex flex-wrap items-center gap-2">
            <FileUpload onUploaded={uploadGpa} label="Upload GPA" disabled={savingGpa} />
            {deal.gpaDocumentUrl && (
              <a
                href={deal.gpaDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] text-primary hover:underline"
              >
                <CheckCircle2 className="size-3.5 text-emerald-600" /> View uploaded GPA
              </a>
            )}
            {savingGpa && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <ContractDocuments deal={deal} onMutate={onMutate} />

        <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
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

        {deal.contractStatus === "SIGNED" && (
          <AlignTeamsPanel deal={deal} onMutate={onMutate} />
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Post-signature: convert to project + align teams via an
// introduction meeting. Shown only once the contract is SIGNED.
// ------------------------------------------------------------
type IntroMeeting = {
  id: string;
  scheduledAt: string;
  location: string | null;
  agenda: string | null;
  status: string;
  teamDesign?: boolean;
  teamProjects?: boolean;
  teamSales?: boolean;
  teamOperations?: boolean;
};

function AlignTeamsPanel({
  deal,
  onMutate,
}: {
  deal: AcqDealDetail;
  onMutate: () => void;
}) {
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState<{ projectId: string; propertyName: string } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [meetings, setMeetings] = useState<IntroMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  async function loadMeetings() {
    setLoadingMeetings(true);
    try {
      const res = await getIntroductionMeetings({ dealId: deal.id });
      if (res.success) setMeetings((res.data as IntroMeeting[]) ?? []);
    } finally {
      setLoadingMeetings(false);
    }
  }

  useEffect(() => {
    loadMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  async function convert() {
    setConverting(true);
    try {
      const res = await convertDealToProject(deal.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setConverted(res.data);
      toast.success(`Converted to project — ${res.data.propertyName}`);
      onMutate();
    } catch {
      toast.error("Couldn't convert — please try again.");
    } finally {
      setConverting(false);
    }
  }

  // Already converted if a property is linked to the deal, or we just converted.
  const alreadyConverted = converted != null || deal.property != null;

  return (
    <div className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50/50 p-4">
      <div className="flex items-center gap-2">
        <Rocket className="size-4 text-emerald-600" />
        <h3 className="text-[14px] font-semibold text-foreground">Align teams &amp; convert</h3>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        The contract is signed. Convert this deal into a project and bring Design, Projects, Sales and Operations together with an introduction meeting.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {converted ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${converted.projectId}`}>
              Open project · {converted.propertyName}
            </Link>
          </Button>
        ) : alreadyConverted ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Already converted to a project
          </span>
        ) : (
          <Button size="sm" onClick={convert} disabled={converting}>
            {converting ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
            Convert to Project
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
          <CalendarClock className="size-3.5" /> Schedule introduction meeting
        </Button>
      </div>

      {/* Existing meetings */}
      <div className="space-y-2 border-t border-emerald-200/70 pt-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          <Users className="size-3.5" /> Introduction meetings
        </div>
        {loadingMeetings ? (
          <p className="text-[12.5px] text-muted-foreground">Loading…</p>
        ) : meetings.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No meetings scheduled yet.</p>
        ) : (
          <ul className="space-y-2">
            {meetings.map((m) => (
              <MeetingRow key={m.id} meeting={m} onChanged={loadMeetings} />
            ))}
          </ul>
        )}
      </div>

      <ScheduleMeetingDialog
        deal={deal}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={loadMeetings}
      />
    </div>
  );
}

function MeetingRow({
  meeting,
  onChanged,
}: {
  meeting: IntroMeeting;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const teams = [
    meeting.teamDesign && "Design",
    meeting.teamProjects && "Projects",
    meeting.teamSales && "Sales",
    meeting.teamOperations && "Operations",
  ].filter(Boolean) as string[];

  const hue: Parameters<typeof StatusPill>[0]["hue"] =
    meeting.status === "COMPLETED" ? "emerald" : meeting.status === "CANCELLED" ? "red" : "blue";

  async function setStatus(status: "COMPLETED" | "CANCELLED") {
    setBusy(true);
    try {
      const res = await updateIntroductionMeeting(meeting.id, { status });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(status === "COMPLETED" ? "Marked completed" : "Meeting cancelled");
      onChanged();
    } catch {
      toast.error("Couldn't update — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const open = meeting.status !== "COMPLETED" && meeting.status !== "CANCELLED";

  return (
    <li className="rounded-md border border-border/60 bg-background p-2.5 text-[12.5px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{fmtDateTime(meeting.scheduledAt)}</span>
        <StatusPill label={meeting.status.replaceAll("_", " ")} hue={hue} size="xs" />
      </div>
      {meeting.location && <div className="pt-0.5 text-muted-foreground">📍 {meeting.location}</div>}
      {teams.length > 0 && <div className="pt-0.5 text-muted-foreground">Teams: {teams.join(", ")}</div>}
      {meeting.agenda && <p className="whitespace-pre-wrap pt-1 text-foreground/80">{meeting.agenda}</p>}
      {open && (
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setStatus("COMPLETED")} disabled={busy}>
            <CheckCircle2 className="size-3.5" /> Complete
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => setStatus("CANCELLED")} disabled={busy}>
            <Trash2 className="size-3.5" /> Cancel
          </Button>
        </div>
      )}
    </li>
  );
}

function ScheduleMeetingDialog({
  deal,
  open,
  onOpenChange,
  onScheduled,
}: {
  deal: AcqDealDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onScheduled: () => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [teams, setTeams] = useState({ design: true, projects: true, sales: true, operations: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setScheduledAt("");
      setLocation("");
      setAgenda("");
      setTeams({ design: true, projects: true, sales: true, operations: true });
    }
  }, [open]);

  async function submit() {
    if (!scheduledAt) {
      toast.error("Pick a date and time.");
      return;
    }
    setBusy(true);
    try {
      const res = await scheduleIntroductionMeeting({
        dealId: deal.id,
        propertyName: deal.propertyName,
        scheduledAt: new Date(scheduledAt).toISOString(),
        location: location.trim() || undefined,
        agenda: agenda.trim() || undefined,
        teams,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Introduction meeting scheduled");
      onOpenChange(false);
      onScheduled();
    } catch {
      toast.error("Couldn't schedule — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const TEAMS: { key: keyof typeof teams; label: string }[] = [
    { key: "design", label: "Design" },
    { key: "projects", label: "Projects" },
    { key: "sales", label: "Sales" },
    { key: "operations", label: "Operations" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule introduction meeting</DialogTitle>
          <DialogDescription>Bring the delivery teams together for {deal.propertyName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Date &amp; time</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office, video link, or venue" />
          </div>
          <div className="space-y-1.5">
            <Label>Agenda</Label>
            <Textarea rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="What to align on" />
          </div>
          <div className="space-y-2">
            <Label>Teams to invite</Label>
            <div className="grid grid-cols-2 gap-2">
              {TEAMS.map((t) => (
                <label
                  key={t.key}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-[12.5px]"
                >
                  <span>{t.label}</span>
                  <Switch
                    checked={teams[t.key]}
                    onCheckedChange={(v) => setTeams((p) => ({ ...p, [t.key]: v }))}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
