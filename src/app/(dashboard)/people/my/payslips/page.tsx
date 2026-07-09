import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, FileText, UserX } from "lucide-react";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My Payslips" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// ============================================================
// Employee Self-Service — "My Payslips".
// Resolves the signed-in user → their linked Employee, then lists payslips
// from FINALISED runs only (LOCKED / PAID — never DRAFT). Each slip links to
// the branded PDF route, which independently enforces ownership.
// ============================================================

export default async function MyPayslipsPage() {
  if (!FEATURES.hrPayroll) notFound();

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();

  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true, firstName: true, lastName: true, empCode: true },
  });

  const payslips = employee
    ? await prisma.hrPayslip.findMany({
        where: {
          employeeId: employee.id,
          run: { status: { in: ["LOCKED", "PAID"] } },
        },
        select: {
          id: true,
          net: true,
          createdAt: true,
          run: { select: { fy: true, month: true, label: true, status: true } },
        },
        orderBy: [{ run: { fy: "desc" } }, { run: { month: "desc" } }],
      })
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        aura
        eyebrow="People · Self-Service"
        title="My Payslips"
        description="Your finalised payslips. Download any month as a print-ready PDF."
      />

      {employee && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={`/api/hr/form16/${employee.id}`} target="_blank" rel="noopener noreferrer">
              <FileText className="size-4" /> Download Form-16
            </a>
          </Button>
        </div>
      )}

      {!employee ? (
        <Card>
          <EmptyState
            icon={<UserX className="size-5" />}
            title="No employee profile linked"
            description="Your login isn't linked to an employee record yet. Please ask HR to connect your profile so your payslips can appear here."
          />
        </Card>
      ) : payslips.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No payslips yet"
            description="Once a payroll run for your salary is finalised, your payslips will appear here to download."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {payslips.map((p) => {
            const label = p.run.label || `${MONTHS[(p.run.month - 1 + 12) % 12]} ${p.run.fy}`;
            return (
              <Card key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">FY {p.run.fy}</div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    {p.run.status === "PAID" ? "Paid" : "Finalised"}
                  </span>
                </div>
                <div className="mt-auto">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Net Pay</div>
                  <div className="text-xl font-bold tabular-nums">{inr.format(Number(p.net))}</div>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                  <a href={`/api/hr/payslips/${p.id}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Download className="size-4" /> Download
                  </a>
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
