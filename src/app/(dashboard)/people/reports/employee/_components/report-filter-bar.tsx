"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/hr/constants";

type Lookup = { id: string; name: string; shortCode?: string | null };

const ALL = "__all__";

// A shared filter bar for every employee report. Which controls appear is opt-in
// so each report shows only the filters it supports. All state lives in the URL
// so the server re-renders with the filtered data (and the CSV export matches).
export function ReportFilterBar({
  basePath,
  entities,
  departments,
  designations,
  showStatus = true,
  showDateRange = false,
  dateLabel = "Date range",
}: {
  basePath: string;
  entities: Lookup[];
  departments: Lookup[];
  designations: Lookup[];
  showStatus?: boolean;
  showDateRange?: boolean;
  dateLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function push(next: URLSearchParams) {
    const qs = next.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath);
  }

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(Array.from(params.entries()));
    if (value && value !== ALL) sp.set(key, value);
    else sp.delete(key);
    push(sp);
  }

  const active =
    params.get("entity") || params.get("dept") || params.get("desig") ||
    (showStatus && params.get("status")) ||
    (showDateRange && (params.get("from") || params.get("to")));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <FilterSelect
        label="Branch"
        value={params.get("entity") ?? ALL}
        onChange={(v) => setParam("entity", v)}
        options={entities.map((e) => ({ value: e.id, label: e.shortCode || e.name }))}
      />
      <FilterSelect
        label="Department"
        value={params.get("dept") ?? ALL}
        onChange={(v) => setParam("dept", v)}
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
      />
      <FilterSelect
        label="Designation"
        value={params.get("desig") ?? ALL}
        onChange={(v) => setParam("desig", v)}
        options={designations.map((d) => ({ value: d.id, label: d.name }))}
      />
      {showStatus && (
        <FilterSelect
          label="Status"
          value={params.get("status") ?? ALL}
          onChange={(v) => setParam("status", v)}
          options={Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
      )}

      {showDateRange && (
        <div className="flex flex-col gap-1">
          <span className="text-meta font-medium text-muted-foreground">{dateLabel}</span>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={params.get("from") ?? ""}
              onChange={(e) => setParam("from", e.target.value)}
              className="h-9 w-[9.5rem]"
              aria-label="From date"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              value={params.get("to") ?? ""}
              onChange={(e) => setParam("to", e.target.value)}
              className="h-9 w-[9.5rem]"
              aria-label="To date"
            />
          </div>
        </div>
      )}

      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={() => router.replace(basePath)}
        >
          <X className="size-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-meta font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-auto min-w-[8.5rem] gap-1.5">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All {label.toLowerCase()}s</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
