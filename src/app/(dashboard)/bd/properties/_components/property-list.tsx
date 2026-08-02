"use client";

import { useRouter } from "next/navigation";
import { Building2, UserCog } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";

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
  // Originating deal (for row context) + a cover photo pulled from the deal's
  // PHOTO attachments.
  deal?: { id: string; attachments?: { url: string }[] } | null;
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
// PropertyList — card grid: cover photo (or soft gradient placeholder),
// name + place, status pill, manager and onboarding progress.
// ============================================================

export function PropertyList({ properties }: PropertyListProps) {
  const router = useRouter();

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <Building2 className="size-6 text-muted-foreground" />
        <p className="text-body font-medium text-foreground">No properties yet</p>
        <p className="max-w-sm text-detail text-muted-foreground">
          Acquired venues appear here once a deal is won and onboarding begins.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {properties.map((p) => {
        const { done, total } = onboardingProgress(p.onboardingProject);
        const place = [p.city, p.locality].filter(Boolean).join(" · ");
        const managerName = p.propertyManager?.name ?? null;
        const cover = p.deal?.attachments?.[0]?.url ?? null;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => router.push(`/bd/properties/${p.id}`)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-premium transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Cover — deal photo when one exists, else a soft gradient block */}
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={p.propertyName}
                className="h-32 w-full shrink-0 border-b border-border/60 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-32 w-full shrink-0 items-center justify-center border-b border-border/60 bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-fuchsia-500/10">
                <Building2 className="size-7 text-muted-foreground/50" />
              </div>
            )}

            <div className="flex flex-1 flex-col gap-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-body font-semibold tracking-[-0.01em] text-foreground">
                    {p.propertyName}
                  </div>
                  <div className="truncate text-detail text-muted-foreground">
                    {formatType(p.propertyType)}
                    {place ? ` · ${place}` : ""}
                  </div>
                </div>
                <span className="shrink-0">
                  <PropertyStatusPill status={p.status} />
                </span>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-meta text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <UserCog className="size-3.5 shrink-0" />
                  <span className="truncate">{managerName ?? "Unassigned"}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {done}/{total} tasks
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
