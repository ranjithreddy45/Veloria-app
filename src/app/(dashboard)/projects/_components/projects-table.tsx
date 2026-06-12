"use client";

import Link from "next/link";
import { StatusPill } from "@/components/shared/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROJECT_PHASE_LABEL } from "@/lib/projects/phases";

export interface ProjectRow {
  id: string;
  phase: string;
  property: { propertyName: string; city: string; locality: string; status: string } | null;
  projectManager: { name: string | null } | null;
  targetReadyDate: string | null;
  readinessPct: number;
  launchedAt: string | null;
}

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No venue projects yet. A project is created automatically when the BD team closes (wins) a deal.
      </div>
    );
  }
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Venue</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead className="text-right">Readiness</TableHead>
            <TableHead>Project Manager</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                <Link href={`/projects/${r.id}`} className="hover:underline">{r.property?.propertyName ?? "—"}</Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{r.property ? `${r.property.locality}, ${r.property.city}` : "—"}</TableCell>
              <TableCell>
                <StatusPill label={PROJECT_PHASE_LABEL[r.phase] ?? r.phase} hue={r.phase === "LAUNCHED" ? "emerald" : "amber"} size="xs" />
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.readinessPct}%</TableCell>
              <TableCell>{r.projectManager?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
