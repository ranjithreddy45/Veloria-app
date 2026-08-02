import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Wallet, Lock, BadgeIndianRupee } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { listPayrollRuns } from "@/actions/hr-payroll-run.actions";
import { NewRunButton } from "./_components/new-run-button";

export const metadata: Metadata = { title: "Payroll" };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const STATUS_HUE: Record<string, Hue> = { DRAFT: "amber", LOCKED: "indigo", PAID: "emerald" };

export default async function PayrollPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const runs = await listPayrollRuns();

  const paidRuns = runs.filter((r) => r.status === "PAID");
  const lastNet = paidRuns[0] ? Number(paidRuns[0].totalNet) : 0;
  const draftCount = runs.filter((r) => r.status === "DRAFT").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Run monthly payroll for the current-structure workforce, review the payslip register, then lock and mark paid."
      >
        <NewRunButton />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Payroll runs" value={runs.length} accent="indigo" icon={<Wallet />} />
        <StatTile label="Drafts open" value={draftCount} accent="amber" icon={<Lock />} sub="Awaiting compute / lock" />
        <StatTile label="Last paid net" value={inr(lastNet)} accent="emerald" icon={<BadgeIndianRupee />} sub={paidRuns[0]?.label ?? "—"} />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h3 className="text-copy font-semibold">Monthly runs</h3>
          <p className="text-detail text-muted-foreground">Latest first. Open a run to compute payslips and manage its lifecycle.</p>
        </div>
        {runs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No payroll runs yet. Start one with “New run”.
          </div>
        ) : (
          <div className="divide-y">
            {runs.map((r) => (
              <Link
                key={r.id}
                href={`/people/payroll/${r.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.label}</span>
                    <StatusPill label={r.status} hue={STATUS_HUE[r.status] ?? "slate"} size="xs" />
                  </div>
                  <span className="text-detail text-muted-foreground">
                    FY {r.fy} · {r.headcount} {r.headcount === 1 ? "employee" : "employees"}
                  </span>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="text-body font-semibold tabular-nums">{inr(Number(r.totalNet))}</div>
                  <div className="text-meta text-muted-foreground">net payable</div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
