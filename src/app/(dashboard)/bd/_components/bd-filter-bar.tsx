"use client";

// ============================================================
// BD filter bar — timeline preset + custom range + employee multiselect.
// Styled as pill dropdowns matching the reference image.
// Writes state to the URL (?range=&from=&to=&emp=) so the server
// page re-renders with fresh data. Shared by BD dashboard & reports.
// ============================================================

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays, Users, Check, ChevronDown, Loader2, RotateCcw, Building2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ── Range options ────────────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { value: "day",    label: "Today"          },
  { value: "week",   label: "This week"      },
  { value: "month",  label: "This month"     },
  { value: "fy",     label: "Financial year" },
  { value: "custom", label: "Custom range"   },
];

/** Derive a short period suffix like "· Sep 2026" to show inside the pill */
function periodSuffix(rangeKey: string, from: string, to: string): string {
  const now = new Date();
  if (rangeKey === "day")    return `· ${format(now, "d MMM yyyy")}`;
  if (rangeKey === "week")   return `· ${format(now, "MMM yyyy")}`;
  if (rangeKey === "month")  return `· ${format(now, "MMM yyyy")}`;
  if (rangeKey === "fy") {
    const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `· FY ${yr}–${String(yr + 1).slice(2)}`;
  }
  if (rangeKey === "custom" && from) {
    try {
      const f = format(new Date(from), "d MMM");
      const t = to ? format(new Date(to), "d MMM") : "…";
      return `· ${f} – ${t}`;
    } catch { return ""; }
  }
  return "";
}

// ── Shared pill button style ─────────────────────────────────────────────────
const PILL =
  "inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[13px] font-medium text-white/80 transition-all hover:bg-white/[0.09] cursor-pointer select-none outline-none ring-0 focus:outline-none focus:ring-0 border-0";

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  employees: { id: string; name: string }[];
}

export function BdFilterBar({ employees }: Props) {
  const router           = useRouter();
  const pathname         = usePathname();
  const sp               = useSearchParams();
  const [pending, start] = useTransition();

  const range = sp.get("range") ?? "month";
  const from  = sp.get("from") ?? "";
  const to    = sp.get("to")   ?? "";
  const selectedEmp = useMemo(
    () => new Set((sp.get("emp") ?? "").split(",").filter(Boolean)),
    [sp],
  );

  const [rangeOpen, setRangeOpen] = useState(false);
  const [empOpen,   setEmpOpen  ] = useState(false);

  const push = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      start(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [sp, pathname, router],
  );

  const toggleEmp = (id: string) => {
    const next = new Set(selectedEmp);
    if (next.has(id)) next.delete(id); else next.add(id);
    push({ emp: [...next].join(",") || null });
  };

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "This month";
  const suffix     = periodSuffix(range, from, to);

  const empLabel =
    selectedEmp.size === 0
      ? "All employees"
      : selectedEmp.size === 1
        ? employees.find((e) => selectedEmp.has(e.id))?.name ?? "1 selected"
        : `${selectedEmp.size} employees`;

  const isFiltered = range !== "month" || selectedEmp.size > 0 || from || to;

  return (
    <div className="flex flex-wrap items-center gap-2">

      {/* ── Date range pill ─────────────────────────────────── */}
      <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={PILL}>
            <CalendarDays className="size-3.5 text-white/50 shrink-0" />
            <span>{rangeLabel}{suffix && <span className="text-white/50"> {suffix}</span>}</span>
            <ChevronDown className="size-3.5 text-white/40 shrink-0 ml-0.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-48 p-1.5 rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl"
        >
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                push({ range: o.value, ...(o.value !== "custom" ? { from: null, to: null } : {}) });
                setRangeOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/[0.07]",
                range === o.value ? "text-white font-semibold" : "text-white/60",
              )}
            >
              {o.label}
              {range === o.value && <Check className="size-3.5 text-indigo-400" />}
            </button>
          ))}

          {/* Custom date inputs */}
          {range === "custom" && (
            <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
              <Input
                type="date"
                value={from}
                className="h-8 text-xs bg-white/5 border-white/10 text-white"
                onChange={(e) => push({ from: e.target.value })}
              />
              <Input
                type="date"
                value={to}
                className="h-8 text-xs bg-white/5 border-white/10 text-white"
                onChange={(e) => push({ to: e.target.value })}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* ── Employee pill ────────────────────────────────────── */}
      <Popover open={empOpen} onOpenChange={setEmpOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={PILL}>
            <Users className="size-3.5 text-white/50 shrink-0" />
            <span className="max-w-[160px] truncate">{empLabel}</span>
            {selectedEmp.size > 0 && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                {selectedEmp.size}
              </span>
            )}
            <ChevronDown className="size-3.5 text-white/40 shrink-0 ml-0.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-60 p-1.5 rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl"
        >
          {/* All employees */}
          <button
            type="button"
            onClick={() => { push({ emp: null }); setEmpOpen(false); }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/[0.07]",
              selectedEmp.size === 0 ? "text-white font-semibold" : "text-white/60",
            )}
          >
            All employees
            {selectedEmp.size === 0 && <Check className="size-3.5 text-indigo-400" />}
          </button>
          <div className="my-1 h-px bg-white/[0.07]" />
          <div className="max-h-64 overflow-y-auto">
            {employees.length === 0 && (
              <p className="px-3 py-3 text-center text-xs text-white/40">No BD executives yet</p>
            )}
            {employees.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => toggleEmp(e.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.07]"
              >
                <span className="truncate">{e.name}</span>
                {selectedEmp.has(e.id) && <Check className="size-3.5 text-indigo-400 shrink-0" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>



      {/* ── Reset ────────────────────────────────────────────── */}
      {isFiltered && (
        <button
          type="button"
          onClick={() => push({ range: null, from: null, to: null, emp: null })}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-white/50 transition-colors hover:text-white/80 hover:bg-white/[0.05]"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </button>
      )}

      {pending && <Loader2 className="size-3.5 animate-spin text-white/40" />}
    </div>
  );
}
