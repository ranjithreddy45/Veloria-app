"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, Building2, ClipboardCheck, Calculator,
  ShieldCheck, FileText, Rocket, Lock, Undo2, BadgeCheck, AlertTriangle,
} from "lucide-react";
import {
  requestOpsAudit, approveCapex, rejectCapex, sendCapex,
  acceptHandoff, completeAssessment, recordOwnerApproval, startExecution,
  enterInternalQc, finalGoAhead, reopenProject,
} from "@/actions/projects.actions";
import { PROJECT_PHASES, PROJECT_PHASE_LABEL, PROJECT_PHASE_HINT, phaseIndex } from "@/lib/projects/phases";
import type { CapexInput } from "@/lib/projects/capex-calc";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CapexCalculator } from "./capex-calculator";
import { CapexVersionCard } from "./capex-version-card";
import { SnagBoard } from "./snag-board";
import { WorkflowStepper, type Step } from "./workflow-stepper";
import { ReadinessPanel } from "./readiness-panel";
import { OpsAuditPanel } from "./ops-audit-panel";
import { HandoverPanel } from "./handover-panel";
import { Donut } from "@/components/ui/donut";
import { healthTextClass, phaseHue } from "@/lib/projects/ui";
import { TAB_LIST_SCROLL } from "@/lib/mobile-tabs";

const inr = (n: number | string) => "₹" + Math.round(Number(n)).toLocaleString("en-IN");
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

interface Perms { canUpdate: boolean; canApprove: boolean; canAudit: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ProjectDetail({ project, perms }: { project: any; perms: Perms }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [reopenTo, setReopenTo] = useState<string>("");

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.success) return toast.error(res.error);
      toast.success(ok);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const readiness = project.readinessItems as { id: string; category: string; title: string; standard: string; status: string }[];
  const audit = project.opsAuditItems as { id: string; category: string; title: string; critical: boolean; status: string }[];
  const capexes = project.capexProjections as { id: string; version: number; status: string; totalCapex: string; estimatedWeeks: number; inputsJson: CapexInput; notes: string | null; createdBy?: { name: string | null } }[];
  const signOffs = (project.signOffs ?? []) as { id: string; stage: string; decision: string; comment: string | null; createdAt: string; approver?: { name: string | null } }[];
  const snags = (project.snags ?? []) as Parameters<typeof SnagBoard>[0]["snags"];
  const openCMSnags = snags.filter((s) => ["CRITICAL", "MAJOR"].includes(s.severity) && s.status !== "VERIFIED_CLOSED").length;

  const phase = project.phase as string;
  const idx = phaseIndex(phase);
  const rDone = readiness.filter((r) => r.status === "DONE" || r.status === "NA").length;
  const rPct = readiness.length ? Math.round((rDone / readiness.length) * 100) : 0;
  const readinessPending = readiness.filter((r) => r.status !== "DONE" && r.status !== "NA").length;
  const draftCapex = capexes.find((c) => c.status === "DRAFT");
  const approvedCapex = capexes.find((c) => c.status === "APPROVED" || c.status === "SENT");
  const hasApprovedCapex = !!approvedCapex;

  // Stepper model (Spec A) + the headline gate for the current stage.
  const steps: Step[] = PROJECT_PHASES.map((ph, i) => ({
    key: ph,
    label: PROJECT_PHASE_LABEL[ph],
    status: i < idx ? "complete" : i === idx ? "current" : "upcoming",
  }));
  const stepperGate =
    phase === "EXECUTION" && readiness.length > 0 && readinessPending > 0
      ? `${readinessPending} readiness item${readinessPending === 1 ? "" : "s"} still open — every standard must pass (or be N/A) before Internal QC.`
      : undefined;

  // Stage action(s) for the current phase — each carries its own lock reason.
  function StageAction() {
    if (phase === "HANDOFF") {
      return perms.canUpdate ? (
        <Button disabled={busy === "stage"} onClick={() => run("stage", () => acceptHandoff(project.id), "Handoff accepted — assessment started.")}>
          <BadgeCheck className="h-4 w-4" /> Accept handoff & start
        </Button>
      ) : <Locked text="Waiting for the Projects Manager to accept the handoff." />;
    }
    if (phase === "ASSESSMENT") {
      return perms.canUpdate ? (
        <Button disabled={busy === "stage"} onClick={() => run("stage", () => completeAssessment(project.id), "Assessment complete — CapEx stage.")}>
          <CheckCircle2 className="h-4 w-4" /> Complete assessment & scoping
        </Button>
      ) : <Locked text="The PM is scoping the venue against Veloria standards." />;
    }
    if (phase === "CAPEX") {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Owner approval:</span>
            {project.ownerApproved ? <span className="text-emerald-600">recorded ✓ {fmtDate(project.ownerApprovedAt)}</span> : <span className="text-amber-600">pending</span>}
            {perms.canUpdate && !project.ownerApproved && (
              <Button size="sm" variant="outline" disabled={busy === "owner"} onClick={() => {
                const proof = prompt("Link to the owner's approval proof (optional):") ?? undefined;
                run("owner", () => recordOwnerApproval(project.id, proof || undefined), "Owner approval recorded.");
              }}>Record owner approval</Button>
            )}
          </div>
          {perms.canUpdate && (
            hasApprovedCapex && project.ownerApproved ? (
              <Button disabled={busy === "stage"} onClick={() => run("stage", () => startExecution(project.id), "Execution started.")}>
                <Rocket className="h-4 w-4" /> Start execution / fit-out
              </Button>
            ) : (
              <Locked text={!hasApprovedCapex ? "Build & get the Projects Head to approve a CapEx model first." : "Record the owner's CapEx & timeline approval to start execution."} />
            )
          )}
        </div>
      );
    }
    if (phase === "EXECUTION") {
      return perms.canUpdate ? (
        readinessPending === 0 && readiness.length > 0 ? (
          <Button disabled={busy === "stage"} onClick={() => run("stage", () => enterInternalQc(project.id), "Entered Internal QC.")}>
            <ClipboardCheck className="h-4 w-4" /> Move to Internal QC
          </Button>
        ) : <Locked text={`${readinessPending} readiness item(s) still open — every standard must pass (or be N/A) before Internal QC.`} />
      ) : <Locked text="Fit-out in progress." />;
    }
    if (phase === "INTERNAL_QC") {
      return perms.canUpdate ? (
        <Button disabled={busy === "stage"} onClick={() => run("stage", () => requestOpsAudit(project.id), "Operations notified for the deep audit.")}>
          <ShieldCheck className="h-4 w-4" /> Request Operations deep audit
        </Button>
      ) : <Locked text="PM self-audit (Internal QC) in progress." />;
    }
    if (phase === "OPS_AUDIT") return <Locked text="Operations is running the deep audit — see the Ops Audit tab." />;
    if (phase === "FINAL_GO_AHEAD") {
      return perms.canApprove ? (
        <Button disabled={busy === "stage"} onClick={() => run("stage", () => finalGoAhead(project.id), "Final go-ahead given.")}>
          <Rocket className="h-4 w-4" /> Give final go-ahead
        </Button>
      ) : <Locked text="Awaiting the Projects Head's final go-ahead." />;
    }
    if (phase === "HANDOVER") return <Locked text="Submit & acknowledge the handover report — see the Handover tab." />;
    if (phase === "LIVE") return <p className="text-sm font-medium text-emerald-600">🎉 Venue is live and handed over to Operations & Sales.</p>;
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Back link + venue name + up to three status pills + a 48px readiness
        * donut is far wider than 375px. Both halves wrap, and the title block
        * gets min-w-0 so a long venue name truncates instead of stretching the
        * row past the viewport. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="sm"><a href="/projects"><ArrowLeft className="h-4 w-4" /> Projects</a></Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-4 w-4 shrink-0" /> <span className="truncate">{project.property.propertyName}</span></h1>
            <p className="truncate text-xs text-muted-foreground">{project.property.locality}, {project.property.city}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {project.status === "ON_HOLD" && <StatusPill label="On hold" hue="amber" size="sm" />}
          {project.status === "CANCELLED" && <StatusPill label="Cancelled" hue="rose" size="sm" />}
          <StatusPill label={PROJECT_PHASE_LABEL[phase] ?? phase} hue={phaseHue(phase)} size="sm" />
          <Donut value={rPct} size={48} colorClass={healthTextClass(rPct)} ariaLabel={`Readiness ${rPct}%`} />
        </div>
      </div>

      {/* Stage stepper (Spec A) */}
      <WorkflowStepper stages={steps} currentIndex={idx} gateMessage={stepperGate} />

      {/* Workflow / next action */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-base">Workflow — {PROJECT_PHASE_LABEL[phase]}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{PROJECT_PHASE_HINT[phase]}</p>
          <div className="flex justify-start sm:justify-end">
            <StageAction />
          </div>
          {/* Re-open (Head / Admin), logged — secondary, lower-emphasis row */}
          {perms.canApprove && idx > 0 && phase !== "LIVE" && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">Re-open to</span>
              <Select value={reopenTo} onValueChange={setReopenTo}>
                <SelectTrigger className="h-8 w-48"><SelectValue placeholder="earlier stage" /></SelectTrigger>
                <SelectContent>
                  {PROJECT_PHASES.slice(0, idx).map((ph) => <SelectItem key={ph} value={ph}>{PROJECT_PHASE_LABEL[ph]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" disabled={!reopenTo || busy === "reopen"} onClick={() => {
                const reason = prompt("Reason for re-opening this stage?");
                if (reason) run("reopen", () => reopenProject(project.id, reopenTo, reason), "Stage re-opened.");
              }}><Undo2 className="h-4 w-4" /> Re-open</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="readiness">
        <TabsList className={TAB_LIST_SCROLL}>
          <TabsTrigger value="readiness"><ClipboardCheck className="h-4 w-4" /> Readiness ({rPct}%)</TabsTrigger>
          <TabsTrigger value="capex"><Calculator className="h-4 w-4" /> CapEx</TabsTrigger>
          <TabsTrigger value="snags"><AlertTriangle className="h-4 w-4" /> Snags{openCMSnags > 0 ? ` (${openCMSnags})` : ""}</TabsTrigger>
          <TabsTrigger value="audit"><ShieldCheck className="h-4 w-4" /> Ops Audit</TabsTrigger>
          <TabsTrigger value="handover"><FileText className="h-4 w-4" /> Handover</TabsTrigger>
          <TabsTrigger value="log"><FileText className="h-4 w-4" /> Sign-offs</TabsTrigger>
        </TabsList>

        {/* READINESS (Spec B) */}
        <TabsContent value="readiness">
          <ReadinessPanel
            projectId={project.id}
            items={readiness}
            canUpdate={perms.canUpdate}
            gateMessage={stepperGate}
          />
        </TabsContent>

        {/* CAPEX (Spec D) */}
        <TabsContent value="capex" className="space-y-4">
          {(approvedCapex || capexes[0]) && (
            <Card className="border-0 shadow-card">
              <CardContent className="flex flex-wrap items-end justify-between gap-3 py-4">
                <div>
                  <p className="text-xs text-muted-foreground">{approvedCapex ? "Approved CapEx" : "Latest CapEx (draft)"}</p>
                  <p className="text-2xl font-semibold tabular-nums">{inr((approvedCapex ?? capexes[0]).totalCapex)}</p>
                  <p className="text-xs text-muted-foreground">over {(approvedCapex ?? capexes[0]).estimatedWeeks} weeks · v{(approvedCapex ?? capexes[0]).version}</p>
                </div>
                <StatusPill
                  label={(approvedCapex ?? capexes[0]).status.replace("_", " ")}
                  hue={approvedCapex ? "emerald" : "slate"}
                  size="sm"
                />
              </CardContent>
            </Card>
          )}
          {capexes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">All versions</h3>
              {capexes.map((c) => (
                <CapexVersionCard
                  key={c.id}
                  capex={c}
                  busy={busy === c.id}
                  canApprove={perms.canApprove}
                  canUpdate={perms.canUpdate}
                  onApprove={() => run(c.id, () => approveCapex(c.id), "Approved.")}
                  onReturn={() => {
                    const r = prompt("Reason to return for changes?");
                    if (r) run(c.id, () => rejectCapex(c.id, r), "Returned.");
                  }}
                  onSend={() => {
                    if (confirm(`Email this CapEx projection (v${c.version}, ${inr(c.totalCapex)}) to the owner?`)) {
                      run(c.id, () => sendCapex(c.id, { channel: "EMAIL" }), "Sent to owner.");
                    }
                  }}
                />
              ))}
            </div>
          )}
          {perms.canUpdate && (draftCapex || !approvedCapex) && (
            <Card>
              <CardHeader><CardTitle className="text-base">{draftCapex ? "Edit CapEx draft" : "Build a CapEx projection"}</CardTitle></CardHeader>
              <CardContent>
                <CapexCalculator
                  projectId={project.id}
                  capexId={draftCapex?.id}
                  initialInput={draftCapex?.inputsJson}
                  initialNotes={draftCapex?.notes ?? undefined}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* SNAGS */}
        <TabsContent value="snags" className="space-y-4">
          <SnagBoard projectId={project.id} snags={snags} perms={{ canUpdate: perms.canUpdate, canAudit: perms.canAudit }} />
        </TabsContent>

        {/* OPS AUDIT (Spec F) */}
        <TabsContent value="audit">
          <OpsAuditPanel
            projectId={project.id}
            items={audit}
            canAudit={perms.canAudit}
            phase={phase}
            passedAt={project.opsAuditPassedAt ? fmtDate(project.opsAuditPassedAt) : null}
            passedByName={project.opsAuditBy?.name ?? null}
          />
        </TabsContent>

        {/* HANDOVER (Spec G) */}
        <TabsContent value="handover">
          <HandoverPanel project={project} perms={perms} phase={phase} rPct={rPct} />
        </TabsContent>

        {/* SIGN-OFFS / AUDIT TRAIL */}
        <TabsContent value="log" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Sign-off history</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {signOffs.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No sign-offs recorded yet.</p>
              ) : signOffs.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 border-b py-1.5 text-sm last:border-0">
                  <div>
                    <span className="font-medium">{PROJECT_PHASE_LABEL[s.stage] ?? s.stage}</span>
                    <StatusPill label={s.decision} hue={s.decision === "APPROVED" ? "emerald" : s.decision === "REOPENED" ? "amber" : "rose"} size="xs" className="ml-2" />
                    {s.comment && <span className="block text-xs text-muted-foreground">{s.comment}</span>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.approver?.name ?? "—"} · {fmtDate(s.createdAt)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Locked({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 rounded-lg bg-warning/12 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
      <Lock className="h-3.5 w-3.5 shrink-0" /> {text}
    </p>
  );
}
