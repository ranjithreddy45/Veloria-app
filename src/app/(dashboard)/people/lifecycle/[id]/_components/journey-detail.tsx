"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Link2, Copy, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { JOURNEY_TASK_STATUS_LABELS, JOURNEY_TASK_STATUS_HUE } from "@/lib/hr/constants";
import {
  updateJourneyTask, completeJourney, submitExitInterview, createPortalInvite,
} from "@/actions/hr-journey.actions";

interface Task {
  id: string; title: string; category: string; status: string; blocksDay1: boolean;
}
interface Journey {
  id: string; type: string; status: string; targetDate: string | null; reason: string | null;
  tasks: Task[];
  exitInterview: { reason: string | null; feedback: string | null; rating: number | null } | null;
}

export function JourneyDetail({ journey, canWrite }: { journey: Journey; canWrite: boolean }) {
  const router = useRouter();
  const [completing, setCompleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isOnboarding = journey.type === "ONBOARDING";
  const closed = journey.status !== "IN_PROGRESS";
  const grouped = groupByCategory(journey.tasks);

  async function complete() {
    setError(null); setCompleting(true);
    const res = await completeJourney(journey.id);
    setCompleting(false);
    if (!res.success) { setError(res.error); return; }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Checklist by category */}
      {Object.entries(grouped).map(([cat, tasks]) => (
        <div key={cat} className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h3>
          <div className="divide-y">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} canWrite={canWrite && !closed} />
            ))}
          </div>
        </div>
      ))}

      {/* Exit interview (offboarding) */}
      {!isOnboarding && <ExitInterviewCard journeyId={journey.id} existing={journey.exitInterview} canWrite={canWrite && !closed} />}

      {/* Complete / status */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="text-[13px] text-muted-foreground">
          {closed
            ? <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600"><CheckCircle2 className="size-4" /> {isOnboarding ? "Onboarding completed — employee is active." : "Offboarding completed — access revoked."}</span>
            : isOnboarding
              ? "Complete all blocking tasks, then finish onboarding to activate the employee."
              : "Complete all clearance tasks, then finish offboarding to revoke access."}
        </div>
        {canWrite && !closed && (
          <Button onClick={complete} disabled={completing} className="gap-1.5">
            {completing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {isOnboarding ? "Complete onboarding" : "Complete offboarding"}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function groupByCategory(tasks: Task[]): Record<string, Task[]> {
  const out: Record<string, Task[]> = {};
  for (const t of tasks) (out[t.category] ??= []).push(t);
  return out;
}

function TaskRow({ task, canWrite }: { task: Task; canWrite: boolean }) {
  const router = useRouter();
  const [status, setStatus] = React.useState(task.status);
  const [busy, setBusy] = React.useState(false);

  async function change(next: string) {
    setStatus(next); setBusy(true);
    const res = await updateJourneyTask(task.id, next);
    setBusy(false);
    if (!res.success) { toast.error(res.error); return; }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium">{task.title}</span>
          {task.blocksDay1 && <StatusPill label="Blocking" hue="amber" size="xs" />}
        </div>
      </div>
      {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      {canWrite ? (
        <Select value={status} onValueChange={change}>
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(JOURNEY_TASK_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <StatusPill label={JOURNEY_TASK_STATUS_LABELS[status]} hue={JOURNEY_TASK_STATUS_HUE[status] as never} size="xs" />
      )}
    </div>
  );
}

function ExitInterviewCard({
  journeyId, existing, canWrite,
}: {
  journeyId: string; existing: { reason: string | null; feedback: string | null; rating: number | null } | null; canWrite: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState(existing?.reason ?? "");
  const [feedback, setFeedback] = React.useState(existing?.feedback ?? "");
  const [rating, setRating] = React.useState(existing?.rating?.toString() ?? "");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  async function save() {
    setBusy(true); setSaved(false);
    const res = await submitExitInterview(journeyId, { reason, feedback, rating: rating ? Number(rating) : undefined });
    if (!res.success) { setBusy(false); toast.error(res.error); return; }
    setBusy(false); setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Exit interview</h3>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label className="text-[12.5px]">Reason for leaving</Label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} disabled={!canWrite}
              className="h-9 w-full rounded-md border bg-background px-3 text-[13px] outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" /></div>
          <div className="space-y-1.5"><Label className="text-[12.5px]">Overall experience (1–5)</Label>
            <Select value={rating} onValueChange={setRating} disabled={!canWrite}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Rate" /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label className="text-[12.5px]">Feedback</Label>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={!canWrite}
            className="h-24 w-full resize-y rounded-md border bg-background p-3 text-[13px] outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" /></div>
        {canWrite && (
          <Button onClick={save} disabled={busy} size="sm" className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : saved ? <CheckCheck className="size-4" /> : null}
            {saved ? "Saved" : "Save interview"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function PortalInviteButton({ employeeId }: { employeeId: string }) {
  const [busy, setBusy] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function generate() {
    setBusy(true);
    const res = await createPortalInvite(employeeId);
    setBusy(false);
    if (res.success) setLink(`${window.location.origin}/onboard/${res.data.token}`);
  }
  function copy() { if (link) { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } }

  if (link) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={copy}>
        {copied ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Link copied" : "Copy candidate link"}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={generate} disabled={busy}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />} Candidate portal link
    </Button>
  );
}
