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
  Paperclip,
  Pencil,
  Rocket,
  ShieldCheck,
  Trash2,
  Users,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { requiresBdHeadApproval, LEGAL_TRANSITIONS, computeEvaluation } from "@/lib/acq/domain";
import { acqCan } from "@/lib/acq/rbac";
import { cn } from "@/lib/utils";
import { DEAL_CONTRACT_TAB_ENABLED, DEAL_PROJECTION_TAB_ENABLED } from "@/config/feature-flags";

import {
  transitionAcqDeal,
  updateAcqDeal,
  submitAcqEvaluation,
  addAcqAttachment,
  addAcqNote,
  markAcqContractSigned,
  approveAcqDeal,
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
  type AcqDealStage,
  type AcqDealModel,
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
  expectedMonthlyEvents: Num;
  projectedFeeValue: Num;
  banquetSizeSft: Num;
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
          { label: "Site scorecard submitted and passed", met: passedEval },
          { label: `Site photos uploaded (${Math.min(photos, 8)}/8)`, met: photos >= 8 },
        ],
      };
    case "EVALUATION_COMPLETED": {
      const reqs: { label: string; met: boolean }[] = [
        { label: "Commercial model selected", met: !!deal.model },
      ];
      if (deal.model === "FRANCHISE") {
        reqs.push({ label: "Royalty % set", met: num(deal.royaltyPct) != null });
      } else if (deal.model !== "REVENUE_MARGIN") {
        // REVENUE_MARGIN quotes absolute prices and no longer carries any of its
        // own, so it has nothing to require here beyond the model itself.
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
// drift (O-10): CHANGE_LOG notes are the system-written edit history (commercials,
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
  evalPassThreshold,
}: {
  deal: AcqDealDetail;
  userRole?: string;
  /** Configured pass mark for the evaluation scorecard (AcqConfig). */
  evalPassThreshold: number;
}) {
  const router = useRouter();

  // Fewer doors: Overview now carries notes + schedule; Projection and Contract
  // are flag-gated off (the contract lifecycle lives in BD → Contracts and the
  // pre-contract checks moved into Negotiation). Nothing was deleted.
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <Tabs defaultValue="overview" className="w-full">
          {/* w-full is this screen's own choice (the tab row spans the deal
            * column on desktop); TAB_LIST_SCROLL adds the phone behaviour. */}
          <TabsList className={`${TAB_LIST_SCROLL} w-full`}>
            <TabsTrigger value="overview" className="shrink-0 whitespace-nowrap">Overview</TabsTrigger>
            <TabsTrigger value="contact" className="shrink-0 whitespace-nowrap">Contact</TabsTrigger>
            <TabsTrigger value="evaluation" className="shrink-0 whitespace-nowrap">Evaluation</TabsTrigger>
            {DEAL_PROJECTION_TAB_ENABLED && (
              <TabsTrigger value="projection" className="shrink-0 whitespace-nowrap">Projection</TabsTrigger>
            )}
            <TabsTrigger value="negotiation" className="shrink-0 whitespace-nowrap">Negotiation</TabsTrigger>
            {DEAL_CONTRACT_TAB_ENABLED && (
              <TabsTrigger value="contract" className="shrink-0 whitespace-nowrap">Contract</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="contact" className="mt-4">
            <ContactTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
          </TabsContent>
          <TabsContent value="evaluation" className="mt-4">
            <EvaluationTab
              deal={deal}
              passThreshold={evalPassThreshold}
              onMutate={() => router.refresh()}
            />
          </TabsContent>
          {DEAL_PROJECTION_TAB_ENABLED && (
            <TabsContent value="projection" className="mt-4">
              {/* One projection lifecycle for every model. The deal no longer
                  carries Revenue-Margin prices of its own, so an RM draft starts
                  blank on price and the builder freezes whatever is entered onto
                  the projection when it saves. Volume still seeds from the deal. */}
              <ProjectionTab
                dealId={deal.id}
                userRole={userRole}
                dealModel={deal.model}
                rmDefaults={{
                  basePrice: null,
                  bestPrice: null,
                  priceBasis: "PER_EVENT",
                  hallCapacity: null,
                  minimumPax: null,
                  eventsPerMonth: num(deal.expectedMonthlyEvents),
                  expectedPax:
                    Math.max(
                      num(deal.seatingTheatre) ?? 0,
                      num(deal.seatingFloating) ?? 0
                    ) || null,
                }}
              />
            </TabsContent>
          )}
          <TabsContent value="negotiation" className="mt-4">
            <NegotiationTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
          </TabsContent>
          {DEAL_CONTRACT_TAB_ENABLED && (
            <TabsContent value="contract" className="mt-4">
              <ContractTab deal={deal} userRole={userRole} onMutate={() => router.refresh()} />
            </TabsContent>
          )}
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
        <CardTitle className="flex items-center gap-2 text-body tracking-[-0.01em]">
          <Users className="size-4" /> Owner contact
        </CardTitle>
        <CardDescription>
          The venue owner&apos;s point of contact for this acquisition.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!lead ? (
          <p className="text-detail text-muted-foreground">
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
          <CardDescription className="text-meta uppercase tracking-[0.08em]">
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
                <p className="mb-1.5 text-meta font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  To reach {ACQ_DEAL_STAGE_LABEL[step.stage]}
                </p>
                <ul className="space-y-1">
                  {step.reqs.map((r) => (
                    <li key={r.label} className="flex items-start gap-1.5 text-detail">
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
                <p className={`mt-1.5 text-meta font-medium ${remaining === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {remaining === 0 ? "✓ Ready to advance" : `${remaining} requirement${remaining > 1 ? "s" : ""} left`}
                </p>
              </div>
            );
          })()}
          {targets.length === 0 ? (
            <p className="text-detail text-muted-foreground">
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
            <p className="pt-1 text-meta text-muted-foreground">
              Lost reason: {deal.lostReason.replaceAll("_", " ")}
            </p>
          )}

          {/* Explicit stage editor — pick any stage; illegal ones are disabled
              with the reason, and the guarded action still has the final say. */}
          {targets.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <Label className="text-meta uppercase tracking-[0.06em] text-muted-foreground">
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
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-detail text-destructive">
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
      <dt className="text-meta uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      {/* Emails and long owner names have no break opportunity, and this dl runs
        * two columns (~165px) on a phone — without break-words they push the
        * card past the viewport edge. */}
      <dd className="text-body break-words text-foreground">{value || "—"}</dd>
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
  const [datesOpen, setDatesOpen] = useState(false);
  const canApprove = acqCan(userRole, "bdhead:approve");
  const canEdit = acqCan(userRole, "lead:write");
  // Shared selector (see isChangeLogNote) — identical history to the Negotiation tab.
  const changeLog = selectChangeLog(deal.notes);
  const lead = deal.lead ?? null;
  const taFees = num(deal.taFees);

  // ONE set of property facts. The deal snapshot and the originating lead used
  // to be printed as two separate grids with two separate Edit buttons — same
  // owner, same hall, twice. The lead is the richer record (phones, parking,
  // stage, source), so it is preferred field-by-field with the deal as fallback.
  const facts = {
    ownerName: lead?.ownerName || deal.ownerName,
    ownerType: lead?.ownerType || deal.ownerType,
    mobilePrimary: lead?.mobilePrimary ?? null,
    mobileAlternate: lead?.mobileAlternate ?? null,
    email: lead?.email ?? null,
    propertyName: lead?.propertyName || deal.propertyName,
    propertyType: lead?.propertyType || deal.propertyType,
    propertyStage: lead?.propertyStage ?? null,
    city: lead?.city || deal.city,
    locality: lead?.locality || deal.locality,
    seatingTheatre: num(lead?.seatingTheatre) ?? num(deal.seatingTheatre),
    seatingFloating: num(lead?.seatingFloating) ?? num(deal.seatingFloating),
    parkingAvailable: lead?.parkingAvailable ?? null,
    leadSource: lead?.leadSource ?? null,
  };
  const seating = [facts.seatingTheatre, facts.seatingFloating]
    .map((n, i) => (n != null ? `${n} ${i === 0 ? "theatre" : "floating"}` : null))
    .filter(Boolean)
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-body tracking-[-0.01em]">Overview</CardTitle>
            <CardDescription>Owner, property and where the deal stands.</CardDescription>
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" /> Edit details
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Stage strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
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
            <Field label="Contract" value={deal.contractStatus?.replaceAll("_", " ")} />
            <Field
              label="BD Head approval"
              value={
                deal.bdHeadApprovedById ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                    <BadgeCheck className="size-3.5" />
                    Approved{deal.bdHeadApprovedBy?.name ? ` · ${deal.bdHeadApprovedBy.name}` : ""}
                  </span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Pending</span>
                    {canApprove && (
                      <Button size="xs" variant="outline" onClick={approve} disabled={busy}>
                        {busy && <Loader2 className="size-3 animate-spin" />}
                        Approve now
                      </Button>
                    )}
                  </span>
                )
              }
            />
          </div>

          {/* Owner & property — one grid, one Edit */}
          <div className="space-y-3">
            <div className="text-meta font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Owner &amp; property
            </div>
            <dl className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
              <Field label="Owner" value={facts.ownerName} />
              <Field label="Owner type" value={facts.ownerType?.replaceAll("_", " ")} />
              <Field label="Lead source" value={facts.leadSource?.replaceAll("_", " ")} />
              <Field label="Primary phone" value={facts.mobilePrimary} />
              <Field label="Alternate phone" value={facts.mobileAlternate} />
              <Field label="Email" value={facts.email} />
              <Field label="Property" value={facts.propertyName} />
              <Field label="Property type" value={facts.propertyType?.replaceAll("_", " ")} />
              <Field label="Property stage" value={facts.propertyStage?.replaceAll("_", " ")} />
              <Field label="Location" value={`${facts.city} · ${facts.locality}`} />
              <Field label="Seating" value={seating} />
              <Field
                label="Parking"
                value={
                  facts.parkingAvailable == null
                    ? "—"
                    : facts.parkingAvailable
                      ? "Available"
                      : "Not available"
                }
              />
            </dl>

            {lead && (lead.referrerName || lead.referrerPhone || lead.referrerEmail || lead.brokerageDemand) && (
              <dl className="grid grid-cols-2 gap-3.5 border-t border-border/50 pt-3 sm:grid-cols-3">
                <Field label="Referrer name" value={lead.referrerName} />
                <Field label="Referrer phone" value={lead.referrerPhone} />
                <Field label="Referrer email" value={lead.referrerEmail} />
                <Field label="Brokerage demand" value={lead.brokerageDemand} />
              </dl>
            )}

            {lead?.notes && (
              <div className="border-t border-border/50 pt-3">
                <Field
                  label="Lead notes"
                  value={<span className="whitespace-pre-wrap">{lead.notes}</span>}
                />
              </div>
            )}

            {lead && (
              <div className="border-t border-border/50 pt-3">
                <div className="mb-1.5 text-meta uppercase tracking-[0.06em] text-muted-foreground">
                  Qualification checklist
                </div>
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {[
                    { label: "Seating ≥ 100", met: lead.qualSeating100 },
                    { label: "Owner interested", met: lead.qualOwnerInterested },
                    { label: "Agrees to renovate", met: lead.qualAgreeRenovate },
                    { label: "Photos ready", met: lead.qualPhotosReady },
                  ].map((q) => (
                    <li key={q.label} className="flex items-center gap-1.5 text-detail">
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
            )}
          </div>

          {/* Commercial dates & TA fees (deal-level) */}
          <div className="space-y-3 rounded-md border border-border/60 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <div className="text-meta font-medium uppercase tracking-[0.06em] text-muted-foreground">
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

          {/* Post-signature hand-off (was on the Contract tab) */}
          {deal.contractStatus === "SIGNED" && (
            <AlignTeamsPanel deal={deal} onMutate={onMutate} />
          )}

          {/* Transparent change log */}
          <div className="space-y-2">
            <div className="text-meta uppercase tracking-[0.06em] text-muted-foreground">
              Change log
            </div>
            {changeLog.length === 0 ? (
              <p className="text-detail text-muted-foreground">No edits yet.</p>
            ) : (
              <ul className="space-y-2">
                {changeLog.map((n) => (
                  <li key={n.id} className="rounded-md border border-border/60 p-2.5 text-detail">
                    <pre className="whitespace-pre-wrap font-sans text-foreground">{n.body}</pre>
                    <div className="pt-1 text-meta text-muted-foreground">
                      {n.author?.name ?? "—"} · {fmtDate(n.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>

        <DetailsEditDialog
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
      </Card>

      {/* Notes — right here, where the team is looking. */}
      <DealNotesPanel
        deal={deal}
        userRole={userRole}
        title="Notes"
        description="Calls, owner asks, internal remarks — everything the team should know."
        defaultType="GENERAL"
        onMutate={onMutate}
      />

      {/* Calls / site-visits / meetings against this deal (shared panel). */}
      <AcqSchedulePanel scope="deal" id={deal.id} userRole={userRole} onMutate={onMutate} />
    </div>
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
        <div className="flex items-center gap-2 text-meta font-medium uppercase tracking-[0.06em] text-muted-foreground">
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
        <p className="text-detail text-muted-foreground">No photos yet.</p>
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
// ------------------------------------------------------------
// ONE edit dialog for everything shown under "Owner & property". It writes the
// deal snapshot (editAcqDealOverview → change log) AND the originating lead
// (editAcqLead → phones, parking, stage, source, referral, notes), so the two
// records can't drift and the rep never has to guess which Edit to press.
// ------------------------------------------------------------
function FormSection({ title }: { title: string }) {
  return (
    <div className="pt-1 text-meta font-medium uppercase tracking-[0.06em] text-muted-foreground sm:col-span-2">
      {title}
    </div>
  );
}

function detailsFormState(deal: AcqDealDetail) {
  const lead = deal.lead ?? null;
  return {
    ownerName: lead?.ownerName || deal.ownerName || "",
    ownerType: lead?.ownerType || deal.ownerType || "SOLE_OWNER",
    mobilePrimary: lead?.mobilePrimary ?? "",
    mobileAlternate: lead?.mobileAlternate ?? "",
    email: lead?.email ?? "",
    propertyName: lead?.propertyName || deal.propertyName || "",
    propertyType: lead?.propertyType || deal.propertyType || "BANQUET",
    propertyStage: lead?.propertyStage ?? "",
    city: lead?.city || deal.city || "",
    locality: lead?.locality || deal.locality || "",
    seatingTheatre: numStr(lead?.seatingTheatre ?? deal.seatingTheatre),
    seatingFloating: numStr(lead?.seatingFloating ?? deal.seatingFloating),
    leadSource: lead?.leadSource ?? "OTHER",
    parking: lead?.parkingAvailable == null ? "" : lead.parkingAvailable ? "yes" : "no",
    referrerName: lead?.referrerName ?? "",
    referrerPhone: lead?.referrerPhone ?? "",
    referrerEmail: lead?.referrerEmail ?? "",
    brokerageDemand: lead?.brokerageDemand ?? "",
    notes: lead?.notes ?? "",
    // Commercials. These used to live on their own "Economics & Model" tab.
    // They are still what the stage gates, the contract's pre-fill and the
    // HallOwner revenue share read, so they stay editable — here, next to the
    // rest of the deal, rather than on a tab of their own.
    model: (deal.model ?? "MANAGEMENT") as AcqDealModel,
    baseFeePct: numStr(deal.baseFeePct),
    incentivePct: numStr(deal.incentivePct),
    royaltyPct: numStr(deal.royaltyPct),
    termYears: numStr(deal.termYears),
    lockinYears: numStr(deal.lockinYears),
    projectedFeeValue: numStr(deal.projectedFeeValue),
    expectedMonthlyEvents: numStr(deal.expectedMonthlyEvents),
    // The venue's own numbers — never economics, they just happened to share
    // that form, and this is their only editor.
    ownerCurrentMonthlyRevenue: numStr(deal.ownerCurrentMonthlyRevenue),
    avgEventsPerMonth: numStr(deal.avgEventsPerMonth),
    peakRateCard: numStr(deal.peakRateCard),
    banquetSizeSft: numStr(deal.banquetSizeSft),
  };
}

function DetailsEditDialog({
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
  const lead = deal.lead ?? null;
  const [f, setF] = useState(() => detailsFormState(deal));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setF(detailsFormState(deal));
  }, [open, deal]);

  const set = <K extends keyof ReturnType<typeof detailsFormState>>(
    k: K,
    v: ReturnType<typeof detailsFormState>[K]
  ) => setF((p) => ({ ...p, [k]: v }));

  const toInt = (s: string) => (s.trim() === "" ? null : Math.trunc(Number(s)));
  // Blank → null, and anything non-finite (a lone "-", "1e") → null too, so a
  // NaN never reaches a Decimal column.
  const numOrNull = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  // termYears / lockinYears / banquetSizeSft are Int? columns — Prisma rejects a
  // decimal, so truncate rather than let "3.5" throw.
  const intOrNull = (s: string): number | null => {
    const n = numOrNull(s);
    return n == null ? null : Math.trunc(n);
  };

  async function save() {
    if (!f.ownerName.trim() || !f.propertyName.trim()) {
      toast.error("Owner and property name are required.");
      return;
    }
    setBusy(true);
    try {
      // 1) Deal snapshot — logged in the change log.
      const dealRes = await editAcqDealOverview(deal.id, {
        ownerName: f.ownerName.trim(),
        ownerType: f.ownerType,
        propertyName: f.propertyName.trim(),
        propertyType: f.propertyType,
        city: f.city.trim(),
        locality: f.locality.trim(),
        seatingTheatre: toInt(f.seatingTheatre),
        seatingFloating: toInt(f.seatingFloating),
      });
      if (!dealRes.success) {
        toast.error(dealRes.error);
        return;
      }
      // 2) The commercials. A separate action because updateAcqDeal is the one
      //    that change-logs them and re-runs the BD-Head floor check; it also
      //    re-validates server-side, so this form never has the last word.
      const commercialsRes = await updateAcqDeal(deal.id, {
        model: f.model,
        baseFeePct: numOrNull(f.baseFeePct),
        incentivePct: numOrNull(f.incentivePct),
        royaltyPct: numOrNull(f.royaltyPct),
        termYears: intOrNull(f.termYears),
        lockinYears: intOrNull(f.lockinYears),
        projectedFeeValue: numOrNull(f.projectedFeeValue),
        expectedMonthlyEvents: numOrNull(f.expectedMonthlyEvents),
        ownerCurrentMonthlyRevenue: numOrNull(f.ownerCurrentMonthlyRevenue),
        avgEventsPerMonth: numOrNull(f.avgEventsPerMonth),
        peakRateCard: numOrNull(f.peakRateCard),
        banquetSizeSft: intOrNull(f.banquetSizeSft),
      });
      if (!commercialsRes.success) {
        toast.error(`Details saved, but the commercials didn't update: ${commercialsRes.error}`);
        onMutate();
        return;
      }
      // 3) The lead record — the fields the deal snapshot doesn't carry.
      if (lead) {
        const leadRes = await editAcqLead(lead.id, {
          ownerName: f.ownerName.trim(),
          mobilePrimary: f.mobilePrimary.trim(),
          mobileAlternate: f.mobileAlternate.trim(),
          email: f.email.trim(),
          propertyName: f.propertyName.trim(),
          propertyType: f.propertyType as never,
          city: f.city.trim(),
          locality: f.locality.trim(),
          seatingTheatre: toInt(f.seatingTheatre),
          seatingFloating: toInt(f.seatingFloating),
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
        if (!leadRes.success) {
          toast.error(`Deal saved, but the lead record didn't update: ${leadRes.error}`);
          onMutate();
          return;
        }
      }
      toast.success("Details updated");
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
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>
            Owner, property and contact details. Changes are logged for the team.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormSection title="Owner" />
          <div className="space-y-1.5"><Label>Owner name</Label><Input value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Owner type</Label>
            <Select value={f.ownerType} onValueChange={(v) => set("ownerType", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ACQ_OWNER_TYPE.map((o) => (<SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          {lead && (
            <>
              <div className="space-y-1.5"><Label>Primary phone</Label><Input value={f.mobilePrimary} onChange={(e) => set("mobilePrimary", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Alternate phone</Label><Input value={f.mobileAlternate} onChange={(e) => set("mobileAlternate", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Lead source</Label>
                <Select value={f.leadSource} onValueChange={(v) => set("leadSource", v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACQ_LEAD_SOURCE.map((o) => (<SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </>
          )}

          <FormSection title="Property" />
          <div className="space-y-1.5"><Label>Property name</Label><Input value={f.propertyName} onChange={(e) => set("propertyName", e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Property type</Label>
            <Select value={f.propertyType} onValueChange={(v) => set("propertyType", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ACQ_PROPERTY_TYPE.map((o) => (<SelectItem key={o} value={o}>{o.replaceAll("_", " ")}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>City</Label><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Locality</Label><Input value={f.locality} onChange={(e) => set("locality", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Seating — theatre</Label><Input inputMode="numeric" value={f.seatingTheatre} onChange={(e) => set("seatingTheatre", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Seating — floating</Label><Input inputMode="numeric" value={f.seatingFloating} onChange={(e) => set("seatingFloating", e.target.value)} /></div>
          {lead && (
            <>
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

              <FormSection title="Referral & notes (optional)" />
              <div className="space-y-1.5"><Label>Referrer name</Label><Input value={f.referrerName} onChange={(e) => set("referrerName", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Referrer phone</Label><Input value={f.referrerPhone} onChange={(e) => set("referrerPhone", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Referrer email</Label><Input value={f.referrerEmail} onChange={(e) => set("referrerEmail", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Brokerage demand</Label><Input value={f.brokerageDemand} onChange={(e) => set("brokerageDemand", e.target.value)} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Lead notes</Label><Textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            </>
          )}

          <FormSection title="Commercials" />
          <div className="space-y-1.5">
            <Label>Commercial model</Label>
            <Select value={f.model} onValueChange={(v) => set("model", v as AcqDealModel)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACQ_DEAL_MODEL.map((m) => (<SelectItem key={m} value={m}>{ACQ_DEAL_MODEL_LABEL[m]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {/* Each model is gated on its own terms at PROPOSAL_SENT and WON, so
              only that model's fields are offered. */}
          {f.model === "MANAGEMENT" && (
            <>
              <NumField label="Base fee %" value={f.baseFeePct} onChange={(v) => set("baseFeePct", v)} />
              <NumField label="Incentive %" value={f.incentivePct} onChange={(v) => set("incentivePct", v)} />
            </>
          )}
          {f.model === "FRANCHISE" && (
            <NumField label="Royalty %" value={f.royaltyPct} onChange={(v) => set("royaltyPct", v)} />
          )}
          <NumField label="Term (years)" value={f.termYears} onChange={(v) => set("termYears", v)} />
          <NumField label="Lock-in (years)" value={f.lockinYears} onChange={(v) => set("lockinYears", v)} />
          <NumField label="Projected fee value" value={f.projectedFeeValue} onChange={(v) => set("projectedFeeValue", v)} />
          <NumField label="Expected monthly events" value={f.expectedMonthlyEvents} onChange={(v) => set("expectedMonthlyEvents", v)} />

          <FormSection title="Venue numbers" />
          <NumField label="Owner current monthly revenue" value={f.ownerCurrentMonthlyRevenue} onChange={(v) => set("ownerCurrentMonthlyRevenue", v)} />
          <NumField label="Avg events / month" value={f.avgEventsPerMonth} onChange={(v) => set("avgEventsPerMonth", v)} />
          <NumField label="Peak rate card" value={f.peakRateCard} onChange={(v) => set("peakRateCard", v)} />
          <NumField label="Venue size (sqft)" value={f.banquetSizeSft} onChange={(v) => set("banquetSizeSft", v)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      {warn && <p className="text-meta text-amber-700">{warn}</p>}
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

const EVAL_HIGH_LABELS = "Capacity, Parking, Condition and Location";
const EVAL_MIN_PHOTOS = 8;
const EVAL_DEFAULT_SCORES: Record<string, number> = {
  capacityScore: 3,
  parkingScore: 3,
  kitchenScore: 3,
  roomsScore: 3,
  conditionScore: 3,
  locationScore: 3,
  avAmenitiesScore: 3,
};

function EvalStepHeader({
  n,
  title,
  met,
  hint,
}: {
  n: number;
  title: string;
  met: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-px flex size-6 shrink-0 items-center justify-center rounded-full text-meta font-semibold",
          met ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
        )}
      >
        {met ? <CheckCircle2 className="size-3.5" /> : n}
      </span>
      <div className="min-w-0">
        <p className="text-body font-medium text-foreground">{title}</p>
        {hint && <p className="text-detail text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Evaluation as three plain steps: score the site → add photos → mark done.
 * Everything needed to finish evaluation is on this one tab, including the
 * "done" button itself (it calls the same guarded transition as the stage
 * panel — no bypass). Before evaluation starts the tab says how to start it;
 * after it is done the tab shows the result and tucks the scorecard away.
 */
function EvaluationTab({
  deal,
  passThreshold,
  onMutate,
}: {
  deal: AcqDealDetail;
  passThreshold: number;
  onMutate: () => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(EVAL_DEFAULT_SCORES);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [rescoring, setRescoring] = useState(false);

  const photos = deal.attachments.filter((a) => a.kind === "PHOTO");
  const photosOk = photos.length >= EVAL_MIN_PHOTOS;
  // Newest first (server orderBy) — the latest passed card is what counts.
  const passedEval = deal.evaluations.find((e) => e.passed) ?? null;
  const latestEval = deal.evaluations[0] ?? null;

  const notStarted = deal.stage === "QUALIFIED" || deal.stage === "ON_HOLD";
  const inEvaluation = deal.stage === "EVALUATION";
  const done = !notStarted && !inEvaluation;

  // Live preview with the SAME formula the server applies, so "Passes" here
  // always equals "Passed" after submit.
  const preview = computeEvaluation(
    {
      capacityScore: scores.capacityScore,
      parkingScore: scores.parkingScore,
      kitchenScore: scores.kitchenScore,
      roomsScore: scores.roomsScore,
      conditionScore: scores.conditionScore,
      locationScore: scores.locationScore,
      avAmenitiesScore: scores.avAmenitiesScore,
    },
    passThreshold
  );

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
      res.data.passed
        ? `Scorecard saved — ${res.data.totalScore}, passed`
        : `Scorecard saved — ${res.data.totalScore}, below the pass mark`
    );
    setRescoring(false);
    onMutate();
  }

  async function start() {
    setFinishing(true);
    const res = await transitionAcqDeal(deal.id, "EVALUATION");
    setFinishing(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Evaluation started");
    onMutate();
  }

  async function finish() {
    setFinishing(true);
    const res = await transitionAcqDeal(deal.id, "EVALUATION_COMPLETED");
    setFinishing(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Evaluation done — deal moved to Evaluation completed");
    onMutate();
  }

  const scorecard = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {EVAL_CRITERIA.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <span className="text-body text-foreground">{c.label}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={c.label}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = scores[c.key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                    className={cn(
                      "size-7 rounded-md border text-detail tabular-nums transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-detail",
          preview.passed
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        )}
      >
        <span>
          Score <b className="tabular-nums">{preview.totalScore}</b> / 100 —{" "}
          {preview.passed ? "passes" : `needs ${passThreshold}+`}
        </span>
        <span className="text-meta">
          Pass mark: {passThreshold}+, with {EVAL_HIGH_LABELS} each 3 or more.
        </span>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything worth noting about the site (optional)"
        rows={2}
      />
      <div className="flex justify-end gap-2">
        {rescoring && (
          <Button variant="ghost" size="sm" onClick={() => setRescoring(false)} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button onClick={submit} disabled={busy} size="sm">
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Save scorecard
        </Button>
      </div>
    </div>
  );

  const history = deal.evaluations.length > 0 && (
    <div className="space-y-1.5">
      <div className="text-meta uppercase tracking-[0.06em] text-muted-foreground">Scorecard history</div>
      {deal.evaluations.map((ev) => (
        <div
          key={ev.id}
          className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-detail"
        >
          <span className="text-muted-foreground">
            {fmtDate(ev.createdAt)}
            {ev.evaluatedBy?.name ? ` · ${ev.evaluatedBy.name}` : ""}
          </span>
          <span className="flex items-center gap-2">
            <span className="font-medium tabular-nums">Score {ev.totalScore}</span>
            <StatusPill label={ev.passed ? "Passed" : "Below mark"} hue={ev.passed ? "emerald" : "red"} size="xs" />
          </span>
        </div>
      ))}
    </div>
  );

  // ---- Not started yet ----
  if (notStarted) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-body tracking-[-0.01em]">Site evaluation</CardTitle>
            <CardDescription>
              The site visit and scorecard happen in the Evaluation stage. Start it when the team is ready to visit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={start} disabled={finishing}>
              {finishing ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
              Start evaluation
            </Button>
          </CardContent>
        </Card>
        {history && <Card><CardContent className="pt-5">{history}</CardContent></Card>}
      </div>
    );
  }

  // ---- Done ----
  if (done) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-body tracking-[-0.01em]">
              <CheckCircle2 className="size-4 text-emerald-600" /> Evaluation done
            </CardTitle>
            <CardDescription>
              {passedEval
                ? `Score ${passedEval.totalScore} · passed on ${fmtDate(passedEval.createdAt)}${passedEval.evaluatedBy?.name ? ` by ${passedEval.evaluatedBy.name}` : ""} · ${photos.length} photos`
                : `${photos.length} photos on file`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {history}
            {rescoring ? (
              scorecard
            ) : (
              <Button variant="outline" size="sm" onClick={() => setRescoring(true)}>
                Score the site again
              </Button>
            )}
          </CardContent>
        </Card>
        <PhotoGrid deal={deal} photos={photos} onMutate={onMutate} />
        <AttachmentAdder deal={deal} onMutate={onMutate} />
      </div>
    );
  }

  // ---- In evaluation: the three steps ----
  const missing = [
    !passedEval ? "a passed scorecard" : null,
    !photosOk ? `${EVAL_MIN_PHOTOS - photos.length} more photo${EVAL_MIN_PHOTOS - photos.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean) as string[];
  const ready = missing.length === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-body tracking-[-0.01em]">Site evaluation</CardTitle>
          <CardDescription>Three steps. When all three are green, the deal moves on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 — score */}
          <div className="space-y-3">
            <EvalStepHeader
              n={1}
              title="Score the site"
              met={!!passedEval}
              hint={
                passedEval
                  ? `Passed — ${passedEval.totalScore} on ${fmtDate(passedEval.createdAt)}${passedEval.evaluatedBy?.name ? ` by ${passedEval.evaluatedBy.name}` : ""}`
                  : latestEval
                    ? `Last card scored ${latestEval.totalScore} — below the pass mark. Score again after fixes, or mark the deal lost.`
                    : "Rate each item 1 (poor) to 5 (excellent)."
              }
            />
            <div className="pl-8">
              {passedEval && !rescoring ? (
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setRescoring(true)}>
                  Score again
                </Button>
              ) : (
                scorecard
              )}
              {history && <div className="pt-3">{history}</div>}
            </div>
          </div>

          {/* Step 2 — photos */}
          <div className="space-y-3">
            <EvalStepHeader
              n={2}
              title={`Add site photos (${Math.min(photos.length, EVAL_MIN_PHOTOS)}/${EVAL_MIN_PHOTOS})`}
              met={photosOk}
              hint={photosOk ? "Enough photos on file." : `At least ${EVAL_MIN_PHOTOS} photos of the property are needed.`}
            />
          </div>

          {/* Step 3 — done */}
          <div className="space-y-3">
            <EvalStepHeader
              n={3}
              title="Mark evaluation done"
              met={false}
              hint={ready ? "Everything's in place." : `Still needed: ${missing.join(" and ")}.`}
            />
            <div className="pl-8">
              <Button onClick={finish} disabled={!ready || finishing}>
                {finishing ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Mark evaluation done
              </Button>
            </div>
          </div>
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
        <CardTitle className="flex items-center gap-2 text-body tracking-[-0.01em]">
          <Camera className="size-4" /> Photos
          <span className="text-detail font-normal text-muted-foreground">
            {photos.length}/8 required
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {photos.length === 0 ? (
          <p className="text-detail text-muted-foreground">
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
            googleDrive
            onUploaded={upload}
            accept="image/png,image/jpeg,image/webp"
            label="Upload photo"
          />
          <span className="text-detail text-muted-foreground">
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
        <CardTitle className="flex items-center gap-2 text-body tracking-[-0.01em]">
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
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-detail"
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
          <FileUpload googleDrive onUploaded={upload} label="Upload" />
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Negotiation tab
// ------------------------------------------------------------
// ------------------------------------------------------------
// Notes panel — shared by Overview (general notes) and Negotiation (owner asks).
// One form, one list: every human note on the deal, newest first. The system
// edit history is deliberately NOT here — it lives in Overview's Change log
// (see selectChangeLog) so the two can never contradict.
// ------------------------------------------------------------
type DealNoteType = "NEGOTIATION" | "INTERNAL" | "GENERAL";

function DealNotesPanel({
  deal,
  userRole,
  title,
  description,
  defaultType,
  onMutate,
}: {
  deal: AcqDealDetail;
  userRole?: string;
  title: string;
  description?: string;
  defaultType: DealNoteType;
  onMutate: () => void;
}) {
  const [noteType, setNoteType] = useState<DealNoteType>(defaultType);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const canWrite = acqCan(userRole, "lead:write");
  const humanNotes = selectHumanNotes(deal.notes);

  async function add() {
    if (!body.trim()) {
      toast.error("Write the note first.");
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
        <CardTitle className="text-body tracking-[-0.01em]">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {canWrite && (
          <div className="space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a note…"
              rows={3}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Select value={noteType} onValueChange={(v) => setNoteType(v as DealNoteType)}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                  <SelectItem value="INTERNAL">Internal</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={add} disabled={busy || !body.trim()} size="sm">
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                Add note
              </Button>
            </div>
          </div>
        )}

        <div className={cn("space-y-2", canWrite && "border-t border-border/60 pt-3")}>
          {humanNotes.length === 0 ? (
            <p className="text-detail text-muted-foreground">No notes yet.</p>
          ) : (
            humanNotes.map((n) => (
              <div key={n.id} className="rounded-md border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2 pb-1">
                  <StatusPill
                    label={n.noteType}
                    hue={NOTE_TYPE_HUE[n.noteType] ?? "slate"}
                    size="xs"
                  />
                  <span className="text-meta text-muted-foreground">
                    {n.author?.name ?? "—"} · {fmtDate(n.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-detail text-foreground">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------
// Negotiation tab — owner asks + counter-offers, and (once the deal reaches
// negotiation) the pre-contract checks that used to sit on the Contract tab.
// ------------------------------------------------------------
const CONTRACT_PHASE_STAGES: AcqDealStage[] = ["NEGOTIATION", "CONTRACT_SENT", "SIGNED", "WON"];

function NegotiationTab({
  deal,
  userRole,
  onMutate,
}: {
  deal: AcqDealDetail;
  userRole?: string;
  onMutate: () => void;
}) {
  const inContractPhase = CONTRACT_PHASE_STAGES.includes(deal.stage);
  return (
    <div className="space-y-4">
      <DealNotesPanel
        deal={deal}
        userRole={userRole}
        title="Negotiation notes"
        description="Owner asks and counter-offers. Negotiation notes alert BD Head and management."
        defaultType="NEGOTIATION"
        onMutate={onMutate}
      />
      {/* Signatory check, GPA and agreement documents gate the contract stages;
        * with the Contract tab retired they live here, where negotiation ends. */}
      {inContractPhase && !DEAL_CONTRACT_TAB_ENABLED && (
        <ContractTab deal={deal} userRole={userRole} onMutate={onMutate} />
      )}
    </div>
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
      <Label className="text-body">Agreement documents</Label>
      <p className="text-meta text-muted-foreground">
        Upload the owner&apos;s KYC and property papers needed for the agreement.
      </p>
      <div className="space-y-2 pt-1">
        {REQUIRED_DOCS.map((label) => {
          const existing = docs.find((d) => d.label === label);
          return (
            <div key={label} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <span className="flex w-full items-center gap-1.5 text-detail sm:w-52">
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
                  className="text-detail text-primary hover:underline"
                >
                  View uploaded
                </a>
              ) : (
                <FileUpload
                  googleDrive
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
                className="block text-detail text-primary hover:underline"
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
        <CardTitle className="text-body tracking-[-0.01em]">Contract</CardTitle>
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
            <Label className="flex items-center gap-2 text-body">
              <ShieldCheck className="size-4" /> Signatory authority verified
            </Label>
            <p className="text-meta text-muted-foreground">
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
            <FileUpload googleDrive onUploaded={uploadGpa} label="Upload GPA" disabled={savingGpa} />
            {deal.gpaDocumentUrl && (
              <a
                href={deal.gpaDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-detail text-primary hover:underline"
              >
                <CheckCircle2 className="size-3.5 text-emerald-600" /> View uploaded GPA
              </a>
            )}
            {savingGpa && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <ContractDocuments deal={deal} onMutate={onMutate} />

        <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
          <div className="flex items-center gap-2 text-detail text-muted-foreground">
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

        {/* Post-signature hand-off (AlignTeamsPanel) renders on the Overview. */}
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
        <h3 className="text-copy font-semibold text-foreground">Align teams &amp; convert</h3>
      </div>
      <p className="text-detail text-muted-foreground">
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
          <span className="inline-flex items-center gap-1.5 text-detail font-medium text-emerald-700">
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
        <div className="flex items-center gap-1.5 text-meta font-medium uppercase tracking-[0.06em] text-muted-foreground">
          <Users className="size-3.5" /> Introduction meetings
        </div>
        {loadingMeetings ? (
          <p className="text-detail text-muted-foreground">Loading…</p>
        ) : meetings.length === 0 ? (
          <p className="text-detail text-muted-foreground">No meetings scheduled yet.</p>
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
    <li className="rounded-md border border-border/60 bg-background p-2.5 text-detail">
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
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-detail"
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
