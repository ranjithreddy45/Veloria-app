import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Briefcase, Users, MapPin, CalendarClock, Star } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getJobOpeningDetail } from "@/actions/recruit.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import {
  APP_STAGE_HUE,
  APP_STAGE_LABEL,
  CANDIDATE_STAGE_HUE,
  CANDIDATE_STAGE_LABEL,
  initialsOf,
  tintFor,
} from "../../candidates/[id]/_components/shared";

export const metadata: Metadata = { title: "Job Opening" };

const STATUS_HUE: Record<string, Hue> = {
  IN_PROGRESS: "blue",
  ON_HOLD: "amber",
  INACTIVE: "slate",
  FILLED: "emerald",
  CANCELLED: "rose",
};
const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  INACTIVE: "Inactive",
  FILLED: "Filled",
  CANCELLED: "Cancelled",
};

export default async function JobOpeningDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "recruit:read")) redirect("/dashboard");

  const detail = await getJobOpeningDetail(id);
  if (!detail) notFound();

  const { opening, candidates } = detail;
  const hired = candidates.filter((c) => c.applicationStage === "HIRED").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <PageHeader title={opening.postingTitle} eyebrow="Recruitment · Job opening" />
        <Button asChild variant="ghost" size="sm">
          <Link href="/recruitment/jobs">
            <ArrowLeft className="size-4" /> Job openings
          </Link>
        </Button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Status"
          value={STATUS_LABEL[opening.status] ?? opening.status}
          accent="blue"
          icon={<Briefcase className="size-4" />}
        />
        <StatTile
          label="Applicants"
          value={candidates.length}
          accent="violet"
          icon={<Users className="size-4" />}
        />
        <StatTile
          label="Hired"
          value={hired}
          accent="emerald"
          icon={<Star className="size-4" />}
        />
        <StatTile
          label="Positions"
          value={opening.numberOfPositions}
          accent="amber"
          icon={<Users className="size-4" />}
        />
      </div>

      {/* Meta strip */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-[13px] text-muted-foreground shadow-card">
        <span className="inline-flex items-center gap-1.5">
          <StatusPill
            label={STATUS_LABEL[opening.status] ?? opening.status}
            hue={STATUS_HUE[opening.status] ?? "slate"}
            size="xs"
          />
        </span>
        {opening.department && (
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="size-3.5" /> {opening.department}
          </span>
        )}
        {opening.city && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {opening.city}
          </span>
        )}
        {opening.targetDate && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" /> Target {formatDate(opening.targetDate)}
          </span>
        )}
        {opening.hiringManager && <span>Hiring manager · {opening.hiringManager}</span>}
        {opening.assignedRecruiter && <span>Recruiter · {opening.assignedRecruiter}</span>}
      </Card>

      {/* Linked candidates */}
      <Card className="overflow-hidden p-0 shadow-card">
        <div className="border-b px-5 py-3.5">
          <h3 className="text-[13px] font-medium text-foreground">
            Candidates{" "}
            <span className="ml-1 tabular-nums text-muted-foreground">
              {candidates.length}
            </span>
          </h3>
        </div>
        {candidates.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No applicants yet"
            description="Candidates linked to this opening (via applications) will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Application Stage</TableHead>
                  <TableHead>Candidate Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.applicationId} className="transition-premium hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback className={cn("text-[10.5px] font-semibold", tintFor(c.id))}>
                            {initialsOf(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 leading-tight">
                          <a
                            href={`/recruitment/candidates/${c.id}`}
                            className="block truncate text-[13px] font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {c.name}
                          </a>
                          {c.email && (
                            <span className="block truncate text-[11.5px] text-muted-foreground">
                              {c.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] text-foreground/80">{c.city || "—"}</TableCell>
                    <TableCell>
                      <StatusPill
                        label={APP_STAGE_LABEL[c.applicationStage] ?? c.applicationStage}
                        hue={APP_STAGE_HUE[c.applicationStage] ?? "neutral"}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        label={CANDIDATE_STAGE_LABEL[c.stage] ?? c.stage}
                        hue={CANDIDATE_STAGE_HUE[c.stage] ?? "neutral"}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
