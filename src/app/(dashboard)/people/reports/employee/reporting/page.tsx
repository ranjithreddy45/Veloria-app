import type { Metadata } from "next";
import { Network } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getHrLookups } from "@/actions/hr-employee.actions";
import { getReportingReport, type ReportFilters } from "@/actions/hr-report-employee.actions";
import { guardEmployeeReports } from "../_components/guard";
import { ReportFilterBar } from "../_components/report-filter-bar";
import { ReportExportButton } from "../_components/report-export-button";

export const metadata: Metadata = { title: "Reporting Authority Report" };

const BASE = "/people/reports/employee/reporting";
const HEADERS = ["Emp Code", "Name", "Designation", "Department", "Branch", "Manager Code", "Reporting Manager"];

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ReportingReport({ searchParams }: PageProps) {
  await guardEmployeeReports();
  const sp = await searchParams;
  const filters: ReportFilters = { entity: sp.entity, dept: sp.dept, desig: sp.desig, status: sp.status };

  const [lookups, { rows }] = await Promise.all([
    getHrLookups(),
    getReportingReport(filters),
  ]);

  const exportRows = rows.map((r) => [
    r.empCode, r.name, r.designation, r.department, r.branch, r.managerCode, r.managerName,
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Network}
        accent="blue"
        eyebrow="People · Reports"
        title="Reporting Authority"
        description="Every employee mapped to their reporting manager. Filter by branch, department, designation or status."
      >
        <ReportExportButton filename="reporting-authority" headers={HEADERS} rows={exportRows} />
      </PageHeader>

      <ReportFilterBar
        basePath={BASE}
        entities={lookups.entities}
        departments={lookups.departments}
        designations={lookups.designations}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Reporting manager</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No employees match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.empCode}>
                    <TableCell className="font-mono text-xs">{r.empCode}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.designation || "—"}</TableCell>
                    <TableCell>{r.department || "—"}</TableCell>
                    <TableCell>{r.branch || "—"}</TableCell>
                    <TableCell>
                      {r.managerName ? (
                        <span>
                          {r.managerName}
                          {r.managerCode && (
                            <span className="ml-1.5 font-mono text-xs text-muted-foreground">{r.managerCode}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No manager</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">{rows.length} employee{rows.length === 1 ? "" : "s"}.</p>
    </div>
  );
}
