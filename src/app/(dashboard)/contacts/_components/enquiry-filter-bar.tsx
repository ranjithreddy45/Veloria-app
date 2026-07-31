"use client";

// ============================================================
// Enquiry filter bar — creation-date range + enquiry status. Writes state to
// the URL (?from=&to=&status=) so the server page re-queries, mirroring the BD
// filter-rail pattern.
//
// MOBILE LAYOUT — mirrors LeadsFilterBar: below `md` the rail collapses to a
// single "Filters" button with an active-count badge that opens a bottom sheet.
// The controls are declared ONCE (`controls`) and rendered into whichever
// container the breakpoint reveals, so the two layouts cannot drift apart.
// ============================================================

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Loader2, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ENQUIRY_STATUS_OPTIONS } from "./enquiry-status";

const ALL_STATUSES = "ALL";
const ALL_VENUES = "ALL";
const UNASSIGNED_VENUE = "UNASSIGNED";

export function EnquiryFilterBar({
  venues,
}: {
  /** Active halls/properties for the assignment filter. */
  venues: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const status = sp.get("status") ?? ALL_STATUSES;
  const venue = sp.get("venue") ?? ALL_VENUES;
  const activeCount =
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (status !== ALL_STATUSES ? 1 : 0) +
    (venue !== ALL_VENUES ? 1 : 0);
  const isFiltered = activeCount > 0;

  const push = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      startTransition(() =>
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      );
    },
    [sp, pathname, router]
  );

  const clearAll = () =>
    push({ from: null, to: null, status: null, venue: null });

  const controls = (
    <>
      {/* Enquiry creation date range. Two 150px inputs + label + arrow is
          ~370px — wider than a 375px phone, so the label moves onto its own
          line below `md` and the inputs share the row. */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Created</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="Created from"
            value={from}
            // An empty bound is open-ended, so max/min only clamp when both are set.
            max={to || undefined}
            className="h-9 w-full min-w-0 flex-1 md:w-[150px] md:flex-none"
            onChange={(e) => push({ from: e.target.value })}
          />
          <span className="shrink-0 text-sm text-muted-foreground">→</span>
          <Input
            type="date"
            aria-label="Created to"
            value={to}
            min={from || undefined}
            className="h-9 w-full min-w-0 flex-1 md:w-[150px] md:flex-none"
            onChange={(e) => push({ to: e.target.value })}
          />
        </div>
      </div>

      {/* Enquiry status */}
      <Select value={status} onValueChange={(v) => push({ status: v === ALL_STATUSES ? null : v })}>
        <SelectTrigger className="h-9 w-full md:w-[170px]" aria-label="Enquiry status filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
          {ENQUIRY_STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Hall / Property */}
      <Select value={venue} onValueChange={(v) => push({ venue: v === ALL_VENUES ? null : v })}>
        <SelectTrigger className="h-9 w-full md:w-[190px]" aria-label="Hall / Property filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VENUES}>All halls / properties</SelectItem>
          <SelectItem value={UNASSIGNED_VENUE}>Unassigned</SelectItem>
          {venues.map((v) => (
            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <>
      {/* Mobile: one "Filters" button + a bottom sheet holding the controls. */}
      <div className="flex items-center gap-2 md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex-1 justify-start">
              <SlidersHorizontal className="size-4" />
              Filters
              {isFiltered && (
                <span className="numeric ml-auto rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
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
              <SheetTitle>Filter enquiries</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-5">{controls}</div>
            <div className="flex gap-2 px-5 pb-5">
              {isFiltered && (
                <Button variant="outline" className="flex-1" onClick={clearAll}>
                  <X className="size-3.5" /> Clear all
                </Button>
              )}
              <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                Show results
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        {isFiltered && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear filters"
            className="shrink-0 text-muted-foreground"
            onClick={clearAll}
          >
            <X className="size-4" />
          </Button>
        )}
        {pending && (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Desktop: the original inline rail, unchanged. */}
      <div className="hidden flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-card md:flex">
        {controls}

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground"
            onClick={clearAll}
          >
            <X className="size-3.5" /> Clear
          </Button>
        )}

        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
    </>
  );
}
