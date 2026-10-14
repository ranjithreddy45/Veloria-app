import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, Eye, FileText, UserX, Receipt } from "lucide-react";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { buildPayslipMonths } from "@/lib/hr/payslip-feed";

export const metadata: Metadata = { title: "My Payslips" };

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
// shows, month by month, both kinds of payslip:
//   • computed by payroll — FINALISED runs only (LOCKED / PAID, never DRAFT),
//     downloaded from the branded PDF route;
//   • uploaded by HR (HrPayslipDocument) — the file itself, from
//     /api/hr/payslip-documents/[id].
// Both routes independently enforce ownership. Uploaded payslips were missing
// here entirely, so a payslip HR uploaded never reached the employee.
// ============================================================

export default async function MyPayslipsPage() {
  if (!FEATURES.hrPayroll) notFound();

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();

  const employee = await prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, empCode: true },
  });

  const [computed, uploaded] = employee
    ? await Promise.all([
        prisma.hrPayslip.findMany({
          where: {
            employeeId: employee.id,
            run: { status: { in: ["LOCKED", "PAID"] } },
          },
          select: {
            id: true,
            net: true,
            run: { select: { fy: true, month: true, label: true, status: true } },
          },
        }),
        // Metadata only — never the file bytes.
        prisma.hrPayslipDocument.findMany({
          where: { employeeId: employee.id },
          select: { id: true, year: true, month: true, fileName: true, mimeType: true, sizeBytes: true, note: true, updatedAt: true },
        }),
      ])
    : [[], []];

  const months = buildPayslipMonths(
    computed.map((p) => ({ id: p.id, net: Number(p.net), run: p.run })),
    uploaded,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        accent="emerald"
        eyebrow="My space"
        title="My Payslips"
        description="Your payslips, month by month — finalised by payroll or uploaded by HR. View or download any month."
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
      ) : months.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No payslips yet"
            description="Your payslips appear here as soon as HR uploads one or finalises (locks) a payroll run with your salary."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {months.map((m) => (
            <Card key={m.key} className="gap-4 p-5 transition-shadow hover:shadow-card-hover">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-copy font-semibold tracking-[-0.01em]">{m.label}</div>
                  <div className="numeric mt-0.5 text-detail text-muted-foreground">
                    {m.computed ? `FY ${m.computed.run.fy}${m.uploaded ? " · also uploaded by HR" : ""}` : "Uploaded by HR"}
                  </div>
                </div>
                {m.computed ? (
                  <StatusPill
                    label={m.computed.run.status === "PAID" ? "Paid" : "Finalised"}
                    hue={m.computed.run.status === "PAID" ? "emerald" : "teal"}
                    size="xs"
                  />
                ) : (
                  <StatusPill label="Uploaded" hue="indigo" size="xs" />
                )}
              </div>

              {m.computed && (
                <div className="mt-auto">
                  <div className="text-meta uppercase tracking-wide text-muted-foreground">Net pay</div>
                  <div className="numeric mt-1 text-h2 font-semibold leading-none">{inr.format(m.computed.net)}</div>
                </div>
              )}
              {!m.computed && m.uploaded?.note && (
                <p className="mt-auto text-detail text-muted-foreground">{m.uploaded.note}</p>
              )}

              <div className="mt-auto space-y-2">
                {m.computed && (
                  <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                    <a href={`/api/hr/payslips/${m.computed.id}/pdf`} target="_blank" rel="noopener noreferrer">
                      <Download className="size-4" /> Download PDF
                    </a>
                  </Button>
                )}
                {m.uploaded && (
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
                      <a href={`/api/hr/payslip-documents/${m.uploaded.id}`} target="_blank" rel="noopener noreferrer">
                        <Eye className="size-4" /> {m.computed ? "View uploaded" : "View"}
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
                      <a href={`/api/hr/payslip-documents/${m.uploaded.id}?download=1`}>
                        <Download className="size-4" /> Download
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
