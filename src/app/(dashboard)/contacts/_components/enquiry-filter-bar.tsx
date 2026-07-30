"use client";

// ============================================================
// Enquiry filter bar — creation-date range + enquiry status. Writes state to
// the URL (?from=&to=&status=) so the server page re-queries, mirroring the BD
// filter-rail pattern.
// ============================================================

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const status = sp.get("status") ?? ALL_STATUSES;
  const venue = sp.get("venue") ?? ALL_VENUES;
  const isFiltered = !!from || !!to || status !== ALL_STATUSES || venue !== ALL_VENUES;

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

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-card">
      {/* Enquiry creation date range */}
      <div className="flex items-center gap-1.5">
        <CalendarDays className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Created</span>
        <Input
          type="date"
          aria-label="Created from"
          value={from}
          // An empty bound is open-ended, so max/min only clamp when both are set.
          max={to || undefined}
          className="h-9 w-[150px]"
          onChange={(e) => push({ from: e.target.value })}
        />
        <span className="text-sm text-muted-foreground">→</span>
        <Input
          type="date"
          aria-label="Created to"
          value={to}
          min={from || undefined}
          className="h-9 w-[150px]"
          onChange={(e) => push({ to: e.target.value })}
        />
      </div>

      {/* Enquiry status */}
      <Select value={status} onValueChange={(v) => push({ status: v === ALL_STATUSES ? null : v })}>
        <SelectTrigger className="h-9 w-[170px]" aria-label="Enquiry status filter">
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
        <SelectTrigger className="h-9 w-[190px]" aria-label="Hall / Property filter">
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

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground"
          onClick={() => push({ from: null, to: null, status: null, venue: null })}
        >
          <X className="size-3.5" /> Clear
        </Button>
      )}

      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
