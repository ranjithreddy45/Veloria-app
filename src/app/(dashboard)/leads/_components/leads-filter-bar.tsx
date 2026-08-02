"use client";

// ============================================================
// Leads filter bar — ownership scope + event-date period + creation period +
// status. Writes state to the URL (?scope=&status=&eventFrom=&eventTo=
// &createdFrom=&createdTo=) so the server page re-queries with fresh data.
// Mirrors the BdFilterBar pattern (URL as the single source of filter truth).
//
// The scope toggle is DISPLAY ONLY: `getLeads` re-resolves the scope from the
// signed-in user's role, so hiding "All leads" here is a courtesy, not the guard.
//
// MOBILE LAYOUT — four controls (status, venue, two date ranges) add up to well
// over 900px, so below `md` the rail collapses to a single "Filters" button with
// an active-count badge that opens a bottom sheet. The controls themselves are
// declared ONCE (`controls` below) and rendered into whichever container the
// breakpoint reveals, so the two layouts can never drift apart. Every control
// carries `w-full md:w-[…]` — full-width and thumb-sized inside the sheet, the
// original fixed width in the desktop rail.
// ============================================================

import { useCallback, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CalendarPlus,
  Inbox,
  Loader2,
  SlidersHorizontal,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

  const activeCount = FILTER_KEYS.filter((k) => !!sp.get(k)).length;
  const filtersActive = activeCount > 0;
  const [sheetOpen, setSheetOpen] = useState(false);

  const clearFilters = () => {
    const cleared: Record<string, string | null> = {};
    for (const k of FILTER_KEYS) cleared[k] = null;
    push(cleared);
  };

  // Declared once, rendered into either the sheet (mobile) or the rail
  // (desktop) — only one of the two containers is ever visible.
  const controls = (
    <>
      {/* Status */}
      <Select
        value={status}
        onValueChange={(v) => push({ status: v === ANY_STATUS ? null : v })}
      >
        <SelectTrigger
          className="h-9 w-full md:w-[150px]"
          aria-label="Filter by status"
        >
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
        <SelectTrigger
          className="h-9 w-full md:w-[180px]"
          aria-label="Filter by hall / property"
        >
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
    </>
  );

  // Ownership scope — managers only. Reps always see their own book. This is a
  // view switch, not a filter, so it stays OUT of the mobile sheet and one tap
  // away. Stateless/controlled, so rendering it in both layouts is safe.
  const scopeTabs = canViewAll ? (
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
  ) : null;

  return (
    <div className="space-y-2 md:space-y-0">
      {/* Mobile: the three scope pills are ~300px wide, so they get their own
          snap-scrolling strip rather than pushing the page sideways. */}
      {scopeTabs && (
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {scopeTabs}
        </div>
      )}

      {/* Mobile: one "Filters" button + a bottom sheet holding the controls. */}
      <div className="flex items-center gap-2 md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex-1 justify-start">
              <SlidersHorizontal className="size-4" />
              Filters
              {filtersActive && (
                <span className="numeric ml-auto rounded-full bg-primary/12 px-2 py-0.5 text-meta font-semibold text-primary">
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="pb-0">
              <SheetTitle>Filter leads</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-5">{controls}</div>
            <div className="flex gap-2 px-5 pb-5">
              {filtersActive && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={clearFilters}
                >
                  <X className="size-3.5" />
                  Clear all
                </Button>
              )}
              <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                Show results
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        {filtersActive && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear filters"
            className="shrink-0 text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="size-4" />
          </Button>
        )}
        {pending && (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Desktop: the original inline rail, unchanged (scope pills included). */}
      <div className="hidden flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm md:flex">
        {scopeTabs}
        {controls}

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
  // Two 145px date inputs + label + arrow is ~360px — wider than a 375px
  // viewport before any page padding. On mobile the label moves onto its own
  // line and the two inputs share the row via flex-1/min-w-0; from `md` the
  // original single-row, fixed-width rail returns.
  return (
    <div className="flex flex-col gap-1.5 md:flex-row md:items-center">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-detail font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={from}
          max={to || undefined}
          aria-label={`${label} period from`}
          className="h-9 w-full min-w-0 flex-1 md:w-[145px] md:flex-none"
          onChange={(e) => onFrom(e.target.value)}
        />
        <span className="shrink-0 text-sm text-muted-foreground">→</span>
        <Input
          type="date"
          value={to}
          min={from || undefined}
          aria-label={`${label} period to`}
          className="h-9 w-full min-w-0 flex-1 md:w-[145px] md:flex-none"
          onChange={(e) => onTo(e.target.value)}
        />
      </div>
    </div>
  );
}
