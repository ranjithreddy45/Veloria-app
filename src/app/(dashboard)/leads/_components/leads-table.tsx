"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DownloadIcon,
  SparklesIcon,
  MailIcon,
  PhoneIcon,
  CopyIcon,
  GitBranchPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader, getSelectionColumn } from "@/components/shared/data-table";
import { SavedViewSelector, type SavedViewState } from "@/components/shared/saved-view-selector";
import type { SavedViewData } from "@/actions/saved-view.actions";
import {
  BulkActionBar,
  TrashIcon as BulkTrashIcon,
  TagIcon as BulkTagIcon,
} from "@/components/shared/bulk-action-bar";
import { LeadStatusPill, LeadSourcePill } from "@/components/shared/status-pill";
import { FacetFilterRail, type FacetDef } from "@/components/shared/facet-filter-rail";
import { ScoreBar } from "@/components/shared/score-bar";
import { DotAvatar } from "@/components/shared/dot-avatar";
import { LeadsStatStrip } from "./leads-stat-strip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteLead, convertLeadToDeal, updateLeadStatus } from "@/actions/lead.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { bulkDeleteLeads, bulkChangeLeadStatus } from "@/actions/bulk.actions";
import { aiScoreAllLeads } from "@/actions/ai.actions";
import { exportLeads } from "@/actions/export.actions";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

export interface LeadWithContact {
  id: string;
  title: string;
  status: string;
  source: string;
  score: number;
  aiScore: number | null;
  estimatedValue: number | null;
  eventType: string | null;
  eventDate: Date | string | null;
  guestCount: number | null;
  createdAt: Date | string;
  /** Engagement roll-up — see lib/crm/engagement.ts. */
  touchCount?: number;
  lastTouchedAt?: Date | string | null;
  lastTouchKind?: string | null;
  lastTouchedByName?: string | null;
  lastModifiedAt?: Date | string | null;
  lastModifiedByName?: string | null;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

// ============================================================
// Currency formatter — Indian lakh/crore
// ============================================================

function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)} L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)} K`;
  return `₹${v.toLocaleString("en-IN")}`;
}

// ============================================================
// Identity cell — avatar + lead title + contact subtitle
// ============================================================

function IdentityCell({ lead }: { lead: LeadWithContact }) {
  const fullName = `${lead.contact.firstName} ${lead.contact.lastName}`.trim();
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <DotAvatar seed={lead.contact.id} name={fullName} size="md" />
      <div className="min-w-0 leading-tight">
        <Link
          href={`/leads/${lead.id}`}
          className="block truncate text-body font-medium text-foreground hover:underline"
        >
          {lead.title}
        </Link>
        <Link
          href={`/contacts/${lead.contact.id}`}
          className="block truncate text-meta text-muted-foreground hover:text-foreground/80 hover:underline"
        >
          {fullName}
          {lead.eventType ? <span className="ml-1 text-muted-foreground/60">· {lead.eventType}</span> : null}
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Quick actions — shown on row hover
// ============================================================

function QuickActions({ lead }: { lead: LeadWithContact }) {
  const router = useRouter();

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleDelete = async () => {
    const result = await deleteLead(lead.id);
    if (result.success) {
      toast.success("Lead deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleConvert = async () => {
    const result = await convertLeadToDeal(lead.id);
    if (result.success) {
      toast.success(
        result.data.alreadyExisted ? "Lead already has a deal" : "Converted to a deal"
      );
      router.push(`/pipeline?deal=${result.data.dealId}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="flex items-center justify-end gap-0.5 opacity-100 [@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 transition-opacity">
      {lead.contact.email && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `mailto:${lead.contact.email}`;
              }}
            >
              <MailIcon className="size-3.5" />
              <span className="sr-only">Email</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-meta">
            Email {lead.contact.email}
          </TooltipContent>
        </Tooltip>
      )}
      {lead.contact.phone && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${lead.contact.phone}`;
              }}
            >
              <PhoneIcon className="size-3.5" />
              <span className="sr-only">Call</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-meta">
            Call {lead.contact.phone}
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
              e.stopPropagation();
              copy(`${window.location.origin}/leads/${lead.id}`, "Lead link");
            }}
          >
            <CopyIcon className="size-3.5" />
            <span className="sr-only">Copy link</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-meta">
          Copy link
        </TooltipContent>
      </Tooltip>

      <AlertDialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-3.5" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href={`/leads/${lead.id}`}>
                <EyeIcon className="mr-2 size-3.5" />
                Open
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/leads/${lead.id}/edit`}>
                <PencilIcon className="mr-2 size-3.5" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                handleConvert();
              }}
            >
              <GitBranchPlusIcon className="mr-2 size-3.5" />
              Convert to Deal
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <TrashIcon className="mr-2 size-3.5" />
                Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium">{lead.title}</span>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Status segment tabs
// ============================================================

type StatusFilter = "ALL" | "NEW" | "NOT_CONNECTED" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";

const TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "NEW", label: "New" },
  { id: "NOT_CONNECTED", label: "Not Connected" },
  { id: "CONTACTED", label: "Contacted" },
  { id: "QUALIFIED", label: "Qualified" },
  { id: "PROPOSAL_SENT", label: "Proposal" },
  { id: "NEGOTIATION", label: "Negotiation" },
  { id: "WON", label: "Won" },
  { id: "LOST", label: "Lost" },
];

function StatusTabs({
  data,
  active,
  onChange,
}: {
  data: LeadWithContact[];
  active: StatusFilter;
  onChange: (s: StatusFilter) => void;
}) {
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: data.length };
    for (const l of data) {
      c[l.status] = (c[l.status] ?? 0) + 1;
    }
    return c;
  }, [data]);

  return (
    // 8 status chips wrap into a 4-row block on a 375px phone (taller still
    // once the coarse-pointer rule pushes each to 44px). Below `md` they stay
    // on one line inside their own snap-scrolling strip — the page itself never
    // scrolls sideways — and go back to wrapping from `md` up.
    <div
      className="flex snap-x snap-mandatory items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-card [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Lead status filter"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        const n = counts[tab.id] ?? 0;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-detail font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground/90"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "numeric rounded px-1 text-meta font-medium",
                isActive
                  ? "bg-background text-foreground/70 ring-1 ring-border"
                  : "text-muted-foreground/70"
              )}
            >
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Inline status cell — change a lead's status straight from the row (auto-save
// via updateLeadStatus). A trigger styled to look like the status pill; the full
// server-side guards (e.g. Won-needs-owner) still apply and surface as a toast.
// ============================================================

const ROW_STATUSES: Array<{ value: string; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "NOT_CONNECTED", label: "Not Connected" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

function InlineStatusCell({ lead }: { lead: LeadWithContact }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onChange(next: string) {
    if (next === lead.status) return;
    setPending(true);
    try {
      const result = await updateLeadStatus(
        lead.id,
        next as "NEW" | "NOT_CONNECTED" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST"
      );
      if (result.success) {
        toast.success(`Status updated to ${next.replace(/_/g, " ").toLowerCase()}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setPending(false);
    }
  }

  return (
    <Select value={lead.status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        aria-label="Change status"
        className="h-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:opacity-40"
        onClick={(e) => e.stopPropagation()}
      >
        <LeadStatusPill status={lead.status} size="xs" />
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {ROW_STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================
// Columns
// ============================================================

/**
 * "When, and by whom" — used for both Last contacted and Last modified.
 *
 * The two answer different questions (who reached the CUSTOMER vs who edited
 * the RECORD) but read the same way, so they share a cell rather than drifting
 * into two near-identical renderings.
 *
 * A date with no name is shown rather than suppressed: "we know it happened,
 * we don't know who" is honest, and hiding the row would lose the timestamp too.
 */
function ActorCell({
  at,
  who,
  emptyLabel,
}: {
  at?: Date | string | null;
  who?: string | null;
  emptyLabel: string;
}) {
  if (!at) {
    return <span className="text-detail text-muted-foreground/60">{emptyLabel}</span>;
  }
  const d = new Date(at);
  return (
    <div className="min-w-0 leading-tight">
      <div className="whitespace-nowrap text-detail text-foreground">
        {d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
      </div>
      <div className="truncate text-meta text-muted-foreground" title={who ?? undefined}>
        {who ?? "Unknown"}
      </div>
    </div>
  );
}

const columns: ColumnDef<LeadWithContact>[] = [
  getSelectionColumn<LeadWithContact>(),
  {
    id: "identity",
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Lead" />
    ),
    cell: ({ row }) => <IdentityCell lead={row.original} />,
    minSize: 280,
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => <LeadSourcePill source={row.getValue<string>("source")} size="xs" />,
  },
  {
    accessorKey: "eventDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Event" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("eventDate");
      return (
        <span className="numeric text-detail text-foreground/85">
          {date ? format(new Date(date as string), "MMM d, yyyy") : "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "estimatedValue",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Value" />
    ),
    cell: ({ row }) => {
      const v = row.original.estimatedValue;
      return (
        <span className="numeric text-detail font-semibold text-foreground/90">
          {formatCurrency(v ? Number(v) : null)}
        </span>
      );
    },
  },
  {
    accessorKey: "score",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Score" />
    ),
    cell: ({ row }) => <ScoreBar score={row.original.score} />,
  },
  {
    accessorKey: "aiScore",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="AI" />
    ),
    cell: ({ row }) => {
      const v = row.original.aiScore;
      if (v === null || v === undefined) {
        return <span className="text-detail text-muted-foreground/60">—</span>;
      }
      return (
        <div className="inline-flex items-center gap-1.5">
          <SparklesIcon className="size-3 text-primary/70" strokeWidth={2} />
          <ScoreBar score={v} width={44} />
        </div>
      );
    },
  },
  {
    accessorKey: "touchCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Touches" />
    ),
    cell: ({ row }) => {
      const n = row.original.touchCount ?? 0;
      const last = row.original.lastTouchedAt
        ? new Date(row.original.lastTouchedAt)
        : null;

      // Never touched is NOT "0 days ago". It is the strongest signal on this
      // screen — a lead that arrived and was never worked — so it gets its own
      // treatment rather than being rendered as a zero among numbers.
      if (!last) {
        // NOT "Never contacted".
        //
        // This column knows what was LOGGED, which is not the same as what
        // happened. A rep who phoned a lead and moved it to Contacted without
        // writing a note leaves no touch record — and the old label called that
        // person negligent, in red, next to a status saying they had done the
        // job. The screen contradicted itself and blamed the user for it.
        //
        // "Not logged" is the true statement, and it points at the real gap:
        // the work is happening off the record.
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-detail font-medium text-muted-foreground"
            title="No call, note or message has been logged against this lead yet"
          >
            Not logged
          </span>
        );
      }

      const days = Math.floor((Date.now() - last.getTime()) / 86_400_000);
      // Escalating, not alarming: most leads are fine, and colouring all of them
      // would make the column noise. Only silence earns colour.
      const tone =
        days >= 14
          ? "text-destructive"
          : days >= 7
            ? "text-warning"
            : "text-muted-foreground";
      return (
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="numeric font-semibold text-foreground">{n}</span>
          <span className={cn("text-detail", tone)}>
            {days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "lastTouchedByName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last contacted" />
    ),
    cell: ({ row }) => <ActorCell
      at={row.original.lastTouchedAt}
      who={row.original.lastTouchedByName}
      emptyLabel="Not logged"
    />,
  },
  {
    accessorKey: "lastModifiedByName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last modified" />
    ),
    cell: ({ row }) => <ActorCell
      at={row.original.lastModifiedAt}
      who={row.original.lastModifiedByName}
      emptyLabel="—"
    />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <InlineStatusCell lead={row.original} />,
  },
  {
    id: "assignedTo",
    accessorFn: (row) => row.assignedTo?.name ?? "",
    header: "Owner",
    cell: ({ row }) => {
      const a = row.original.assignedTo;
      if (!a) {
        return (
          <span className="text-detail text-muted-foreground/60 italic">
            Unassigned
          </span>
        );
      }
      return (
        <div className="inline-flex items-center gap-1.5">
          <DotAvatar seed={a.id} name={a.name} size="xs" />
          <span className="text-detail text-foreground/85 truncate max-w-[110px]">
            {a.name?.split(" ")[0]}
          </span>
        </div>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <QuickActions lead={row.original} />,
    size: 140,
  },
];

// ============================================================
// Faceted filter rail — derived from existing fields only
// ============================================================

function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const leadFacets: FacetDef<LeadWithContact>[] = [
  {
    key: "status",
    label: "Status",
    get: (l) => l.status,
    format: titleCase,
    max: 8,
  },
  {
    key: "source",
    label: "Source",
    get: (l) => l.source,
    format: titleCase,
  },
  {
    key: "owner",
    label: "Owner",
    get: (l) => l.assignedTo?.name ?? "Unassigned",
  },
];

// ============================================================
// Toolbar buttons
// ============================================================

function AIScoreAllButton() {
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleScoreAll() {
    setLoading(true);
    try {
      const result = await aiScoreAllLeads();
      if (result.success) {
        toast.success(`AI scored ${result.data.updatedCount} leads`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to run AI scoring");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleScoreAll} disabled={loading}>
      <SparklesIcon className="size-3.5" />
      {loading ? "Scoring…" : "AI score all"}
    </Button>
  );
}

function ExportButton() {
  const [loading, setLoading] = React.useState(false);
  const searchParams = useSearchParams();

  async function handleExport() {
    setLoading(true);
    try {
      // Send the SAME filters the URL is showing. Previously this called
      // exportLeads() with nothing, so the file ignored every filter on screen
      // and quietly contained the whole book.
      //
      // Read straight from the URL rather than from component state because the
      // URL is what the server page itself filtered on — anything else would be
      // a second opinion about what the user is looking at.
      const result = await exportLeads({
        scope: (searchParams.get("scope") as "mine" | "all" | "unassigned") ?? "mine",
        status: searchParams.get("status") ?? undefined,
        venueId: searchParams.get("venue") ?? undefined,
        eventFrom: searchParams.get("eventFrom") ?? undefined,
        eventTo: searchParams.get("eventTo") ?? undefined,
        createdFrom: searchParams.get("createdFrom") ?? undefined,
        createdTo: searchParams.get("createdTo") ?? undefined,
        enquirySource: searchParams.get("channel") ?? undefined,
        due: searchParams.get("due") ?? undefined,
      });
      if (result.success) {
        const csv = toCSV(result.data.headers, result.data.rows);
        downloadCSV(`leads-${new Date().toISOString().split("T")[0]}.csv`, csv);
        toast.success("Leads exported");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      <DownloadIcon className="size-3.5" />
      {loading ? "Exporting…" : "Export"}
    </Button>
  );
}

// ============================================================
// Main table component
// ============================================================

interface LeadsTableProps {
  data: LeadWithContact[];
  /**
   * True when the server-side filter bar already narrowed the list to one
   * status. The client status tabs are then hidden: their per-tab counts would
   * all read 0 except the active one, and clicking any other tab would dead-end
   * on an empty table.
   */
  statusFiltered?: boolean;
}

export function LeadsTable({ data, statusFiltered = false }: LeadsTableProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [selectedRows, setSelectedRows] = React.useState<LeadWithContact[]>([]);

  // Post-tab rows feed the facet rail; the rail's output feeds the table.
  // When the server already filtered by status the tabs are hidden, so any
  // leftover local tab state must NOT keep narrowing rows invisibly.
  const filtered = React.useMemo(() => {
    if (statusFiltered || statusFilter === "ALL") return data;
    return data.filter((l) => l.status === statusFilter);
  }, [data, statusFilter, statusFiltered]);

  const [facetFiltered, setFacetFiltered] = React.useState<LeadWithContact[]>(filtered);

  const selectedIds = React.useMemo(
    () => selectedRows.map((r) => r.id),
    [selectedRows]
  );

  const bulkActions = React.useMemo(
    () => [
      {
        id: "mark-contacted",
        label: "Mark contacted",
        icon: BulkTagIcon,
        onClick: async (ids: string[]) => {
          const result = await bulkChangeLeadStatus({ ids, status: "CONTACTED" });
          if (result.success) {
            toast.success(`Updated ${result.data.count} leads`);
            router.refresh();
          } else toast.error(result.error);
        },
      },
      {
        id: "mark-qualified",
        label: "Mark qualified",
        icon: BulkTagIcon,
        onClick: async (ids: string[]) => {
          const result = await bulkChangeLeadStatus({ ids, status: "QUALIFIED" });
          if (result.success) {
            toast.success(`Updated ${result.data.count} leads`);
            router.refresh();
          } else toast.error(result.error);
        },
      },
      {
        id: "mark-won",
        label: "Mark won",
        icon: BulkTagIcon,
        onClick: async (ids: string[]) => {
          const result = await bulkChangeLeadStatus({ ids, status: "WON" });
          if (result.success) {
            toast.success(`Marked ${result.data.count} leads as won`);
            router.refresh();
          } else toast.error(result.error);
        },
      },
      {
        id: "mark-lost",
        label: "Mark lost",
        icon: BulkTagIcon,
        onClick: async (ids: string[]) => {
          const result = await bulkChangeLeadStatus({ ids, status: "LOST" });
          if (result.success) {
            toast.success(`Marked ${result.data.count} leads as lost`);
            router.refresh();
          } else toast.error(result.error);
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: BulkTrashIcon,
        variant: "destructive" as const,
        requireConfirm: true,
        confirmTitle: "Delete leads",
        confirmDescription: `Delete ${selectedRows.length} lead(s)? This cannot be undone.`,
        onClick: async (ids: string[]) => {
          const result = await bulkDeleteLeads({ ids });
          if (result.success) {
            toast.success(`Deleted ${result.data.count} leads`);
            router.refresh();
          } else toast.error(result.error);
        },
      },
    ],
    [router, selectedRows.length]
  );

  // Saved-view integration: expose the current filter to the selector
  // and apply incoming view filters back to local state.
  const getCurrentState = React.useCallback<() => SavedViewState>(() => {
    return {
      filters:
        statusFilter === "ALL"
          ? []
          : [{ field: "status", operator: "equals", value: statusFilter }],
    };
  }, [statusFilter]);

  const handleViewSelect = React.useCallback((view: SavedViewData | null) => {
    if (!view) {
      setStatusFilter("ALL");
      return;
    }
    const statusFilterEntry = (view.filters as Array<{ field: string; value: unknown }>)?.find(
      (f) => f.field === "status"
    );
    if (statusFilterEntry && typeof statusFilterEntry.value === "string") {
      setStatusFilter(statusFilterEntry.value as StatusFilter);
    } else {
      setStatusFilter("ALL");
    }
  }, []);

  return (
    <div className="space-y-4">
      <LeadsStatStrip data={data} />
      {!statusFiltered && (
        <StatusTabs
          data={data}
          active={statusFilter}
          onChange={setStatusFilter}
        />
      )}
      <div className="flex items-start gap-4">
        <FacetFilterRail
          items={filtered}
          facets={leadFacets}
          onChange={setFacetFiltered}
        />
        <div className="min-w-0 flex-1">
          <DataTable
            columns={columns}
            data={facetFiltered}
            searchKey="identity"
            searchPlaceholder="Search leads…"
            enableRowSelection
            onSelectionChange={setSelectedRows}
            getRowId={(row) => row.id}
            toolbarExtra={
              <div className="flex items-center gap-2">
                <SavedViewSelector
                  entityType="LEAD"
                  getCurrentState={getCurrentState}
                  onViewSelect={handleViewSelect}
                />
                <AIScoreAllButton />
                <ExportButton />
              </div>
            }
          />
        </div>
      </div>
      <BulkActionBar
        selectedCount={selectedRows.length}
        selectedIds={selectedIds}
        actions={bulkActions}
        onClearSelection={() => setSelectedRows([])}
      />
    </div>
  );
}
