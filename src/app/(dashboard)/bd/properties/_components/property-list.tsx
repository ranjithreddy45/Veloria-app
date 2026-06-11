"use client";

import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ============================================================
// Types — matches getAcqProperties() serialized shape
// ============================================================

export interface PropertyListItem {
  id: string;
  propertyName: string;
  propertyType: string;
  city: string | null;
  locality: string | null;
  status: string;
  propertyManagerId: string | null;
  propertyManager?: { id: string; name: string | null } | null;
  onboardingProject?: {
    status: "OPEN" | "COMPLETED";
    _count?: { tasks: number };
    tasks: { done: boolean }[];
  } | null;
}

interface PropertyListProps {
  properties: PropertyListItem[];
}

// ============================================================
// Status hue map — shared with detail view
// ============================================================

const STATUS_HUE: Record<
  string,
  "amber" | "emerald" | "blue" | "slate" | "rose"
> = {
  ONBOARDING: "amber",
  AVAILABLE: "emerald",
  ACTIVE: "blue",
  PAUSED: "slate",
  OFF_BOARDED: "rose",
};

const STATUS_LABEL: Record<string, string> = {
  ONBOARDING: "Onboarding",
  AVAILABLE: "Available",
  ACTIVE: "Active",
  PAUSED: "Paused",
  OFF_BOARDED: "Off-boarded",
};

export function PropertyStatusPill({ status }: { status: string }) {
  return (
    <StatusPill
      label={STATUS_LABEL[status] ?? status}
      hue={STATUS_HUE[status] ?? "neutral"}
    />
  );
}

// Compute "X/Y" onboarding progress defensively from the tasks array.
function onboardingProgress(
  project: PropertyListItem["onboardingProject"]
): { done: number; total: number } {
  const tasks = Array.isArray(project?.tasks) ? project!.tasks : [];
  const total = Number(project?._count?.tasks ?? tasks.length) || tasks.length;
  const done = tasks.reduce((acc, t) => acc + (t.done ? 1 : 0), 0);
  return { done, total };
}

function formatType(type: string): string {
  return type
    .split("_")
    .map((w) => (w.length > 0 ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");
}

// ============================================================
// PropertyList
// ============================================================

export function PropertyList({ properties }: PropertyListProps) {
  const router = useRouter();

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <Building2 className="size-6 text-muted-foreground" />
        <p className="text-[13px] font-medium text-foreground">No properties yet</p>
        <p className="max-w-sm text-[12px] text-muted-foreground">
          Acquired venues appear here once a deal is won and onboarding begins.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground">
              Property
            </TableHead>
            <TableHead className="text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground">
              Type
            </TableHead>
            <TableHead className="text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground">
              Manager
            </TableHead>
            <TableHead className="text-right text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground">
              Onboarding
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((p) => {
            const { done, total } = onboardingProgress(p.onboardingProject);
            const place = [p.city, p.locality].filter(Boolean).join(" · ");
            const managerName = p.propertyManager?.name ?? null;
            return (
              <TableRow
                key={p.id}
                onClick={() => router.push(`/bd/properties/${p.id}`)}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-foreground">
                      {p.propertyName}
                    </span>
                    {place && (
                      <span className="text-[12px] text-muted-foreground">{place}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-[12.5px] text-muted-foreground">
                  {formatType(p.propertyType)}
                </TableCell>
                <TableCell>
                  <PropertyStatusPill status={p.status} />
                </TableCell>
                <TableCell className="text-[12.5px]">
                  {managerName ? (
                    <span className="text-foreground">{managerName}</span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-[12.5px] tabular-nums text-muted-foreground">
                  {done}/{total} tasks
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
