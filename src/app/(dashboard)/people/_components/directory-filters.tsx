"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/hr/constants";

type Lookup = { id: string; name: string; shortCode?: string | null };

const ALL = "__all__";

export function DirectoryFilters({
  entities, verticals, departments, designations,
}: {
  entities: Lookup[]; verticals: Lookup[]; departments: Lookup[]; designations: Lookup[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [search, setSearch] = React.useState(params.get("q") ?? "");

  // Debounced search → URL.
  React.useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(Array.from(params.entries()));
      if (search.trim()) sp.set("q", search.trim());
      else sp.delete("q");
      sp.delete("page");
      router.replace(`/people?${sp.toString()}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(Array.from(params.entries()));
    if (value && value !== ALL) sp.set(key, value);
    else sp.delete(key);
    sp.delete("page");
    router.replace(`/people?${sp.toString()}`);
  }

  const active =
    params.get("q") || params.get("entity") || params.get("vertical") ||
    params.get("dept") || params.get("desig") || params.get("status");

  function clearAll() {
    setSearch("");
    router.replace("/people");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, code, email, phone…"
          className="h-9 pl-8"
        />
      </div>

      <FilterSelect label="Entity" value={params.get("entity") ?? ALL} onChange={(v) => setParam("entity", v)}
        options={entities.map((e) => ({ value: e.id, label: e.shortCode || e.name }))} />
      <FilterSelect label="Vertical" value={params.get("vertical") ?? ALL} onChange={(v) => setParam("vertical", v)}
        options={verticals.map((v) => ({ value: v.id, label: v.name }))} />
      <FilterSelect label="Department" value={params.get("dept") ?? ALL} onChange={(v) => setParam("dept", v)}
        options={departments.map((d) => ({ value: d.id, label: d.name }))} />
      <FilterSelect label="Designation" value={params.get("desig") ?? ALL} onChange={(v) => setParam("desig", v)}
        options={designations.map((d) => ({ value: d.id, label: d.name }))} />
      <FilterSelect label="Status" value={params.get("status") ?? ALL} onChange={(v) => setParam("status", v)}
        options={Object.entries(EMPLOYEE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))} />

      {active && (
        <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={clearAll}>
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
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[8.5rem] gap-1.5">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
