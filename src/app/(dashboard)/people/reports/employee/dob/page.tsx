import type { Metadata } from "next";
import Link from "next/link";
import { Cake } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getHrLookups } from "@/actions/hr-employee.actions";
import { getDobReport, type ReportFilters } from "@/actions/hr-report-employee.actions";
import { guardEmployeeReports } from "../_components/guard";
import { ReportFilterBar } from "../_components/report-filter-bar";
import { ReportExportButton } from "../_components/report-export-button";

export const metadata: Metadata = { title: "Date of Birth Report" };

const BASE = "/people/reports/employee/dob";
const HEADERS = ["Emp Code", "Name", "Department", "Branch", "DOB", "Birthday", "Days Until", "Turning"];
const WINDOWS = [30, 60, 90] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function DobReport({ searchParams }: PageProps) {
  await guardEmployeeReports();
  const sp = await searchParams;
  const filters: ReportFilters = { entity: sp.entity, dept: sp.dept, desig: sp.desig, status: sp.status };
  const windowDays = sp.window ? parseInt(sp.window, 10) : 30;

  const [lookups, { rows, window }] = await Promise.all([
    getHrLookups(),
    getDobReport(filters, windowDays),
  ]);

  const exportRows = rows.map((r) => [
    r.empCode, r.name, r.department, r.branch, r.dob, r.birthday, r.daysUntil, r.turningAge,
  ]);

  // Preserve active filters when switching the window.
  const windowHref = (w: number) => {
    const q = new URLSearchParams();
    if (filters.entity) q.set("entity", filters.entity);
    if (filters.dept) q.set("dept", filters.dept);
    if (filters.desig) q.set("desig", filters.desig);
    if (filters.status) q.set("status", filters.status);
    q.set("window", String(w));
    return `${BASE}?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Cake}
        accent="pink"
        eyebrow="People · Reports"
        title="Date of Birth"
        description="Upcoming birthdays, sorted by how soon they fall. Computed in UTC so a date never slips a day."
      >
        <ReportExportButton filename="employee-birthdays" headers={HEADERS} rows={exportRows} />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportFilterBar
          basePath={BASE}
          entities={lookups.entities}
          departments={lookups.departments}
          designations={lookups.designations}
        />
        <div className="inline-flex overflow-hidden rounded-lg border">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={windowHref(w)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                window === w ? "bg-pink-500/15 text-pink-600 dark:text-pink-300" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {w} days
            </Link>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Birthday</TableHead>
                <TableHead className="text-right">Days until</TableHead>
                <TableHead className="text-right">Turning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No birthdays in the next {window} days for these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.empCode}>
                    <TableCell className="font-mono text-xs">{r.empCode}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.department || "—"}</TableCell>
                    <TableCell>{r.branch || "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.birthday}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.daysUntil === 0 ? "Today 🎂" : `${r.daysUntil}d`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.turningAge}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        {rows.length} birthday{rows.length === 1 ? "" : "s"} in the next {window} days.
      </p>
    </div>
  );
}
