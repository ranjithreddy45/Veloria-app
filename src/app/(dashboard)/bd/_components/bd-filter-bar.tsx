"use client";

// ============================================================
// BD filter bar — timeline preset + custom range + employee multiselect.
// Writes state to the URL (?range=&from=&to=&emp=) so the server page re-renders
// with fresh data. Shared by the BD dashboard and BD reports.
// ============================================================

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Users, Check, ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "fy", label: "Financial year" },
  { value: "custom", label: "Custom range" },
];

interface Props {
  employees: { id: string; name: string }[];
}

export function BdFilterBar({ employees }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const range = sp.get("range") ?? "month";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const selectedEmp = useMemo(() => new Set((sp.get("emp") ?? "").split(",").filter(Boolean)), [sp]);

  const [empOpen, setEmpOpen] = useState(false);

  const push = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [sp, pathname, router]
  );

  const toggleEmp = (id: string) => {
    const next = new Set(selectedEmp);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    push({ emp: [...next].join(",") || null });
  };

  const empLabel =
    selectedEmp.size === 0 ? "All employees" : selectedEmp.size === 1
      ? employees.find((e) => selectedEmp.has(e.id))?.name ?? "1 selected"
      : `${selectedEmp.size} employees`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Timeline */}
      <div className="flex items-center gap-1.5">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <Select value={range} onValueChange={(v) => push({ range: v, ...(v !== "custom" ? { from: null, to: null } : {}) })}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Custom range inputs */}
      {range === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" value={from} className="h-9 w-[150px]" onChange={(e) => push({ from: e.target.value })} />
          <span className="text-muted-foreground text-sm">→</span>
          <Input type="date" value={to} className="h-9 w-[150px]" onChange={(e) => push({ to: e.target.value })} />
        </div>
      )}

      {/* Employee multiselect */}
      <Popover open={empOpen} onOpenChange={setEmpOpen}>
        <PopoverTrigger asChild>
          {/* With exactly one employee picked the label is their full name, which
            * on a 375px screen is wider than the row — truncate rather than let
            * the button push the filter bar past the viewport edge. */}
          <Button variant="outline" className="h-9 max-w-full gap-2">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{empLabel}</span>
            {selectedEmp.size > 0 && <Badge className="ml-1 h-5 px-1.5">{selectedEmp.size}</Badge>}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5">
          <button
            type="button"
            onClick={() => push({ emp: null })}
            className={cn("flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent", selectedEmp.size === 0 && "font-medium")}
          >
            All employees
            {selectedEmp.size === 0 && <Check className="h-4 w-4 text-primary" />}
          </button>
          <div className="my-1 h-px bg-border" />
          <div className="max-h-64 overflow-y-auto">
            {employees.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No BD executives yet</p>}
            {employees.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => toggleEmp(e.id)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span className="truncate">{e.name}</span>
                {selectedEmp.has(e.id) && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
