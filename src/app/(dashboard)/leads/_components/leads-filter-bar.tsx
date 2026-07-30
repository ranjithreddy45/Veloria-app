"use client";

// ============================================================
// Leads filter bar — ownership scope + event-date period + creation period +
// status. Writes state to the URL (?scope=&status=&eventFrom=&eventTo=
// &createdFrom=&createdTo=) so the server page re-queries with fresh data.
// Mirrors the BdFilterBar pattern (URL as the single source of filter truth).
//
// The scope toggle is DISPLAY ONLY: `getLeads` re-resolves the scope from the
// signed-in user's role, so hiding "All leads" here is a courtesy, not the guard.
// ============================================================

import { useCallback, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CalendarPlus,
  Inbox,
  Loader2,
  Users,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ViewTabs } from "@/components/ui/view-tabs";

// Sentinel for "no status filter" — a shadcn SelectItem can't take value="".
const ANY_STATUS = "ALL";
// Hall/Property sentinels (same reason — no empty SelectItem value).
const ANY_VENUE = "ALL";
const UNASSIGNED_VENUE = "UNASSIGNED";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ANY_STATUS, label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

// The URL keys this bar owns — cleared together by "Clear filters".
const FILTER_KEYS = [
  "status",
  "venue",
  "eventFrom",
  "eventTo",
  "createdFrom",
  "createdTo",
] as const;

interface Props {
  /** Server-resolved: may this viewer switch to "All leads" / "Unassigned"? */
  canViewAll: boolean;
  /** Server-resolved effective scope (a downgraded "all" shows as "mine"). */
  scope: "mine" | "all" | "unassigned";
  /** Active halls/properties for the venue filter. */
  venues: { id: string; name: string }[];
  /** Ownerless-lead count for the "Unassigned" inbox badge (managers only). */
  unassignedCount?: number;
}

export function LeadsFilterBar({ canViewAll, scope, venues, unassignedCount = 0 }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const status = sp.get("status") ?? ANY_STATUS;
  const venue = sp.get("venue") ?? ANY_VENUE;
  const eventFrom = sp.get("eventFrom") ?? "";
  const eventTo = sp.get("eventTo") ?? "";
  const createdFrom = sp.get("createdFrom") ?? "";
  const createdTo = sp.get("createdTo") ?? "";

  const push = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      startTransition(() =>
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      );
    },
    [sp, pathname, router]
  );

  const filtersActive = FILTER_KEYS.some((k) => !!sp.get(k));

  const clearFilters = () => {
    const cleared: Record<string, string | null> = {};
    for (const k of FILTER_KEYS) cleared[k] = null;
    push(cleared);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm">
      {/* Ownership scope — managers only. Reps always see their own book. */}
      {canViewAll && (
        <ViewTabs
          value={scope}
          // "mine" is the default → clear the param; the other two set it.
          onValueChange={(v) => push({ scope: v === "mine" ? null : v })}
          options={[
            { value: "mine", label: "My leads", icon: User },
            { value: "all", label: "All leads", icon: Users },
            {
              value: "unassigned",
              label:
                unassignedCount > 0 ? `Unassigned (${unassignedCount})` : "Unassigned",
              icon: Inbox,
            },
          ]}
        />
      )}

      {/* Status */}
      <Select
        value={status}
        onValueChange={(v) => push({ status: v === ANY_STATUS ? null : v })}
      >
        <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Hall / Property (preferred venue) */}
      <Select
        value={venue}
        onValueChange={(v) => push({ venue: v === ANY_VENUE ? null : v })}
      >
        <SelectTrigger className="h-9 w-[180px]" aria-label="Filter by hall / property">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_VENUE}>All halls / properties</SelectItem>
          <SelectItem value={UNASSIGNED_VENUE}>Unassigned</SelectItem>
          {venues.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Event date period */}
      <DateRangeField
        icon={<CalendarDays className="size-4 shrink-0 text-muted-foreground" />}
        label="Event"
        from={eventFrom}
        to={eventTo}
        onFrom={(v) => push({ eventFrom: v || null })}
        onTo={(v) => push({ eventTo: v || null })}
      />

      {/* Lead creation period */}
      <DateRangeField
        icon={<CalendarPlus className="size-4 shrink-0 text-muted-foreground" />}
        label="Created"
        from={createdFrom}
        to={createdTo}
        onFrom={(v) => push({ createdFrom: v || null })}
        onTo={(v) => push({ createdTo: v || null })}
      />

      {filtersActive && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground"
          onClick={clearFilters}
        >
          <X className="size-3.5" />
          Clear filters
        </Button>
      )}

      {pending && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// One labelled from → to pair of native date inputs. Values are IST calendar
// days (yyyy-mm-dd); the server turns them into IST-anchored instants.
// ------------------------------------------------------------
function DateRangeField({
  icon,
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  icon: ReactNode;
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[12px] font-medium text-muted-foreground">
        {label}
      </span>
      <Input
        type="date"
        value={from}
        max={to || undefined}
        aria-label={`${label} period from`}
        className="h-9 w-[145px]"
        onChange={(e) => onFrom(e.target.value)}
      />
      <span className="text-sm text-muted-foreground">→</span>
      <Input
        type="date"
        value={to}
        min={from || undefined}
        aria-label={`${label} period to`}
        className="h-9 w-[145px]"
        onChange={(e) => onTo(e.target.value)}
      />
    </div>
  );
}
