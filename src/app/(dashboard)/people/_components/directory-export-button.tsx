"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { getEmployees } from "@/actions/hr-employee.actions";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/hr/constants";
import type { EmployeeStatus } from "@prisma/client";

// Columns exported, in order. Matches the directory grid's meaningful fields.
const HEADERS = [
  "Emp Code", "Name", "Designation", "Department",
  "Branch/Entity", "Email", "Mobile", "DOJ", "Status",
];

// Format a @db.Date / DateTime as a calendar date in UTC so a DOJ stored at
// UTC-midnight never slips to the previous day in a behind-UTC timezone.
function utcDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10); // yyyy-mm-dd, already UTC
}

// Shape of the rows getEmployees returns (only the fields we export).
type ExportRow = {
  empCode: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  phone: string | null;
  status: EmployeeStatus;
  dateOfJoining: Date | string | null;
  legalEntity: { name: string; shortCode: string | null } | null;
  department: { name: string } | null;
  designation: { name: string } | null;
};

export function DirectoryExportButton() {
  const params = useSearchParams();
  const [busy, setBusy] = React.useState(false);

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    try {
      // Rebuild the CURRENTLY-FILTERED query from the URL (page is intentionally
      // ignored — export spans every page of the filtered set, not just the one
      // on screen). Sort order is preserved so the file matches the view.
      const base = {
        search: params.get("q") ?? undefined,
        legalEntityId: params.get("entity") ?? undefined,
        businessVerticalId: params.get("vertical") ?? undefined,
        departmentId: params.get("dept") ?? undefined,
        designationId: params.get("desig") ?? undefined,
        status: params.get("status") ?? undefined,
        sortBy: params.get("sort") ?? undefined,
        sortOrder: params.get("dir") ?? undefined,
      };

      const pageSize = 100;
      const all: ExportRow[] = [];
      let page = 1;
      // Page through the server action until every filtered row is collected.
      // Hard-capped so a runaway dataset can't loop forever.
      for (let guard = 0; guard < 200; guard++) {
        const res = await getEmployees({ ...base, page, pageSize });
        all.push(...(res.rows as unknown as ExportRow[]));
        if (all.length >= res.total || res.rows.length === 0) break;
        page += 1;
      }

      if (all.length === 0) {
        toast.info("No employees match the current filters.");
        return;
      }

      const rows = all.map((r) => [
        r.empCode,
        `${r.firstName} ${r.lastName}`.trim(),
        r.designation?.name ?? "",
        r.department?.name ?? "",
        r.legalEntity?.shortCode || r.legalEntity?.name || "",
        r.workEmail ?? "",
        r.phone ?? "",
        utcDate(r.dateOfJoining),
        EMPLOYEE_STATUS_LABELS[r.status] ?? r.status,
      ]);

      const csv = toCSV(HEADERS, rows);
      downloadCSV(`people-directory-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success(`Exported ${all.length} employee${all.length === 1 ? "" : "s"}.`);
    } catch {
      toast.error("Could not export the directory. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      onClick={handleExport}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
      ) : (
        <Download className="mr-1.5 size-3.5" />
      )}
      {busy ? "Exporting…" : "Export CSV"}
    </Button>
  );
}
