"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_HUE } from "@/lib/hr/constants";
import type { EmployeeStatus } from "@prisma/client";

export interface DirectoryRow {
  id: string;
  empCode: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  photoUrl: string | null;
  status: EmployeeStatus;
  legalEntity: { name: string; shortCode: string | null } | null;
  businessVertical: { name: string } | null;
  department: { name: string } | null;
  designation: { name: string } | null;
  reportingManager: { firstName: string; lastName: string } | null;
}

export function DirectoryTable({
  rows, total, page, pageSize,
}: {
  rows: DirectoryRow[]; total: number; page: number; pageSize: number;
}) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function go(p: number) {
    const sp = new URLSearchParams(window.location.search);
    sp.set("page", String(p));
    router.replace(`/people?${sp.toString()}`);
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Employee</TableHead>
            <TableHead className="hidden md:table-cell">Entity</TableHead>
            <TableHead className="hidden lg:table-cell">Vertical</TableHead>
            <TableHead className="hidden lg:table-cell">Department</TableHead>
            <TableHead className="hidden xl:table-cell">Reports to</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const name = `${r.firstName} ${r.lastName}`.trim();
            const initials = `${r.firstName[0] ?? ""}${r.lastName[0] ?? ""}`.toUpperCase();
            return (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => router.push(`/people/${r.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarImage src={r.photoUrl || undefined} alt={name} />
                      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                        {initials || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <Link
                        href={`/people/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-medium hover:underline"
                      >
                        {name}
                      </Link>
                      <div className="truncate text-[12px] text-muted-foreground">
                        {r.empCode}
                        {r.designation?.name ? ` · ${r.designation.name}` : ""}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-[12.5px] text-muted-foreground">
                    {r.legalEntity?.shortCode || r.legalEntity?.name || "—"}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-[13px] text-muted-foreground">
                  {r.businessVertical?.name || "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-[13px] text-muted-foreground">
                  {r.department?.name || "—"}
                </TableCell>
                <TableCell className="hidden xl:table-cell text-[13px] text-muted-foreground">
                  {r.reportingManager ? `${r.reportingManager.firstName} ${r.reportingManager.lastName}` : "—"}
                </TableCell>
                <TableCell>
                  <StatusPill label={EMPLOYEE_STATUS_LABELS[r.status]} hue={EMPLOYEE_STATUS_HUE[r.status]} size="xs" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-[13px] text-muted-foreground">
          <span>
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
