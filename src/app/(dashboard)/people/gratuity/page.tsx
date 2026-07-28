import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Coins, BadgeCheck, Users, BadgeIndianRupee } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { getGratuityLedger } from "@/actions/hr-gratuity.actions";
import {
  formatInr,
  EMP_STATUS_HUE,
} from "@/app/(dashboard)/people/gratuity/_lib/gratuity-types";
import { GratuityNav } from "./_components/gratuity-nav";

export const metadata: Metadata = { title: "Gratuity Ledger" };

export default async function GratuityLedgerPage() {
  if (!FEATURES.hr || !FEATURES.hrPayroll) notFound();
  const session = await auth();
  // Self-guard: gratuity payout figures are compensation data → hr:payroll.
  if (!hasPermission(session?.user?.role ?? "", "hr:payroll")) redirect("/people");

  const rows = await getGratuityLedger();

  const eligible = rows.filter((r) => r.eligible);
  // Payable total counts only employees who are eligible AND have a salary
  // structure (projectedPayout != null). No-structure employees are excluded.
  const payableRows = eligible.filter((r) => r.projectedPayout != null);
  const totalPayable = payableRows.reduce((s, r) => s + (r.projectedPayout ?? 0), 0);
  const noStructureCount = rows.filter((r) => r.projectedPayout == null).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll"
        icon={Coins}
        accent="amber"
        title="Gratuity Ledger"
        description="Projected statutory gratuity for every employee — (15/26) × last-drawn basic × completed years, payable at 5+ years of service. Figures use the shared payroll calculator."
      />

      <GratuityNav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Employees" value={rows.length} accent="indigo" icon={<Users />} />
        <StatTile
          label="Eligible (5y+)"
          value={eligible.length}
          accent="emerald"
          icon={<BadgeCheck />}
          sub="At/above statutory minimum"
        />
        <StatTile
          label="Total payable today"
          value={formatInr(totalPayable)}
          accent="amber"
          icon={<BadgeIndianRupee />}
          sub={`${payableRows.length} eligible with a salary structure`}
        />
        <StatTile
          label="No salary structure"
          value={noStructureCount}
          accent={noStructureCount > 0 ? "rose" : "teal"}
          icon={<Coins />}
          sub="Excluded from payable total"
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-premium">
        <div className="border-b px-5 py-3.5">
          <h3 className="text-[14px] font-semibold">Gratuity by employee</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Projected payout is what would be owed if the employee separated today. Employees with no
            current salary structure show “—” and are excluded from the total.
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Coins />}
            title="No employees yet"
            description="Once employees are on record, their gratuity projection appears here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">DOJ</th>
                  <th className="px-3 py-2.5 text-right font-medium">Years</th>
                  <th className="px-3 py-2.5 font-medium">Eligible</th>
                  <th className="px-3 py-2.5 text-right font-medium">Last basic</th>
                  <th className="px-5 py-2.5 text-right font-medium">Projected payout</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">{r.empCode}</div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill
                        label={r.status.replace(/_/g, " ").toLowerCase()}
                        hue={EMP_STATUS_HUE[r.status] ?? "slate"}
                        size="xs"
                      />
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{r.doj ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.yearsOfService.toFixed(2)}</td>
                    <td className="px-3 py-3">
                      {r.eligible ? (
                        <StatusPill label="Eligible" hue="emerald" size="xs" />
                      ) : (
                        <StatusPill label="Not yet" hue="slate" size="xs" noDot />
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.lastBasic == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatInr(r.lastBasic)
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {r.projectedPayout == null ? (
                        <span className="font-normal text-muted-foreground">—</span>
                      ) : (
                        formatInr(r.projectedPayout)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-5 py-3" colSpan={6}>
                    Total payable (eligible, with salary structure)
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatInr(totalPayable)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
