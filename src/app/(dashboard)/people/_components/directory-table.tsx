"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Eye, Copy, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_HUE } from "@/lib/hr/constants";
import { DirectoryExportButton } from "./directory-export-button";
import type { EmployeeStatus } from "@prisma/client";

export interface DirectoryRow {
  id: string;
  empCode: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  phone: string | null;
  dateOfJoining: Date | string | null;
  photoUrl: string | null;
  status: EmployeeStatus;
  legalEntity: { name: string; shortCode: string | null } | null;
  businessVertical: { name: string } | null;
  department: { name: string } | null;
  designation: { name: string } | null;
  reportingManager: { firstName: string; lastName: string } | null;
}

// Column keys that map to the whitelisted server-side sort fields in getEmployees.
type SortKey = "name" | "dateOfJoining" | "status";

function formatJoined(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  // UTC so a DOJ stored at UTC-midnight (@db.Date) never shifts a day.
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "2-digit", month: "short", year: "numeric",
  }).format(d);
}

export function DirectoryTable({
  rows, total, page, pageSize, canWrite,
}: {
  rows: DirectoryRow[]; total: number; page: number; pageSize: number; canWrite: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const sortKey = params.get("sort");
  const sortDir = params.get("dir") === "desc" ? "desc" : "asc";

  function go(p: number) {
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.set("page", String(p));
    router.replace(`/people?${sp.toString()}`);
  }

  // Cycle a header: unsorted → asc → desc → unsorted. Resets to page 1 so the
  // first page reflects the new order. The sort lives in the URL → shareable.
  function toggleSort(key: SortKey) {
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.delete("page");
    if (sortKey !== key) {
      sp.set("sort", key);
      sp.set("dir", "asc");
    } else if (sortDir === "asc") {
      sp.set("sort", key);
      sp.set("dir", "desc");
    } else {
      sp.delete("sort");
      sp.delete("dir");
    }
    router.replace(`/people?${sp.toString()}`);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}`);
    } catch {
      toast.error("Could not copy the employee code.");
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      {/* Toolbar: filtered count + CSV export of the whole filtered set. */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-body text-muted-foreground">
          <span className="numeric font-medium text-foreground">{total}</span>{" "}
          {total === 1 ? "employee" : "employees"}
        </span>
        <DirectoryExportButton />
      </div>

      {/* Desktop / tablet: comfortable table with a sticky header. */}
      <div className="hidden max-h-[70vh] overflow-auto sm:block">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>
                <SortButton label="Employee" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              </TableHead>
              <TableHead className="hidden md:table-cell">Entity</TableHead>
              <TableHead className="hidden lg:table-cell">Vertical</TableHead>
              <TableHead className="hidden lg:table-cell">Department</TableHead>
              <TableHead className="hidden xl:table-cell">Reports to</TableHead>
              <TableHead className="hidden lg:table-cell">
                <SortButton label="Joined" active={sortKey === "dateOfJoining"} dir={sortDir} onClick={() => toggleSort("dateOfJoining")} />
              </TableHead>
              <TableHead>
                <SortButton label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
              </TableHead>
              <TableHead className="w-10 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:py-3.5">
            {rows.map((r) => {
              const name = `${r.firstName} ${r.lastName}`.trim();
              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer card-hover-tint transition-premium"
                  onClick={() => router.push(`/people/${r.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <EmpAvatar row={r} name={name} />
                      <div className="min-w-0">
                        <Link
                          href={`/people/${r.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate text-copy font-medium leading-tight hover:underline"
                        >
                          {name}
                        </Link>
                        <div className="mt-0.5 truncate text-detail text-muted-foreground">
                          <span className="numeric">{r.empCode}</span>
                          {r.designation?.name ? ` · ${r.designation.name}` : ""}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-body text-muted-foreground">
                      {r.legalEntity?.shortCode || r.legalEntity?.name || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-body text-muted-foreground">
                    {r.businessVertical?.name || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-body text-muted-foreground">
                    {r.department?.name || "—"}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-body text-muted-foreground">
                    {r.reportingManager ? `${r.reportingManager.firstName} ${r.reportingManager.lastName}` : "—"}
                  </TableCell>
                  <TableCell className="numeric hidden lg:table-cell text-detail text-muted-foreground whitespace-nowrap">
                    {formatJoined(r.dateOfJoining)}
                  </TableCell>
                  <TableCell>
                    <StatusPill label={EMPLOYEE_STATUS_LABELS[r.status]} hue={EMPLOYEE_STATUS_HUE[r.status]} size="xs" />
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions row={r} canWrite={canWrite} onCopy={copyCode} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards so nothing clips. */}
      <ul className="divide-y sm:hidden">
        {rows.map((r) => {
          const name = `${r.firstName} ${r.lastName}`.trim();
          return (
            <li key={r.id} className="relative">
              <Link
                href={`/people/${r.id}`}
                className="flex items-center gap-3 px-4 py-3.5 pr-12 card-hover-tint transition-premium"
              >
                <EmpAvatar row={r} name={name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-copy font-medium">{name}</span>
                    <StatusPill label={EMPLOYEE_STATUS_LABELS[r.status]} hue={EMPLOYEE_STATUS_HUE[r.status]} size="xs" />
                  </div>
                  <div className="mt-0.5 truncate text-detail text-muted-foreground">
                    <span className="numeric">{r.empCode}</span>
                    {r.designation?.name ? ` · ${r.designation.name}` : ""}
                  </div>
                  <div className="mt-0.5 truncate text-detail text-muted-foreground">
                    {[r.department?.name, r.legalEntity?.shortCode || r.legalEntity?.name]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </Link>
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <RowActions row={r} canWrite={canWrite} onCopy={copyCode} />
              </div>
            </li>
          );
        })}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-body text-muted-foreground">
          <span className="numeric">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => go(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// A header that toggles server-side sort, showing the active direction.
function SortButton({
  label, active, dir, onClick,
}: {
  label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      {!active ? (
        <ArrowUpDown className="size-3 opacity-40" />
      ) : dir === "asc" ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )}
    </button>
  );
}

// Per-row action menu. Non-destructive only.
function RowActions({
  row, canWrite, onCopy,
}: {
  row: DirectoryRow; canWrite: boolean; onCopy: (code: string) => void;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground data-[state=open]:bg-muted"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Actions for ${row.firstName} ${row.lastName}`.trim()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => router.push(`/people/${row.id}`)}>
          <Eye className="size-4" /> View profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCopy(row.empCode)}>
          <Copy className="size-4" /> Copy employee code
        </DropdownMenuItem>
        {canWrite && (
          <DropdownMenuItem onSelect={() => router.push(`/people/${row.id}`)}>
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Shared avatar with photo → initials fallback, used by both layouts.
function EmpAvatar({ row, name }: { row: DirectoryRow; name: string }) {
  const initials = `${row.firstName[0] ?? ""}${row.lastName[0] ?? ""}`.toUpperCase();
  return (
    <Avatar size="sm">
      <AvatarImage src={row.photoUrl || undefined} alt={name} />
      <AvatarFallback className="bg-primary/10 text-meta font-semibold text-primary">
        {initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
