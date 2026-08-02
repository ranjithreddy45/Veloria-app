import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, FileText, UserX, Receipt } from "lucide-react";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";

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
// ------------------------------------------------------------
// Lives outside the hr:read-gated /people tree so an ordinary employee can reach
// their own payslips. Resolves the signed-in user → their linked Employee, then
// lists payslips from FINALISED runs only (LOCKED / PAID — never DRAFT). Each
// slip links to the branded PDF route, which independently enforces ownership.
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
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        accent="emerald"
        eyebrow="My space"
        title="My Payslips"
        description="Your finalised payslips. Download any month as a print-ready PDF."
      >
        {employee && (
          <Button asChild variant="outline" className="gap-1.5">
            <a href={`/api/hr/form16/${employee.id}`} target="_blank" rel="noopener noreferrer">
              <FileText className="size-4" /> Download Form-16
            </a>
          </Button>
        )}
      </PageHeader>

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {payslips.map((p) => {
            const label = p.run.label || `${MONTHS[(p.run.month - 1 + 12) % 12]} ${p.run.fy}`;
            return (
              <Card key={p.id} className="gap-4 p-5 shadow-card transition-shadow hover:shadow-card-hover">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-copy font-semibold tracking-[-0.01em]">{label}</div>
                    <div className="numeric mt-0.5 text-detail text-muted-foreground">FY {p.run.fy}</div>
                  </div>
                  <StatusPill
                    label={p.run.status === "PAID" ? "Paid" : "Finalised"}
                    hue={p.run.status === "PAID" ? "emerald" : "teal"}
                    size="xs"
                  />
                </div>
                <div className="mt-auto">
                  <div className="text-meta uppercase tracking-wide text-muted-foreground">Net pay</div>
                  <div className="numeric mt-1 text-h2 font-semibold leading-none">
                    {inr.format(Number(p.net))}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                  <a href={`/api/hr/payslips/${p.id}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Download className="size-4" /> Download PDF
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
