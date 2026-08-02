"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Mail,
  Phone,
  Pencil,
  Building2,
  Users,
} from "lucide-react";
import { HallOwnerStatusPill } from "@/components/shared/status-pill";
import { DotAvatar } from "@/components/shared/dot-avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface OwnerItem {
  id: string;
  ownerName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  propertyCity: string | null;
  numberOfHalls: number | null;
  totalCapacity: number | null;
  commercialModel: string | null;
  revenueSharePercent: number | string | null;
  minimumMonthlyGuarantee: number | string | null;
  contractStatus: string;
  bdOwner: { id: string; name: string | null } | null;
}

const STAGES: { key: string; label: string; dot: string }[] = [
  { key: "PROSPECT", label: "Prospect", dot: "bg-slate-400" },
  { key: "CONTACT_MADE", label: "Contact Made", dot: "bg-blue-500" },
  { key: "SITE_INSPECTION", label: "Site Inspection", dot: "bg-violet-500" },
  { key: "NEGOTIATION", label: "Negotiation", dot: "bg-amber-500" },
  { key: "CONTRACT_DRAFTED", label: "Contract Drafted", dot: "bg-orange-500" },
  { key: "SIGNED", label: "Signed", dot: "bg-teal-500" },
  { key: "ONBOARDED", label: "Onboarded", dot: "bg-emerald-500" },
  { key: "RENEWAL", label: "Renewal", dot: "bg-cyan-500" },
  { key: "CHURNED", label: "Churned", dot: "bg-rose-500" },
];

const MODEL_LABELS: Record<string, string> = {
  REVENUE_SHARE: "Revenue Share",
  FIXED_LEASE: "Fixed Lease",
  HYBRID: "Hybrid",
  MANAGEMENT_FEE: "Management Fee",
};

function commercialText(o: OwnerItem): string | null {
  if (!o.commercialModel) return null;
  const base = MODEL_LABELS[o.commercialModel] ?? o.commercialModel;
  return o.revenueSharePercent != null
    ? `${base} · ${o.revenueSharePercent}%`
    : base;
}

// ============================================================
// Quick actions (hover) — mirrors the Sales CRM leads rows
// ============================================================

function QuickActions({ owner }: { owner: OwnerItem }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-100 [@media(hover:hover)]:opacity-0 transition-opacity group-hover/row:opacity-100">
      {owner.email && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = `mailto:${owner.email}`;
              }}
            >
              <Mail className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-meta">
            Email {owner.email}
          </TooltipContent>
        </Tooltip>
      )}
      {owner.phone && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = `tel:${owner.phone}`;
              }}
            >
              <Phone className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-meta">
            Call {owner.phone}
          </TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              router.push(`/owners/${owner.id}/edit`);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-meta">
          Edit
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ============================================================
// Workspace
// ============================================================

export function OwnersWorkspace({ owners }: { owners: OwnerItem[] }) {
  const [view, setView] = React.useState<"list" | "board">("list");
  const [stage, setStage] = React.useState<string>("ALL");
  const [query, setQuery] = React.useState("");

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: owners.length };
    for (const o of owners) c[o.contractStatus] = (c[o.contractStatus] ?? 0) + 1;
    return c;
  }, [owners]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return owners.filter((o) => {
      if (stage !== "ALL" && o.contractStatus !== stage) return false;
      if (!q) return true;
      return (
        o.ownerName.toLowerCase().includes(q) ||
        (o.companyName ?? "").toLowerCase().includes(q) ||
        (o.propertyCity ?? "").toLowerCase().includes(q)
      );
    });
  }, [owners, stage, query]);

  const TABS = [{ key: "ALL", label: "All", dot: "" }, ...STAGES];

  return (
    <div className="flex flex-col gap-4">
      {/* View toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
          <button
            onClick={() => setView("list")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-detail font-medium transition-colors",
              view === "list"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground/90"
            )}
          >
            <ListIcon className="size-3.5" /> List
          </button>
          <button
            onClick={() => setView("board")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-detail font-medium transition-colors",
              view === "board"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground/90"
            )}
          >
            <LayoutGrid className="size-3.5" /> Funnel
          </button>
        </div>
      </div>

      {view === "list" ? (
        <>
          {/* Stage tabs */}
          <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
            {TABS.map((t) => {
              const active = stage === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setStage(t.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-detail font-medium transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground/90"
                  )}
                >
                  {t.dot && <span className={cn("size-1.5 rounded-full", t.dot)} />}
                  {t.label}
                  <span
                    className={cn(
                      "rounded px-1 text-meta tabular-nums",
                      active
                        ? "bg-background text-foreground/70 ring-1 ring-border"
                        : "text-muted-foreground/70"
                    )}
                  >
                    {counts[t.key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search owners, companies, cities…"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center border-b border-border bg-muted/30 px-3 py-2 text-meta font-medium uppercase tracking-[0.05em] text-muted-foreground">
              <div className="flex-1">Owner</div>
              <div className="hidden w-40 sm:block">Property</div>
              <div className="hidden w-44 md:block">Commercials</div>
              <div className="w-36">Stage</div>
              <div className="hidden w-28 lg:block">BD Owner</div>
              <div className="w-[120px] text-right">Actions</div>
            </div>
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-body text-muted-foreground">
                No owners match.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((o) => (
                  <Link
                    key={o.id}
                    href={`/owners/${o.id}`}
                    className="group/row flex items-center px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <DotAvatar seed={o.id} name={o.ownerName} size="md" />
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-body font-medium text-foreground">
                          {o.ownerName}
                        </p>
                        {o.companyName && (
                          <p className="truncate text-meta text-muted-foreground">
                            {o.companyName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="hidden w-40 text-detail text-muted-foreground sm:block">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3" />
                        {o.propertyCity ?? "—"}
                      </span>
                      {o.numberOfHalls != null && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <Users className="size-3" />
                          {o.numberOfHalls}
                        </span>
                      )}
                    </div>
                    <div className="hidden w-44 text-detail text-foreground/80 md:block">
                      {commercialText(o) ?? "—"}
                    </div>
                    <div className="w-36">
                      <HallOwnerStatusPill status={o.contractStatus} size="xs" />
                    </div>
                    <div className="hidden w-28 lg:block">
                      {o.bdOwner ? (
                        <span className="inline-flex items-center gap-1.5 text-detail text-foreground/85">
                          <DotAvatar
                            seed={o.bdOwner.id}
                            name={o.bdOwner.name}
                            size="xs"
                          />
                          {o.bdOwner.name?.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="text-detail italic text-muted-foreground/60">
                          Unassigned
                        </span>
                      )}
                    </div>
                    <div className="w-[120px]">
                      <QuickActions owner={o} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Funnel board */
        <div className="flex-1 overflow-x-auto pb-3">
          <div className="flex gap-3">
            {STAGES.map((col) => {
              const items = owners.filter((o) => o.contractStatus === col.key);
              return (
                <div
                  key={col.key}
                  className="flex w-[280px] min-w-[280px] flex-col rounded-lg border border-border bg-muted/40"
                >
                  <div className="flex items-center gap-2 rounded-t-lg border-b border-border bg-card/60 px-3 py-2.5">
                    <span className={cn("size-2 rounded-full", col.dot)} />
                    <h3 className="text-detail font-semibold uppercase tracking-[0.04em] text-foreground">
                      {col.label}
                    </h3>
                    <span className="rounded bg-background px-1 text-meta font-medium tabular-nums text-muted-foreground ring-1 ring-border">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 p-2">
                    {items.map((o) => (
                      <Link
                        key={o.id}
                        href={`/owners/${o.id}`}
                        className="block rounded-md border border-border bg-card p-2.5 transition hover:border-primary/40"
                      >
                        <div className="flex items-center gap-2">
                          <DotAvatar seed={o.id} name={o.ownerName} size="xs" />
                          <span className="truncate text-detail font-medium text-foreground">
                            {o.ownerName}
                          </span>
                        </div>
                        {o.companyName && (
                          <p className="mt-1 truncate text-meta text-muted-foreground">
                            {o.companyName}
                          </p>
                        )}
                        {commercialText(o) && (
                          <div className="mt-1.5 text-meta font-medium text-violet-700">
                            {commercialText(o)}
                          </div>
                        )}
                      </Link>
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-md border border-dashed border-border py-6 text-center text-meta text-muted-foreground/60">
                        Empty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
