import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getHrLookups } from "@/actions/hr-employee.actions";
import { getDojReport, type ReportFilters } from "@/actions/hr-report-employee.actions";
import { guardEmployeeReports } from "../_components/guard";
import { ReportFilterBar } from "../_components/report-filter-bar";
import { ReportExportButton } from "../_components/report-export-button";
import { EmployeeStatusPill } from "../_components/status-pill";

export const metadata: Metadata = { title: "Date of Joining Report" };

const BASE = "/people/reports/employee/doj";
const HEADERS = ["Emp Code", "Name", "Department", "Designation", "Branch", "DOJ", "Tenure", "Status"];

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function DojReport({ searchParams }: PageProps) {
  await guardEmployeeReports();
  const sp = await searchParams;
  const filters: ReportFilters = { entity: sp.entity, dept: sp.dept, desig: sp.desig, status: sp.status };

  const [lookups, { rows }] = await Promise.all([
    getHrLookups(),
    getDojReport(filters, sp.from, sp.to),
  ]);

  const exportRows = rows.map((r) => [
    r.empCode, r.name, r.department, r.designation, r.branch, r.dateOfJoining, r.tenure, r.status,
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CalendarPlus}
        accent="emerald"
        eyebrow="People · Reports"
        title="Date of Joining"
        description="Joiners with tenure to date. Filter by a joining-date range, branch, department, designation or status."
      >
        <ReportExportButton filename="employee-joiners" headers={HEADERS} rows={exportRows} />
      </PageHeader>

      <ReportFilterBar
        basePath={BASE}
        entities={lookups.entities}
        departments={lookups.departments}
        designations={lookups.designations}
        showDateRange
        dateLabel="Joining date"
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>DOJ</TableHead>
                <TableHead className="text-right">Tenure</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No joiners match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.empCode}>
                    <TableCell className="font-mono text-xs">{r.empCode}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.department || "—"}</TableCell>
                    <TableCell>{r.designation || "—"}</TableCell>
                    <TableCell>{r.branch || "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.dateOfJoining || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.tenure}</TableCell>
                    <TableCell><EmployeeStatusPill status={r.status} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">{rows.length} joiner{rows.length === 1 ? "" : "s"}.</p>
    </div>
  );
}
