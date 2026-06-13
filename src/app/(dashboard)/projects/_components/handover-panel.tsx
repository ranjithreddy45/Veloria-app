"use client";

// ============================================================
// HandoverPanel (Spec G) — turns the handover summary into a clear go/no-go
// gate. Each launch prerequisite is a checklist row (icon by state, label,
// value/pill on the right; readiness shows a health-banded mini-bar). A top
// summary shows "X of N ready for launch" + overall bar. The launch button is
// disabled until every prerequisite is met, with a tooltip listing blockers.
// When everything clears, a celebratory ready state shows. API unchanged.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, Download, FileText, Rocket, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { healthBarClass, healthHue } from "@/lib/projects/ui";
import { generateHandover, launchProject, acknowledgeHandover } from "@/actions/projects.actions";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

interface Gate {
  key: string;
  label: string;
  met: boolean;
  node: React.ReactNode; // right-side value/pill
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HandoverPanel({ project, perms, phase, rPct }: { project: any; perms: { canUpdate: boolean; canApprove: boolean; canAudit: boolean }; phase: string; rPct: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

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

  const gates: Gate[] = [
    {
      key: "readiness", label: "Readiness", met: rPct >= 100,
      node: (
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-full rounded-full", healthBarClass(rPct))} style={{ width: `${rPct}%` }} />
          </span>
          <span className="text-xs font-medium tabular-nums">{rPct}%</span>
        </span>
      ),
    },
    {
      key: "audit", label: "Operations audit", met: !!project.opsAuditPassedAt,
      node: <StatusPill label={project.opsAuditPassedAt ? "Passed" : "Pending"} hue={project.opsAuditPassedAt ? "emerald" : "amber"} size="xs" />,
    },
    {
      key: "goahead", label: "Final go-ahead", met: !!project.finalGoAheadAt,
      node: <span className="text-xs text-muted-foreground">{project.finalGoAheadAt ? `Given · ${fmtDate(project.finalGoAheadAt)}` : "Pending"}</span>,
    },
    {
      key: "report", label: "Handover report", met: !!project.handoverReportAt,
      node: <span className="text-xs text-muted-foreground">{project.handoverReportAt ? `Submitted · ${fmtDate(project.handoverReportAt)}` : "Not yet"}</span>,
    },
    {
      key: "opsack", label: "Operations acknowledgement", met: !!project.opsAcknowledgedAt,
      node: <StatusPill label={project.opsAcknowledgedAt ? "Acknowledged" : "Pending"} hue={project.opsAcknowledgedAt ? "emerald" : "amber"} size="xs" />,
    },
    {
      key: "mgmtack", label: "Management acknowledgement", met: !!project.mgmtAcknowledgedAt,
      node: <StatusPill label={project.mgmtAcknowledgedAt ? "Acknowledged" : "Pending"} hue={project.mgmtAcknowledgedAt ? "emerald" : "amber"} size="xs" />,
    },
  ];

  const metCount = gates.filter((g) => g.met).length;
  const allMet = metCount === gates.length;
  const summaryPct = Math.round((metCount / gates.length) * 100);

  const launchBlockers = gates.filter((g) => !g.met).map((g) => g.label);
  const isLive = phase === "LIVE";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Handover &amp; Launch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {isLive ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/40">
            <PartyPopper className="size-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Venue is live &amp; handed over</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Marketing &amp; Sales notified; Operations owns the venue.</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium">{metCount} of {gates.length} ready for launch</span>
              <span className="text-xs tabular-nums text-muted-foreground">{summaryPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-[width] duration-300 ease-out", healthBarClass(summaryPct))} style={{ width: `${summaryPct}%` }} />
            </div>
          </div>
        )}

        {/* Gate rows */}
        <ul className="divide-y rounded-xl border">
          {gates.map((g) => (
            <li key={g.key} className="flex items-center gap-3 px-3 py-2.5">
              {g.met
                ? <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                : <Circle className="size-4 shrink-0 text-muted-foreground/50" />}
              <span className={cn("flex-1 text-sm", g.met ? "font-medium" : "text-muted-foreground")}>{g.label}</span>
              {g.node}
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {project.handoverReportAt && (
            <Button asChild variant="outline">
              <a href={`/api/projects/${project.id}/handover/pdf`} target="_blank" rel="noopener noreferrer">
                <Download className="size-4" /> Handover report PDF
              </a>
            </Button>
          )}
          {perms.canUpdate && phase === "HANDOVER" && project.finalGoAheadAt && !project.handoverReportAt && (
            <Button disabled={busy === "handover"} onClick={() => run("handover", () => generateHandover(project.id), "Handover submitted to Ops & Management.")}>
              <FileText className="size-4" /> Submit handover report
            </Button>
          )}
          {perms.canAudit && project.handoverReportAt && !project.opsAcknowledgedAt && (
            <Button variant="outline" disabled={busy === "ackops"} onClick={() => run("ackops", () => acknowledgeHandover(project.id, "OPS"), "Ops acknowledged.")}>
              Acknowledge (Operations)
            </Button>
          )}
          {perms.canApprove && project.handoverReportAt && !project.mgmtAcknowledgedAt && (
            <Button variant="outline" disabled={busy === "ackmgmt"} onClick={() => run("ackmgmt", () => acknowledgeHandover(project.id, "MGMT"), "Management acknowledged.")}>
              Acknowledge (Management)
            </Button>
          )}

          {/* Launch — gated. Disabled until all prerequisites are met; the
              tooltip names what's still blocking. */}
          {perms.canApprove && phase === "HANDOVER" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={allMet ? -1 : 0} className="ml-auto">
                  <Button
                    disabled={!allMet || busy === "launch"}
                    aria-label={allMet ? "Complete handover and go live" : `Launch blocked: ${launchBlockers.join(", ")} still pending`}
                    onClick={() => run("launch", () => launchProject(project.id), "Venue launched — Sales notified!")}
                    className={cn(!allMet && "pointer-events-none")}
                  >
                    <Rocket className="size-4" /> Complete handover &amp; go live
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {allMet ? "All prerequisites met — ready to launch." : `Still blocking: ${launchBlockers.join(", ")}.`}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {(project.launchedAt || isLive) && (
          <p className="text-xs text-muted-foreground">
            {project.launchedAt ? `Launched ${fmtDate(project.launchedAt)}` : "Launched"}
            {project.launchedBy?.name ? ` · ${project.launchedBy.name}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
