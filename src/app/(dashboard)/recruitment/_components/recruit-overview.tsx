"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  CircleDot,
  Users,
  Sparkles,
  Loader2,
  Timer,
  UserCheck,
  Workflow,
} from "lucide-react";
import { seedRecruitDemo } from "@/actions/recruit.actions";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Dashboard = {
  pipeline: {
    id: string;
    postingTitle: string;
    department: string | null;
    positions: number;
    counts: Record<string, number>;
  }[];
  stages: string[];
  timeToFill: { avg: number | null; rows: { id: string; title: string; days: number }[] };
  timeToHire: { avg: number | null; rows: { id: string; candidate: string; job: string; days: number }[] };
  totals: { openings: number; activeOpenings: number; applications: number };
};

// Short labels + soft tints per stage chip.
const STAGE_META: Record<string, { label: string; chip: string }> = {
  SCREENING: { label: "Screening", chip: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  SUBMISSIONS: { label: "Submissions", chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" },
  INTERVIEW: { label: "Interview", chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  OFFERED: { label: "Offered", chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
  HIRED: { label: "Hired", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  REJECTED: { label: "Rejected", chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
  ARCHIVED: { label: "Archived", chip: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" },
};

function stageLabel(stage: string) {
  return STAGE_META[stage]?.label ?? stage.charAt(0) + stage.slice(1).toLowerCase();
}

function StageChip({ stage, count }: { stage: string; count: number }) {
  if (!count) return <span className="text-xs text-muted-foreground/60 tabular-nums">—</span>;
  const meta = STAGE_META[stage];
  return (
    <span
      className={cn(
        "inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
        meta?.chip ?? "bg-muted text-foreground",
      )}
    >
      {count}
    </span>
  );
}

export function RecruitOverview({
  data,
  canWrite,
}: {
  data: Dashboard | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);

  async function loadDemo() {
    setSeeding(true);
    try {
      const res = await seedRecruitDemo();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Demo loaded — ${res.data.openings} openings, ${res.data.candidates} candidates, ${res.data.applications} applications.`,
      );
      router.refresh();
    } finally {
      setSeeding(false);
    }
  }

  const isEmpty = !data || data.pipeline.length === 0;

  if (isEmpty) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-0">
          <EmptyState
            icon={<Workflow className="size-5" />}
            title="No openings yet"
            description={
              canWrite
                ? "Load a realistic demo pipeline to explore the hiring board, time-to-fill and time-to-hire."
                : "Once your team posts openings and adds candidates, the hiring pipeline will appear here."
            }
            tone="neutral"
            action={
              canWrite ? (
                <Button size="sm" disabled={seeding} onClick={loadDemo}>
                  {seeding ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Load demo data
                </Button>
              ) : undefined
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Open positions"
          value={data.totals.openings}
          accent="indigo"
          icon={<Briefcase className="size-4" />}
          sub="Across all departments"
        />
        <StatTile
          label="Active openings"
          value={data.totals.activeOpenings}
          accent="blue"
          icon={<CircleDot className="size-4" />}
          sub="In progress right now"
        />
        <StatTile
          label="Total applications"
          value={data.totals.applications}
          accent="violet"
          icon={<Users className="size-4" />}
          sub="Candidates in pipeline"
        />
      </div>

      {/* Hiring pipeline */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="size-4 text-indigo-500" />
            Hiring Pipeline
          </CardTitle>
          <CardDescription>
            Candidates per stage for every open posting.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px] pl-6">Posting</TableHead>
                  {data.stages.map((s) => (
                    <TableHead key={s} className="whitespace-nowrap text-center">
                      {stageLabel(s)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pipeline.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6">
                      <div className="font-medium leading-tight">{row.postingTitle}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {row.department ?? "—"}
                        {row.positions > 1 ? ` · ${row.positions} positions` : ""}
                      </div>
                    </TableCell>
                    {data.stages.map((s) => (
                      <TableCell key={s} className="text-center">
                        <StageChip stage={s} count={row.counts[s] ?? 0} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Time-to-fill / Time-to-hire */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="size-4 text-amber-500" />
              Time-to-fill
            </CardTitle>
            <CardDescription>
              {data.timeToFill.avg !== null ? (
                <span className="text-foreground">
                  <span className="text-base font-semibold tabular-nums">
                    {data.timeToFill.avg}
                  </span>{" "}
                  days avg
                </span>
              ) : (
                "No openings filled yet."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {data.timeToFill.rows.length === 0 ? (
              <p className="px-6 pb-6 text-xs text-muted-foreground">
                Once an opening is marked filled, it will show here with its days-to-fill.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Opening</TableHead>
                    <TableHead className="pr-6 text-right">Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.timeToFill.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6 font-medium">{r.title}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{r.days}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="size-4 text-emerald-500" />
              Time-to-hire
            </CardTitle>
            <CardDescription>
              {data.timeToHire.avg !== null ? (
                <span className="text-foreground">
                  <span className="text-base font-semibold tabular-nums">
                    {data.timeToHire.avg}
                  </span>{" "}
                  days avg
                </span>
              ) : (
                "No candidates hired yet."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {data.timeToHire.rows.length === 0 ? (
              <p className="px-6 pb-6 text-xs text-muted-foreground">
                When a candidate reaches the Hired stage, their days-to-hire will show here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Candidate</TableHead>
                    <TableHead className="pr-6 text-right">Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.timeToHire.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6">
                        <div className="font-medium leading-tight">{r.candidate}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{r.job}</div>
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{r.days}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
