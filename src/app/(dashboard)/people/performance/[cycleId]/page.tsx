import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getCalibration } from "@/actions/hr-performance.actions";

export const metadata: Metadata = { title: "Calibration" };

export default async function CalibrationPage({ params }: { params: Promise<{ cycleId: string }> }) {
  if (!FEATURES.hr || !FEATURES.hrPerformance) notFound();
  const { cycleId } = await params;
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) redirect("/people");

  const { cycle, rows } = await getCalibration(cycleId);
  if (!cycle) notFound();

  return (
    <div className="space-y-6">
      <Link href="/people/performance" className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Performance
      </Link>
      <PageHeader
        title={`Calibration — ${cycle.name}`}
        description={`${formatDate(cycle.startDate)} – ${formatDate(cycle.endDate)}. Compare self vs manager ratings across the org to calibrate fairly.`}
      />
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-body text-muted-foreground">No goals or reviews recorded for this cycle yet.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Goals</TableHead>
                <TableHead className="text-right">Self</TableHead>
                <TableHead className="text-right">Manager</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employee.id}>
                  <TableCell className="font-medium">
                    <Link href={`/people/${r.employee.id}`} className="hover:underline">{r.employee.firstName} {r.employee.lastName}</Link>
                    <span className="ml-1.5 text-meta text-muted-foreground">{r.employee.empCode}</span>
                  </TableCell>
                  <TableCell className="text-body text-muted-foreground">{r.employee.department?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.goals}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.selfAvg ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{r.mgrRating ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
