"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  CalendarClock,
  BadgeCheck,
  Trophy,
  Plus,
  FileSearch,
  Loader2,
} from "lucide-react";

import {
  createApplication,
  setApplicationStage,
} from "@/actions/recruit.actions";
import { REC_APP_STAGES } from "@/lib/recruit/constants";
import { FacetFilterRail, type FacetDef } from "@/components/shared/facet-filter-rail";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

type Stage =
  | "SCREENING"
  | "SUBMISSIONS"
  | "INTERVIEW"
  | "OFFERED"
  | "HIRED"
  | "REJECTED"
  | "ARCHIVED";

interface App {
  id: string;
  name: string;
  candidateName: string;
  postingTitle: string;
  stage: Stage;
  rating: number | null;
  candidateId: string;
  jobOpeningId: string;
  modifiedAt: string;
}

interface Options {
  users: { id: string; name: string }[];
  openings: { id: string; title: string }[];
  candidates: { id: string; name: string }[];
}

// ============================================================
// Stage metadata
// ============================================================

const STAGE_LABEL: Record<Stage, string> = {
  SCREENING: "Screening",
  SUBMISSIONS: "Submissions",
  INTERVIEW: "Interview",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

const STAGE_HUE: Record<Stage, Hue> = {
  SCREENING: "slate",
  SUBMISSIONS: "slate",
  INTERVIEW: "blue",
  OFFERED: "amber",
  HIRED: "emerald",
  REJECTED: "rose",
  ARCHIVED: "slate",
};

// Ordered pipeline shown in the stepper (terminal stages excluded).
const PIPELINE: Stage[] = ["SCREENING", "SUBMISSIONS", "INTERVIEW", "OFFERED", "HIRED"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ============================================================
// Stage stepper — dots for the ordered pipeline, current one filled.
// ============================================================

function StageStepper({ stage }: { stage: Stage }) {
  if (stage === "REJECTED") return <StatusPill label="Rejected" hue="rose" size="xs" />;
  if (stage === "ARCHIVED") return <StatusPill label="Archived" hue="slate" size="xs" />;

  const idx = PIPELINE.indexOf(stage);
  return (
    <div className="flex items-center gap-1" aria-label={`Stage: ${STAGE_LABEL[stage]}`}>
      {PIPELINE.map((s, i) => {
        const reached = idx >= 0 && i <= idx;
        const current = i === idx;
        return (
          <React.Fragment key={s}>
            <span
              aria-hidden
              title={STAGE_LABEL[s]}
              className={cn(
                "size-2 shrink-0 rounded-full transition-premium",
                current
                  ? "bg-primary ring-2 ring-primary/25"
                  : reached
                    ? "bg-primary/60"
                    : "bg-muted-foreground/25",
              )}
            />
            {i < PIPELINE.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px w-3 shrink-0",
                  idx >= 0 && i < idx ? "bg-primary/50" : "bg-muted-foreground/20",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================
// Inline stage change Select
// ============================================================

function StageSelect({
  app,
  canWrite,
}: {
  app: App;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onChange(next: string) {
    if (next === app.stage) return;
    setPending(true);
    const res = await setApplicationStage(app.id, next);
    setPending(false);
    if (res.success) {
      toast.success(`${app.candidateName} moved to ${STAGE_LABEL[next as Stage] ?? next}`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Select value={app.stage} onValueChange={onChange} disabled={!canWrite || pending}>
      <SelectTrigger size="sm" className="h-8 w-[150px] text-xs">
        {pending ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Updating…
          </span>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>
        {REC_APP_STAGES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {STAGE_LABEL[s as Stage] ?? s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================
// New-application Dialog
// ============================================================

function NewApplicationDialog({ options }: { options: Options }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [candidateId, setCandidateId] = React.useState("");
  const [jobOpeningId, setJobOpeningId] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onSubmit() {
    if (!candidateId || !jobOpeningId) {
      toast.error("Pick a candidate and a job opening.");
      return;
    }
    setPending(true);
    const res = await createApplication(candidateId, jobOpeningId);
    setPending(false);
    if (res.success) {
      toast.success("Application created.");
      setOpen(false);
      setCandidateId("");
      setJobOpeningId("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New application
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New application</DialogTitle>
          <DialogDescription>
            Add a candidate to an open requisition. They&apos;ll start in screening.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Candidate</label>
            <Select value={candidateId} onValueChange={setCandidateId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a candidate" />
              </SelectTrigger>
              <SelectContent>
                {options.candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Job opening</label>
            <Select value={jobOpeningId} onValueChange={setJobOpeningId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a job opening" />
              </SelectTrigger>
              <SelectContent>
                {options.openings.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending || !candidateId || !jobOpeningId}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Main
// ============================================================

export function Applications({
  apps,
  options,
  canWrite,
}: {
  apps: App[];
  options: Options;
  canWrite: boolean;
}) {
  const [filtered, setFiltered] = React.useState<App[]>(apps);
  const onChange = React.useCallback((rows: App[]) => setFiltered(rows), []);

  const counts = React.useMemo(() => {
    const by = (s: Stage) => apps.filter((a) => a.stage === s).length;
    return {
      screening: by("SCREENING") + by("SUBMISSIONS"),
      interviewing: by("INTERVIEW"),
      offered: by("OFFERED"),
      hired: by("HIRED"),
    };
  }, [apps]);

  const facets = React.useMemo<FacetDef<App>[]>(
    () => [
      {
        key: "stage",
        label: "Stage",
        get: (a) => a.stage,
        format: (v) => STAGE_LABEL[v as Stage] ?? v,
      },
      {
        key: "posting",
        label: "Posting",
        get: (a) => a.postingTitle,
        max: 8,
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      {/* StatTiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="In screening"
          value={counts.screening}
          accent="violet"
          icon={<Users className="size-4" />}
        />
        <StatTile
          label="Interviewing"
          value={counts.interviewing}
          accent="blue"
          icon={<CalendarClock className="size-4" />}
        />
        <StatTile
          label="Offered"
          value={counts.offered}
          accent="amber"
          icon={<BadgeCheck className="size-4" />}
        />
        <StatTile
          label="Hired"
          value={counts.hired}
          accent="emerald"
          icon={<Trophy className="size-4" />}
        />
      </div>

      <div className="flex items-center justify-end">
        {canWrite && <NewApplicationDialog options={options} />}
      </div>

      <div className="flex gap-4">
        {/* Faceted filter rail */}
        <div className="hidden lg:block">
          <FacetFilterRail items={apps} facets={facets} onChange={onChange} />
        </div>

        {/* Table */}
        <Card className="flex-1 overflow-hidden p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<FileSearch className="size-5" />}
              title="No applications"
              description={
                apps.length === 0
                  ? "Once candidates start applying to openings, they'll show up here."
                  : "No applications match the current filters. Try clearing a facet."
              }
              action={canWrite && apps.length === 0 ? <NewApplicationDialog options={options} /> : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-wide">Application Name</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Candidate Name</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Application Stage</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide">Change Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="text-[11px] font-medium">
                            {initials(a.candidateName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 truncate text-sm font-medium">{a.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.candidateName}</TableCell>
                    <TableCell>
                      <StageStepper stage={a.stage} />
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={STAGE_LABEL[a.stage]}
                        hue={STAGE_HUE[a.stage]}
                        size="xs"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <StageSelect app={a} canWrite={canWrite} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
