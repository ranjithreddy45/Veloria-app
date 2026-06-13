"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, Loader2, Building2, ClipboardCheck, Calculator,
  ShieldCheck, FileText, Rocket, Download,
} from "lucide-react";
import {
  setReadinessItem, setOpsAuditItem, requestOpsAudit, completeOpsAudit,
  generateHandover, launchProject, setProjectPhase, approveCapex, rejectCapex, sendCapex,
} from "@/actions/projects.actions";
import { PROJECT_PHASES, PROJECT_PHASE_LABEL } from "@/lib/projects/phases";
import type { CapexInput } from "@/lib/projects/capex-calc";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CapexCalculator } from "./capex-calculator";

const inr = (n: number | string) => "₹" + Math.round(Number(n)).toLocaleString("en-IN");

interface Perms { canUpdate: boolean; canApprove: boolean; canAudit: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ProjectDetail({ project, perms }: { project: any; perms: Perms }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

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

  const rDone = readiness.filter((r) => r.status === "DONE" || r.status === "NA").length;
  const rPct = readiness.length ? Math.round((rDone / readiness.length) * 100) : 0;
  const draftCapex = capexes.find((c) => c.status === "DRAFT");
  const approvedCapex = capexes.find((c) => c.status === "APPROVED" || c.status === "SENT");

  const readinessByCat = readiness.reduce((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {} as Record<string, typeof readiness>);

  const RSTATUS = ["PENDING", "IN_PROGRESS", "DONE", "NA"];
  const ASTATUS = ["PENDING", "PASS", "FAIL", "NA"];

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
        <StatusPill label={PROJECT_PHASE_LABEL[project.phase] ?? project.phase} hue={project.phase === "LAUNCHED" ? "emerald" : "amber"} size="sm" />
      </div>

      {/* Phase stepper */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          {PROJECT_PHASES.map((ph, i) => {
            const active = project.phase === ph;
            const done = (PROJECT_PHASES as readonly string[]).indexOf(project.phase) > i;
            return (
              <div key={ph} className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-amber-100 text-amber-700" : done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {PROJECT_PHASE_LABEL[ph]}
                </span>
                {i < PROJECT_PHASES.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            );
          })}
          {perms.canUpdate && project.phase !== "LAUNCHED" && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Set phase</span>
              <Select value={["PLANNING", "CAPEX", "EXECUTION"].includes(project.phase) ? project.phase : undefined} onValueChange={(v) => run("phase", () => setProjectPhase(project.id, v), "Phase updated.")}>
                <SelectTrigger className="h-8 w-44"><SelectValue placeholder={PROJECT_PHASE_LABEL[project.phase]} /></SelectTrigger>
                <SelectContent>
                  {["PLANNING", "CAPEX", "EXECUTION"].map((ph) => <SelectItem key={ph} value={ph}>{PROJECT_PHASE_LABEL[ph]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="readiness">
        <TabsList>
          <TabsTrigger value="readiness"><ClipboardCheck className="h-4 w-4" /> Readiness ({rPct}%)</TabsTrigger>
          <TabsTrigger value="capex"><Calculator className="h-4 w-4" /> CapEx</TabsTrigger>
          <TabsTrigger value="audit"><ShieldCheck className="h-4 w-4" /> Ops Audit</TabsTrigger>
          <TabsTrigger value="handover"><FileText className="h-4 w-4" /> Handover</TabsTrigger>
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

        {/* OPS AUDIT */}
        <TabsContent value="audit" className="space-y-4">
          {audit.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">When the venue is ready, request the Operations deep audit.</p>
                {perms.canUpdate && (
                  <Button disabled={busy === "req"} onClick={() => run("req", () => requestOpsAudit(project.id), "Operations notified.")}>
                    <ShieldCheck className="h-4 w-4" /> Request Operations audit
                  </Button>
                )}
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
              {perms.canAudit && !project.opsAuditPassedAt && (
                <Button disabled={busy === "complete"} onClick={() => run("complete", () => completeOpsAudit(project.id), "Audit signed off.")}>
                  <CheckCircle2 className="h-4 w-4" /> Sign off audit (all critical passed)
                </Button>
              )}
              {project.opsAuditPassedAt && <p className="text-sm text-emerald-600">✓ Operations audit passed.</p>}
            </>
          )}
        </TabsContent>

        {/* HANDOVER */}
        <TabsContent value="handover" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Handover & Launch</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Readiness</span><span>{rPct}%</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Ops audit</span><span>{project.opsAuditPassedAt ? "Passed ✓" : "Pending"}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Handover report</span><span>{project.handoverReportAt ? "Submitted ✓" : "Not yet"}</span></div>
              <div className="flex flex-wrap gap-2 pt-2">
                {project.handoverReportAt && (
                  <Button asChild variant="outline"><a href={`/api/projects/${project.id}/handover/pdf`} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /> Handover report PDF</a></Button>
                )}
                {perms.canApprove && project.opsAuditPassedAt && !project.handoverReportAt && (
                  <Button disabled={busy === "handover"} onClick={() => run("handover", () => generateHandover(project.id), "Handover submitted to Ops & Management.")}>
                    <FileText className="h-4 w-4" /> Submit handover report
                  </Button>
                )}
                {perms.canApprove && project.handoverReportAt && project.phase !== "LAUNCHED" && (
                  <Button disabled={busy === "launch"} onClick={() => run("launch", () => launchProject(project.id), "Venue launched — Sales notified!")}>
                    <Rocket className="h-4 w-4" /> Give launch go-ahead
                  </Button>
                )}
                {project.phase === "LAUNCHED" && <p className="text-sm font-medium text-emerald-600">🎉 Venue is launched and live for Sales.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
