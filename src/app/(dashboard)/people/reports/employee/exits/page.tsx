import type { Metadata } from "next";
import { CalendarX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getHrLookups } from "@/actions/hr-employee.actions";
import { getExitReport, type ReportFilters } from "@/actions/hr-report-employee.actions";
import { guardEmployeeReports } from "../_components/guard";
import { ReportFilterBar } from "../_components/report-filter-bar";
import { ReportExportButton } from "../_components/report-export-button";

export const metadata: Metadata = { title: "Date of Leaving Report" };

const BASE = "/people/reports/employee/exits";
const HEADERS = ["Emp Code", "Name", "Department", "Designation", "Branch", "DOJ", "Exit Date", "Tenure at Exit"];

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ExitReport({ searchParams }: PageProps) {
  await guardEmployeeReports();
  const sp = await searchParams;
  // Status is fixed to EXITED for this report — no status filter here.
  const filters: ReportFilters = { entity: sp.entity, dept: sp.dept, desig: sp.desig };

  const [lookups, { rows }] = await Promise.all([
    getHrLookups(),
    getExitReport(filters, sp.from, sp.to),
  ]);

  const exportRows = rows.map((r) => [
    r.empCode, r.name, r.department, r.designation, r.branch, r.dateOfJoining, r.dateOfExit, r.tenureAtExit,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarX}
        accent="rose"
        eyebrow="People · Reports"
        title="Date of Leaving"
        description="Exited employees with exit date and tenure at exit. Filter by exit-date range, branch, department or designation."
      >
        <ReportExportButton filename="employee-exits" headers={HEADERS} rows={exportRows} />
      </PageHeader>

      <ReportFilterBar
        basePath={BASE}
        entities={lookups.entities}
        departments={lookups.departments}
        designations={lookups.designations}
        showStatus={false}
        showDateRange
        dateLabel="Exit date"
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
                <TableHead>Exit date</TableHead>
                <TableHead className="text-right">Tenure at exit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No exits match these filters.
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
                    <TableCell className="tabular-nums">{r.dateOfExit || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.tenureAtExit}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">{rows.length} exit{rows.length === 1 ? "" : "s"}.</p>
    </div>
  );
}
