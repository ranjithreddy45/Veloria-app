import type { Metadata } from "next";
import { PieChart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getHrLookups } from "@/actions/hr-employee.actions";
import {
  getClassificationReport, type ReportFilters, type ClassBucket,
} from "@/actions/hr-report-employee.actions";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/hr/constants";
import type { EmployeeStatus } from "@prisma/client";
import { guardEmployeeReports } from "../_components/guard";
import { ReportFilterBar } from "../_components/report-filter-bar";
import { ReportExportButton } from "../_components/report-export-button";

export const metadata: Metadata = { title: "Classification Report" };

const BASE = "/people/reports/employee/classification";
const HEADERS = ["Dimension", "Value", "Headcount", "% of total"];

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

export default async function ClassificationReport({ searchParams }: PageProps) {
  await guardEmployeeReports();
  const sp = await searchParams;
  const filters: ReportFilters = { entity: sp.entity, dept: sp.dept, desig: sp.desig, status: sp.status };

  const [lookups, report] = await Promise.all([
    getHrLookups(),
    getClassificationReport(filters),
  ]);

  const { total, byDepartment, byDesignation, byBranch, byStatus } = report;

  // Status buckets carry raw enum keys — label them for display + export.
  const statusLabelled: ClassBucket[] = byStatus.map((b) => ({
    key: EMPLOYEE_STATUS_LABELS[b.key as EmployeeStatus] ?? b.key,
    count: b.count,
  }));

  const dimensions: { title: string; buckets: ClassBucket[] }[] = [
    { title: "Department", buckets: byDepartment },
    { title: "Designation", buckets: byDesignation },
    { title: "Branch", buckets: byBranch },
    { title: "Status", buckets: statusLabelled },
  ];

  const exportRows = dimensions.flatMap((d) =>
    d.buckets.map((b) => [d.title, b.key, b.count, pct(b.count, total)])
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PieChart}
        accent="amber"
        eyebrow="People · Reports"
        title="Classification"
        description="Headcount pivoted by department, designation, branch and status. Filters narrow the population before counting."
      >
        <ReportExportButton filename="employee-classification" headers={HEADERS} rows={exportRows} />
      </PageHeader>

      <ReportFilterBar
        basePath={BASE}
        entities={lookups.entities}
        departments={lookups.departments}
        designations={lookups.designations}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total headcount" value={total} accent="gold" />
        <StatTile label="Departments" value={byDepartment.length} accent="blue" />
        <StatTile label="Designations" value={byDesignation.length} accent="teal" />
        <StatTile label="Branches" value={byBranch.length} accent="amber" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {dimensions.map((d) => (
          <Card key={d.title} className="overflow-hidden p-0">
            <div className="border-b px-4 py-2.5 text-sm font-semibold">By {d.title.toLowerCase()}</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{d.title}</TableHead>
                    <TableHead className="text-right">Headcount</TableHead>
                    <TableHead className="text-right">% of total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.buckets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        No data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    d.buckets.map((b) => (
                      <TableRow key={b.key}>
                        <TableCell className="font-medium">{b.key}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.count}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {pct(b.count, total)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
