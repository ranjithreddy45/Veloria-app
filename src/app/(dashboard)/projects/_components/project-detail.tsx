"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, Building2, ClipboardCheck, Calculator,
  ShieldCheck, FileText, Rocket, Download, Lock, Undo2, BadgeCheck, AlertTriangle,
} from "lucide-react";
import {
  setReadinessItem, setOpsAuditItem, requestOpsAudit, completeOpsAudit,
  generateHandover, launchProject, approveCapex, rejectCapex, sendCapex,
  acceptHandoff, completeAssessment, recordOwnerApproval, startExecution,
  enterInternalQc, finalGoAhead, acknowledgeHandover, reopenProject,
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
import { SnagBoard } from "./snag-board";

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

  const readinessByCat = readiness.reduce((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {} as Record<string, typeof readiness>);

  const RSTATUS = ["PENDING", "IN_PROGRESS", "DONE", "NA"];
  const ASTATUS = ["PENDING", "PASS", "FAIL", "NA"];

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><a href="/projects"><ArrowLeft className="h-4 w-4" /> Projects</a></Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-4 w-4" /> {project.property.propertyName}</h1>
            <p className="text-xs text-muted-foreground">{project.property.locality}, {project.property.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.status === "ON_HOLD" && <StatusPill label="On hold" hue="amber" size="sm" />}
          {project.status === "CANCELLED" && <StatusPill label="Cancelled" hue="rose" size="sm" />}
          <StatusPill label={PROJECT_PHASE_LABEL[phase] ?? phase} hue={phase === "LIVE" ? "emerald" : "amber"} size="sm" />
        </div>
      </div>

      {/* Stage stepper */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-1.5 py-3">
          {PROJECT_PHASES.map((ph, i) => {
            const active = i === idx;
            const done = idx > i;
            return (
              <div key={ph} className="flex items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-amber-100 text-amber-700" : done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {PROJECT_PHASE_LABEL[ph]}
                </span>
                {i < PROJECT_PHASES.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Workflow / next action */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Workflow — {PROJECT_PHASE_LABEL[phase]}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{PROJECT_PHASE_HINT[phase]}</p>
          <StageAction />
          {/* Re-open (Head / Admin), logged */}
          {perms.canApprove && idx > 0 && phase !== "LIVE" && (
            <div className="flex items-center gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">Re-open to</span>
              <Select value={reopenTo} onValueChange={setReopenTo}>
                <SelectTrigger className="h-8 w-48"><SelectValue placeholder="earlier stage" /></SelectTrigger>
                <SelectContent>
                  {PROJECT_PHASES.slice(0, idx).map((ph) => <SelectItem key={ph} value={ph}>{PROJECT_PHASE_LABEL[ph]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={!reopenTo || busy === "reopen"} onClick={() => {
                const reason = prompt("Reason for re-opening this stage?");
                if (reason) run("reopen", () => reopenProject(project.id, reopenTo, reason), "Stage re-opened.");
              }}><Undo2 className="h-4 w-4" /> Re-open</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="readiness">
        <TabsList>
          <TabsTrigger value="readiness"><ClipboardCheck className="h-4 w-4" /> Readiness ({rPct}%)</TabsTrigger>
          <TabsTrigger value="capex"><Calculator className="h-4 w-4" /> CapEx</TabsTrigger>
          <TabsTrigger value="snags"><AlertTriangle className="h-4 w-4" /> Snags{openCMSnags > 0 ? ` (${openCMSnags})` : ""}</TabsTrigger>
          <TabsTrigger value="audit"><ShieldCheck className="h-4 w-4" /> Ops Audit</TabsTrigger>
          <TabsTrigger value="handover"><FileText className="h-4 w-4" /> Handover</TabsTrigger>
          <TabsTrigger value="log"><FileText className="h-4 w-4" /> Sign-offs</TabsTrigger>
        </TabsList>

        {/* READINESS */}
        <TabsContent value="readiness" className="space-y-4">
          {Object.entries(readinessByCat).map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader><CardTitle className="text-sm">{cat}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {items.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-3 border-b py-1.5 last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{it.title}</div>
                      <div className="text-xs text-muted-foreground">{it.standard}</div>
                    </div>
                    <Select value={it.status} onValueChange={(v) => run(it.id, () => setReadinessItem(it.id, { status: v }), "Updated.")} disabled={!perms.canUpdate}>
                      <SelectTrigger className="h-8 w-32 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{RSTATUS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* CAPEX */}
        <TabsContent value="capex" className="space-y-4">
          {capexes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">CapEx projections</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {capexes.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div>
                      <span className="font-medium">v{c.version}</span> · <span className="tabular-nums">{inr(c.totalCapex)}</span> · {c.estimatedWeeks} wks
                      <StatusPill label={c.status.replace("_", " ")} hue={c.status === "APPROVED" || c.status === "SENT" ? "emerald" : c.status === "PENDING_APPROVAL" ? "amber" : "slate"} size="xs" className="ml-2" />
                    </div>
                    <div className="flex gap-2">
                      {(c.status === "APPROVED" || c.status === "SENT") && (
                        <Button asChild variant="outline" size="sm"><a href={`/api/projects/capex/${c.id}/pdf`} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /> PDF</a></Button>
                      )}
                      {c.status === "PENDING_APPROVAL" && perms.canApprove && (
                        <>
                          <Button size="sm" disabled={busy === c.id} onClick={() => run(c.id, () => approveCapex(c.id), "Approved.")}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
                          <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => { const r = prompt("Reason to return for changes?"); if (r) run(c.id, () => rejectCapex(c.id, r), "Returned."); }}>Return</Button>
                        </>
                      )}
                      {(c.status === "APPROVED" || c.status === "SENT") && perms.canUpdate && (
                        <Button size="sm" disabled={busy === c.id} onClick={() => run(c.id, () => sendCapex(c.id, { channel: "EMAIL" }), "Sent to owner.")}>Send to owner</Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
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

        {/* OPS AUDIT */}
        <TabsContent value="audit" className="space-y-4">
          {audit.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                The Operations deep audit checklist appears once the PM requests the audit (after Internal QC).
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="space-y-1.5 py-3">
                  {audit.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-3 border-b py-1.5 last:border-0">
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">{it.title}</span>
                        {it.critical && <span className="ml-2 text-[10px] font-semibold uppercase text-rose-600">critical</span>}
                        <span className="block text-xs text-muted-foreground">{it.category}</span>
                      </div>
                      <Select value={it.status} onValueChange={(v) => run(it.id, () => setOpsAuditItem(it.id, { status: v }), "Updated.")} disabled={!perms.canAudit}>
                        <SelectTrigger className="h-8 w-28 shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{ASTATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {perms.canAudit && !project.opsAuditPassedAt && phase === "OPS_AUDIT" && (
                <Button disabled={busy === "complete"} onClick={() => run("complete", () => completeOpsAudit(project.id), "Audit signed off.")}>
                  <CheckCircle2 className="h-4 w-4" /> Sign off audit (all critical passed)
                </Button>
              )}
              {project.opsAuditPassedAt && <p className="text-sm text-emerald-600">✓ Operations audit passed {fmtDate(project.opsAuditPassedAt)}{project.opsAuditBy?.name ? ` · ${project.opsAuditBy.name}` : ""}.</p>}
            </>
          )}
        </TabsContent>

        {/* HANDOVER */}
        <TabsContent value="handover" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Handover & Launch</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Readiness" value={`${rPct}%`} />
              <Row label="Ops audit" value={project.opsAuditPassedAt ? "Passed ✓" : "Pending"} />
              <Row label="Final go-ahead" value={project.finalGoAheadAt ? `Given ✓ ${fmtDate(project.finalGoAheadAt)}` : "Pending"} />
              <Row label="Handover report" value={project.handoverReportAt ? `Submitted ✓ ${fmtDate(project.handoverReportAt)}` : "Not yet"} />
              <Row label="Operations acknowledgement" value={project.opsAcknowledgedAt ? `Acknowledged ✓ ${fmtDate(project.opsAcknowledgedAt)}` : "Pending"} />
              <Row label="Management acknowledgement" value={project.mgmtAcknowledgedAt ? `Acknowledged ✓ ${fmtDate(project.mgmtAcknowledgedAt)}` : "Pending"} />
              <div className="flex flex-wrap gap-2 pt-2">
                {project.handoverReportAt && (
                  <Button asChild variant="outline"><a href={`/api/projects/${project.id}/handover/pdf`} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /> Handover report PDF</a></Button>
                )}
                {perms.canUpdate && phase === "HANDOVER" && project.finalGoAheadAt && !project.handoverReportAt && (
                  <Button disabled={busy === "handover"} onClick={() => run("handover", () => generateHandover(project.id), "Handover submitted to Ops & Management.")}>
                    <FileText className="h-4 w-4" /> Submit handover report
                  </Button>
                )}
                {perms.canAudit && project.handoverReportAt && !project.opsAcknowledgedAt && (
                  <Button variant="outline" disabled={busy === "ackops"} onClick={() => run("ackops", () => acknowledgeHandover(project.id, "OPS"), "Ops acknowledged.")}>Acknowledge (Operations)</Button>
                )}
                {perms.canApprove && project.handoverReportAt && !project.mgmtAcknowledgedAt && (
                  <Button variant="outline" disabled={busy === "ackmgmt"} onClick={() => run("ackmgmt", () => acknowledgeHandover(project.id, "MGMT"), "Management acknowledged.")}>Acknowledge (Management)</Button>
                )}
                {perms.canApprove && phase === "HANDOVER" && project.handoverReportAt && project.opsAcknowledgedAt && project.mgmtAcknowledgedAt && (
                  <Button disabled={busy === "launch"} onClick={() => run("launch", () => launchProject(project.id), "Venue launched — Sales notified!")}>
                    <Rocket className="h-4 w-4" /> Launch venue
                  </Button>
                )}
                {phase === "LIVE" && <p className="text-sm font-medium text-emerald-600">🎉 Venue is launched and live for Sales.</p>}
              </div>
            </CardContent>
          </Card>
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
  return <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="h-3.5 w-3.5" /> {text}</p>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
