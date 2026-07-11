import type { Metadata } from "next";
import { IdCard } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getHrLookups } from "@/actions/hr-employee.actions";
import { getEmployeeMasterReport, type ReportFilters } from "@/actions/hr-report-employee.actions";
import { guardEmployeeReports } from "../_components/guard";
import { ReportFilterBar } from "../_components/report-filter-bar";
import { ReportExportButton } from "../_components/report-export-button";
import { EmployeeStatusPill } from "../_components/status-pill";

export const metadata: Metadata = { title: "Employee Master" };

const BASE = "/people/reports/employee/master";
const HEADERS = [
  "Emp Code", "Name", "Gender", "DOB", "DOJ", "Department",
  "Designation", "Branch", "Work Email", "Personal Email", "Mobile", "Status",
];

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function EmployeeMasterReport({ searchParams }: PageProps) {
  await guardEmployeeReports();
  const sp = await searchParams;
  const filters: ReportFilters = { entity: sp.entity, dept: sp.dept, desig: sp.desig, status: sp.status };

  const [lookups, { rows }] = await Promise.all([
    getHrLookups(),
    getEmployeeMasterReport(filters),
  ]);

  const exportRows = rows.map((r) => [
    r.empCode, r.name, r.gender, r.dob, r.dateOfJoining, r.department,
    r.designation, r.branch, r.workEmail, r.personalEmail, r.phone, r.status,
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={IdCard}
        accent="violet"
        eyebrow="People · Reports"
        title="Employee Master"
        description="The full employee directory. Filter by branch, department, designation or status, then export to CSV."
      >
        <ReportExportButton filename="employee-master" headers={HEADERS} rows={exportRows} />
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
                <TableHead>Gender</TableHead>
                <TableHead>DOJ</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                    No employees match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.empCode}>
                    <TableCell className="font-mono text-xs">{r.empCode}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.gender || "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.dateOfJoining || "—"}</TableCell>
                    <TableCell>{r.department || "—"}</TableCell>
                    <TableCell>{r.designation || "—"}</TableCell>
                    <TableCell>{r.branch || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.workEmail || "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.phone || "—"}</TableCell>
                    <TableCell><EmployeeStatusPill status={r.status} /></TableCell>
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
